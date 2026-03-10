from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import PermissionDenied
from django.middleware.csrf import CsrfViewMiddleware


class _CsrfCheck(CsrfViewMiddleware):
    def _reject(self, request, reason):
        return reason


class SessionCsrfAuthentication(BaseAuthentication):
    def authenticate(self, request):
        user_id = request.session.get('userId')
        if not user_id:
            return None

        self._enforce_csrf(request)
        return None

    def _enforce_csrf(self, request):
        check = _CsrfCheck(lambda req: None)
        reason = check.process_view(request, None, (), {})
        if reason:
            raise PermissionDenied(f'CSRF Failed: {reason}')
