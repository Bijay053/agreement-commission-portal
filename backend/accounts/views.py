import hashlib
import os
import re
import secrets
import time
from datetime import timedelta

import bcrypt
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import (
    LoginVerificationCode, PasswordHistory, PasswordResetToken,
    Permission, Role, RolePermission, SecurityAuditLog, User,
    UserRole, UserSession,
)
from audit.models import AuditLog
from core.permissions import get_user_permissions, require_auth, require_permission

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
        days_since = (timezone.now() - user.password_changed_at).days
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


def send_otp_email(email, code):
    subject = 'Login Verification Code - Agreement Portal'
    html = f'''
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #3b82f6;">
            <h1 style="color: #1e40af; margin: 0;">Agreement Portal</h1>
            <p style="color: #6b7280; margin: 5px 0 0;">Study Info Centre</p>
        </div>
        <div style="padding: 30px 0;">
            <h2 style="color: #111827;">Login Verification Code</h2>
            <p style="color: #4b5563;">Your verification code:</p>
            <div style="text-align: center; padding: 20px 0;">
                <div style="display: inline-block; background-color: #f3f4f6; border: 2px solid #3b82f6; border-radius: 8px; padding: 16px 40px; letter-spacing: 8px; font-size: 32px; font-weight: bold; color: #1e40af; font-family: monospace;">
                    {code}
                </div>
            </div>
            <p style="color: #6b7280; font-size: 14px;">This code expires in {settings.OTP_EXPIRY_MINUTES} minutes.</p>
        </div>
    </div>
    '''
    send_mail(
        subject,
        '',
        f'"{settings.FROM_NAME}" <{settings.DEFAULT_FROM_EMAIL}>',
        [email],
        html_message=html,
        fail_silently=False,
    )


class LoginView(APIView):
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
            try:
                send_otp_email(user.email, otp_code)
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


class VerifyOtpView(APIView):
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

            try:
                send_otp_email(user.email, otp_code)
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
                html = f'''
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h1 style="color: #1e40af;">Agreement Portal</h1>
                    <h2>Password Reset Request</h2>
                    <p>Click below to reset your password:</p>
                    <a href="{reset_url}" style="background-color: #3b82f6; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a>
                    <p style="font-size: 14px; color: #6b7280;">This link expires in 30 minutes.</p>
                </div>
                '''
                send_mail(subject, '', f'"{settings.FROM_NAME}" <{settings.DEFAULT_FROM_EMAIL}>', [user.email], html_message=html, fail_silently=False)
            except Exception as e:
                print(f'Failed to send password reset email: {e}')
                print(f'Fallback - Reset URL for {user.email}: {reset_url}')

            return Response(generic)
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class ResetPasswordView(APIView):
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
            if timezone.now() > reset_token.expires_at:
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


class MeView(APIView):
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
    @require_auth
    def get(self, request):
        try:
            user_id = request.session['userId']
            logs = SecurityAuditLog.objects.filter(user_id=user_id).order_by('-created_at')[:50]
            result = [{
                'id': l.id, 'userId': l.user_id, 'eventType': l.event_type,
                'ipAddress': l.ip_address, 'deviceInfo': l.device_info,
                'metadata': l.metadata, 'createdAt': l.created_at.isoformat() if l.created_at else None,
            } for l in logs]
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
    @require_permission("security.user.manage")
    def get(self, request):
        users = User.objects.all().order_by('id')
        result = []
        for u in users:
            d = user_to_dict(u)
            d['roles'] = get_user_roles_list(u.id)
            result.append(d)
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

            hashed = hash_password(password)
            user = User.objects.create(email=email, full_name=full_name, password_hash=hashed, is_active=True)
            if role_id:
                UserRole.objects.create(user_id=user.id, role_id=role_id)
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
