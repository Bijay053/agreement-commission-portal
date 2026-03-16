from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from core.permissions import require_permission
from .models import PortalCredential, PortalAccessLog
from .encryption import encrypt_value, decrypt_value


class PortalRevealThrottle(UserRateThrottle):
    rate = '30/hour'
    scope = 'portal_reveal'


PORTAL_CATEGORIES = [
    'Australia', 'UK', 'USA', 'Canada', 'Europe',
    'Agent Portals', 'Finance', 'Internal Systems', 'Other',
]


def _get_client_ip(request):
    xff = request.META.get('HTTP_X_FORWARDED_FOR')
    if xff:
        return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '')


def _log_action(portal, user, action, request, result='success', note=''):
    PortalAccessLog.objects.create(
        portal_id=portal.id if portal else 0,
        user_id=user.get('id', 0) if isinstance(user, dict) else user,
        user_name=user.get('name', '') if isinstance(user, dict) else '',
        user_email=user.get('email', '') if isinstance(user, dict) else '',
        action=action,
        portal_name=portal.portal_name if portal else '',
        ip_address=_get_client_ip(request),
        result=result,
        note=note,
    )


def _user_info(request):
    return {
        'id': request.session.get('userId', 0),
        'name': request.session.get('userName', ''),
        'email': request.session.get('userEmail', ''),
    }


def portal_to_dict(p, include_password=False):
    d = {
        'id': p.id,
        'portalName': p.portal_name,
        'portalUrl': p.portal_url or '',
        'username': p.username or '',
        'category': p.category or '',
        'country': p.country or '',
        'team': p.team or '',
        'notes': p.notes or '',
        'status': p.status or 'active',
        'createdBy': p.created_by,
        'updatedBy': p.updated_by,
        'passwordUpdatedAt': p.password_updated_at.isoformat() if p.password_updated_at else None,
        'createdAt': p.created_at.isoformat() if p.created_at else None,
        'updatedAt': p.updated_at.isoformat() if p.updated_at else None,
    }
    if include_password:
        try:
            d['password'] = decrypt_value(p.encrypted_password) if p.encrypted_password else ''
        except Exception:
            d['password'] = ''
    return d


class PortalListView(APIView):
    @require_permission("portal_access.view")
    def get(self, request):
        status_filter = request.GET.get('status', 'active')
        portals = PortalCredential.objects.all()
        if status_filter and status_filter != 'all':
            portals = portals.filter(status=status_filter)
        portals = portals.order_by('-updated_at')
        return Response([portal_to_dict(p) for p in portals])

    @require_permission("portal_access.edit")
    def post(self, request):
        d = request.data
        user = _user_info(request)
        portal = PortalCredential(
            portal_name=d.get('portalName', ''),
            portal_url=d.get('portalUrl', ''),
            username=d.get('username', ''),
            encrypted_password=encrypt_value(d.get('password', '')),
            category=d.get('category', ''),
            country=d.get('country', ''),
            team=d.get('team', ''),
            notes=d.get('notes', ''),
            status=d.get('status', 'active'),
            created_by=user['id'],
            updated_by=user['id'],
            password_updated_at=timezone.now() if d.get('password') else None,
        )
        portal.save()
        _log_action(portal, user, 'portal_created', request)
        return Response(portal_to_dict(portal), status=201)


class PortalDetailView(APIView):
    @require_permission("portal_access.view")
    def get(self, request, portal_id):
        try:
            portal = PortalCredential.objects.get(id=portal_id)
        except PortalCredential.DoesNotExist:
            return Response({'message': 'Portal not found'}, status=404)
        return Response(portal_to_dict(portal))

    @require_permission("portal_access.edit")
    def put(self, request, portal_id):
        try:
            portal = PortalCredential.objects.get(id=portal_id)
        except PortalCredential.DoesNotExist:
            return Response({'message': 'Portal not found'}, status=404)

        d = request.data
        user = _user_info(request)
        changes = []

        for field, db_field in {
            'portalName': 'portal_name', 'portalUrl': 'portal_url',
            'username': 'username', 'category': 'category',
            'country': 'country', 'team': 'team',
            'notes': 'notes', 'status': 'status',
        }.items():
            if field in d:
                old = getattr(portal, db_field) or ''
                new = d[field] or ''
                if old != new:
                    changes.append(f"{field}: {old} → {new}")
                setattr(portal, db_field, d[field])

        if 'password' in d and d['password']:
            portal.encrypted_password = encrypt_value(d['password'])
            portal.password_updated_at = timezone.now()
            changes.append("password updated")

        portal.updated_by = user['id']
        portal.save()

        _log_action(portal, user, 'portal_edited', request, note='; '.join(changes) if changes else '')
        return Response(portal_to_dict(portal))

    @require_permission("portal_access.delete")
    def delete(self, request, portal_id):
        try:
            portal = PortalCredential.objects.get(id=portal_id)
        except PortalCredential.DoesNotExist:
            return Response({'message': 'Portal not found'}, status=404)

        user = _user_info(request)
        portal.status = 'inactive'
        portal.updated_by = user['id']
        portal.save()
        _log_action(portal, user, 'portal_deactivated', request)
        return Response({'message': 'Deactivated'})


