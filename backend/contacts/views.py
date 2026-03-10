from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Q
from core.permissions import require_permission
from core.pagination import StandardPagination
from core.models import Country
from providers.models import Provider
from agreements.models import Agreement
from .models import AgreementContact


def contact_to_dict(c, countries_lookup=None):
    country_name = None
    if c.country_id:
        if countries_lookup is not None:
            country_name = countries_lookup.get(c.country_id)
        else:
            try:
                country_name = Country.objects.get(id=c.country_id).name
            except Country.DoesNotExist:
                pass
    return {
        'id': c.id, 'agreementId': c.agreement_id, 'fullName': c.full_name,
        'positionTitle': c.position_title, 'phone': c.phone, 'email': c.email,
        'countryId': c.country_id, 'countryName': country_name,
        'city': c.city, 'isPrimary': c.is_primary, 'notes': c.notes,
        'createdAt': c.created_at.isoformat() if c.created_at else None,
        'updatedAt': c.updated_at.isoformat() if c.updated_at else None,
    }


class AllContactsView(APIView):
    pagination_class = StandardPagination

    @require_permission("contacts.view")
    def get(self, request):
        try:
            qs = AgreementContact.objects.all()
            q = request.query_params.get('q')
            provider_id = request.query_params.get('providerId')
            provider_country_id = request.query_params.get('providerCountryId')
            contact_country_id = request.query_params.get('contactCountryId')
            agreement_status = request.query_params.get('agreementStatus')

            if q:
                qs = qs.filter(Q(full_name__icontains=q) | Q(email__icontains=q) | Q(phone__icontains=q))
            if provider_id:
                agreement_ids = Agreement.objects.filter(university_id=int(provider_id)).values_list('id', flat=True)
                qs = qs.filter(agreement_id__in=agreement_ids)
            if provider_country_id:
                prov_ids = Provider.objects.filter(country_id=int(provider_country_id)).values_list('id', flat=True)
                agr_ids = Agreement.objects.filter(university_id__in=prov_ids).values_list('id', flat=True)
                qs = qs.filter(agreement_id__in=agr_ids)
            if contact_country_id:
                qs = qs.filter(country_id=int(contact_country_id))
            if agreement_status:
                agr_ids = Agreement.objects.filter(status=agreement_status).values_list('id', flat=True)
                qs = qs.filter(agreement_id__in=agr_ids)

            qs = qs.order_by('full_name')

            paginator = self.pagination_class()
            page = paginator.paginate_queryset(qs, request)
            contacts = page if page is not None else list(qs)

            country_ids = set(c.country_id for c in contacts if c.country_id)
            countries_lookup = {c.id: c.name for c in Country.objects.filter(id__in=country_ids)} if country_ids else {}

            agreement_ids = set(c.agreement_id for c in contacts if c.agreement_id)
            agreements_lookup = {a.id: a for a in Agreement.objects.filter(id__in=agreement_ids)} if agreement_ids else {}

            provider_ids = set(a.university_id for a in agreements_lookup.values() if a.university_id)
            providers_lookup = {p.id: p for p in Provider.objects.filter(id__in=provider_ids)} if provider_ids else {}

            result = []
            for c in contacts:
                d = contact_to_dict(c, countries_lookup)
                agr = agreements_lookup.get(c.agreement_id)
                if agr:
                    d['agreementCode'] = agr.agreement_code
                    d['agreementTitle'] = agr.title
                    prov = providers_lookup.get(agr.university_id)
                    d['providerName'] = prov.name if prov else None
                result.append(d)

            if page is not None:
                return paginator.get_paginated_response(result)
            return Response(result)
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class AgreementContactsView(APIView):
    @require_permission("contacts.view")
    def get(self, request, agreement_id):
        contacts = list(AgreementContact.objects.filter(agreement_id=agreement_id).order_by('full_name'))
        country_ids = set(c.country_id for c in contacts if c.country_id)
        countries_lookup = {c.id: c.name for c in Country.objects.filter(id__in=country_ids)} if country_ids else {}
        return Response([contact_to_dict(c, countries_lookup) for c in contacts])

    @require_permission("contacts.create")
    def post(self, request, agreement_id):
        try:
            email = request.data.get('email', '').strip()
            if email:
                existing = AgreementContact.objects.filter(agreement_id=agreement_id, email__iexact=email).first()
                if existing:
                    return Response({'message': f'A contact with email "{email}" already exists for this agreement'}, status=409)
            import re
            phone = request.data.get('phone', '')
            if phone and not re.match(r'^[\d\s\+\-\(\)\.]+$', phone):
                return Response({'message': 'Phone number can only contain digits, spaces, +, -, (, ) and .'}, status=400)
            user_id = request.session.get('userId')
            c = AgreementContact.objects.create(
                agreement_id=agreement_id,
                full_name=request.data.get('fullName', ''),
                position_title=request.data.get('positionTitle'),
                phone=request.data.get('phone'),
                email=email,
                country_id=request.data.get('countryId'),
                city=request.data.get('city'),
                is_primary=request.data.get('isPrimary', False),
                notes=request.data.get('notes'),
                created_by_user_id=user_id,
                updated_by_user_id=user_id,
            )
            return Response(contact_to_dict(c))
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class ContactDetailView(APIView):
    @require_permission("contacts.edit")
    def patch(self, request, contact_id):
        try:
            try:
                c = AgreementContact.objects.get(id=contact_id)
            except AgreementContact.DoesNotExist:
                return Response({'message': 'Contact not found'}, status=404)
            new_email = request.data.get('email', '').strip() if 'email' in request.data else None
            if new_email and new_email.lower() != (c.email or '').lower():
                existing = AgreementContact.objects.filter(agreement_id=c.agreement_id, email__iexact=new_email).exclude(id=contact_id).first()
                if existing:
                    return Response({'message': f'A contact with email "{new_email}" already exists for this agreement'}, status=409)
            import re
            phone = request.data.get('phone') if 'phone' in request.data else None
            if phone and not re.match(r'^[\d\s\+\-\(\)\.]+$', phone):
                return Response({'message': 'Phone number can only contain digits, spaces, +, -, (, ) and .'}, status=400)
            field_map = {
                'fullName': 'full_name', 'positionTitle': 'position_title',
                'phone': 'phone', 'email': 'email', 'countryId': 'country_id',
                'city': 'city', 'isPrimary': 'is_primary', 'notes': 'notes',
            }
            for js_field, db_field in field_map.items():
                if js_field in request.data:
                    setattr(c, db_field, request.data[js_field])
            c.updated_by_user_id = request.session.get('userId')
            c.save()
            return Response(contact_to_dict(c))
        except Exception as e:
            return Response({'message': str(e)}, status=500)

    @require_permission("contacts.delete")
    def delete(self, request, contact_id):
        try:
            AgreementContact.objects.filter(id=contact_id).delete()
            return Response({'message': 'Deleted'})
        except Exception as e:
            return Response({'message': str(e)}, status=500)
