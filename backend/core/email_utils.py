from django.conf import settings
from django.core.mail import EmailMessage


def send_mail_with_bcc(subject, plain_text, from_email, recipients, html_message=None, bcc=None, fail_silently=False):
    bcc_list = list(bcc or [])
    notification_bcc = getattr(settings, 'NOTIFICATION_BCC_EMAILS', [])
    if notification_bcc:
        for email in notification_bcc:
            if email not in recipients and email not in bcc_list:
                bcc_list.append(email)

    msg = EmailMessage(
        subject=subject,
        body=html_message or plain_text,
        from_email=from_email,
        to=recipients,
        bcc=bcc_list if bcc_list else None,
    )
    if html_message:
        msg.content_subtype = 'html'
    msg.send(fail_silently=fail_silently)
