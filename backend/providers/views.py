from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Q
from core.permissions import require_auth, require_permission
from core.models import Country
from .models import Provider


def provider_to_dict(p):
    country_name = None
    if p.country_id:
        try:
            country_name = Country.objects.get(id=p.country_id).name
        except Country.DoesNotExist:
            pass
    return {
        'id': p.id,
        'name': p.name,
        'providerType': p.provider_type,
        'countryId': p.country_id,
        'countryName': country_name,
        'website': p.website,
        'notes': p.notes,
        'status': p.status,
        'createdAt': p.created_at.isoformat() if p.created_at else None,
        'updatedAt': p.updated_at.isoformat() if p.updated_at else None,
    }


class ProviderListView(APIView):
    @require_auth
    def get(self, request):
        qs = Provider.objects.all()
        status = request.query_params.get('status')
        provider_type = request.query_params.get('providerType')
        country_id = request.query_params.get('countryId')
        search = request.query_params.get('search')
        if status:
            qs = qs.filter(status=status)
        if provider_type:
            qs = qs.filter(provider_type=provider_type)
        if country_id:
            qs = qs.filter(country_id=int(country_id))
        if search:
            qs = qs.filter(name__icontains=search)
        return Response([provider_to_dict(p) for p in qs.order_by('name')])

    @require_permission("providers.provider.add")
    def post(self, request):
        try:
            name = request.data.get('name', '')
            country_id = request.data.get('countryId')
            dup = Provider.objects.filter(name__iexact=name)
            if country_id:
                dup = dup.filter(country_id=country_id)
            if dup.exists():
                return Response({'message': 'A provider with this name and country already exists'}, status=409)
            p = Provider.objects.create(
                name=name,
                provider_type=request.data.get('providerType', 'university'),
                country_id=country_id,
                website=request.data.get('website'),
                notes=request.data.get('notes'),
                status=request.data.get('status', 'active'),
            )
            return Response(provider_to_dict(p))
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class ProviderDetailView(APIView):
    @require_auth
    def get(self, request, provider_id):
        try:
            p = Provider.objects.get(id=provider_id)
        except Provider.DoesNotExist:
            return Response({'message': 'Provider not found'}, status=404)
        return Response(provider_to_dict(p))

    @require_permission("providers.provider.update")
    def patch(self, request, provider_id):
        try:
            try:
                p = Provider.objects.get(id=provider_id)
            except Provider.DoesNotExist:
                return Response({'message': 'Provider not found'}, status=404)
            name = request.data.get('name', p.name)
            country_id = request.data.get('countryId', p.country_id)
            if name != p.name:
                dup = Provider.objects.filter(name__iexact=name).exclude(id=provider_id)
                if country_id:
                    dup = dup.filter(country_id=country_id)
                if dup.exists():
                    return Response({'message': 'A provider with this name and country already exists'}, status=409)
            for field in ['name', 'providerType', 'countryId', 'website', 'notes', 'status']:
                snake = field.replace('T', '_t').replace('I', '_i') if field != 'name' else field
                db_field = {'providerType': 'provider_type', 'countryId': 'country_id'}.get(field, field)
                if field in request.data:
                    setattr(p, db_field, request.data[field])
            p.save()
            return Response(provider_to_dict(p))
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class UniversityListView(APIView):
    @require_auth
    def get(self, request):
        qs = Provider.objects.filter(status='active').order_by('name')
        return Response([provider_to_dict(p) for p in qs])

    @require_permission("providers.provider.add")
    def post(self, request):
        try:
            name = request.data.get('name', '')
            country_id = request.data.get('countryId')
            dup = Provider.objects.filter(name__iexact=name)
            if country_id:
                dup = dup.filter(country_id=country_id)
            if dup.exists():
                return Response({'message': 'A provider with this name and country already exists'}, status=409)
            p = Provider.objects.create(
                name=name,
                provider_type=request.data.get('providerType', 'university'),
                country_id=country_id,
                website=request.data.get('website'),
                notes=request.data.get('notes'),
                status=request.data.get('status', 'active'),
            )
            return Response(provider_to_dict(p))
        except Exception as e:
            return Response({'message': str(e)}, status=500)
