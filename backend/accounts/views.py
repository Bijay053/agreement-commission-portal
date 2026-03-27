import hashlib
import os
import re
import secrets
import time
from datetime import timedelta, datetime

import bcrypt
from django.conf import settings
from core.email_utils import send_mail_with_bcc
from django.utils import timezone


def make_aware_safe(dt):
    if dt is None:
        return None
    if timezone.is_naive(dt):
        return timezone.make_aware(dt)
    return dt
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import (
    LoginVerificationCode, PasswordHistory, PasswordResetToken,
    Permission, Role, RolePermission, SecurityAuditLog, User,
    UserDevice, UserRole, UserSession,
)
from audit.models import AuditLog
from core.permissions import get_user_permissions, require_auth, require_permission
from core.pagination import StandardPagination
from core.throttling import LoginRateThrottle

login_attempt_tracker = {}


def hash_password(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(12)).decode('utf-8')


def compare_password(password, hashed):
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False


def generate_otp():
    return str(secrets.randbelow(900000) + 100000)


def hash_otp(code):
    return hashlib.sha256(code.encode()).hexdigest()


def validate_password_policy(password):
    if len(password) < 8:
        return 'Password must be at least 8 characters'
    if not re.search(r'[A-Z]', password):
        return 'Password must contain at least one uppercase letter'
    if not re.search(r'[a-z]', password):
        return 'Password must contain at least one lowercase letter'
    if not re.search(r'[0-9]', password):
        return 'Password must contain at least one number'
    if not re.search(r'[!@#$%^&*()_+\-=\[\]{};\':"\\|,.<>/?]', password):
        return 'Password must contain at least one special character'
    return None


def get_client_ip(request):
    xff = request.META.get('HTTP_X_FORWARDED_FOR')
    if xff:
        return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', 'unknown')


def get_user_agent(request):
    return request.META.get('HTTP_USER_AGENT', '')


def parse_device_info(ua_string):
    browser = 'Unknown'
    os_name = 'Unknown'
    device_type = 'desktop'
    ua = ua_string.lower()
    if 'chrome' in ua:
        browser = 'Chrome'
    elif 'firefox' in ua:
        browser = 'Firefox'
    elif 'safari' in ua:
        browser = 'Safari'
    elif 'edge' in ua:
        browser = 'Edge'
    if 'windows' in ua:
        os_name = 'Windows'
    elif 'mac' in ua:
        os_name = 'macOS'
    elif 'linux' in ua:
        os_name = 'Linux'
    elif 'android' in ua:
        os_name = 'Android'
        device_type = 'mobile'
    elif 'iphone' in ua or 'ipad' in ua:
        os_name = 'iOS'
        device_type = 'mobile'
    return {'browser': browser, 'os': os_name, 'deviceType': device_type}


def generate_fingerprint(request):
    ua = get_user_agent(request)
    device = parse_device_info(ua)
    fp_from_client = request.data.get('fingerprint', '')
    if fp_from_client:
        return fp_from_client
    raw = f"{device['browser']}|{device['os']}|{ua}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def check_new_device(user, request, device_info, client_ip):
    fingerprint = generate_fingerprint(request)
    existing = UserDevice.objects.filter(user_id=user.id, fingerprint=fingerprint).first()
    now_str = timezone.now().strftime('%d %b %Y, %I:%M %p')
    device_name = f"{device_info['browser']} on {device_info['os']}"

    if existing:
        existing.last_login = timezone.now()
        existing.ip_address = client_ip
        existing.save(update_fields=['last_login', 'ip_address'])
        return False

    UserDevice.objects.create(
        user_id=user.id,
        fingerprint=fingerprint,
        device_name=device_name,
        browser=device_info['browser'],
        os=device_info['os'],
        ip_address=client_ip,
    )

    create_security_log(
        user_id=user.id,
        event_type='NEW_DEVICE_LOGIN',
        ip_address=client_ip,
        device_info=get_user_agent(request),
        metadata={'fingerprint': fingerprint, 'device': device_name},
    )

    try:
        from django.conf import settings as django_settings
        portal_url = getattr(django_settings, 'PORTAL_URL', 'https://portal.studyinfocentre.com')

        user_subject = 'Security Alert – New Device Login Detected'
        user_body = f'''
        <p style="color:#475569;font-size:15px;line-height:1.6;">Hello <strong>{user.full_name}</strong>,</p>
        <p style="color:#475569;font-size:15px;line-height:1.6;">A login to your account was detected from a new device.</p>
        {_info_table(
            _info_row('Device', device_name) +
            _info_row('IP Address', client_ip) +
            _info_row('Date &amp; Time', now_str)
        )}
        <div style="background-color:#fef3c7;border-left:4px solid #f59e0b;padding:14px 18px;border-radius:6px;margin:20px 0;">
          <p style="color:#92400e;font-size:13px;margin:0;"><strong>If this was you</strong>, no action is required.</p>
          <p style="color:#92400e;font-size:13px;margin:6px 0 0;">If you do not recognize this activity, please <strong>change your password immediately</strong> and contact support.</p>
        </div>
        <p style="color:#94a3b8;font-size:13px;">For your security, the system administrator has also been notified.</p>
        '''
        device_portal = getattr(request, '_portal_type', 'agreement')
        user_html = _email_wrap('New Device Login Detected', user_body, portal=device_portal)
        send_mail_with_bcc(
            user_subject, '',
            django_settings.DEFAULT_FROM_EMAIL,
            [user.email],
            html_message=user_html,
            fail_silently=True,
        )

        admin_emails = list(
            User.objects.filter(is_active=True, email__icontains='admin')
            .exclude(id=user.id)
            .values_list('email', flat=True)[:5]
        )
        admin_role_user_ids = UserRole.objects.filter(
            role_id__in=Role.objects.filter(name__icontains='admin').values_list('id', flat=True)
        ).values_list('user_id', flat=True)
        admin_emails_from_roles = list(
            User.objects.filter(id__in=admin_role_user_ids, is_active=True)
            .exclude(id=user.id)
            .values_list('email', flat=True)
        )
        all_admin_emails = list(set(admin_emails + admin_emails_from_roles))

        if all_admin_emails:
            admin_subject = 'Security Alert – New Device Login for User'
            admin_body = f'''
            <p style="color:#475569;font-size:15px;line-height:1.6;">Hello Admin,</p>
            <p style="color:#475569;font-size:15px;line-height:1.6;">A user has logged into the system from a new device.</p>
            {_info_table(
                _info_row('User', user.full_name) +
                _info_row('Email', user.email) +
                _info_row('Device', device_name) +
                _info_row('IP Address', client_ip) +
                _info_row('Date &amp; Time', now_str)
            )}
            <p style="color:#64748b;font-size:14px;">Please review this activity if it appears unusual.</p>
            '''
            admin_html = _email_wrap('New Device Login for User', admin_body)
            send_mail_with_bcc(
                admin_subject, '',
                django_settings.DEFAULT_FROM_EMAIL,
                all_admin_emails,
                html_message=admin_html,
                fail_silently=True,
            )
    except Exception:
        pass

    return True


