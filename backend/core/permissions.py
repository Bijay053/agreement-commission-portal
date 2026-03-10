import functools
from rest_framework.response import Response


def get_user_permissions(user_id):
    from accounts.models import UserRole, RolePermission, Permission
    role_ids = UserRole.objects.filter(user_id=user_id).values_list('role_id', flat=True)
    perm_ids = RolePermission.objects.filter(role_id__in=role_ids).values_list('permission_id', flat=True)
    return list(Permission.objects.filter(id__in=perm_ids).values_list('code', flat=True))


def require_auth(view_func):
    @functools.wraps(view_func)
    def wrapper(self_or_request, *args, **kwargs):
        request = self_or_request if hasattr(self_or_request, 'session') else args[0] if args else self_or_request
        if hasattr(self_or_request, 'request'):
            request = self_or_request.request
        elif not hasattr(self_or_request, 'session') and args:
            request = args[0]
        else:
            request = self_or_request

        user_id = request.session.get('userId')
        if not user_id:
            return Response({'message': 'Authentication required'}, status=401)
        return view_func(self_or_request, *args, **kwargs)
    return wrapper


def require_permission(*codes):
    def decorator(view_func):
        @functools.wraps(view_func)
        def wrapper(self_or_request, *args, **kwargs):
            request = self_or_request if hasattr(self_or_request, 'session') else args[0] if args else self_or_request
            if hasattr(self_or_request, 'request'):
                request = self_or_request.request
            elif not hasattr(self_or_request, 'session') and args:
                request = args[0]
            else:
                request = self_or_request

            user_id = request.session.get('userId')
            if not user_id:
                return Response({'message': 'Authentication required'}, status=401)

            user_perms = request.session.get('userPermissions', [])
            has_perm = any(code in user_perms for code in codes)
            if not has_perm:
                return Response({'message': 'Insufficient permissions'}, status=403)
            return view_func(self_or_request, *args, **kwargs)
        return wrapper

    if len(codes) == 1 and callable(codes[0]):
        func = codes[0]
        codes = ()
        return require_auth(func)

    return decorator


def check_password_expired(request):
    exempt_paths = [
        '/api/auth/me',
        '/api/auth/change-password',
        '/api/auth/logout',
        '/api/auth/heartbeat',
        '/api/auth/sessions',
    ]
    if any(request.path == p or request.path.startswith(p + '/') for p in exempt_paths):
        return None
    if request.session.get('passwordExpired'):
        return Response(
            {'message': 'Password expired. Please change your password before continuing.'},
            status=403
        )
    return None
