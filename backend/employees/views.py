from datetime import datetime, date
from rest_framework.views import APIView
from rest_framework.response import Response
from core.permissions import require_auth, require_permission
from core.pagination import StandardPagination
from .models import Employee


def _safe_iso(val):
    if not val:
        return None
    if isinstance(val, (datetime, date)):
        return val.isoformat()
    return str(val)


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
        'passportNumber': e.passport_number or '',
        'joinDate': _safe_iso(e.join_date),
        'salaryAmount': str(e.salary_amount) if e.salary_amount else '',
        'salaryCurrency': e.salary_currency or 'NPR',
        'status': e.status,
        'createdAt': _safe_iso(e.created_at),
        'updatedAt': _safe_iso(e.updated_at),
    }


class EmployeeListView(APIView):
    pagination_class = StandardPagination

    @require_permission("employee.view")
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

    @require_permission("employee.add")
    def post(self, request):
        data = request.data
        full_name = data.get('fullName', '').strip()
        email = data.get('email', '').strip()
        if not full_name or not email:
            return Response({'message': 'Full name and email are required'}, status=400)

        if Employee.objects.filter(email=email).exists():
            return Response({'message': 'An employee with this email already exists'}, status=400)

        org_id = data.get('organizationId') or data.get('organization_id') or None
        dept_id = data.get('departmentId') or data.get('department_id') or None

        employee = Employee.objects.create(
            full_name=full_name,
            email=email,
            phone=data.get('phone', ''),
            position=data.get('position', ''),
            department=data.get('department', ''),
            organization_id=org_id if org_id else None,
            department_id=dept_id if dept_id else None,
            gender=data.get('gender', '') or None,
            marital_status=data.get('maritalStatus') or data.get('marital_status') or None,
            date_of_birth=data.get('dateOfBirth') or data.get('date_of_birth') or None,
            citizenship_no=data.get('citizenshipNo') or data.get('citizenship_no') or '',
            pan_no=data.get('panNo') or data.get('pan_no') or '',
            permanent_address=data.get('permanentAddress') or data.get('permanent_address') or '',
            temporary_address=data.get('temporaryAddress') or data.get('temporary_address') or '',
            passport_number=data.get('passportNumber') or data.get('passport_number') or '',
            join_date=data.get('joinDate') or data.get('join_date') or None,
            employment_type=data.get('employmentType') or data.get('employment_type') or 'full_time',
            salary_amount=data.get('salaryAmount') or data.get('salary_amount') or None,
            salary_currency=data.get('salaryCurrency') or data.get('salary_currency') or 'NPR',
            bank_name=data.get('bankName') or data.get('bank_name') or '',
            bank_account_number=data.get('bankAccountNumber') or data.get('bank_account_number') or '',
            bank_branch=data.get('bankBranch') or data.get('bank_branch') or '',
            emergency_contact_name=data.get('emergencyContactName') or data.get('emergency_contact_name') or '',
            emergency_contact_phone=data.get('emergencyContactPhone') or data.get('emergency_contact_phone') or '',
            status=data.get('status', 'active'),
        )
        return Response(_serialize_employee(employee), status=201)


class EmployeeDetailView(APIView):
    @require_permission("employee.view")
    def get(self, request, employee_id):
        try:
            employee = Employee.objects.get(id=employee_id)
            return Response(_serialize_employee(employee))
        except Employee.DoesNotExist:
            return Response({'message': 'Employee not found'}, status=404)

    @require_permission("employee.edit")
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
        employee.passport_number = data.get('passportNumber', employee.passport_number)
        employee.join_date = data.get('joinDate') or employee.join_date
        employee.salary_amount = data.get('salaryAmount') or employee.salary_amount
        employee.salary_currency = data.get('salaryCurrency', employee.salary_currency)
        employee.status = data.get('status', employee.status)
        employee.save()
        return Response(_serialize_employee(employee))

    @require_permission("employee.delete")
    def delete(self, request, employee_id):
        try:
            employee = Employee.objects.get(id=employee_id)
        except Employee.DoesNotExist:
            return Response({'message': 'Employee not found'}, status=404)
        employee.delete()
        return Response({'message': 'Employee deleted'})
