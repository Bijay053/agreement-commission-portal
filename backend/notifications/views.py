from datetime import date, timedelta
from html import escape as html_escape
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from core.pagination import StandardPagination
from core.permissions import require_auth, require_permission
from agreements.models import Agreement
from providers.models import Provider
from .models import AgreementNotification


def _esc(value):
    return html_escape(str(value)) if value else ''


def build_email(template_type, provider_name, expiry_date, days_remaining, agreement_code, agreement_title):
    provider_name_safe = _esc(provider_name)
    agreement_code_safe = _esc(agreement_code)
    agreement_title_safe = _esc(agreement_title)
    expiry_str = expiry_date.strftime('%d %B %Y') if expiry_date else ''

    header_color = '#1e40af'
    if template_type == 'expired':
        header_color = '#dc2626'
    elif template_type == 'urgent':
        header_color = '#d97706'

    wrapper_style = (
        'font-family: Arial, Helvetica, sans-serif; max-width: 640px; margin: 0 auto; '
        'background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;'
    )
    header_style = f'background-color: {header_color}; padding: 24px 32px; color: #ffffff;'
    body_style = 'padding: 32px;'
    footer_style = (
        'padding: 20px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; '
        'font-size: 12px; color: #6b7280; text-align: center;'
    )

    if template_type == 'reminder':
        subject = f'Agreement Expiry Reminder – {provider_name}'
        plain_text = (
            f'Dear Team,\n\n'
            f'This is a friendly reminder that our agent agreement with {provider_name} '
            f'is scheduled to expire on {expiry_str}.\n\n'
            f'To ensure uninterrupted collaboration and student recruitment, we would appreciate it if '
            f'the renewal process could be initiated at your earliest convenience.\n\n'
            f'If any updated terms or documentation are required from our side, please let us know.\n\n'
            f'Agreement: {agreement_code} – {agreement_title}\n'
            f'Expiry Date: {expiry_str}\n'
            f'Days Remaining: {days_remaining}\n\n'
            f'Warm regards,\nStudy Info Centre\nAgreement & Commission Management Portal'
        )
        body_content = f'''
            <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">Dear Team,</p>
            <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
                This is a friendly reminder that our agent agreement with <strong>{provider_name_safe}</strong>
                is scheduled to expire on <strong>{expiry_str}</strong>.
            </p>
            <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
                To ensure uninterrupted collaboration and student recruitment, we would appreciate it if
                the renewal process could be initiated at your earliest convenience.
            </p>
            <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
                If any updated terms or documentation are required from our side, please let us know.
            </p>
        '''

    elif template_type == 'urgent':
        subject = f'Urgent: Agreement Expiring Soon – {provider_name}'
        plain_text = (
            f'Dear Team,\n\n'
            f'Our agreement with {provider_name} will expire on {expiry_str}.\n\n'
            f'Kindly advise on the renewal status so that we can continue supporting student '
            f'recruitment without interruption.\n\n'
            f'We look forward to your update.\n\n'
            f'Agreement: {agreement_code} – {agreement_title}\n'
            f'Expiry Date: {expiry_str}\n'
            f'Days Remaining: {days_remaining}\n\n'
            f'Warm regards,\nStudy Info Centre\nAgreement & Commission Management Portal'
        )
        body_content = f'''
            <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">Dear Team,</p>
            <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
                Our agreement with <strong>{provider_name_safe}</strong> will expire on
                <strong>{expiry_str}</strong>.
            </p>
            <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
                Kindly advise on the renewal status so that we can continue supporting student
                recruitment without interruption.
            </p>
            <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
                We look forward to your update.
            </p>
        '''

    elif template_type == 'expired':
        subject = f'Agreement Expired – Renewal Request – {provider_name}'
        plain_text = (
            f'Dear Team,\n\n'
            f'Our recruitment agreement with {provider_name} expired on {expiry_str}.\n\n'
            f'We would appreciate your guidance on the renewal process so we can continue '
            f'promoting your programs to prospective students.\n\n'
            f'Looking forward to your response.\n\n'
            f'Agreement: {agreement_code} – {agreement_title}\n'
            f'Expired On: {expiry_str}\n\n'
            f'Warm regards,\nStudy Info Centre\nAgreement & Commission Management Portal'
        )
        body_content = f'''
            <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">Dear Team,</p>
            <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
                Our recruitment agreement with <strong>{provider_name_safe}</strong> expired on
                <strong>{expiry_str}</strong>.
            </p>
            <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
                We would appreciate your guidance on the renewal process so we can continue
                promoting your programs to prospective students.
            </p>
            <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
                Looking forward to your response.
            </p>
        '''
    else:
        subject = f'Agreement Notification – {provider_name}'
        plain_text = f'Notification regarding agreement with {provider_name} (expiry: {expiry_str}).'
        body_content = f'''
            <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">Dear Team,</p>
            <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
                This is a notification regarding our agreement with <strong>{provider_name_safe}</strong>
                (expiry: <strong>{expiry_str}</strong>).
            </p>
        '''

    title_map = {
        'reminder': 'Agreement Expiry Reminder',
        'urgent': 'Urgent: Agreement Expiring Soon',
        'expired': 'Agreement Expired – Renewal Request',
    }
    header_title = title_map.get(template_type, 'Agreement Notification')

    days_label = f'{abs(days_remaining)} days ago' if days_remaining < 0 else f'{days_remaining} days'
    if days_remaining <= 0:
        days_color = '#dc2626'
    elif days_remaining <= 14:
        days_color = '#dc2626'
    elif days_remaining <= 30:
        days_color = '#d97706'
    else:
        days_color = '#059669'

    portal_url = _esc(getattr(settings, 'PORTAL_URL', 'https://portal.studyinfocentre.com'))

    html = f'''<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 20px; background-color: #f3f4f6;">
<div style="{wrapper_style}">
    <div style="{header_style}">
        <h1 style="margin: 0; font-size: 20px; font-weight: 600;">{header_title}</h1>
        <p style="margin: 8px 0 0 0; font-size: 13px; opacity: 0.9;">Study Info Centre – Agreement Portal</p>
    </div>
    <div style="{body_style}">
        {body_content}
        <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #e5e7eb;">
            <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Agreement Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 140px;">Provider</td>
                    <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500;">{provider_name_safe}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px; border-top: 1px solid #f3f4f6;">Agreement</td>
                    <td style="padding: 8px 0; color: #111827; font-size: 14px; border-top: 1px solid #f3f4f6;">{agreement_code_safe} – {agreement_title_safe}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px; border-top: 1px solid #f3f4f6;">Expiry Date</td>
                    <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500; border-top: 1px solid #f3f4f6;">{expiry_str}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px; border-top: 1px solid #f3f4f6;">Time Remaining</td>
                    <td style="padding: 8px 0; font-size: 14px; font-weight: 600; border-top: 1px solid #f3f4f6; color: {days_color};">{days_label}</td>
                </tr>
            </table>
        </div>
        <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0;">
            Warm regards,<br>
            <strong style="color: #374151;">Study Info Centre</strong><br>
            Agreement &amp; Commission Management Portal
        </p>
    </div>
    <div style="{footer_style}">
        <p style="margin: 0;">This is an automated notification from the Agreement Portal.</p>
        <p style="margin: 4px 0 0 0;">
            <a href="{portal_url}" style="color: #1e40af; text-decoration: none;">{portal_url}</a>
        </p>
    </div>
</div>
</body>
</html>'''

    return subject, plain_text, html


