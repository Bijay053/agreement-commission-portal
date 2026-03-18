import os
from html import escape as _esc
from django.conf import settings
from django.core.mail import EmailMessage


def send_offer_signing_request_email(employee_name, employee_email, signing_token, frontend_url=None, company_name=None):
    if not frontend_url:
        frontend_url = getattr(settings, 'PORTAL_URL', 'https://portal.studyinfocentre.com')
    if not company_name:
        company_name = 'Study Info Centre Pvt. Ltd.'

    signing_link = f'{frontend_url}/sign-offer/{signing_token}'
    name_safe = _esc(employee_name)
    co_safe = _esc(company_name)

    subject = 'Action Required — Please Sign Your Offer Letter'

    html = f'''<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 20px; background-color: #f3f4f6; font-family: Arial, Helvetica, sans-serif;">
<div style="max-width: 640px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
    <div style="background-color: #1e40af; padding: 24px 32px; color: #ffffff;">
        <h1 style="margin: 0; font-size: 20px; font-weight: 600;">Offer Letter — Signature Required</h1>
        <p style="margin: 8px 0 0 0; font-size: 13px; opacity: 0.9;">{co_safe}</p>
    </div>
    <div style="padding: 32px;">
        <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">Dear {name_safe},</p>
        <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
            Your offer letter from <strong>{co_safe}</strong> is ready for your review and signature.
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
            Please click the button below to read and sign your offer letter. This link will expire in <strong>7 days</strong>.
        </p>
        <div style="text-align: center; margin: 32px 0;">
            <a href="{_esc(signing_link)}" style="display: inline-block; background-color: #1e40af; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: 600;">
                Sign My Offer Letter
            </a>
        </div>
        <p style="color: #6b7280; font-size: 13px; line-height: 1.6; margin: 0 0 24px 0;">
            If the button does not work, paste this link into your browser:<br>
            <a href="{_esc(signing_link)}" style="color: #1e40af; word-break: break-all;">{_esc(signing_link)}</a>
        </p>
        <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0;">
            Regards,<br>
            <strong style="color: #374151;">HR Department</strong><br>
            {co_safe}
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
        print(f'Offer letter signing request email failed: {e}')
        return False


def send_offer_employee_signed_notification(employee_name, employee_email, offer_id, company_name=None, position=''):
    if not company_name:
        company_name = 'Study Info Centre Pvt. Ltd.'
    from_email = f'"{getattr(settings, "FROM_NAME", "Agreement Portal")}" <{settings.DEFAULT_FROM_EMAIL}>'
    name_safe = _esc(employee_name)
    co_safe = _esc(company_name)
    pos_safe = _esc(position)
    from datetime import datetime
    signed_time = datetime.utcnow().strftime('%d %B %Y at %I:%M %p UTC')

    portal_url = getattr(settings, 'PORTAL_URL', 'https://portal.studyinfocentre.com')

    admin_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'au@studyinfocentre.com')
    accounts_email = 'accounts@studyinfocentre.com'
    recipients = list(set([admin_email, accounts_email]))

    admin_subject = f'Employee Signed Offer Letter — {employee_name}'
    admin_html = f'''<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 20px; background-color: #f3f4f6; font-family: Arial, sans-serif;">
<div style="max-width: 640px; margin: 0 auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
    <div style="background-color: #f59e0b; padding: 24px 32px; color: #fff;">
        <h1 style="margin: 0; font-size: 20px;">Employee Has Signed Offer Letter — Company Signature Required</h1>
        <p style="margin: 8px 0 0 0; font-size: 13px; opacity: 0.9;">{co_safe}</p>
    </div>
    <div style="padding: 32px;">
        <p style="color: #374151; font-size: 15px; line-height: 1.6;">
            <strong>{name_safe}</strong>{f' ({pos_safe})' if pos_safe else ''} has signed their offer letter on <strong>{signed_time}</strong>.
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.6;">
            The offer letter now requires the company's signature. Please log in to the portal to complete the signing.
        </p>
        <div style="text-align: center; margin: 32px 0;">
            <a href="{_esc(portal_url)}" style="display: inline-block; background-color: #1e40af; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: 600;">
                Go to Portal
            </a>
        </div>
    </div>
</div>
</body>
</html>'''

    try:
        msg = EmailMessage(admin_subject, admin_html, from_email, recipients)
        msg.content_subtype = 'html'
        msg.send(fail_silently=False)
    except Exception as e:
        print(f'Admin notification (offer letter employee signed) failed: {e}')

    emp_subject = f'Offer Letter Received — {company_name}'
    emp_html = f'''<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 20px; background-color: #f3f4f6; font-family: Arial, sans-serif;">
<div style="max-width: 640px; margin: 0 auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
    <div style="background-color: #1e40af; padding: 24px 32px; color: #fff;">
        <h1 style="margin: 0; font-size: 20px;">Your Signature Has Been Received</h1>
        <p style="margin: 8px 0 0 0; font-size: 13px; opacity: 0.9;">{co_safe}</p>
    </div>
    <div style="padding: 32px;">
        <p style="color: #374151; font-size: 15px; line-height: 1.6;">Dear {name_safe},</p>
        <p style="color: #374151; font-size: 15px; line-height: 1.6;">
            Thank you for signing your offer letter. Your signature has been received and recorded.
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.6;">
            The offer letter will now be reviewed and signed by the company. Once fully executed, you will receive a copy.
        </p>
    </div>
