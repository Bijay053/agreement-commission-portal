from datetime import date, timedelta
from collections import defaultdict
from django.db.models import Q, Count
from rest_framework.views import APIView
from rest_framework.response import Response
from core.permissions import require_auth, require_permission
from core.models import Country
from providers.models import Provider
from audit.models import AuditLog
from core.status_history import record_status_change
from core.pagination import StandardPagination
from core.field_permissions import filter_fields, filter_fields_list
from core.object_permissions import filter_agreements_by_territory, can_access_agreement
from .models import Agreement, AgreementTerritory
from documents.models import AgreementDocument as Document
from accounts.models import User


def _build_provider_and_country_lookups(provider_ids):
    providers = {p.id: p for p in Provider.objects.filter(id__in=provider_ids)}
    country_ids = {p.country_id for p in providers.values() if p.country_id}
    countries = {c.id: c.name for c in Country.objects.filter(id__in=country_ids)} if country_ids else {}
    return providers, countries


def _build_territory_lookup(agreement_ids):
    raw = defaultdict(list)
    for t in AgreementTerritory.objects.filter(agreement_id__in=agreement_ids):
        raw[t.agreement_id].append(t.country_id)
    all_country_ids = set()
    for cids in raw.values():
        all_country_ids.update(cids)
    country_names = {c.id: c.name for c in Country.objects.filter(id__in=all_country_ids)} if all_country_ids else {}
    territories = {}
    for aid, cids in raw.items():
        territories[aid] = [{'id': cid, 'name': country_names.get(cid, '')} for cid in cids]
    return territories


def agreement_to_dict(a, providers_lookup=None, countries_lookup=None, territories_lookup=None):
    provider_name = None
    country_name = None
    if providers_lookup is not None:
        provider = providers_lookup.get(a.university_id)
        if provider:
            provider_name = provider.name
            if provider.country_id and countries_lookup is not None:
                country_name = countries_lookup.get(provider.country_id)
    else:
        try:
            provider = Provider.objects.get(id=a.university_id)
            provider_name = provider.name
            if provider.country_id:
                try:
                    country_name = Country.objects.get(id=provider.country_id).name
                except Country.DoesNotExist:
                    pass
        except Provider.DoesNotExist:
            pass

    if territories_lookup is not None:
        territories = territories_lookup.get(a.id, [])
    else:
        terr_ids = list(AgreementTerritory.objects.filter(agreement_id=a.id).values_list('country_id', flat=True))
        if terr_ids:
            cnames = {c.id: c.name for c in Country.objects.filter(id__in=terr_ids)}
            territories = [{'id': cid, 'name': cnames.get(cid, '')} for cid in terr_ids]
        else:
            territories = []

    return {
        'id': a.id,
        'universityId': a.university_id,
        'universityName': provider_name,
        'countryName': country_name,
        'agreementCode': a.agreement_code,
        'title': a.title,
        'agreementType': a.agreement_type,
        'status': a.status,
        'territoryType': a.territory_type,
        'territoryCountryId': a.territory_country_id,
        'territoryCountryIds': [t['id'] for t in territories],
        'territories': territories,
        'startDate': str(a.start_date) if a.start_date else None,
        'expiryDate': str(a.expiry_date) if a.expiry_date else None,
        'autoRenew': a.auto_renew,
        'confidentialityLevel': a.confidentiality_level,
        'internalNotes': a.internal_notes,
        'createdByUserId': a.created_by_user_id,
        'updatedByUserId': a.updated_by_user_id,
        'createdAt': a.created_at.isoformat() if a.created_at else None,
        'updatedAt': a.updated_at.isoformat() if a.updated_at else None,
    }


def _agreements_to_dicts(agreements):
    agreement_list = list(agreements)
    if not agreement_list:
        return []
    agreement_ids = [a.id for a in agreement_list]
    provider_ids = set(a.university_id for a in agreement_list if a.university_id)
    providers_lookup, countries_lookup = _build_provider_and_country_lookups(provider_ids)
    territories_lookup = _build_territory_lookup(agreement_ids)
    return [agreement_to_dict(a, providers_lookup, countries_lookup, territories_lookup) for a in agreement_list]