def _determine_template_and_tier(days_until):
    if days_until <= 0:
        return 'expired', 0
    elif days_until <= 7:
        return 'urgent', 7
    elif days_until <= 14:
        return 'urgent', 14
    elif days_until <= 30:
        return 'reminder', 30
    elif days_until <= 60:
        return 'reminder', 60
    elif days_until <= 90:
        return 'reminder', 90
    else:
        return None, None


class NotificationListView(APIView):
    pagination_class = StandardPagination

    @require_auth
    def get(self, request):
        try:
            qs = AgreementNotification.objects.all().order_by('-sent_date')
            agreement_id = request.query_params.get('agreementId')
            if agreement_id:
                qs = qs.filter(agreement_id=int(agreement_id))

            paginator = self.pagination_class()
            page = paginator.paginate_queryset(qs, request)
            items = page if page is not None else list(qs)
            result = [{
                'id': n.id, 'agreementId': n.agreement_id, 'providerName': n.provider_name,
                'notificationType': n.notification_type,
                'sentDate': n.sent_date.isoformat() if n.sent_date else None,
                'daysBeforeExpiry': n.days_before_expiry, 'status': n.status,
                'recipientEmails': n.recipient_emails,
            } for n in items]
            if page is not None:
                return paginator.get_paginated_response(result)
            return Response(result)
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class TriggerNotificationCheckView(APIView):
    @require_auth
    def post(self, request):
        try:
            today = date.today()
            recipients = ['au@studyinfocentre.com', 'info@studyinfocentre.com', 'partners@studyinfocentre.com']
            notified = 0

            agreements = list(Agreement.objects.filter(status__in=['active', 'renewal_in_progress']))

            provider_ids = set(a.university_id for a in agreements if a.university_id)
            providers_lookup = {p.id: p for p in Provider.objects.filter(id__in=provider_ids)} if provider_ids else {}

            for agr in agreements:
                if not agr.expiry_date:
                    continue
                days_until = (agr.expiry_date - today).days

                template_type, matching_tier = _determine_template_and_tier(days_until)
                if template_type is None:
                    continue

                prov = providers_lookup.get(agr.university_id)
                provider_name = prov.name if prov else 'Unknown'

                if template_type == 'expired':
                    existing = AgreementNotification.objects.filter(
                        agreement_id=agr.id,
                        notification_type='expired',
                        sent_date__date=today,
                    ).exists()
                    if existing:
                        continue
                else:
                    existing = AgreementNotification.objects.filter(
                        agreement_id=agr.id,
                        days_before_expiry=matching_tier,
                    ).exists()
                    if existing:
                        continue

                subject, plain_text, html = build_email(
                    template_type=template_type,
                    provider_name=provider_name,
                    expiry_date=agr.expiry_date,
                    days_remaining=days_until,
                    agreement_code=agr.agreement_code or '',
                    agreement_title=agr.title or '',
                )

                email_status = 'sent'
                try:
                    send_mail(
                        subject, plain_text,
                        f'"{settings.FROM_NAME}" <{settings.DEFAULT_FROM_EMAIL}>',
                        recipients, html_message=html, fail_silently=False,
                    )
                except Exception as e:
                    print(f'Notification email failed: {e}')
                    email_status = 'failed'

                notification_type = f'expiry_{matching_tier}d' if matching_tier > 0 else 'expired'
                AgreementNotification.objects.create(
                    agreement_id=agr.id,
                    provider_name=provider_name,
                    notification_type=notification_type,
                    days_before_expiry=matching_tier,
                    status=email_status,
                    recipient_emails=','.join(recipients),
                )
                notified += 1

            return Response({'message': f'Notification check complete. {notified} notifications sent.'})
        except Exception as e:
            return Response({'message': str(e)}, status=500)
