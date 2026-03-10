from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Q
from core.permissions import require_permission
from core.models import Country
from providers.models import Provider
from agreements.models import Agreement
from .models import AgreementContact


def contact_to_dict(c):
    country_name = None
    if c.country_id:
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

            result = []
            for c in qs.order_by('full_name'):
                d = contact_to_dict(c)
                try:
                    agr = Agreement.objects.get(id=c.agreement_id)
                    d['agreementCode'] = agr.agreement_code
                    d['agreementTitle'] = agr.title
                    try:
                        prov = Provider.objects.get(id=agr.university_id)
                        d['providerName'] = prov.name
                    except Provider.DoesNotExist:
                        d['providerName'] = None
                except Agreement.DoesNotExist:
                    pass
                result.append(d)
            return Response(result)
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class AgreementContactsView(APIView):
    @require_permission("contacts.view")
    def get(self, request, agreement_id):
        contacts = AgreementContact.objects.filter(agreement_id=agreement_id).order_by('full_name')
        return Response([contact_to_dict(c) for c in contacts])

    @require_permission("contacts.create")
    def post(self, request, agreement_id):
        try:
            c = AgreementContact.objects.create(
                agreement_id=agreement_id,
                full_name=request.data.get('fullName', ''),
                position_title=request.data.get('positionTitle'),
                phone=request.data.get('phone'),
                email=request.data.get('email'),
                country_id=request.data.get('countryId'),
                city=request.data.get('city'),
                is_primary=request.data.get('isPrimary', False),
                notes=request.data.get('notes'),
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
            field_map = {
                'fullName': 'full_name', 'positionTitle': 'position_title',
                'phone': 'phone', 'email': 'email', 'countryId': 'country_id',
                'city': 'city', 'isPrimary': 'is_primary', 'notes': 'notes',
            }
            for js_field, db_field in field_map.items():
                if js_field in request.data:
                    setattr(c, db_field, request.data[js_field])
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
