from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class SessionUserRateThrottle(UserRateThrottle):
    def get_cache_key(self, request, view):
        user_id = None
        if hasattr(request, 'session'):
            user_id = request.session.get('userId')
        if user_id:
            ident = str(user_id)
        else:
            ident = self.get_ident(request)
        return self.cache_format % {'scope': self.scope, 'ident': ident}


class LoginRateThrottle(AnonRateThrottle):
    scope = 'login'