def create_security_log(user_id=None, event_type='', ip_address=None, device_info=None, metadata=None):
    SecurityAuditLog.objects.create(
        user_id=user_id,
        event_type=event_type,
        ip_address=ip_address,
        device_info=device_info,
        metadata=metadata,
    )


def create_audit_log(user_id=None, action='', entity_type='', entity_id=None, ip_address=None, user_agent=None, metadata=None):
    AuditLog.objects.create(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        ip_address=ip_address,
        user_agent=user_agent,
        metadata=metadata,
    )


def get_password_expiry_info(user):
    password_expired = False
    password_warning = False
    days_until_expiry = None

    if user.force_password_change:
        password_expired = True
    elif user.password_changed_at:
        days_since = (timezone.now() - make_aware_safe(user.password_changed_at)).days
        days_until_expiry = settings.PASSWORD_EXPIRY_DAYS - days_since
        if days_until_expiry <= 0:
            password_expired = True
        elif days_until_expiry <= settings.PASSWORD_WARNING_DAYS:
            password_warning = True

    return password_expired, password_warning, days_until_expiry


def user_to_dict(user):
    return {
        'id': user.id,
        'email': user.email,
        'fullName': user.full_name,
        'isActive': user.is_active,
        'portalAccess': getattr(user, 'portal_access', 'admin') or 'admin',
        'passwordChangedAt': user.password_changed_at.isoformat() if user.password_changed_at else None,
        'lastLoginAt': user.last_login_at.isoformat() if user.last_login_at else None,
        'lastLoginIp': user.last_login_ip,
        'forcePasswordChange': user.force_password_change,
        'createdAt': user.created_at.isoformat() if user.created_at else None,
        'updatedAt': user.updated_at.isoformat() if user.updated_at else None,
    }


def role_to_dict(role):
    return {'id': role.id, 'name': role.name, 'description': role.description}


def get_user_roles_list(user_id):
    role_ids = UserRole.objects.filter(user_id=user_id).values_list('role_id', flat=True)
    roles = Role.objects.filter(id__in=role_ids)
    return [role_to_dict(r) for r in roles]


def _email_wrap(title, body_html, footer_note='', portal='agreement'):
    footer = f'<p style="color:#9ca3af;font-size:12px;margin-top:8px;">{footer_note}</p>' if footer_note else ''
    if portal == 'people':
        header_title = 'HRMS Portal'
        footer_text = 'HRMS &ndash; Study Info Centre'
        gradient = 'linear-gradient(135deg,#0f766e 0%,#14b8a6 100%)'
    else:
        header_title = 'Agreement Portal'
        footer_text = 'Agreement &amp; Commission Management Portal'
        gradient = 'linear-gradient(135deg,#1e40af 0%,#3b82f6 100%)'
    return f'''<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <tr><td style="background:{gradient};padding:32px 40px;text-align:center;">
    <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;letter-spacing:0.5px;">{header_title}</h1>
    <p style="color:#bfdbfe;margin:6px 0 0;font-size:13px;">Study Info Centre</p>
  </td></tr>
  <tr><td style="padding:36px 40px;">
    <h2 style="color:#1e293b;margin:0 0 20px;font-size:20px;font-weight:600;">{title}</h2>
    {body_html}
  </td></tr>
  <tr><td style="background-color:#f8fafc;padding:24px 40px;border-top:1px solid #e2e8f0;text-align:center;">
    <p style="color:#94a3b8;font-size:12px;margin:0;">{footer_text}</p>
    <p style="color:#94a3b8;font-size:11px;margin:4px 0 0;">&copy; {timezone.now().year} Study Info Centre. All rights reserved.</p>
    {footer}
  </td></tr>
</table>
</td></tr></table>
</body></html>'''


def _info_row(label, value, is_link=False):
    val_html = f'<a href="{value}" style="color:#3b82f6;text-decoration:none;font-weight:500;">{value}</a>' if is_link else f'<span style="color:#1e293b;font-weight:500;">{value}</span>'
    return f'<tr><td style="padding:10px 16px;color:#64748b;font-size:14px;border-bottom:1px solid #f1f5f9;width:140px;">{label}</td><td style="padding:10px 16px;font-size:14px;border-bottom:1px solid #f1f5f9;">{val_html}</td></tr>'


def _info_table(rows_html):
    return f'<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin:16px 0;">{rows_html}</table>'


def _button(text, url, color='#3b82f6'):
    return f'<div style="text-align:center;padding:24px 0;"><a href="{url}" style="background-color:{color};color:#ffffff;padding:14px 36px;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;display:inline-block;letter-spacing:0.3px;">{text}</a></div>'


