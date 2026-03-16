import functools
from rest_framework.response import Response


LEGACY_PERMISSION_MAP = {
    "agreement.view": "agreements.agreement.read",
    "agreement.create": "agreements.agreement.add",
    "agreement.edit": "agreements.agreement.update",
    "agreement.delete": "agreements.agreement.delete",
    "agreement.notes.view_sensitive": "agreements.notes.read",
    "agreement.notes.edit_sensitive": "agreements.notes.update",
    "targets.view": "targets.target.read",
    "targets.create": "targets.target.add",
    "targets.edit": "targets.target.update",
    "targets.delete": "targets.target.delete",
    "targets.export": "targets.target.export",
    "commission.view": "commission.commission_rule.read",
    "commission.create": "commission.commission_rule.add",
    "commission.edit": "commission.commission_rule.update",
    "commission.delete": "commission.commission_rule.delete",
    "commission.export": "commission.commission_rule.export",
    "bonus.view": "bonus.bonus_rule.read",
    "bonus.create": "bonus.bonus_rule.add",
    "bonus.edit": "bonus.bonus_rule.update",
    "bonus.delete": "bonus.bonus_rule.delete",
    "bonus.export": "bonus.bonus_rule.export",
    "commission_tracker.view": "commission_tracker.student.read",
    "commission_tracker.create": "commission_tracker.student.add",
    "commission_tracker.edit": "commission_tracker.student.update",
    "commission_tracker.delete": "commission_tracker.student.delete",
    "commission_tracker.export": "commission_tracker.student.export",
    "commission_tracker.entry.view": "commission_tracker.entry.read",
    "commission_tracker.entry.create": "commission_tracker.entry.add",
    "commission_tracker.entry.edit": "commission_tracker.entry.update",
    "commission_tracker.entry.delete": "commission_tracker.entry.delete",
    "commission_tracker.entry.export": "commission_tracker.entry.export",
    "commission_tracker.student.delete_master": "commission_tracker.student.delete_master",
    "commission_tracker.master.edit": "commission_tracker.master.edit",
    "contacts.view": "contacts.contact.read",
    "contacts.create": "contacts.contact.add",
    "contacts.edit": "contacts.contact.update",
    "contacts.delete": "contacts.contact.delete",
    "contacts.export": "contacts.contact.export",
    "sub_agent_commission.view": "sub_agent_commission.entry.read",
    "sub_agent_commission.create": "sub_agent_commission.entry.add",
    "sub_agent_commission.edit": "sub_agent_commission.entry.update",
    "sub_agent_commission.delete": "sub_agent_commission.entry.delete",
    "document.list": "documents.document.list",
    "document.view_in_portal": "documents.document.view_in_portal",
    "document.download": "documents.document.download",
    "document.upload": "documents.document.upload",
    "document.replace": "documents.document.replace",
    "document.delete": "documents.document.delete",
    "audit.view": "administration.audit.read",
    "security.user.manage": "administration.user.update",
    "security.role.manage": "administration.role.update",
    "security.country_scope.manage": "administration.country_scope.update",
    "reminders.view": "reminders.reminder.read",
    "reminders.manage": "reminders.reminder.update",
    "providers.provider.read": "providers.provider.read",
    "providers.provider.add": "providers.provider.add",
    "providers.provider.update": "providers.provider.update",
    "providers.provider.delete": "providers.provider.delete",
    "portal_access.view": "portal_access.portal.view",
    "portal_access.edit": "portal_access.portal.edit",
    "portal_access.reveal": "portal_access.portal.reveal",
    "portal_access.delete": "portal_access.portal.delete",
    "portal_access.logs": "portal_access.portal.logs",
}


IMPLIED_PERMISSIONS = {
    "commission_tracker.view": [
        "commission_tracker.entry.view", "commission_tracker.entry.read",
        "commission_tracker.field.financials",
    ],
    "commission_tracker.create": [
        "commission_tracker.entry.create", "commission_tracker.entry.add",
        "commission_tracker.field.financials",
    ],
    "commission_tracker.edit": [
        "commission_tracker.entry.edit", "commission_tracker.entry.update",
        "commission_tracker.master.edit",
        "commission_tracker.field.financials",
    ],
    "commission_tracker.delete": [
        "commission_tracker.entry.delete",
    ],
    "commission_tracker.export": [
        "commission_tracker.entry.export",
        "commission_tracker.field.financials",
    ],
    "commission_tracker.student.read": [
        "commission_tracker.entry.read", "commission_tracker.entry.view",
        "commission_tracker.field.financials",
    ],
    "commission_tracker.student.add": [
        "commission_tracker.entry.add", "commission_tracker.entry.create",
        "commission_tracker.field.financials",
    ],
    "commission_tracker.student.update": [
        "commission_tracker.entry.update", "commission_tracker.entry.edit",
        "commission_tracker.master.edit",
        "commission_tracker.field.financials",
    ],
    "commission_tracker.student.delete": [
        "commission_tracker.entry.delete",
    ],
    "commission_tracker.student.export": [
        "commission_tracker.entry.export",
        "commission_tracker.field.financials",
    ],
    "commission_tracker.entry.read": [
        "commission_tracker.field.financials",
    ],
    "commission_tracker.entry.update": [
        "commission_tracker.field.financials",
    ],
    "portal_access.edit": [
        "portal_access.view",
    ],
    "portal_access.delete": [
        "portal_access.view",
    ],
    "portal_access.reveal": [
        "portal_access.view",
    ],
    "portal_access.portal.edit": [
        "portal_access.view", "portal_access.portal.view",
    ],
    "portal_access.portal.delete": [
        "portal_access.view", "portal_access.portal.view",
    ],
    "portal_access.portal.reveal": [
        "portal_access.view", "portal_access.portal.view",
    ],
    "portal_access.portal.logs": [
        "portal_access.view", "portal_access.portal.view",
    ],
}


def get_user_permissions(user_id):
    from accounts.models import UserRole, RolePermission, Permission
    role_ids = UserRole.objects.filter(user_id=user_id).values_list('role_id', flat=True)
    perm_ids = RolePermission.objects.filter(role_id__in=role_ids).values_list('permission_id', flat=True)
    raw_codes = list(Permission.objects.filter(id__in=perm_ids).values_list('code', flat=True))
    all_codes = set(raw_codes)
    for legacy_code, new_code in LEGACY_PERMISSION_MAP.items():
        if legacy_code in all_codes:
            all_codes.add(new_code)
        if new_code in all_codes:
            all_codes.add(legacy_code)
    expanded = set(all_codes)
    for code in all_codes:
        if code in IMPLIED_PERMISSIONS:
            expanded.update(IMPLIED_PERMISSIONS[code])
    return list(expanded)


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
