from django.conf import settings
from importlib import import_module
from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin


class ExtensionSessionMiddleware:
    """
    Allows Chrome extension to authenticate via X-Session-Token header.
    This is needed because MV3 service workers cannot reliably set Cookie headers.
    Must be placed AFTER SessionMiddleware in MIDDLEWARE list.
    """
    EXTENSION_PATHS = [
        '/api/portal-access/match',
        '/api/portal-access/autofill-log',
        '/api/auth/me',
    ]

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        token = request.META.get('HTTP_X_SESSION_TOKEN', '').strip()
        if token and request.path.startswith('/api/'):
            if not request.session.get('userId'):
                is_ext_path = any(
                    request.path == p or request.path.startswith('/api/portal-access/')
                    for p in self.EXTENSION_PATHS
                )
                if is_ext_path:
                    try:
                        engine = import_module(settings.SESSION_ENGINE)
                        store = engine.SessionStore(session_key=token)
                        data = store.load()
                        if data and store.get('userId'):
                            request.session = store
                    except Exception:
                        pass
        return self.get_response(request)


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
        if request.path.startswith('/api/'):
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