def send_otp_email(email, code, portal='agreement'):
    portal_label = 'HRMS Portal' if portal == 'people' else 'Agreement Portal'
    subject = f'Login Verification Code - {portal_label}'
    if portal == 'people':
        border_color = '#0f766e'
        bg_gradient = 'linear-gradient(135deg,#f0fdfa,#ccfbf1)'
        text_color = '#0f766e'
    else:
        border_color = '#3b82f6'
        bg_gradient = 'linear-gradient(135deg,#eff6ff,#dbeafe)'
        text_color = '#1e40af'
    body = f'''
    <p style="color:#475569;font-size:15px;line-height:1.6;">Your one-time verification code is:</p>
    <div style="text-align:center;padding:24px 0;">
      <div style="display:inline-block;background:{bg_gradient};border:2px solid {border_color};border-radius:12px;padding:20px 48px;letter-spacing:10px;font-size:36px;font-weight:bold;color:{text_color};font-family:'Courier New',monospace;">
        {code}
      </div>
    </div>
    <p style="color:#94a3b8;font-size:13px;text-align:center;">This code expires in <strong>{settings.OTP_EXPIRY_MINUTES} minutes</strong>. Do not share it with anyone.</p>
    '''
    html = _email_wrap('Login Verification Code', body, portal=portal)
    send_mail_with_bcc(
        subject,
        '',
        f'"{settings.FROM_NAME}" <{settings.DEFAULT_FROM_EMAIL}>',
        [email],
        html_message=html,
        fail_silently=False,
    )


class LoginView(APIView):
    authentication_classes = []
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        try:
            email = (request.data.get('email') or '').strip()
            password = request.data.get('password', '')
            if not email or not password or len(password) < 6:
                return Response({'message': 'Invalid credentials format'}, status=400)

            client_ip = get_client_ip(request)

            tracker = login_attempt_tracker.get(email)
            if tracker and tracker.get('lockedUntil', 0) > time.time():
                remain = int(tracker['lockedUntil'] - time.time())
                create_security_log(event_type='LOGIN_LOCKED', ip_address=client_ip, metadata={'email': email, 'remainSec': remain})
                return Response({'message': f'Too many failed attempts. Try again in {remain} seconds.'}, status=429)

            try:
                user = User.objects.get(email=email)
            except User.DoesNotExist:
                return Response({'message': 'Invalid email or password'}, status=401)

            if not user.is_active:
                return Response({'message': 'Invalid email or password'}, status=401)

            host = request.get_host().split(':')[0].lower()
            portal_access = getattr(user, 'portal_access', 'admin') or 'admin'
            is_people_portal = 'people.' in host
            is_admin_portal = not is_people_portal

            if is_admin_portal and portal_access == 'employee':
                return Response({'message': 'You do not have access to this portal. Please use people.studyinfocentre.com'}, status=403)
            if is_people_portal and portal_access == 'admin':
                return Response({'message': 'You do not have access to this portal. Please use portal.studyinfocentre.com'}, status=403)

            if not compare_password(password, user.password_hash):
                entry = login_attempt_tracker.get(email, {'count': 0, 'lockedUntil': 0})
                entry['count'] += 1
                if entry['count'] >= 5:
                    entry['lockedUntil'] = time.time() + 15 * 60
                    entry['count'] = 0
                login_attempt_tracker[email] = entry
                create_audit_log(user_id=user.id, action='LOGIN_FAILED', entity_type='user', entity_id=user.id, ip_address=client_ip)
                create_security_log(user_id=user.id, event_type='LOGIN_FAILED', ip_address=client_ip, device_info=get_user_agent(request))
                return Response({'message': 'Invalid email or password'}, status=401)

            login_attempt_tracker.pop(email, None)

            otp_code = generate_otp()
            otp_hash = hash_otp(otp_code)
            expires_at = timezone.now() + timedelta(minutes=settings.OTP_EXPIRY_MINUTES)

            LoginVerificationCode.objects.create(
                user_id=user.id,
                code_hash=otp_hash,
                expires_at=expires_at,
            )

            otp_sent = False
            portal_type = 'people' if is_people_portal else 'agreement'
            try:
                send_otp_email(user.email, otp_code, portal=portal_type)
                create_security_log(user_id=user.id, event_type='OTP_SENT', ip_address=client_ip, device_info=get_user_agent(request))
                otp_sent = True
                print(f'[OTP] Code for {user.email}: {otp_code} (expires in {settings.OTP_EXPIRY_MINUTES} min)')
            except Exception as e:
                print(f'Failed to send OTP email: {e}')
                create_security_log(user_id=user.id, event_type='OTP_SEND_FAILED', ip_address=client_ip, metadata={'error': str(e)})
                print(f'[OTP FALLBACK] Code for {user.email}: {otp_code} (email delivery failed)')

            request.session['pendingUserId'] = user.id
            request.session['otpRequired'] = True
            request.session.save()

            if not otp_sent:
                return Response({'message': 'Failed to send verification email. Please try again or contact an administrator.'}, status=500)

            masked = re.sub(r'(.{2})(.*)(@.*)', r'\1***\3', user.email)
            return Response({
                'requiresOtp': True,
                'message': 'Verification code sent to your email',
                'email': masked,
            })
        except Exception as e:
            return Response({'message': str(e)}, status=500)