class AgreementListView(APIView):
    pagination_class = StandardPagination

    @require_permission("agreement.view")
    def get(self, request):
        qs = Agreement.objects.all()
        user_id = request.session.get('userId')
        qs = filter_agreements_by_territory(qs, user_id)
        status = request.query_params.get('status')
        country_id = request.query_params.get('countryId')
        provider_country_id = request.query_params.get('providerCountryId')
        provider_id = request.query_params.get('providerId')
        search = request.query_params.get('search')

        if status:
            qs = qs.filter(status=status)
        if provider_id:
            qs = qs.filter(university_id=int(provider_id))
        if provider_country_id:
            provider_ids = Provider.objects.filter(country_id=int(provider_country_id)).values_list('id', flat=True)
            qs = qs.filter(university_id__in=provider_ids)
        if country_id:
            territory_agreement_ids = AgreementTerritory.objects.filter(country_id=int(country_id)).values_list('agreement_id', flat=True)
            qs = qs.filter(Q(territory_country_id=int(country_id)) | Q(id__in=territory_agreement_ids))
        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(agreement_code__icontains=search))

        qs = qs.order_by('-created_at')
        user_perms = request.session.get('userPermissions', [])
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request)
        if page is not None:
            data = filter_fields_list(_agreements_to_dicts(page), 'agreement', user_perms)
            return paginator.get_paginated_response(data)
        return Response(filter_fields_list(_agreements_to_dicts(qs), 'agreement', user_perms))

    @require_permission("agreement.create")
    def post(self, request):
        try:
            data = request.data.copy()
            territory_country_ids = data.pop('territoryCountryIds', [])
            territory_type = data.get('territoryType', 'country_specific')

            university_id = int(data.get('universityId', 0))
            agreement_type = data.get('agreementType', '')
            start_date_str = data.get('startDate', '')

            dup = Agreement.objects.filter(
                university_id=university_id,
                agreement_type=agreement_type,
                start_date=start_date_str,
            )
            if territory_country_ids:
                existing_ids = set()
                for a in dup:
                    terr_ids = set(AgreementTerritory.objects.filter(agreement_id=a.id).values_list('country_id', flat=True))
                    if terr_ids == set(territory_country_ids):
                        existing_ids.add(a.id)
                if existing_ids:
                    return Response({'message': 'Agreement already exists for this provider, type, start date, and territory.'}, status=409)

            initial_status = data.get('status', 'draft')
            agreement = Agreement.objects.create(
                university_id=university_id,
                agreement_code=data.get('agreementCode', ''),
                title=data.get('title', ''),
                agreement_type=agreement_type,
                status=initial_status,
                territory_type=territory_type,
                territory_country_id=territory_country_ids[0] if territory_country_ids else None,
                start_date=start_date_str,
                expiry_date=data.get('expiryDate', ''),
                auto_renew=data.get('autoRenew', False),
                confidentiality_level='high',
                internal_notes=data.get('internalNotes'),
                created_by_user_id=request.session.get('userId'),
                updated_by_user_id=request.session.get('userId'),
            )

            if territory_type not in ('global', 'south_asia') and territory_country_ids:
                for cid in territory_country_ids:
                    AgreementTerritory.objects.create(agreement_id=agreement.id, country_id=cid)

            record_status_change('agreement', agreement.id, None, initial_status, request.session.get('userId'), notes='Agreement created')

            AuditLog.objects.create(
                user_id=request.session.get('userId'),
                action='AGREEMENT_CREATE',
                entity_type='agreement',
                entity_id=agreement.id,
                ip_address=request.META.get('REMOTE_ADDR'),
            )
            user_perms = request.session.get('userPermissions', [])
            return Response(filter_fields(agreement_to_dict(agreement), 'agreement', user_perms))
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class AgreementDetailView(APIView):
    @require_permission("agreement.view")
    def get(self, request, agreement_id):
        try:
            a = Agreement.objects.get(id=agreement_id)
        except Agreement.DoesNotExist:
            return Response({'message': 'Agreement not found'}, status=404)
        user_id = request.session.get('userId')
        if not can_access_agreement(user_id, a):
            return Response({'message': 'Access denied'}, status=403)
        user_perms = request.session.get('userPermissions', [])
        return Response(filter_fields(agreement_to_dict(a), 'agreement', user_perms))

    @require_permission("agreement.edit")
    def patch(self, request, agreement_id):
        try:
            try:
                a = Agreement.objects.get(id=agreement_id)
            except Agreement.DoesNotExist:
                return Response({'message': 'Agreement not found'}, status=404)

            data = request.data.copy()
            territory_country_ids = data.pop('territoryCountryIds', None)
            old_status = a.status

            field_map = {
                'universityId': 'university_id', 'agreementCode': 'agreement_code',
                'title': 'title', 'agreementType': 'agreement_type', 'status': 'status',
                'territoryType': 'territory_type', 'startDate': 'start_date',
                'expiryDate': 'expiry_date', 'autoRenew': 'auto_renew',
                'internalNotes': 'internal_notes',
            }

            for js_field, db_field in field_map.items():
                if js_field in data:
                    setattr(a, db_field, data[js_field])

            if data.get('territoryType') == 'country_specific' and territory_country_ids:
                a.territory_country_id = territory_country_ids[0] if territory_country_ids else None
            elif data.get('territoryType') in ('global', 'south_asia'):
                a.territory_country_id = None

            a.confidentiality_level = 'high'
            a.updated_by_user_id = request.session.get('userId')
            a.save()

            if territory_country_ids is not None:
                AgreementTerritory.objects.filter(agreement_id=agreement_id).delete()
                if data.get('territoryType') not in ('global', 'south_asia'):
                    for cid in territory_country_ids:
                        AgreementTerritory.objects.create(agreement_id=agreement_id, country_id=cid)

            if 'status' in data:
                record_status_change('agreement', agreement_id, old_status, a.status, request.session.get('userId'))

            AuditLog.objects.create(
                user_id=request.session.get('userId'),
                action='AGREEMENT_EDIT',
                entity_type='agreement',
                entity_id=agreement_id,
                ip_address=request.META.get('REMOTE_ADDR'),
            )
            user_perms = request.session.get('userPermissions', [])
            return Response(filter_fields(agreement_to_dict(a), 'agreement', user_perms))
        except Exception as e:
            return Response({'message': str(e)}, status=500)

    @require_permission("agreement.delete")
    def delete(self, request, agreement_id):
        try:
            try:
                a = Agreement.objects.get(id=agreement_id)
            except Agreement.DoesNotExist:
                return Response({'message': 'Agreement not found'}, status=404)
            a.delete()
            AuditLog.objects.create(
                user_id=request.session.get('userId'),
                action='AGREEMENT_DELETE',
                entity_type='agreement',
                entity_id=agreement_id,
                ip_address=request.META.get('REMOTE_ADDR'),
            )
            return Response({'message': 'Deleted'})
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class AgreementExportView(APIView):
    @require_permission("agreement.view")
    def get(self, request):
        qs = Agreement.objects.all()
        user_id = request.session.get('userId')
        qs = filter_agreements_by_territory(qs, user_id)
        status = request.query_params.get('status')
        if status:
            qs = qs.filter(status=status)
        qs = qs.order_by('-created_at')
        data = _agreements_to_dicts(qs)
        headers = [
            'ID', 'Agreement Code', 'Title', 'Provider', 'Country',
            'Type', 'Status', 'Start Date', 'Expiry Date', 'Auto Renew',
            'Territory Type', 'Created At',
        ]
        rows = []
        for d in data:
            rows.append([
                d.get('id'), d.get('agreementCode'), d.get('title'),
                d.get('universityName'), d.get('countryName'),
                d.get('agreementType'), d.get('status'),
                d.get('startDate'), d.get('expiryDate'),
                d.get('autoRenew'), d.get('territoryType'),
                d.get('createdAt'),
            ])
        from core.exports import export_data
        return export_data(request, 'agreements_export', headers, rows, 'Agreements')


