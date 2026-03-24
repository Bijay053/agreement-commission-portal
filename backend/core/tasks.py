from celery import shared_task
from django.conf import settings
from core.email_utils import send_mail_with_bcc


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_email_task(self, subject, plain_text, from_email, recipients, html_message=None):
    try:
        send_mail_with_bcc(
            subject,
            plain_text,
            from_email,
            recipients,
            html_message=html_message,
        )
    except Exception as exc:
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_otp_email_task(self, email, subject, html):
    try:
        from_email = f'"{settings.FROM_NAME}" <{settings.DEFAULT_FROM_EMAIL}>'
        send_mail_with_bcc(
            subject,
            '',
            from_email,
            [email],
            html_message=html,
        )
    except Exception as exc:
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_password_reset_email_task(self, email, subject, html):
    try:
        from_email = f'"{settings.FROM_NAME}" <{settings.DEFAULT_FROM_EMAIL}>'
        send_mail_with_bcc(
            subject,
            '',
            from_email,
            [email],
            html_message=html,
        )
    except Exception as exc:
        raise self.retry(exc=exc)