@method_decorator(ensure_csrf_cookie, name='dispatch')
class VerifyOtpView(APIView):
    authentication_classes = []
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        try:
            code = request.data.get('code', '')
            user_id = request.session.get('pendingUserId')
            if not user_id or not request.session.get('otpRequired'):
                return Response({'message': 'No pending verification. Please login again.'}, status=400)

            client_ip = get_client_ip(request)

            active_codes = LoginVerificationCode.objects.filter(
                user_id=user_id,
                status='pending',
                expires_at__gt=timezone.now(),
            ).order_by('-created_at')

            active_code = active_codes.first()
            if not active_code:
                return Response({'message': 'Verification code expired. Please login again.'}, status=400)

            if active_code.attempts >= settings.MAX_OTP_ATTEMPTS:
                active_code.status = 'exhausted'
                active_code.save()
                create_security_log(user_id=user_id, event_type='OTP_EXHAUSTED', ip_address=client_ip)
                request.session.pop('pendingUserId', None)
                request.session.pop('otpRequired', None)
                return Response({'message': 'Too many attempts. Please login again.'}, status=400)

            active_code.attempts += 1
            active_code.save()

            if hash_otp(code) != active_code.code_hash:
                create_security_log(user_id=user_id, event_type='OTP_FAILED', ip_address=client_ip)
                remaining = settings.MAX_OTP_ATTEMPTS - active_code.attempts
                return Response({'message': f'Invalid code. {remaining} attempt(s) remaining.'}, status=401)

            active_code.status = 'used'
            active_code.used_at = timezone.now()
            active_code.save()
            create_security_log(user_id=user_id, event_type='OTP_VERIFIED', ip_address=client_ip, device_info=get_user_agent(request))

            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                return Response({'message': 'User not found'}, status=401)

            perms = get_user_permissions(user.id)
            roles = get_user_roles_list(user.id)

            request.session['userId'] = user.id
            request.session['userPermissions'] = perms
            request.session['portalAccess'] = getattr(user, 'portal_access', 'admin') or 'admin'
            request.session.pop('pendingUserId', None)
            request.session.pop('otpRequired', None)

            device_info = parse_device_info(get_user_agent(request))
            UserSession.objects.create(
                user_id=user.id,
                session_token=request.session.session_key,
                ip_address=client_ip,
                browser=device_info['browser'],
                os=device_info['os'],
                device_type=device_info['deviceType'],
                otp_verified=True,
            )

            host = request.get_host().split(':')[0].lower()
            request._portal_type = 'people' if 'people.' in host else 'agreement'
            is_new_device = check_new_device(user, request, device_info, client_ip)

            user.last_login_at = timezone.now()
            user.last_login_ip = client_ip
            user.save(update_fields=['last_login_at', 'last_login_ip'])

            create_audit_log(user_id=user.id, action='LOGIN_SUCCESS', entity_type='user', entity_id=user.id, ip_address=client_ip)

            password_expired, password_warning, days_until_expiry = get_password_expiry_info(user)
            request.session['passwordExpired'] = password_expired

            return Response({
                'user': user_to_dict(user),
                'permissions': perms,
                'roles': roles,
                'passwordExpired': password_expired,
                'passwordWarning': password_warning,
                'daysUntilExpiry': days_until_expiry,
            })
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class ResendOtpView(APIView):
    authentication_classes = []
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        try:
            user_id = request.session.get('pendingUserId')
            if not user_id or not request.session.get('otpRequired'):
                return Response({'message': 'No pending verification. Please login again.'}, status=400)

            client_ip = get_client_ip(request)
            existing = LoginVerificationCode.objects.filter(
                user_id=user_id, status='pending', expires_at__gt=timezone.now()
            ).order_by('-created_at').first()

            if existing and existing.resend_count >= settings.MAX_OTP_RESENDS:
                return Response({'message': 'Maximum resend limit reached. Please login again.'}, status=429)

            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                return Response({'message': 'User not found'}, status=400)

            otp_code = generate_otp()
            otp_hash = hash_otp(otp_code)
            expires_at = timezone.now() + timedelta(minutes=settings.OTP_EXPIRY_MINUTES)

            new_code = LoginVerificationCode.objects.create(
                user_id=user_id,
                code_hash=otp_hash,
                expires_at=expires_at,
                resend_count=(existing.resend_count + 1) if existing else 1,
            )

            host = request.get_host().split(':')[0].lower()
            portal_type = 'people' if 'people.' in host else 'agreement'
            try:
                send_otp_email(user.email, otp_code, portal=portal_type)
                create_security_log(user_id=user_id, event_type='OTP_RESENT', ip_address=client_ip)
                print(f'[OTP] Resend code for {user.email}: {otp_code}')
            except Exception as e:
                print(f'Failed to resend OTP: {e}')
                return Response({'message': 'Failed to send verification email. Please try again.'}, status=500)

            return Response({'message': 'New verification code sent'})
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class LogoutView(APIView):
    def post(self, request):
        user_id = request.session.get('userId')
        session_key = request.session.session_key
        if user_id:
            matching = UserSession.objects.filter(user_id=user_id, session_token=session_key, is_active=True).first()
            if matching:
                matching.is_active = False
                matching.logout_at = timezone.now()
                matching.logout_reason = 'manual'
                matching.save()
            create_audit_log(user_id=user_id, action='LOGOUT', entity_type='user', entity_id=user_id)
            create_security_log(user_id=user_id, event_type='LOGOUT', ip_address=get_client_ip(request))
        request.session.flush()
        return Response({'message': 'Logged out'})


