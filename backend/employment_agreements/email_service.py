import os
from html import escape as _esc
from django.conf import settings
from django.core.mail import EmailMessage


def send_signing_request_email(employee_name, employee_email, signing_token, frontend_url=None):
    if not frontend_url:
        frontend_url = getattr(settings, 'PORTAL_URL', 'https://portal.studyinfocentre.com')

    signing_link = f'{frontend_url}/sign/{signing_token}'
    name_safe = _esc(employee_name)

    subject = 'Action Required — Please Sign Your Employment Agreement'

    plain_text = (
        f'Dear {employee_name},\n\n'
        f'Your employment agreement with Study Info Centre Pvt. Ltd. is ready for your review and signature.\n\n'
        f'Please click the link below to read and sign your agreement. This link will expire in 7 days.\n\n'
        f'{signing_link}\n\n'
        f'Regards,\nHR Department\nStudy Info Centre Pvt. Ltd.'
    )

    html = f'''<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 20px; background-color: #f3f4f6; font-family: Arial, Helvetica, sans-serif;">
<div style="max-width: 640px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
    <div style="background-color: #1e40af; padding: 24px 32px; color: #ffffff;">
        <h1 style="margin: 0; font-size: 20px; font-weight: 600;">Employment Agreement — Signature Required</h1>
        <p style="margin: 8px 0 0 0; font-size: 13px; opacity: 0.9;">Study Info Centre Pvt. Ltd.</p>
    </div>
    <div style="padding: 32px;">
        <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">Dear {name_safe},</p>
        <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
            Your employment agreement with <strong>Study Info Centre Pvt. Ltd.</strong> is ready for your review and signature.
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
            Please click the button below to read and sign your agreement. This link will expire in <strong>7 days</strong>.
        </p>
        <div style="text-align: center; margin: 32px 0;">
            <a href="{_esc(signing_link)}" style="display: inline-block; background-color: #1e40af; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: 600;">
                Sign My Agreement
            </a>
        </div>
        <p style="color: #6b7280; font-size: 13px; line-height: 1.6; margin: 0 0 24px 0;">
            If the button does not work, paste this link into your browser:<br>
            <a href="{_esc(signing_link)}" style="color: #1e40af; word-break: break-all;">{_esc(signing_link)}</a>
        </p>
        <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0;">
            Regards,<br>
            <strong style="color: #374151;">HR Department</strong><br>
            Study Info Centre Pvt. Ltd.
        </p>
    </div>
    <div style="padding: 20px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: center;">
        <p style="margin: 0;">This is an automated notification from the Agreement Portal.</p>
    </div>
</div>
</body>
</html>'''

    from_email = f'"{getattr(settings, "FROM_NAME", "Agreement Portal")}" <{settings.DEFAULT_FROM_EMAIL}>'

    try:
        msg = EmailMessage(subject, html, from_email, [employee_email])
        msg.content_subtype = 'html'
        msg.send(fail_silently=False)
        return True
    except Exception as e:
        print(f'Signing request email failed: {e}')
        return False


def send_signed_confirmation_email(employee_name, employee_email, admin_email, signed_pdf_bytes=None, pdf_password=None):
    from_email = f'"{getattr(settings, "FROM_NAME", "Agreement Portal")}" <{settings.DEFAULT_FROM_EMAIL}>'
    name_safe = _esc(employee_name)
    from datetime import datetime
    signed_time = datetime.utcnow().strftime('%d %B %Y at %I:%M %p UTC')

    password_section = ''
    if pdf_password:
        pw_safe = _esc(pdf_password)
        password_section = f'''
        <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 16px; margin: 16px 0;">
            <p style="color: #92400e; font-size: 14px; font-weight: 600; margin: 0 0 6px 0;">&#128274; PDF Password</p>
            <p style="color: #78350f; font-size: 15px; margin: 0;">
                Your document is password-protected. Use the password below to open the attached PDF:
            </p>
            <p style="color: #1e40af; font-size: 18px; font-weight: 700; margin: 12px 0 0 0; font-family: monospace; letter-spacing: 1px; background: #ffffff; padding: 10px 16px; border-radius: 4px; display: inline-block;">
                {pw_safe}
            </p>
        </div>'''

    employee_subject = 'Your Signed Employment Agreement — Study Info Centre Pvt. Ltd.'
    employee_html = f'''<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 20px; background-color: #f3f4f6; font-family: Arial, sans-serif;">
<div style="max-width: 640px; margin: 0 auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
    <div style="background-color: #059669; padding: 24px 32px; color: #fff;">
        <h1 style="margin: 0; font-size: 20px;">Agreement Signed Successfully</h1>
        <p style="margin: 8px 0 0 0; font-size: 13px; opacity: 0.9;">Study Info Centre Pvt. Ltd.</p>
    </div>
    <div style="padding: 32px;">
        <p style="color: #374151; font-size: 15px; line-height: 1.6;">Dear {name_safe},</p>
        <p style="color: #374151; font-size: 15px; line-height: 1.6;">
            Thank you for signing your employment agreement. Please find your signed copy attached to this email.
        </p>
        {password_section}
        <p style="color: #374151; font-size: 15px; line-height: 1.6;">Keep this for your records.</p>
        <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">Regards,<br><strong>HR Department</strong><br>Study Info Centre Pvt. Ltd.</p>
    </div>
</div>
</body>
</html>'''

    try:
        msg = EmailMessage(employee_subject, employee_html, from_email, [employee_email])
        msg.content_subtype = 'html'
        if signed_pdf_bytes:
            msg.attach(f'{employee_name}_signed_agreement.pdf', signed_pdf_bytes, 'application/pdf')
        msg.send(fail_silently=False)
    except Exception as e:
        print(f'Employee confirmation email failed: {e}')

    if admin_email:
        admin_subject = f'Agreement Signed — {employee_name}'
        admin_html = f'''<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 20px; background-color: #f3f4f6; font-family: Arial, sans-serif;">
<div style="max-width: 640px; margin: 0 auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
    <div style="background-color: #1e40af; padding: 24px 32px; color: #fff;">
        <h1 style="margin: 0; font-size: 20px;">Agreement Signed</h1>
    </div>
    <div style="padding: 32px;">
        <p style="color: #374151; font-size: 15px; line-height: 1.6;">
            <strong>{name_safe}</strong> has signed their employment agreement on <strong>{signed_time}</strong>.
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.6;">Please find the signed copy attached.</p>
    </div>
</div>
</body>
</html>'''

        try:
            msg = EmailMessage(admin_subject, admin_html, from_email, [admin_email])
            msg.content_subtype = 'html'
            if signed_pdf_bytes:
                msg.attach(f'{employee_name}_signed_agreement.pdf', signed_pdf_bytes, 'application/pdf')
            msg.send(fail_silently=False)
        except Exception as e:
            print(f'Admin confirmation email failed: {e}')
