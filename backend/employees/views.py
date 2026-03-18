from rest_framework.views import APIView
from rest_framework.response import Response
from core.permissions import require_auth
from core.pagination import StandardPagination
from .models import Employee


def _serialize_employee(e):
    return {
        'id': str(e.id),
        'fullName': e.full_name,
        'email': e.email,
        'phone': e.phone or '',
        'position': e.position or '',
        'department': e.department or '',
        'citizenshipNo': e.citizenship_no or '',
        'panNo': e.pan_no or '',
        'permanentAddress': e.permanent_address or '',
        'joinDate': e.join_date.isoformat() if e.join_date else None,
        'status': e.status,
        'createdAt': e.created_at.isoformat() if e.created_at else None,
        'updatedAt': e.updated_at.isoformat() if e.updated_at else None,
    }


class EmployeeListView(APIView):
    pagination_class = StandardPagination

    @require_auth
    def get(self, request):
        qs = Employee.objects.all()
        search = request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(full_name__icontains=search)
        status = request.query_params.get('status', '').strip()
        if status:
            qs = qs.filter(status=status)
        department = request.query_params.get('department', '').strip()
        if department:
            qs = qs.filter(department__iexact=department)

        qs = qs.order_by('full_name')
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request)
        items = page if page is not None else list(qs)
        result = [_serialize_employee(e) for e in items]
        if page is not None:
            return paginator.get_paginated_response(result)
        return Response(result)

    @require_auth
    def post(self, request):
        data = request.data
        full_name = data.get('fullName', '').strip()
        email = data.get('email', '').strip()
        if not full_name or not email:
            return Response({'message': 'Full name and email are required'}, status=400)

        if Employee.objects.filter(email=email).exists():
            return Response({'message': 'An employee with this email already exists'}, status=400)

        employee = Employee.objects.create(
            full_name=full_name,
            email=email,
            phone=data.get('phone', ''),
            position=data.get('position', ''),
            department=data.get('department', ''),
            citizenship_no=data.get('citizenshipNo', ''),
            pan_no=data.get('panNo', ''),
            permanent_address=data.get('permanentAddress', ''),
            join_date=data.get('joinDate') or None,
            status=data.get('status', 'active'),
        )
        return Response(_serialize_employee(employee), status=201)


class EmployeeDetailView(APIView):
    @require_auth
    def get(self, request, employee_id):
        try:
            employee = Employee.objects.get(id=employee_id)
            return Response(_serialize_employee(employee))
        except Employee.DoesNotExist:
            return Response({'message': 'Employee not found'}, status=404)

    @require_auth
    def put(self, request, employee_id):
        try:
            employee = Employee.objects.get(id=employee_id)
        except Employee.DoesNotExist:
            return Response({'message': 'Employee not found'}, status=404)

        data = request.data
        employee.full_name = data.get('fullName', employee.full_name).strip()
        employee.email = data.get('email', employee.email).strip()
        employee.phone = data.get('phone', employee.phone)
        employee.position = data.get('position', employee.position)
        employee.department = data.get('department', employee.department)
        employee.citizenship_no = data.get('citizenshipNo', employee.citizenship_no)
        employee.pan_no = data.get('panNo', employee.pan_no)
        employee.permanent_address = data.get('permanentAddress', employee.permanent_address)
        employee.join_date = data.get('joinDate') or employee.join_date
        employee.status = data.get('status', employee.status)
        employee.save()
        return Response(_serialize_employee(employee))

    @require_auth
    def delete(self, request, employee_id):
        try:
            employee = Employee.objects.get(id=employee_id)
        except Employee.DoesNotExist:
            return Response({'message': 'Employee not found'}, status=404)
        employee.delete()
        return Response({'message': 'Employee deleted'})
