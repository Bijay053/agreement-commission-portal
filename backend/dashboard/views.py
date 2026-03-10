from datetime import date, timedelta
from django.db.models import Count
from rest_framework.views import APIView
from rest_framework.response import Response
from core.permissions import require_auth
from agreements.models import Agreement
from providers.models import Provider


class DashboardStatsView(APIView):
    @require_auth
    def get(self, request):
        try:
            total = Agreement.objects.count()
            active = Agreement.objects.filter(status='active').count()
            draft = Agreement.objects.filter(status='draft').count()
            expired = Agreement.objects.filter(status='expired').count()
            renewal = Agreement.objects.filter(status='renewal_in_progress').count()
            providers_count = Provider.objects.filter(status='active').count()

            today = date.today()
            expiring_30 = Agreement.objects.filter(
                status='active', expiry_date__lte=today + timedelta(days=30), expiry_date__gte=today
            ).count()

            return Response({
                'totalAgreements': total,
                'active': active,
                'draft': draft,
                'expired': expired,
                'renewalInProgress': renewal,
                'totalProviders': providers_count,
                'expiring30Days': expiring_30,
            })
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class DashboardExpiringView(APIView):
    @require_auth
    def get(self, request):
        try:
            today = date.today()
            cutoff = today + timedelta(days=90)
            agreements = list(Agreement.objects.filter(
                status__in=['active', 'renewal_in_progress'],
                expiry_date__lte=cutoff
            ).order_by('expiry_date')[:20])

            provider_ids = set(a.university_id for a in agreements if a.university_id)
            providers_lookup = {p.id: p for p in Provider.objects.filter(id__in=provider_ids)} if provider_ids else {}

            result = []
            for a in agreements:
                prov = providers_lookup.get(a.university_id)
                prov_name = prov.name if prov else 'Unknown'

                result.append({
                    'id': a.id, 'title': a.title, 'agreementCode': a.agreement_code,
                    'status': a.status, 'expiryDate': str(a.expiry_date),
                    'universityName': prov_name,
                    'daysUntilExpiry': (a.expiry_date - today).days,
                })
            return Response(result)
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class DashboardRecentView(APIView):
    @require_auth
    def get(self, request):
        try:
            agreements = list(Agreement.objects.all().order_by('-updated_at')[:10])

            provider_ids = set(a.university_id for a in agreements if a.university_id)
            providers_lookup = {p.id: p for p in Provider.objects.filter(id__in=provider_ids)} if provider_ids else {}

            result = []
            for a in agreements:
                prov = providers_lookup.get(a.university_id)
                prov_name = prov.name if prov else 'Unknown'

                result.append({
                    'id': a.id, 'title': a.title, 'agreementCode': a.agreement_code,
                    'status': a.status, 'universityName': prov_name,
                    'updatedAt': a.updated_at.isoformat() if a.updated_at else None,
                })
            return Response(result)
        except Exception as e:
            return Response({'message': str(e)}, status=500)