</div>
</body>
</html>'''

    try:
        msg = EmailMessage(emp_subject, emp_html, from_email, [employee_email])
        msg.content_subtype = 'html'
        msg.send(fail_silently=False)
    except Exception as e:
        print(f'Employee acknowledgement email (offer letter) failed: {e}')


def send_offer_signed_confirmation_email(employee_name, employee_email, admin_email, signed_pdf_bytes=None, pdf_password=None, company_name=None, download_link=None):
    if not company_name:
        company_name = 'Study Info Centre Pvt. Ltd.'
    from_email = f'"{getattr(settings, "FROM_NAME", "Agreement Portal")}" <{settings.DEFAULT_FROM_EMAIL}>'
    name_safe = _esc(employee_name)
    co_safe = _esc(company_name)
    from datetime import datetime
    signed_time = datetime.utcnow().strftime('%d %B %Y at %I:%M %p UTC')

    password_section = ''
    if pdf_password:
        pw_safe = _esc(pdf_password)
        password_section = f'''
        <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 16px; margin: 16px 0;">
            <p style="color: #92400e; font-size: 14px; font-weight: 600; margin: 0 0 6px 0;">&#128274; PDF Password</p>
            <p style="color: #78350f; font-size: 15px; margin: 0;">Use the password below to open the PDF:</p>
            <p style="color: #1e40af; font-size: 18px; font-weight: 700; margin: 12px 0 0 0; font-family: monospace; letter-spacing: 1px; background: #ffffff; padding: 10px 16px; border-radius: 4px; display: inline-block;">
                {pw_safe}
            </p>
        </div>'''

    download_section = ''
    if download_link:
        dl_safe = _esc(download_link)
        download_section = f'''
        <div style="text-align: center; margin: 24px 0;">
            <a href="{dl_safe}" style="display: inline-block; background-color: #059669; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-size: 15px; font-weight: 600;">
                Download Signed Offer Letter
            </a>
        </div>'''

    attachment_note = ''
    if signed_pdf_bytes:
        attachment_note = 'Please find your signed offer letter attached.'
    elif download_link:
        attachment_note = 'You can download your signed offer letter using the link below.'
    else:
        attachment_note = 'Your signed offer letter is available in the portal.'

    employee_subject = f'Your Signed Offer Letter — {company_name}'
    employee_html = f'''<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 20px; background-color: #f3f4f6; font-family: Arial, sans-serif;">
<div style="max-width: 640px; margin: 0 auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
    <div style="background-color: #059669; padding: 24px 32px; color: #fff;">
        <h1 style="margin: 0; font-size: 20px;">Offer Letter Fully Signed</h1>
        <p style="margin: 8px 0 0 0; font-size: 13px; opacity: 0.9;">{co_safe}</p>
    </div>
    <div style="padding: 32px;">
        <p style="color: #374151; font-size: 15px; line-height: 1.6;">Dear {name_safe},</p>
        <p style="color: #374151; font-size: 15px; line-height: 1.6;">
            Your offer letter has been signed by both you and the company. {attachment_note}
        </p>
        {password_section}
        {download_section}
        <p style="color: #374151; font-size: 15px; line-height: 1.6;">Keep this for your records.</p>
        <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">Regards,<br><strong>HR Department</strong><br>{co_safe}</p>
    </div>
</div>
</body>
</html>'''

    try:
        msg = EmailMessage(employee_subject, employee_html, from_email, [employee_email])
        msg.content_subtype = 'html'
        if signed_pdf_bytes:
            msg.attach(f'{employee_name}_signed_offer_letter.pdf', signed_pdf_bytes, 'application/pdf')
        msg.send(fail_silently=False)
    except Exception as e:
        print(f'Employee offer letter confirmation email failed: {e}')

    all_admin_recipients = list(set(filter(None, [admin_email, 'accounts@studyinfocentre.com'])))
    try:
        admin_default = getattr(settings, 'DEFAULT_FROM_EMAIL', 'au@studyinfocentre.com')
        if admin_default and admin_default not in all_admin_recipients:
            all_admin_recipients.append(admin_default)
    except Exception:
        pass

    if all_admin_recipients:
        admin_subject = f'Offer Letter Fully Signed — {employee_name}'
        admin_html = f'''<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 20px; background-color: #f3f4f6; font-family: Arial, sans-serif;">
<div style="max-width: 640px; margin: 0 auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
    <div style="background-color: #059669; padding: 24px 32px; color: #fff;">
        <h1 style="margin: 0; font-size: 20px;">Offer Letter Fully Signed</h1>
        <p style="margin: 8px 0 0 0; font-size: 13px; opacity: 0.9;">{co_safe}</p>
    </div>
    <div style="padding: 32px;">
        <p style="color: #374151; font-size: 15px; line-height: 1.6;">
            The offer letter for <strong>{name_safe}</strong> has been fully executed on <strong>{signed_time}</strong>.
        </p>
        {download_section}
    </div>
</div>
</body>
</html>'''

        try:
            msg = EmailMessage(admin_subject, admin_html, from_email, all_admin_recipients)
            msg.content_subtype = 'html'
            if signed_pdf_bytes:
                msg.attach(f'{employee_name}_signed_offer_letter.pdf', signed_pdf_bytes, 'application/pdf')
            msg.send(fail_silently=False)
        except Exception as e:
            print(f'Admin offer letter confirmation email failed: {e}')
