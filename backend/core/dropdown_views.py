from rest_framework.views import APIView
from rest_framework.response import Response
from core.dropdown_models import DropdownOption

VALID_CATEGORIES = ['study_level', 'commission_basis', 'pay_event', 'commission_mode', 'agreement_type']


class DropdownOptionsView(APIView):
    def get(self, request):
        category = request.query_params.get('category')
        if category:
            options = DropdownOption.objects.filter(category=category, is_active=True).order_by('sort_order', 'label')
            return Response([{'id': o.id, 'value': o.value, 'label': o.label, 'sortOrder': o.sort_order} for o in options])

        result = {}
        for cat in VALID_CATEGORIES:
            options = DropdownOption.objects.filter(category=cat, is_active=True).order_by('sort_order', 'label')
            result[cat] = [{'id': o.id, 'value': o.value, 'label': o.label, 'sortOrder': o.sort_order} for o in options]
        return Response(result)


class DropdownOptionsAdminView(APIView):
    def get(self, request):
        category = request.query_params.get('category')
        if category:
            options = DropdownOption.objects.filter(category=category).order_by('sort_order', 'label')
        else:
            options = DropdownOption.objects.all().order_by('category', 'sort_order', 'label')
        return Response([{
            'id': o.id, 'category': o.category, 'value': o.value,
            'label': o.label, 'sortOrder': o.sort_order, 'isActive': o.is_active,
        } for o in options])

    def post(self, request):
        category = request.data.get('category')
        value = request.data.get('value', '').strip()
        label = request.data.get('label', '').strip()
        if category not in VALID_CATEGORIES:
            return Response({'message': 'Invalid category'}, status=400)
        if not value or not label:
            return Response({'message': 'Value and label are required'}, status=400)

        if DropdownOption.objects.filter(category=category, value=value).exists():
            return Response({'message': 'This option already exists'}, status=400)

        max_order = DropdownOption.objects.filter(category=category).order_by('-sort_order').values_list('sort_order', flat=True).first() or 0
        obj = DropdownOption.objects.create(
            category=category, value=value, label=label, sort_order=max_order + 1,
        )
        return Response({
            'id': obj.id, 'category': obj.category, 'value': obj.value,
            'label': obj.label, 'sortOrder': obj.sort_order, 'isActive': obj.is_active,
        }, status=201)

    def patch(self, request):
        option_id = request.data.get('id')
        if not option_id:
            return Response({'message': 'ID is required'}, status=400)
        try:
            obj = DropdownOption.objects.get(id=option_id)
        except DropdownOption.DoesNotExist:
            return Response({'message': 'Not found'}, status=404)

        if 'label' in request.data:
            obj.label = request.data['label'].strip()
        if 'value' in request.data:
            obj.value = request.data['value'].strip()
        if 'sortOrder' in request.data:
            obj.sort_order = request.data['sortOrder']
        if 'isActive' in request.data:
            obj.is_active = request.data['isActive']
        obj.save()
        return Response({
            'id': obj.id, 'category': obj.category, 'value': obj.value,
            'label': obj.label, 'sortOrder': obj.sort_order, 'isActive': obj.is_active,
        })

    def delete(self, request):
        option_id = request.query_params.get('id')
        if not option_id:
            return Response({'message': 'ID is required'}, status=400)
        try:
            obj = DropdownOption.objects.get(id=option_id)
            obj.delete()
            return Response({'message': 'Deleted'})
        except DropdownOption.DoesNotExist:
            return Response({'message': 'Not found'}, status=404)
