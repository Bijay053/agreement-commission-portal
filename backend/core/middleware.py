from django.http import JsonResponse


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
