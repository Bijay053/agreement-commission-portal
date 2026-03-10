from datetime import date, timedelta
from django.db.models import Q, Count
from rest_framework.views import APIView
from rest_framework.response import Response
from core.permissions import require_auth, require_permission
from core.models import Country
from providers.models import Provider
from audit.models import AuditLog
from .models import Agreement, AgreementTerritory


def agreement_to_dict(a):
    provider_name = None
    country_name = None
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

    territories = list(AgreementTerritory.objects.filter(agreement_id=a.id).values_list('country_id', flat=True))

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
        'territoryCountryIds': territories,
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


class AgreementListView(APIView):
    @require_permission("agreement.view")
    def get(self, request):
        qs = Agreement.objects.all()
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

        return Response([agreement_to_dict(a) for a in qs.order_by('-created_at')])

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

            agreement = Agreement.objects.create(
                university_id=university_id,
                agreement_code=data.get('agreementCode', ''),
                title=data.get('title', ''),
                agreement_type=agreement_type,
                status=data.get('status', 'draft'),
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

            if territory_type == 'country_specific' and territory_country_ids:
                for cid in territory_country_ids:
                    AgreementTerritory.objects.create(agreement_id=agreement.id, country_id=cid)

            AuditLog.objects.create(
                user_id=request.session.get('userId'),
                action='AGREEMENT_CREATE',
                entity_type='agreement',
                entity_id=agreement.id,
                ip_address=request.META.get('REMOTE_ADDR'),
            )
            return Response(agreement_to_dict(agreement))
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class AgreementDetailView(APIView):
    @require_permission("agreement.view")
    def get(self, request, agreement_id):
        try:
            a = Agreement.objects.get(id=agreement_id)
        except Agreement.DoesNotExist:
            return Response({'message': 'Agreement not found'}, status=404)
        return Response(agreement_to_dict(a))

    @require_permission("agreement.edit")
    def patch(self, request, agreement_id):
        try:
            try:
                a = Agreement.objects.get(id=agreement_id)
            except Agreement.DoesNotExist:
                return Response({'message': 'Agreement not found'}, status=404)

            data = request.data.copy()
            territory_country_ids = data.pop('territoryCountryIds', None)

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
            elif data.get('territoryType') == 'global':
                a.territory_country_id = None

            a.confidentiality_level = 'high'
            a.updated_by_user_id = request.session.get('userId')
            a.save()

            if territory_country_ids is not None:
                AgreementTerritory.objects.filter(agreement_id=agreement_id).delete()
                if data.get('territoryType') != 'global':
                    for cid in territory_country_ids:
                        AgreementTerritory.objects.create(agreement_id=agreement_id, country_id=cid)

            AuditLog.objects.create(
                user_id=request.session.get('userId'),
                action='AGREEMENT_EDIT',
                entity_type='agreement',
                entity_id=agreement_id,
                ip_address=request.META.get('REMOTE_ADDR'),
            )
            return Response(agreement_to_dict(a))
        except Exception as e:
            return Response({'message': str(e)}, status=500)

    @require_permission("agreement.delete")
    def delete(self, request, agreement_id):
        try:
            Agreement.objects.filter(id=agreement_id).delete()
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
            agreements = Agreement.objects.filter(status__in=['active', 'renewal_in_progress', 'expired'])
            today = date.today()
            provider_filter = request.query_params.get('provider')
            country_filter = request.query_params.get('country')
            status_filter = request.query_params.get('status')

            results = []
            for a in agreements:
                try:
                    provider = Provider.objects.get(id=a.university_id)
                    country_name = 'N/A'
                    if provider.country_id:
                        try:
                            country_name = Country.objects.get(id=provider.country_id).name
                        except Country.DoesNotExist:
                            pass
                except Provider.DoesNotExist:
                    continue

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
