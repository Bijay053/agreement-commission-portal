from django.conf import settings
from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin


CSP_POLICY = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline'; "
    "style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data: blob:; "
    "connect-src 'self'; "
    "font-src 'self' data:; "
    "frame-ancestors 'none'"
)


class CSPMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if not settings.DEBUG:
            response['Content-Security-Policy'] = CSP_POLICY
        return response


CSRF_EXEMPT_PATHS = [
    '/api/auth/login',
    '/api/auth/verify-otp',
    '/api/auth/resend-otp',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
]


class CsrfExemptPreAuthMiddleware(MiddlewareMixin):
    def process_view(self, request, callback, callback_args, callback_kwargs):
        if any(request.path == p or request.path.startswith(p + '/') for p in CSRF_EXEMPT_PATHS):
            setattr(request, '_dont_enforce_csrf_checks', True)
        return None


class SessionAuthMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith('/api/') and request.session.get('userId'):
            exempt_paths = [
                '/api/auth/me',
                '/api/auth/change-password',
                '/api/auth/logout',
                '/api/auth/heartbeat',
                '/api/auth/sessions',
                '/api/auth/login',
                '/api/auth/verify-otp',
                '/api/auth/resend-otp',
                '/api/auth/forgot-password',
                '/api/auth/reset-password',
            ]
            if not any(request.path == p or request.path.startswith(p + '/') for p in exempt_paths):
                if request.session.get('passwordExpired'):
                    return JsonResponse(
                        {'message': 'Password expired. Please change your password before continuing.'},
                        status=403
                    )

        response = self.get_response(request)
        return response
