from rest_framework.views import APIView
from rest_framework.response import Response
from core.permissions import require_permission
from core.pagination import StandardPagination
from core.exports import export_data
from accounts.models import User
from .models import AuditLog


def audit_log_to_dict(l, user_cache):
    if l.user_id and l.user_id not in user_cache:
        try:
            u = User.objects.get(id=l.user_id)
            user_cache[l.user_id] = u.full_name
        except User.DoesNotExist:
            user_cache[l.user_id] = None
    return {
        'id': l.id, 'userId': l.user_id, 'action': l.action,
        'entityType': l.entity_type, 'entityId': l.entity_id,
        'ipAddress': l.ip_address, 'userAgent': l.user_agent,
        'metadata': l.metadata,
        'createdAt': l.created_at.isoformat() if l.created_at else None,
        'userName': user_cache.get(l.user_id),
    }


class AuditLogListView(APIView):
    pagination_class = StandardPagination

    @require_permission("audit.view")
    def get(self, request):
        try:
            qs = AuditLog.objects.all().order_by('-created_at')
            user_id = request.query_params.get('userId')
            action = request.query_params.get('action')
            entity_type = request.query_params.get('entityType')
            from_date = request.query_params.get('from')
            to_date = request.query_params.get('to')

            if user_id:
                qs = qs.filter(user_id=int(user_id))
            if action:
                qs = qs.filter(action=action)
            if entity_type:
                qs = qs.filter(entity_type=entity_type)
            if from_date:
                qs = qs.filter(created_at__gte=from_date)
            if to_date:
                qs = qs.filter(created_at__lte=to_date)

            user_cache = {}
            paginator = self.pagination_class()
            page = paginator.paginate_queryset(qs, request)
            if page is not None:
                data = [audit_log_to_dict(l, user_cache) for l in page]
                return paginator.get_paginated_response(data)
            return Response([audit_log_to_dict(l, user_cache) for l in qs[:200]])
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class AuditLogExportView(APIView):
    @require_permission("audit.view")
    def get(self, request):
        try:
            qs = AuditLog.objects.all().order_by('-created_at')
            user_id_filter = request.query_params.get('userId')
            action = request.query_params.get('action')
            entity_type = request.query_params.get('entityType')
            from_date = request.query_params.get('from')
            to_date = request.query_params.get('to')

            if user_id_filter:
                qs = qs.filter(user_id=int(user_id_filter))
            if action:
                qs = qs.filter(action=action)
            if entity_type:
                qs = qs.filter(entity_type=entity_type)
            if from_date:
                qs = qs.filter(created_at__gte=from_date)
            if to_date:
                qs = qs.filter(created_at__lte=to_date)

            user_cache = {}
            headers = ['ID', 'User ID', 'User Name', 'Action', 'Entity Type', 'Entity ID', 'IP Address', 'Created At']
            rows = []
            for l in qs[:5000]:
                d = audit_log_to_dict(l, user_cache)
                rows.append([
                    d.get('id'), d.get('userId'), d.get('userName'),
                    d.get('action'), d.get('entityType'), d.get('entityId'),
                    d.get('ipAddress'), d.get('createdAt'),
                ])
            return export_data(request, 'audit_logs_export', headers, rows, 'Audit Logs')
        except Exception as e:
            return Response({'message': str(e)}, status=500)