class ForgotPasswordView(APIView):
    authentication_classes = []
    throttle_classes = [LoginRateThrottle]
    forgot_rate_limit = {}

    def post(self, request):
        try:
            email = (request.data.get('email') or '').strip()
            if not email:
                return Response({'message': 'Email is required'}, status=400)

            client_ip = get_client_ip(request)
            now = time.time()
            rate_entry = self.forgot_rate_limit.get(client_ip)
            if rate_entry and rate_entry.get('resetAt', 0) > now and rate_entry.get('count', 0) >= 5:
                return Response({'message': 'If an account with that email exists, a password reset link has been sent.'})
            if not rate_entry or rate_entry.get('resetAt', 0) <= now:
                self.forgot_rate_limit[client_ip] = {'count': 1, 'resetAt': now + 15 * 60}
            else:
                rate_entry['count'] += 1

            generic = {'message': 'If an account with that email exists, a password reset link has been sent.'}

            try:
                user = User.objects.get(email=email, is_active=True)
            except User.DoesNotExist:
                return Response(generic)

            PasswordResetToken.objects.filter(user_id=user.id, used_at__isnull=True).update(used_at=timezone.now())

            raw_token = secrets.token_bytes(32)
            token_hex = raw_token.hex()
            token_hash = hashlib.sha256(raw_token).hexdigest()
            expires_at = timezone.now() + timedelta(minutes=30)

            PasswordResetToken.objects.create(
                user_id=user.id,
                token_hash=token_hash,
                expires_at=expires_at,
                request_ip=client_ip,
                user_agent=get_user_agent(request),
            )

            create_audit_log(
                user_id=user.id, action='PASSWORD_RESET_REQUESTED', entity_type='user',
                entity_id=user.id, ip_address=client_ip, user_agent=get_user_agent(request),
            )

            proto = request.META.get('HTTP_X_FORWARDED_PROTO', request.scheme)
            host = request.META.get('HTTP_X_FORWARDED_HOST', request.get_host())
            reset_url = f'{proto}://{host}/reset-password?token={token_hex}'

            try:
                subject = 'Password Reset Request - Agreement Portal'
                reset_body = f'''
                <p style="color:#475569;font-size:15px;line-height:1.6;">We received a request to reset your password. Click the button below to create a new password:</p>
                {_button('Reset Password', reset_url)}
                <p style="color:#94a3b8;font-size:13px;text-align:center;">This link expires in <strong>30 minutes</strong>.</p>
                <div style="background-color:#fef2f2;border-left:4px solid #ef4444;padding:14px 18px;border-radius:6px;margin:20px 0;">
                  <p style="color:#991b1b;font-size:13px;margin:0;">If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
                </div>
                '''
                html = _email_wrap('Password Reset Request', reset_body)
                send_mail_with_bcc(subject, '', f'"{settings.FROM_NAME}" <{settings.DEFAULT_FROM_EMAIL}>', [user.email], html_message=html, fail_silently=False)
            except Exception as e:
                print(f'Failed to send password reset email: {e}')
                print(f'Fallback - Reset URL for {user.email}: {reset_url}')

            return Response(generic)
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class ResetPasswordView(APIView):
    authentication_classes = []
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        try:
            token = request.data.get('token', '')
            new_password = request.data.get('newPassword', '')
            if not token:
                return Response({'message': 'Reset token is required'}, status=400)
            if not new_password:
                return Response({'message': 'New password is required'}, status=400)

            policy_error = validate_password_policy(new_password)
            if policy_error:
                return Response({'message': policy_error}, status=400)

            raw_token = bytes.fromhex(token)
            token_hash = hashlib.sha256(raw_token).hexdigest()

            try:
                reset_token = PasswordResetToken.objects.get(token_hash=token_hash)
            except PasswordResetToken.DoesNotExist:
                return Response({'message': 'Invalid or expired reset token'}, status=400)

            if reset_token.used_at:
                return Response({'message': 'This reset token has already been used'}, status=400)
            if timezone.now() > make_aware_safe(reset_token.expires_at):
                return Response({'message': 'This reset token has expired'}, status=400)

            try:
                user = User.objects.get(id=reset_token.user_id, is_active=True)
            except User.DoesNotExist:
                return Response({'message': 'This account is no longer active'}, status=400)

            history = PasswordHistory.objects.filter(user_id=user.id).order_by('-created_at')[:3]
            for h in history:
                if compare_password(new_password, h.password_hash):
                    return Response({'message': 'Cannot reuse a recent password. Please choose a different password.'}, status=400)
            if compare_password(new_password, user.password_hash):
                return Response({'message': 'New password must be different from current password.'}, status=400)

            PasswordHistory.objects.create(user_id=user.id, password_hash=user.password_hash)
            user.password_hash = hash_password(new_password)
            user.password_changed_at = timezone.now()
            user.force_password_change = False
            user.save()

            reset_token.used_at = timezone.now()
            reset_token.save()
            PasswordResetToken.objects.filter(user_id=user.id, used_at__isnull=True).update(used_at=timezone.now())
            UserSession.objects.filter(user_id=user.id, is_active=True).update(is_active=False, logout_at=timezone.now(), logout_reason='password_reset')

            create_audit_log(user_id=user.id, action='PASSWORD_RESET_COMPLETED', entity_type='user', entity_id=user.id, ip_address=get_client_ip(request))

            return Response({'message': 'Password has been reset successfully. Please log in with your new password.'})
        except Exception as e:
            return Response({'message': str(e)}, status=500)


@method_decorator(ensure_csrf_cookie, name='dispatch')
class MeView(APIView):
    authentication_classes = []

    def get(self, request):
        user_id = request.session.get('userId')
        if not user_id:
            return Response({'message': 'Not authenticated'}, status=401)
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'message': 'User not found'}, status=401)

        perms = get_user_permissions(user.id)
        roles = get_user_roles_list(user.id)
        request.session['userPermissions'] = perms

        password_expired, password_warning, days_until_expiry = get_password_expiry_info(user)

        return Response({
            'user': user_to_dict(user),
            'permissions': perms,
            'roles': roles,
            'passwordExpired': password_expired,
            'passwordWarning': password_warning,
            'daysUntilExpiry': days_until_expiry,
        })


class ClientInfoView(APIView):
    @require_auth
    def get(self, request):
        client_ip = get_client_ip(request)
        return Response({'ip': client_ip})


