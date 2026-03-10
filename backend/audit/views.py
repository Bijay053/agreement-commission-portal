from rest_framework.views import APIView
from rest_framework.response import Response
from core.permissions import require_permission
from accounts.models import User
from .models import AuditLog


class AuditLogListView(APIView):
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

            limit = int(request.query_params.get('limit', 200))
            logs = qs[:limit]

            result = []
            user_cache = {}
            for l in logs:
                if l.user_id and l.user_id not in user_cache:
                    try:
                        u = User.objects.get(id=l.user_id)
                        user_cache[l.user_id] = u.full_name
                    except User.DoesNotExist:
                        user_cache[l.user_id] = None
                result.append({
                    'id': l.id, 'userId': l.user_id, 'action': l.action,
                    'entityType': l.entity_type, 'entityId': l.entity_id,
                    'ipAddress': l.ip_address, 'userAgent': l.user_agent,
                    'metadata': l.metadata,
                    'createdAt': l.created_at.isoformat() if l.created_at else None,
                    'userName': user_cache.get(l.user_id),
                })
            return Response(result)
        except Exception as e:
            return Response({'message': str(e)}, status=500)
