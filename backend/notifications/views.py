from datetime import date, timedelta
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from core.permissions import require_auth, require_permission
from agreements.models import Agreement
from providers.models import Provider
from .models import AgreementNotification


class NotificationListView(APIView):
    @require_auth
    def get(self, request):
        try:
            qs = AgreementNotification.objects.all().order_by('-sent_date')
            agreement_id = request.query_params.get('agreementId')
            if agreement_id:
                qs = qs.filter(agreement_id=int(agreement_id))
            limit = int(request.query_params.get('limit', 100))
            notifs = qs[:limit]
            return Response([{
                'id': n.id, 'agreementId': n.agreement_id, 'providerName': n.provider_name,
                'notificationType': n.notification_type,
                'sentDate': n.sent_date.isoformat() if n.sent_date else None,
                'daysBeforeExpiry': n.days_before_expiry, 'status': n.status,
                'recipientEmails': n.recipient_emails,
            } for n in notifs])
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class TriggerNotificationCheckView(APIView):
    @require_auth
    def post(self, request):
        try:
            today = date.today()
            reminder_tiers = [90, 60, 30, 14, 7]
            recipients = ['au@studyinfocentre.com', 'info@studyinfocentre.com', 'partners@studyinfocentre.com']
            notified = 0

            agreements = Agreement.objects.filter(status__in=['active', 'renewal_in_progress'])
            for agr in agreements:
                days_until = (agr.expiry_date - today).days
                matching_tier = None
                for tier in reminder_tiers:
                    if days_until <= tier:
                        matching_tier = tier
                        break

                if matching_tier is None:
                    continue

                existing = AgreementNotification.objects.filter(
                    agreement_id=agr.id,
                    days_before_expiry=matching_tier,
                ).exists()
                if existing:
                    continue

                try:
                    prov = Provider.objects.get(id=agr.university_id)
                    provider_name = prov.name
                except Provider.DoesNotExist:
                    provider_name = 'Unknown'

                urgency = 'critical' if matching_tier <= 14 else ('warning' if matching_tier <= 30 else 'info')
                subject = f'Agreement Expiry Reminder ({matching_tier} days) - {provider_name}'
                html = f'''
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h1 style="color: #1e40af;">Agreement Expiry Reminder</h1>
                    <p><strong>Agreement:</strong> {agr.agreement_code} - {agr.title}</p>
                    <p><strong>Provider:</strong> {provider_name}</p>
                    <p><strong>Expiry Date:</strong> {agr.expiry_date}</p>
                    <p><strong>Days Remaining:</strong> {days_until}</p>
                    <p style="color: {'#dc2626' if urgency == 'critical' else '#f59e0b'};">
                        {f'URGENT: This agreement expires in {days_until} days!' if urgency == 'critical' else f'This agreement expires in {days_until} days.'}
                    </p>
                </div>
                '''

                email_status = 'sent'
                try:
                    send_mail(
                        subject, '', f'"{settings.FROM_NAME}" <{settings.DEFAULT_FROM_EMAIL}>',
                        recipients, html_message=html, fail_silently=False,
                    )
                except Exception as e:
                    print(f'Notification email failed: {e}')
                    email_status = 'failed'

                AgreementNotification.objects.create(
                    agreement_id=agr.id,
                    provider_name=provider_name,
                    notification_type=f'expiry_{matching_tier}d',
                    days_before_expiry=matching_tier,
                    status=email_status,
                    recipient_emails=','.join(recipients),
                )
                notified += 1

            return Response({'message': f'Notification check complete. {notified} notifications sent.'})
        except Exception as e:
            return Response({'message': str(e)}, status=500)