class ChangePasswordView(APIView):
    @require_auth
    def post(self, request):
        try:
            current_password = request.data.get('currentPassword', '')
            new_password = request.data.get('newPassword', '')
            confirm_password = request.data.get('confirmPassword', '')
            user_id = request.session['userId']
            client_ip = get_client_ip(request)

            if not current_password or not new_password or not confirm_password:
                return Response({'message': 'All fields are required'}, status=400)
            if new_password != confirm_password:
                return Response({'message': 'New password and confirmation do not match'}, status=400)

            policy_error = validate_password_policy(new_password)
            if policy_error:
                return Response({'message': policy_error}, status=400)

            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                return Response({'message': 'User not found'}, status=404)

            if not compare_password(current_password, user.password_hash):
                create_security_log(user_id=user_id, event_type='PASSWORD_CHANGE_FAILED', ip_address=client_ip, metadata={'reason': 'wrong_current'})
                return Response({'message': 'Current password is incorrect'}, status=401)

            history = PasswordHistory.objects.filter(user_id=user_id).order_by('-created_at')[:3]
            for h in history:
                if compare_password(new_password, h.password_hash):
                    return Response({'message': 'Cannot reuse a recent password. Please choose a different password.'}, status=400)
            if compare_password(new_password, user.password_hash):
                return Response({'message': 'New password must be different from current password.'}, status=400)

            PasswordHistory.objects.create(user_id=user_id, password_hash=user.password_hash)
            user.password_hash = hash_password(new_password)
            user.password_changed_at = timezone.now()
            user.force_password_change = False
            user.save()

            create_security_log(user_id=user_id, event_type='PASSWORD_CHANGED', ip_address=client_ip)
            create_audit_log(user_id=user_id, action='PASSWORD_CHANGED', entity_type='user', entity_id=user_id, ip_address=client_ip)
            request.session['passwordExpired'] = False

            return Response({'message': 'Password changed successfully'})
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class HeartbeatView(APIView):

    @require_auth
    def post(self, request):
        try:
            user_id = request.session['userId']
            session_key = request.session.session_key
            match = UserSession.objects.filter(user_id=user_id, session_token=session_key, is_active=True).first()
            if match:
                match.last_activity_at = timezone.now()
                match.save(update_fields=['last_activity_at'])
            return Response({'active': True})
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class SessionsView(APIView):
    @require_auth
    def get(self, request):
        try:
            user_id = request.session['userId']
            current_token = request.session.session_key
            sessions = UserSession.objects.filter(user_id=user_id).order_by('-login_at')
            result = []
            for s in sessions:
                d = {
                    'id': s.id,
                    'userId': s.user_id,
                    'ipAddress': s.ip_address,
                    'browser': s.browser,
                    'os': s.os,
                    'deviceType': s.device_type,
                    'location': s.location,
                    'loginAt': s.login_at.isoformat() if s.login_at else None,
                    'lastActivityAt': s.last_activity_at.isoformat() if s.last_activity_at else None,
                    'logoutAt': s.logout_at.isoformat() if s.logout_at else None,
                    'logoutReason': s.logout_reason,
                    'isActive': s.is_active,
                    'otpVerified': s.otp_verified,
                    'isCurrent': s.session_token == current_token,
                }
                result.append(d)
            return Response(result)
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class SessionLogoutView(APIView):
    @require_auth
    def post(self, request, session_id):
        try:
            session = UserSession.objects.filter(id=session_id).first()
            if not session or session.user_id != request.session['userId']:
                return Response({'message': 'Session not found'}, status=404)
            session.is_active = False
            session.logout_at = timezone.now()
            session.logout_reason = 'remote_logout'
            session.save()
            create_security_log(user_id=request.session['userId'], event_type='REMOTE_LOGOUT', ip_address=get_client_ip(request), metadata={'targetSessionId': session_id})
            return Response({'message': 'Session logged out'})
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class LogoutOthersView(APIView):
    @require_auth
    def post(self, request):
        try:
            user_id = request.session['userId']
            current_token = request.session.session_key
            current_session = UserSession.objects.filter(user_id=user_id, session_token=current_token, is_active=True).first()
            exclude_id = current_session.id if current_session else None
            qs = UserSession.objects.filter(user_id=user_id, is_active=True)
            if exclude_id:
                qs = qs.exclude(id=exclude_id)
            qs.update(is_active=False, logout_at=timezone.now(), logout_reason='logout_others')
            create_security_log(user_id=user_id, event_type='LOGOUT_ALL_OTHERS', ip_address=get_client_ip(request))
            return Response({'message': 'All other sessions logged out'})
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class SecurityLogsView(APIView):
    pagination_class = StandardPagination

    @require_auth
    def get(self, request):
        try:
            user_id = request.session['userId']
            qs = SecurityAuditLog.objects.filter(user_id=user_id).order_by('-created_at')
            paginator = self.pagination_class()
            page = paginator.paginate_queryset(qs, request)
            items = page if page is not None else list(qs)
            result = [{
                'id': l.id, 'userId': l.user_id, 'eventType': l.event_type,
                'ipAddress': l.ip_address, 'deviceInfo': l.device_info,
                'metadata': l.metadata, 'createdAt': l.created_at.isoformat() if l.created_at else None,
            } for l in items]
            if page is not None:
                return paginator.get_paginated_response(result)
            return Response(result)
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class AdminUserSessionsView(APIView):
    @require_permission("security.user.manage")
    def get(self, request, user_id):
        try:
            sessions = UserSession.objects.filter(user_id=user_id).order_by('-login_at')
            result = [{
                'id': s.id, 'userId': s.user_id, 'ipAddress': s.ip_address,
                'browser': s.browser, 'os': s.os, 'deviceType': s.device_type,
                'location': s.location,
                'loginAt': s.login_at.isoformat() if s.login_at else None,
                'lastActivityAt': s.last_activity_at.isoformat() if s.last_activity_at else None,
                'logoutAt': s.logout_at.isoformat() if s.logout_at else None,
                'logoutReason': s.logout_reason, 'isActive': s.is_active, 'otpVerified': s.otp_verified,
            } for s in sessions]
            return Response(result)
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class AdminUserSecurityLogsView(APIView):
    @require_permission("security.user.manage")
    def get(self, request, user_id):
        try:
            logs = SecurityAuditLog.objects.filter(user_id=user_id).order_by('-created_at')[:100]
            result = [{
                'id': l.id, 'userId': l.user_id, 'eventType': l.event_type,
                'ipAddress': l.ip_address, 'deviceInfo': l.device_info,
                'metadata': l.metadata, 'createdAt': l.created_at.isoformat() if l.created_at else None,
            } for l in logs]
            return Response(result)
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class UsersListView(APIView):
    pagination_class = StandardPagination

    @require_permission("security.user.manage")
    def get(self, request):
        qs = User.objects.all().order_by('id')
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request)
        items = page if page is not None else list(qs)
        result = []
        for u in items:
            d = user_to_dict(u)
            d['roles'] = get_user_roles_list(u.id)
            result.append(d)
        if page is not None:
            return paginator.get_paginated_response(result)
        return Response(result)

    @require_permission("security.user.manage")
    def post(self, request):
        try:
            email = request.data.get('email', '')
            full_name = request.data.get('fullName', '')
            password = request.data.get('password', '')
            role_id = request.data.get('roleId')

            if not password or len(password) < 12:
                return Response({'message': 'Password must be at least 12 characters'}, status=400)
            if not re.search(r'[A-Z]', password) or not re.search(r'[a-z]', password) or not re.search(r'\d', password):
                return Response({'message': 'Password must include uppercase, lowercase, and a number'}, status=400)

            portal_access = request.data.get('portalAccess', 'admin')
            if portal_access not in ('admin', 'employee', 'both'):
                portal_access = 'admin'

            hashed = hash_password(password)
            user = User.objects.create(
                email=email,
                full_name=full_name,
                password_hash=hashed,
                is_active=True,
                force_password_change=True,
                portal_access=portal_access,
            )
            if role_id:
                UserRole.objects.create(user_id=user.id, role_id=role_id)

            try:
                from django.conf import settings as django_settings
                portal_url = getattr(django_settings, 'PORTAL_URL', 'https://portal.studyinfocentre.com')
                subject = 'Your Account Has Been Created \u2013 Temporary Password'
                welcome_body = f'''
                <p style="color:#475569;font-size:15px;line-height:1.6;">Hello <strong>{full_name}</strong>,</p>
                <p style="color:#475569;font-size:15px;line-height:1.6;">Your account has been successfully created. You can log in using the details below:</p>
                {_info_table(
                    _info_row('Login Email', email) +
                    _info_row('Temporary Password', password) +
                    _info_row('Login Link', portal_url, is_link=True)
                )}
                {_button('Login to Portal', portal_url)}
                <div style="background-color:#fef3c7;border-left:4px solid #f59e0b;padding:14px 18px;border-radius:6px;margin:20px 0;">
                  <p style="color:#92400e;font-size:13px;margin:0;">For security reasons, please <strong>change your password immediately</strong> after your first login.</p>
                </div>
                <p style="color:#94a3b8;font-size:13px;">If you did not request this account or need assistance, please contact the system administrator.</p>
                '''
                welcome_html = _email_wrap('Welcome to Agreement Portal', welcome_body)
                send_mail_with_bcc(
                    subject,
                    '',
                    django_settings.DEFAULT_FROM_EMAIL,
                    [email],
                    html_message=welcome_html,
                    fail_silently=True,
                )
            except Exception:
                pass

            return Response(user_to_dict(user))
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class UserRolesView(APIView):
    @require_permission("security.user.manage")
    def get(self, request, user_id):
        return Response(get_user_roles_list(user_id))

    @require_permission("security.role.manage")
    def post(self, request, user_id):
        try:
            role_id = request.data.get('roleId')
            UserRole.objects.create(user_id=user_id, role_id=role_id)
            return Response({'message': 'Role assigned'})
        except Exception as e:
            return Response({'message': str(e)}, status=500)

    @require_permission("security.role.manage")
    def put(self, request, user_id):
        try:
            role_ids = request.data.get('roleIds', [])
            if not isinstance(role_ids, list):
                return Response({'message': 'roleIds must be an array'}, status=400)
            old_roles = get_user_roles_list(user_id)
            UserRole.objects.filter(user_id=user_id).delete()
            for rid in role_ids:
                UserRole.objects.create(user_id=user_id, role_id=rid)
            create_audit_log(
                user_id=request.session.get('userId'), action='USER_ROLES_UPDATE',
                entity_type='user', entity_id=user_id, ip_address=get_client_ip(request),
                metadata={'oldRoles': [r['name'] for r in old_roles], 'newRoleIds': role_ids},
            )
            return Response({'message': 'User roles updated'})
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class UserRoleDeleteView(APIView):
    @require_permission("security.role.manage")
    def delete(self, request, user_id, role_id):
        try:
            UserRole.objects.filter(user_id=user_id, role_id=role_id).delete()
            return Response({'message': 'Role removed'})
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class UserNameUpdateView(APIView):
    @require_permission("security.user.manage")
    def patch(self, request, user_id):
        try:
            full_name = (request.data.get('fullName') or '').strip()
            if not full_name:
                return Response({'message': 'Full name is required'}, status=400)
            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                return Response({'message': 'User not found'}, status=404)
            old_name = user.full_name
            user.full_name = full_name
            user.save(update_fields=['full_name'])
            create_audit_log(
                user_id=request.session.get('userId'), action='USER_NAME_UPDATE',
                entity_type='user', entity_id=user_id, ip_address=get_client_ip(request),
                metadata={'oldName': old_name, 'newName': full_name},
            )
            return Response({'message': 'User name updated'})
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class UserEmailUpdateView(APIView):
    @require_permission("security.user.manage")
    def patch(self, request, user_id):
        try:
            email = (request.data.get('email') or '').strip().lower()
            if not email:
                return Response({'message': 'Email is required'}, status=400)
            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                return Response({'message': 'User not found'}, status=404)
            if User.objects.filter(email=email).exclude(id=user_id).exists():
                return Response({'message': 'Email already in use by another user'}, status=400)
            old_email = user.email
            user.email = email
            user.save(update_fields=['email'])
            create_audit_log(
                user_id=request.session.get('userId'), action='USER_EMAIL_UPDATE',
                entity_type='user', entity_id=user_id, ip_address=get_client_ip(request),
                metadata={'oldEmail': old_email, 'newEmail': email},
            )
            return Response({'message': 'User email updated'})
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class UserPortalAccessUpdateView(APIView):
    @require_permission("security.user.manage")
    def patch(self, request, user_id):
        try:
            portal_access = request.data.get('portalAccess', '')
            if portal_access not in ('admin', 'employee', 'both'):
                return Response({'message': 'portalAccess must be admin, employee, or both'}, status=400)
            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                return Response({'message': 'User not found'}, status=404)
            old_access = user.portal_access
            user.portal_access = portal_access
            user.save(update_fields=['portal_access'])
            create_audit_log(
                user_id=request.session.get('userId'), action='USER_PORTAL_ACCESS_UPDATE',
                entity_type='user', entity_id=user_id, ip_address=get_client_ip(request),
                metadata={'oldAccess': old_access, 'newAccess': portal_access},
            )
            return Response({'message': 'Portal access updated'})
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class UserStatusUpdateView(APIView):
    @require_permission("security.user.manage")
    def patch(self, request, user_id):
        try:
            is_active = request.data.get('isActive')
            if not isinstance(is_active, bool):
                return Response({'message': 'isActive must be a boolean'}, status=400)
            if user_id == request.session.get('userId'):
                return Response({'message': 'You cannot deactivate your own account'}, status=400)
            User.objects.filter(id=user_id).update(is_active=is_active)
            if not is_active:
                UserSession.objects.filter(user_id=user_id, is_active=True).update(
                    is_active=False, logout_at=timezone.now(), logout_reason='account_deactivated'
                )
            create_audit_log(
                user_id=request.session.get('userId'),
                action='USER_ACTIVATED' if is_active else 'USER_DEACTIVATED',
                entity_type='user', entity_id=user_id, ip_address=get_client_ip(request),
            )
            return Response({'message': 'User activated' if is_active else 'User deactivated'})
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class RolesListView(APIView):
    @require_auth
    def get(self, request):
        perms = request.session.get('userPermissions', [])
        if 'security.role.manage' not in perms and 'security.user.manage' not in perms:
            return Response({'message': 'Forbidden'}, status=403)
        roles = Role.objects.all().order_by('id')
        result = []
        for r in roles:
            count = UserRole.objects.filter(role_id=r.id).count()
            result.append({**role_to_dict(r), 'userCount': count})
        return Response(result)

    @require_permission("security.role.manage")
    def post(self, request):
        try:
            name = (request.data.get('name') or '').strip()
            description = request.data.get('description', '')
            if not name:
                return Response({'message': 'Role name is required'}, status=400)
            role = Role.objects.create(name=name, description=description)
            create_audit_log(
                user_id=request.session.get('userId'), action='ROLE_CREATE',
                entity_type='role', entity_id=role.id, ip_address=get_client_ip(request),
                metadata={'name': role.name},
            )
            return Response(role_to_dict(role))
        except Exception as e:
            if 'unique' in str(e).lower():
                return Response({'message': 'A role with this name already exists'}, status=409)
            return Response({'message': str(e)}, status=500)