class AgreementStatusCountsView(APIView):
    @require_permission("agreement.view")
    def get(self, request):
        counts = {}
        for status in ['draft', 'active', 'expired', 'terminated', 'renewal_in_progress']:
            counts[status] = Agreement.objects.filter(status=status).count()
        return Response(counts)


class AgreementAlertsView(APIView):
    @require_permission("agreement.view")
    def get(self, request):
        try:
            qs = Agreement.objects.filter(status__in=['active', 'renewal_in_progress', 'expired'])
            user_id = request.session.get('userId')
            qs = filter_agreements_by_territory(qs, user_id)
            agreements = list(qs)
            today = date.today()
            provider_filter = request.query_params.get('provider')
            country_filter = request.query_params.get('country')
            status_filter = request.query_params.get('status')

            provider_ids = set(a.university_id for a in agreements if a.university_id)
            providers_lookup, countries_lookup = _build_provider_and_country_lookups(provider_ids)

            results = []
            for a in agreements:
                provider = providers_lookup.get(a.university_id)
                if not provider:
                    continue

                country_name = countries_lookup.get(provider.country_id, 'N/A') if provider.country_id else 'N/A'

                days_until = (a.expiry_date - today).days

                if a.status == 'renewal_in_progress' and days_until < 0:
                    urgency = 'renewal_pending'
                elif days_until < 0:
                    urgency = 'expired'
                elif days_until <= 30:
                    urgency = 'critical'
                elif days_until <= 90:
                    urgency = 'warning'
                else:
                    continue

                item = {
                    'id': a.id, 'title': a.title, 'agreementCode': a.agreement_code,
                    'status': a.status, 'startDate': str(a.start_date), 'expiryDate': str(a.expiry_date),
                    'universityName': provider.name, 'universityId': provider.id,
                    'countryName': country_name, 'countryId': provider.country_id,
                    'daysUntilExpiry': days_until, 'urgency': urgency,
                }

                if provider_filter and provider_filter.lower() not in provider.name.lower():
                    continue
                if country_filter and country_name != country_filter:
                    continue
                if status_filter and urgency != status_filter:
                    continue

                results.append(item)

            results.sort(key=lambda x: x['daysUntilExpiry'])

            summary = {
                'expiring90': len([a for a in results if a['urgency'] == 'warning']),
                'expiring30': len([a for a in results if a['urgency'] == 'critical']),
                'expired': len([a for a in results if a['urgency'] == 'expired']),
                'renewalPending': len([a for a in results if a['urgency'] == 'renewal_pending']),
            }

            return Response({'alerts': results, 'summary': summary})
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class AgreementAuditView(APIView):
    @require_permission("audit.view")
    def get(self, request, agreement_id):
        try:
            doc_ids = list(Document.objects.filter(agreement_id=agreement_id).values_list('id', flat=True))

            qs = AuditLog.objects.filter(
                Q(entity_type='agreement', entity_id=agreement_id) |
                Q(entity_type='document', entity_id__in=doc_ids) |
                Q(entity_type='commission', entity_id=agreement_id) |
                Q(entity_type='target', entity_id=agreement_id) |
                Q(entity_type='contact', entity_id=agreement_id)
            ).order_by('-created_at')[:200]

            user_cache = {}
            results = []
            for l in qs:
                if l.user_id and l.user_id not in user_cache:
                    try:
                        u = User.objects.get(id=l.user_id)
                        user_cache[l.user_id] = u.full_name
                    except User.DoesNotExist:
                        user_cache[l.user_id] = None
                results.append({
                    'id': l.id, 'userId': l.user_id, 'action': l.action,
                    'entityType': l.entity_type, 'entityId': l.entity_id,
                    'ipAddress': l.ip_address, 'metadata': l.metadata,
                    'createdAt': l.created_at.isoformat() if l.created_at else None,
                    'userName': user_cache.get(l.user_id),
                })
            return Response(results)
        except Exception as e:
            return Response({'message': str(e)}, status=500)
