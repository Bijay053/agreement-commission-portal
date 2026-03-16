from rest_framework.views import APIView
from rest_framework.response import Response
from core.permissions import require_auth, require_permission, LEGACY_PERMISSION_MAP
from core.models import Country
from accounts.models import Permission

PERMISSION_REGISTRY = [
    {
        "module": "agreements",
        "label": "Agreements",
        "resources": [
            {"resource": "agreement", "label": "Agreements", "actions": ["read", "add", "update", "delete", "export"]},
            {"resource": "notes", "label": "Sensitive Notes", "actions": ["read", "update"]},
        ],
    },
    {
        "module": "providers",
        "label": "Providers",
        "resources": [
            {"resource": "provider", "label": "Providers", "actions": ["read", "add", "update", "delete", "export"]},
        ],
    },
    {
        "module": "targets",
        "label": "Targets",
        "resources": [
            {"resource": "target", "label": "Agreement Targets", "actions": ["read", "add", "update", "delete", "export"]},
        ],
    },
    {
        "module": "commission",
        "label": "Commission Rules",
        "resources": [
            {"resource": "commission_rule", "label": "Commission Rules", "actions": ["read", "add", "update", "delete", "export"]},
        ],
    },
    {
        "module": "bonus",
        "label": "Bonus Rules",
        "resources": [
            {"resource": "bonus_rule", "label": "Bonus Rules", "actions": ["read", "add", "update", "delete", "export"]},
        ],
    },
    {
        "module": "contacts",
        "label": "Contacts",
        "resources": [
            {"resource": "contact", "label": "Agreement Contacts", "actions": ["read", "add", "update", "delete", "export"]},
        ],
    },
    {
        "module": "commission_tracker",
        "label": "Commission Tracker",
        "resources": [
            {"resource": "student", "label": "Commission Students", "actions": ["read", "add", "update", "delete", "export", "delete_master"]},
            {"resource": "entry", "label": "Term Entries", "actions": ["read", "add", "update", "delete"]},
            {"resource": "master", "label": "Master Sheet", "actions": ["edit"]},
        ],
    },
    {
        "module": "sub_agent_commission",
        "label": "Sub-Agent Commission",
        "resources": [
            {"resource": "entry", "label": "Sub-Agent Entries", "actions": ["read", "add", "update", "delete"]},
        ],
    },
    {
        "module": "portal_access",
        "label": "Portal Access",
        "resources": [
            {"resource": "portal", "label": "Portal Credentials", "actions": ["view", "edit", "reveal", "delete", "logs"]},
        ],
    },
    {
        "module": "documents",
        "label": "Documents",
        "resources": [
            {"resource": "document", "label": "Agreement Documents", "actions": ["list", "view_in_portal", "download", "upload", "replace", "delete"]},
        ],
    },
    {
        "module": "administration",
        "label": "Administration",
        "resources": [
            {"resource": "user", "label": "Users", "actions": ["read", "add", "update", "delete"]},
            {"resource": "role", "label": "Roles", "actions": ["read", "add", "update", "delete"]},
            {"resource": "country_scope", "label": "Country Access", "actions": ["read", "update"]},
            {"resource": "audit", "label": "Audit Logs", "actions": ["read"]},
        ],
    },
    {
        "module": "reminders",
        "label": "Reminder Settings",
        "resources": [
            {"resource": "reminder", "label": "Reminders", "actions": ["read", "update"]},
        ],
    },
]


class CountryListView(APIView):
    @require_auth
    def get(self, request):
        countries = Country.objects.all().order_by('name')
        data = [{'id': c.id, 'iso2': c.iso2, 'name': c.name} for c in countries]
        return Response(data)


class PermissionSchemaView(APIView):
    @require_permission("security.role.manage")
    def get(self, request):
        all_permissions = list(Permission.objects.all())
        reverse_legacy = {v: k for k, v in LEGACY_PERMISSION_MAP.items()}

        modules = []
        for mod in PERMISSION_REGISTRY:
            resources = []
            for resource in mod['resources']:
                actions = []
                for action in resource['actions']:
                    new_code = f"{mod['module']}.{resource['resource']}.{action}"
                    legacy_code = reverse_legacy.get(new_code)
                    perm = None
                    for p in all_permissions:
                        if p.code == new_code or p.code == legacy_code or (p.module == mod['module'] and p.resource == resource['resource'] and p.action == action):
                            perm = p
                            break
                    actions.append({
                        'action': action,
                        'code': perm.code if perm else new_code,
                        'permissionId': perm.id if perm else None,
                        'description': perm.description if perm else f"{action} {resource['label']}",
                    })
                resources.append({
                    'resource': resource['resource'],
                    'label': resource['label'],
                    'actions': actions,
                })
            modules.append({
                'module': mod['module'],
                'label': mod['label'],
                'resources': resources,
            })
        return Response({'modules': modules})