class RoleDetailView(APIView):
    @require_permission("security.role.manage")
    def get(self, request, role_id):
        try:
            role = Role.objects.get(id=role_id)
        except Role.DoesNotExist:
            return Response({'message': 'Role not found'}, status=404)
        return Response(role_to_dict(role))

    @require_permission("security.role.manage")
    def patch(self, request, role_id):
        try:
            try:
                role = Role.objects.get(id=role_id)
            except Role.DoesNotExist:
                return Response({'message': 'Role not found'}, status=404)
            old_name = role.name
            if 'name' in request.data:
                role.name = request.data['name']
            if 'description' in request.data:
                role.description = request.data['description']
            role.save()
            create_audit_log(
                user_id=request.session.get('userId'), action='ROLE_UPDATE',
                entity_type='role', entity_id=role_id, ip_address=get_client_ip(request),
                metadata={'oldName': old_name, 'newName': role.name},
            )
            return Response(role_to_dict(role))
        except Exception as e:
            return Response({'message': str(e)}, status=500)

    @require_permission("security.role.manage")
    def delete(self, request, role_id):
        try:
            user_count = UserRole.objects.filter(role_id=role_id).count()
            if user_count > 0:
                return Response({'message': f'Cannot delete role: {user_count} users still assigned.'}, status=400)
            Role.objects.filter(id=role_id).delete()
            create_audit_log(
                user_id=request.session.get('userId'), action='ROLE_DELETE',
                entity_type='role', entity_id=role_id, ip_address=get_client_ip(request),
            )
            return Response({'message': 'Role deleted'})
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class RolePermissionsView(APIView):
    @require_permission("security.role.manage")
    def get(self, request, role_id):
        perm_ids = list(RolePermission.objects.filter(role_id=role_id).values_list('permission_id', flat=True))
        return Response(perm_ids)

    @require_permission("security.role.manage")
    def put(self, request, role_id):
        try:
            try:
                role = Role.objects.get(id=role_id)
            except Role.DoesNotExist:
                return Response({'message': 'Role not found'}, status=404)

            perm_ids = request.data.get('permissionIds', [])
            if not isinstance(perm_ids, list):
                return Response({'message': 'permissionIds must be an array'}, status=400)

            old_perm_ids = list(RolePermission.objects.filter(role_id=role_id).values_list('permission_id', flat=True))

            admin_codes = ['security.role.manage', 'security.user.manage']
            admin_perms = Permission.objects.filter(code__in=admin_codes)
            admin_perm_ids = list(admin_perms.values_list('id', flat=True))

            other_roles_with_admin = RolePermission.objects.filter(
                permission_id__in=admin_perm_ids
            ).exclude(role_id=role_id).values_list('role_id', flat=True).distinct()
            roles_with_users = UserRole.objects.filter(role_id__in=other_roles_with_admin).exists()

            if not roles_with_users:
                would_remove = any(ap_id not in perm_ids for ap_id in admin_perm_ids)
                if would_remove:
                    return Response({'message': 'Cannot remove admin permissions from the last admin role.'}, status=400)

            RolePermission.objects.filter(role_id=role_id).delete()
            for pid in perm_ids:
                RolePermission.objects.create(role_id=role_id, permission_id=pid)

            create_audit_log(
                user_id=request.session.get('userId'), action='ROLE_PERMISSIONS_UPDATE',
                entity_type='role', entity_id=role_id, ip_address=get_client_ip(request),
                metadata={'oldPermissionCount': len(old_perm_ids), 'newPermissionCount': len(perm_ids)},
            )
            return Response({'message': 'Permissions updated'})
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class RoleDuplicateView(APIView):
    @require_permission("security.role.manage")
    def post(self, request, role_id):
        try:
            try:
                original = Role.objects.get(id=role_id)
            except Role.DoesNotExist:
                return Response({'message': 'Role not found'}, status=404)

            new_name = request.data.get('name', f'{original.name} (Copy)')
            new_role = Role.objects.create(name=new_name, description=original.description)
            perms = RolePermission.objects.filter(role_id=role_id)
            for p in perms:
                RolePermission.objects.create(role_id=new_role.id, permission_id=p.permission_id)

            create_audit_log(
                user_id=request.session.get('userId'), action='ROLE_DUPLICATE',
                entity_type='role', entity_id=new_role.id, ip_address=get_client_ip(request),
                metadata={'sourceRoleId': role_id, 'sourceName': original.name, 'newName': new_role.name},
            )
            return Response(role_to_dict(new_role))
        except Exception as e:
            if 'unique' in str(e).lower():
                return Response({'message': 'A role with this name already exists'}, status=409)
            return Response({'message': str(e)}, status=500)