class PortalRevealPasswordView(APIView):
    throttle_classes = [PortalRevealThrottle]

    @require_permission("portal_access.reveal")
    def post(self, request, portal_id):
        try:
            portal = PortalCredential.objects.get(id=portal_id)
        except PortalCredential.DoesNotExist:
            return Response({'message': 'Portal not found'}, status=404)

        user = _user_info(request)
        _log_action(portal, user, 'password_revealed', request)

        try:
            password = decrypt_value(portal.encrypted_password) if portal.encrypted_password else ''
        except Exception:
            password = ''

        return Response({'password': password})


class PortalRotatePasswordView(APIView):
    @require_permission("portal_access.edit")
    def post(self, request, portal_id):
        try:
            portal = PortalCredential.objects.get(id=portal_id)
        except PortalCredential.DoesNotExist:
            return Response({'message': 'Portal not found'}, status=404)

        new_password = request.data.get('password', '')
        if not new_password:
            return Response({'message': 'New password required'}, status=400)

        user = _user_info(request)
        portal.encrypted_password = encrypt_value(new_password)
        portal.password_updated_at = timezone.now()
        portal.updated_by = user['id']
        portal.save()

        _log_action(portal, user, 'password_rotated', request)
        return Response({'message': 'Password updated', 'passwordUpdatedAt': portal.password_updated_at.isoformat()})


class PortalCopyUsernameView(APIView):
    @require_permission("portal_access.view")
    def post(self, request, portal_id):
        try:
            portal = PortalCredential.objects.get(id=portal_id)
        except PortalCredential.DoesNotExist:
            return Response({'message': 'Portal not found'}, status=404)

        user = _user_info(request)
        _log_action(portal, user, 'username_copied', request)
        return Response({'username': portal.username})


class PortalCopyPasswordView(APIView):
    throttle_classes = [PortalRevealThrottle]

    @require_permission("portal_access.reveal")
    def post(self, request, portal_id):
        try:
            portal = PortalCredential.objects.get(id=portal_id)
        except PortalCredential.DoesNotExist:
            return Response({'message': 'Portal not found'}, status=404)

        user = _user_info(request)
        try:
            password = decrypt_value(portal.encrypted_password) if portal.encrypted_password else ''
        except Exception:
            return Response({'message': 'Decryption error'}, status=500)

        _log_action(portal, user, 'password_copied', request)
        return Response({'password': password})


class PortalOpenView(APIView):
    @require_permission("portal_access.view")
    def post(self, request, portal_id):
        try:
            portal = PortalCredential.objects.get(id=portal_id)
        except PortalCredential.DoesNotExist:
            return Response({'message': 'Portal not found'}, status=404)

        user = _user_info(request)
        _log_action(portal, user, 'portal_opened', request)
        return Response({'url': portal.portal_url})


class PortalOpenAndFillView(APIView):
    throttle_classes = [PortalRevealThrottle]

    @require_permission("portal_access.reveal")
    def post(self, request, portal_id):
        try:
            portal = PortalCredential.objects.get(id=portal_id)
        except PortalCredential.DoesNotExist:
            return Response({'message': 'Portal not found'}, status=404)

        user = _user_info(request)
        try:
            password = decrypt_value(portal.encrypted_password) if portal.encrypted_password else ''
        except Exception:
            password = ''

        _log_action(portal, user, 'open_and_fill', request)
        return Response({
            'username': portal.username,
            'password': password,
            'url': portal.portal_url,
        })


class PortalAccessLogListView(APIView):
    @require_permission("portal_access.logs")
    def get(self, request):
        portal_id = request.GET.get('portalId')
        user_id = request.GET.get('userId')
        action = request.GET.get('action')
        try:
            limit = min(int(request.GET.get('limit', 200)), 1000)
        except (ValueError, TypeError):
            limit = 200

        logs = PortalAccessLog.objects.all().order_by('-created_at')
        if portal_id:
            logs = logs.filter(portal_id=portal_id)
        if user_id:
            logs = logs.filter(user_id=user_id)
        if action:
            logs = logs.filter(action=action)

        logs = logs[:limit]
        return Response([{
            'id': log.id,
            'portalId': log.portal_id,
            'userId': log.user_id,
            'userName': log.user_name,
            'userEmail': log.user_email,
            'action': log.action,
            'portalName': log.portal_name,
            'ipAddress': log.ip_address,
            'result': log.result,
            'note': log.note,
            'createdAt': log.created_at.isoformat() if log.created_at else None,
        } for log in logs])


class PortalCategoriesView(APIView):
    @require_permission("portal_access.view")
    def get(self, request):
        return Response(PORTAL_CATEGORIES)
