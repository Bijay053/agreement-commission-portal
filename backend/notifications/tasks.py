from datetime import date, timedelta

from celery import shared_task
from django.conf import settings
from django.utils import timezone
from core.email_utils import send_mail_with_bcc

from agreements.models import Agreement
from notifications.models import AgreementNotification
from notifications.views import _determine_template_and_tier, build_email
from providers.models import Provider


@shared_task(bind=True, max_retries=3, default_retry_delay=120)
def send_notification_email_task(self, subject, plain_text, html, recipients):
    try:
        from_email = f'"{settings.FROM_NAME}" <{settings.DEFAULT_FROM_EMAIL}>'
        send_mail_with_bcc(
            subject,
            plain_text,
            from_email,
            recipients,
            html_message=html,
        )
    except Exception as exc:
        raise self.retry(exc=exc)


@shared_task
def check_agreement_expiry_notifications():
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
            send_notification_email_task.delay(subject, plain_text, html, recipients)
        except Exception as e:
            print(f'Notification email task failed to enqueue: {e}')
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

    return f'Notification check complete. {notified} notifications sent.'


@shared_task
def cleanup_expired_sessions():
    from accounts.models import UserSession, LoginVerificationCode

    now = timezone.now()
    idle_cutoff = now - timedelta(hours=24)

    stale_sessions = UserSession.objects.filter(
        is_active=True,
        last_activity_at__lt=idle_cutoff,
    )
    count = stale_sessions.update(
        is_active=False,
        logout_at=now,
        logout_reason='expired',
    )

    expired_codes = LoginVerificationCode.objects.filter(
        status='pending',
        expires_at__lt=now,
    )
    codes_count = expired_codes.update(status='expired')

    return f'Session cleanup complete. {count} sessions expired, {codes_count} verification codes expired.'


@shared_task
def check_password_expiry_reminders():
    from accounts.models import User

    PASSWORD_MAX_AGE_DAYS = getattr(settings, 'PASSWORD_MAX_AGE_DAYS', 90)
    REMINDER_DAYS_BEFORE = [14, 7, 3, 1]

    now = timezone.now()
    notified = 0

    users = User.objects.filter(is_active=True).exclude(password_changed_at__isnull=True)

    for user in users:
        password_age = (now - user.password_changed_at).days
        days_until_expiry = PASSWORD_MAX_AGE_DAYS - password_age

        if days_until_expiry not in REMINDER_DAYS_BEFORE:
            continue

        subject = f'Password Expiry Reminder - {days_until_expiry} day{"s" if days_until_expiry != 1 else ""} remaining'
        plain_text = (
            f'Dear {user.full_name},\n\n'
            f'Your password will expire in {days_until_expiry} day{"s" if days_until_expiry != 1 else ""}. '
            f'Please change your password to avoid any disruption to your account access.\n\n'
            f'You can change your password by logging in and navigating to Account Security.\n\n'
            f'Regards,\nStudy Info Centre Portal'
        )
        html = (
            f'<p>Dear {user.full_name},</p>'
            f'<p>Your password will expire in <strong>{days_until_expiry} day{"s" if days_until_expiry != 1 else ""}</strong>. '
            f'Please change your password to avoid any disruption to your account access.</p>'
            f'<p>You can change your password by logging in and navigating to Account Security.</p>'
            f'<p>Regards,<br/>Study Info Centre Portal</p>'
        )

        try:
            send_notification_email_task.delay(subject, plain_text, html, [user.email])
            notified += 1
        except Exception as e:
            print(f'Password expiry reminder failed for user {user.id}: {e}')

    return f'Password expiry check complete. {notified} reminders sent.'
