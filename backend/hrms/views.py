import os
from datetime import datetime, date, timedelta
from decimal import Decimal
from django.utils import timezone
from django.db.models import Q, Sum
from rest_framework.views import APIView
from rest_framework.response import Response

from core.permissions import require_auth, require_permission
from employees.models import Employee
from .models import (
    Organization, Department, FiscalYear, LeaveType,
    DepartmentLeaveAllocation, LeavePolicy, Holiday,
    LeaveBalance, LeaveRequest, AttendanceRecord,
    OnlineCheckInPermission, DeviceMapping, SalaryStructure,
    PayrollRun, Payslip, NotificationSetting,
)


def serialize_org(org):
    return {
        'id': str(org.id),
        'name': org.name,
        'short_code': org.short_code,
        'address': org.address,
        'country': org.country,
        'phone': org.phone,
        'email': org.email,
        'registration_number': org.registration_number,
        'pan_number': org.pan_number,
        'logo_url': org.logo_url,
        'status': org.status,
        'created_at': org.created_at.isoformat() if org.created_at else None,
    }


def serialize_dept(dept):
    return {
        'id': str(dept.id),
        'organization_id': str(dept.organization_id),
        'organization_name': dept.organization.name if dept.organization else None,
        'name': dept.name,
        'head_employee_id': str(dept.head_employee_id) if dept.head_employee_id else None,
        'working_days_per_week': dept.working_days_per_week,
        'work_start_time': dept.work_start_time.strftime('%H:%M') if dept.work_start_time else None,
        'work_end_time': dept.work_end_time.strftime('%H:%M') if dept.work_end_time else None,
        'late_threshold_minutes': dept.late_threshold_minutes,
        'early_leave_threshold_minutes': dept.early_leave_threshold_minutes,
        'status': dept.status,
    }


def serialize_fiscal_year(fy):
    return {
        'id': str(fy.id),
        'organization_id': str(fy.organization_id),
        'name': fy.name,
        'start_date': fy.start_date.isoformat() if fy.start_date else None,
        'end_date': fy.end_date.isoformat() if fy.end_date else None,
        'is_current': fy.is_current,
    }


def serialize_leave_type(lt):
    return {
        'id': str(lt.id),
        'organization_id': str(lt.organization_id),
        'name': lt.name,
        'code': lt.code,
        'default_days': float(lt.default_days),
        'is_paid': lt.is_paid,
        'is_carry_forward': lt.is_carry_forward,
        'max_carry_forward_days': float(lt.max_carry_forward_days),
        'requires_document': lt.requires_document,
        'document_required_after_days': lt.document_required_after_days,
        'color': lt.color,
        'status': lt.status,
    }


def serialize_leave_policy(lp):
    return {
        'id': str(lp.id),
        'organization_id': str(lp.organization_id),
        'min_days_advance_notice': lp.min_days_advance_notice,
        'max_consecutive_days': lp.max_consecutive_days,
        'require_document_after_days': lp.require_document_after_days,
        'allow_half_day': lp.allow_half_day,
        'allow_negative_balance': lp.allow_negative_balance,
        'max_negative_days': float(lp.max_negative_days),
        'require_approval': lp.require_approval,
        'auto_approve_if_balance': lp.auto_approve_if_balance,
        'weekend_days': lp.weekend_days,
    }


def serialize_holiday(h):
    return {
        'id': str(h.id),
        'organization_id': str(h.organization_id),
        'name': h.name,
        'date': h.date.isoformat() if h.date else None,
        'is_optional': h.is_optional,
        'fiscal_year_id': str(h.fiscal_year_id) if h.fiscal_year_id else None,
    }


def serialize_leave_balance(lb):
    return {
        'id': str(lb.id),
        'employee_id': str(lb.employee_id),
        'leave_type_id': str(lb.leave_type_id),
        'leave_type_name': lb.leave_type.name if lb.leave_type else None,
        'leave_type_code': lb.leave_type.code if lb.leave_type else None,
        'fiscal_year_id': str(lb.fiscal_year_id),
        'fiscal_year_name': lb.fiscal_year.name if lb.fiscal_year else None,
        'allocated_days': float(lb.allocated_days),
        'used_days': float(lb.used_days),
        'carried_forward_days': float(lb.carried_forward_days),
        'remaining_days': float(lb.remaining_days),
    }


def serialize_leave_request(lr):
    emp_name = None
    try:
        emp = Employee.objects.get(id=lr.employee_id)
        emp_name = emp.full_name
    except Employee.DoesNotExist:
        pass

    approver_name = None
    if lr.approved_by:
        try:
            from accounts.models import User
            approver = User.objects.get(id=lr.approved_by)
            approver_name = approver.name
        except Exception:
            pass

    return {
        'id': str(lr.id),
        'employee_id': str(lr.employee_id),
        'employee_name': emp_name,
        'leave_type_id': str(lr.leave_type_id),
        'leave_type_name': lr.leave_type.name if lr.leave_type else None,
        'leave_type_color': lr.leave_type.color if lr.leave_type else None,
        'start_date': lr.start_date.isoformat() if lr.start_date else None,
        'end_date': lr.end_date.isoformat() if lr.end_date else None,
        'days_count': float(lr.days_count),
        'is_half_day': lr.is_half_day,
        'half_day_period': lr.half_day_period,
        'reason': lr.reason,
        'status': lr.status,
        'approved_by': str(lr.approved_by) if lr.approved_by else None,
        'approver_name': approver_name,
        'approved_at': lr.approved_at.isoformat() if lr.approved_at else None,
        'rejection_reason': lr.rejection_reason,
        'document_url': lr.document_url,
        'created_at': lr.created_at.isoformat() if lr.created_at else None,
    }


def serialize_attendance(att):
    emp_name = None
    try:
        emp = Employee.objects.get(id=att.employee_id)
        emp_name = emp.full_name
    except Employee.DoesNotExist:
        pass

    return {
        'id': str(att.id),
        'employee_id': str(att.employee_id),
        'employee_name': emp_name,
        'date': att.date.isoformat() if att.date else None,
        'check_in': att.check_in.isoformat() if att.check_in else None,
        'check_out': att.check_out.isoformat() if att.check_out else None,
        'check_in_method': att.check_in_method,
        'check_out_method': att.check_out_method,
        'check_in_location': att.check_in_location,
        'check_out_location': att.check_out_location,
        'check_in_photo_url': att.check_in_photo_url,
        'check_out_photo_url': att.check_out_photo_url,
        'is_late': att.is_late,
        'is_early_leave': att.is_early_leave,
        'late_minutes': att.late_minutes,
        'early_leave_minutes': att.early_leave_minutes,
        'status': att.status,
        'work_hours': float(att.work_hours),
        'overtime_hours': float(att.overtime_hours),
        'notes': att.notes,
    }


def serialize_salary_structure(ss):
    emp_name = None
    try:
        emp = Employee.objects.get(id=ss.employee_id)
        emp_name = emp.full_name
    except Employee.DoesNotExist:
        pass

    return {
        'id': str(ss.id),
        'employee_id': str(ss.employee_id),
        'employee_name': emp_name,
        'basic_salary': float(ss.basic_salary),
        'allowances': ss.allowances,
        'deductions': ss.deductions,
        'cit_type': ss.cit_type,
        'cit_value': float(ss.cit_value),
        'ssf_applicable': ss.ssf_applicable,
        'ssf_employee_percentage': float(ss.ssf_employee_percentage),
        'ssf_employer_percentage': float(ss.ssf_employer_percentage),
        'tax_applicable': ss.tax_applicable,
        'effective_from': ss.effective_from.isoformat() if ss.effective_from else None,
        'effective_to': ss.effective_to.isoformat() if ss.effective_to else None,
        'status': ss.status,
    }


def serialize_payslip(ps):
    emp_name = None
    try:
        emp = Employee.objects.get(id=ps.employee_id)
        emp_name = emp.full_name
    except Employee.DoesNotExist:
        pass

    return {
        'id': str(ps.id),
        'payroll_run_id': str(ps.payroll_run_id),
        'employee_id': str(ps.employee_id),
        'employee_name': emp_name,
        'month': ps.month,
        'year': ps.year,
        'basic_salary': float(ps.basic_salary),
        'allowances': ps.allowances,
        'gross_salary': float(ps.gross_salary),
        'cit_deduction': float(ps.cit_deduction),
        'ssf_employee_deduction': float(ps.ssf_employee_deduction),
        'ssf_employer_contribution': float(ps.ssf_employer_contribution),
        'tax_deduction': float(ps.tax_deduction),
        'other_deductions': ps.other_deductions,
        'total_deductions': float(ps.total_deductions),
        'net_salary': float(ps.net_salary),
        'working_days': ps.working_days,
        'present_days': ps.present_days,
        'absent_days': ps.absent_days,
        'leave_days': ps.leave_days,
        'late_count': ps.late_count,
        'early_leave_count': ps.early_leave_count,
        'status': ps.status,
    }


def get_employee_for_user(user_id):
    try:
        return Employee.objects.get(user_id=user_id)
    except Employee.DoesNotExist:
        return None


def send_late_notification(employee, attendance_record, department):
    from core.email_utils import send_email
    try:
        org = Organization.objects.get(id=employee.organization_id) if employee.organization_id else None
        if not org:
            return
        settings = NotificationSetting.objects.filter(organization=org).first()
        if not settings or not settings.late_arrival_notify_employee:
            return

        subject = settings.late_email_subject
        body = settings.late_email_template.format(
            employee_name=employee.full_name,
            check_in_time=attendance_record.check_in.strftime('%I:%M %p') if attendance_record.check_in else 'N/A',
            date=attendance_record.date.strftime('%Y-%m-%d'),
            late_minutes=attendance_record.late_minutes,
            start_time=department.work_start_time.strftime('%I:%M %p') if department else 'N/A',
        )
        send_email(employee.email, subject, body)
    except Exception:
        pass


def send_early_leave_notification(employee, attendance_record, department):
    from core.email_utils import send_email
    try:
        org = Organization.objects.get(id=employee.organization_id) if employee.organization_id else None
        if not org:
            return
        settings = NotificationSetting.objects.filter(organization=org).first()
        if not settings or not settings.early_leave_notify_employee:
            return

        subject = settings.early_leave_email_subject
        body = settings.early_leave_email_template.format(
            employee_name=employee.full_name,
            check_out_time=attendance_record.check_out.strftime('%I:%M %p') if attendance_record.check_out else 'N/A',
            date=attendance_record.date.strftime('%Y-%m-%d'),
            early_minutes=attendance_record.early_leave_minutes,
            end_time=department.work_end_time.strftime('%I:%M %p') if department else 'N/A',
        )
        send_email(employee.email, subject, body)
    except Exception:
        pass


class OrganizationListView(APIView):
    @require_permission('hrms.organization.read')
    def get(self, request):
        orgs = Organization.objects.all()
        status = request.GET.get('status')
        if status:
            orgs = orgs.filter(status=status)
        return Response([serialize_org(o) for o in orgs])

    @require_permission('hrms.organization.add')
    def post(self, request):
        data = request.data
        org = Organization.objects.create(
            name=data.get('name', ''),
            short_code=data.get('short_code', ''),
            address=data.get('address'),
            country=data.get('country'),
            phone=data.get('phone'),
            email=data.get('email'),
            registration_number=data.get('registration_number'),
            pan_number=data.get('pan_number'),
            logo_url=data.get('logo_url'),
        )
        return Response(serialize_org(org), status=201)


class OrganizationDetailView(APIView):
    @require_permission('hrms.organization.read')
    def get(self, request, org_id):
        try:
            org = Organization.objects.get(id=org_id)
        except Organization.DoesNotExist:
            return Response({'message': 'Organization not found'}, status=404)
        return Response(serialize_org(org))

    @require_permission('hrms.organization.update')
    def put(self, request, org_id):
        try:
            org = Organization.objects.get(id=org_id)
        except Organization.DoesNotExist:
            return Response({'message': 'Organization not found'}, status=404)
        data = request.data
        for field in ['name', 'short_code', 'address', 'country', 'phone', 'email',
                      'registration_number', 'pan_number', 'logo_url', 'status']:
            if field in data:
                setattr(org, field, data[field])
        org.save()
        return Response(serialize_org(org))

    @require_permission('hrms.organization.delete')
    def delete(self, request, org_id):
        try:
            org = Organization.objects.get(id=org_id)
        except Organization.DoesNotExist:
            return Response({'message': 'Organization not found'}, status=404)
        org.delete()
        return Response({'message': 'Organization deleted'})


class DepartmentListView(APIView):
    @require_permission('hrms.department.read')
    def get(self, request):
        depts = Department.objects.select_related('organization').all()
        org_id = request.GET.get('organization_id')
        if org_id:
            depts = depts.filter(organization_id=org_id)
        status = request.GET.get('status')
        if status:
            depts = depts.filter(status=status)
        return Response([serialize_dept(d) for d in depts])

    @require_permission('hrms.department.add')
    def post(self, request):
        data = request.data
        dept = Department.objects.create(
            organization_id=data.get('organization_id'),
            name=data.get('name', ''),
            head_employee_id=data.get('head_employee_id'),
            working_days_per_week=data.get('working_days_per_week', 6),
            work_start_time=data.get('work_start_time', '10:00'),
            work_end_time=data.get('work_end_time', '18:00'),
            late_threshold_minutes=data.get('late_threshold_minutes', 15),
            early_leave_threshold_minutes=data.get('early_leave_threshold_minutes', 15),
        )
        return Response(serialize_dept(dept), status=201)


class DepartmentDetailView(APIView):
    @require_permission('hrms.department.read')
    def get(self, request, dept_id):
        try:
            dept = Department.objects.select_related('organization').get(id=dept_id)
        except Department.DoesNotExist:
            return Response({'message': 'Department not found'}, status=404)
        return Response(serialize_dept(dept))

    @require_permission('hrms.department.update')
    def put(self, request, dept_id):
        try:
            dept = Department.objects.get(id=dept_id)
        except Department.DoesNotExist:
            return Response({'message': 'Department not found'}, status=404)
        data = request.data
        for field in ['name', 'head_employee_id', 'working_days_per_week', 'work_start_time',
                      'work_end_time', 'late_threshold_minutes', 'early_leave_threshold_minutes', 'status']:
            if field in data:
                setattr(dept, field, data[field])
        if 'organization_id' in data:
            dept.organization_id = data['organization_id']
        dept.save()
        return Response(serialize_dept(dept))

    @require_permission('hrms.department.delete')
    def delete(self, request, dept_id):
        try:
            dept = Department.objects.get(id=dept_id)
        except Department.DoesNotExist:
            return Response({'message': 'Department not found'}, status=404)
        dept.delete()
        return Response({'message': 'Department deleted'})


class FiscalYearListView(APIView):
    @require_permission('hrms.fiscal_year.read')
    def get(self, request):
        fys = FiscalYear.objects.all()
        org_id = request.GET.get('organization_id')
        if org_id:
            fys = fys.filter(organization_id=org_id)
        return Response([serialize_fiscal_year(fy) for fy in fys])

    @require_permission('hrms.fiscal_year.add')
    def post(self, request):
        data = request.data
        if data.get('is_current'):
            FiscalYear.objects.filter(organization_id=data.get('organization_id'), is_current=True).update(is_current=False)
        fy = FiscalYear.objects.create(
            organization_id=data.get('organization_id'),
            name=data.get('name', ''),
            start_date=data.get('start_date'),
            end_date=data.get('end_date'),
            is_current=data.get('is_current', False),
        )
        return Response(serialize_fiscal_year(fy), status=201)


class FiscalYearDetailView(APIView):
    @require_permission('hrms.fiscal_year.read')
    def get(self, request, fy_id):
        try:
            fy = FiscalYear.objects.get(id=fy_id)
        except FiscalYear.DoesNotExist:
            return Response({'message': 'Fiscal year not found'}, status=404)
        return Response(serialize_fiscal_year(fy))

    @require_permission('hrms.fiscal_year.update')
    def put(self, request, fy_id):
        try:
            fy = FiscalYear.objects.get(id=fy_id)
        except FiscalYear.DoesNotExist:
            return Response({'message': 'Fiscal year not found'}, status=404)
        data = request.data
        if data.get('is_current'):
            FiscalYear.objects.filter(organization_id=fy.organization_id, is_current=True).exclude(id=fy_id).update(is_current=False)
        for field in ['name', 'start_date', 'end_date', 'is_current']:
            if field in data:
                setattr(fy, field, data[field])
        fy.save()
        return Response(serialize_fiscal_year(fy))

    @require_permission('hrms.fiscal_year.delete')
    def delete(self, request, fy_id):
        try:
            fy = FiscalYear.objects.get(id=fy_id)
        except FiscalYear.DoesNotExist:
            return Response({'message': 'Fiscal year not found'}, status=404)
        fy.delete()
        return Response({'message': 'Fiscal year deleted'})


class LeaveTypeListView(APIView):
    @require_permission('hrms.leave_type.read')
    def get(self, request):
        lts = LeaveType.objects.all()
        org_id = request.GET.get('organization_id')
        if org_id:
            lts = lts.filter(organization_id=org_id)
        return Response([serialize_leave_type(lt) for lt in lts])

    @require_permission('hrms.leave_type.add')
    def post(self, request):
        data = request.data
        lt = LeaveType.objects.create(
            organization_id=data.get('organization_id'),
            name=data.get('name', ''),
            code=data.get('code', ''),
            default_days=data.get('default_days', 0),
            is_paid=data.get('is_paid', True),
            is_carry_forward=data.get('is_carry_forward', False),
            max_carry_forward_days=data.get('max_carry_forward_days', 0),
            requires_document=data.get('requires_document', False),
            document_required_after_days=data.get('document_required_after_days', 0),
            color=data.get('color', '#3B82F6'),
        )
        return Response(serialize_leave_type(lt), status=201)


class LeaveTypeDetailView(APIView):
    @require_permission('hrms.leave_type.read')
    def get(self, request, lt_id):
        try:
            lt = LeaveType.objects.get(id=lt_id)
        except LeaveType.DoesNotExist:
            return Response({'message': 'Leave type not found'}, status=404)
        return Response(serialize_leave_type(lt))

    @require_permission('hrms.leave_type.update')
    def put(self, request, lt_id):
        try:
            lt = LeaveType.objects.get(id=lt_id)
        except LeaveType.DoesNotExist:
            return Response({'message': 'Leave type not found'}, status=404)
        data = request.data
        for field in ['name', 'code', 'default_days', 'is_paid', 'is_carry_forward',
                      'max_carry_forward_days', 'requires_document', 'document_required_after_days', 'color', 'status']:
            if field in data:
                setattr(lt, field, data[field])
        lt.save()
        return Response(serialize_leave_type(lt))

    @require_permission('hrms.leave_type.delete')
    def delete(self, request, lt_id):
        try:
            lt = LeaveType.objects.get(id=lt_id)
        except LeaveType.DoesNotExist:
            return Response({'message': 'Leave type not found'}, status=404)
        lt.delete()
        return Response({'message': 'Leave type deleted'})


class LeavePolicyListView(APIView):
    @require_permission('hrms.leave_policy.read')
    def get(self, request):
        policies = LeavePolicy.objects.all()
        org_id = request.GET.get('organization_id')
        if org_id:
            policies = policies.filter(organization_id=org_id)
        return Response([serialize_leave_policy(lp) for lp in policies])

    @require_permission('hrms.leave_policy.add')
    def post(self, request):
        data = request.data
        lp = LeavePolicy.objects.create(
            organization_id=data.get('organization_id'),
            min_days_advance_notice=data.get('min_days_advance_notice', 1),
            max_consecutive_days=data.get('max_consecutive_days', 14),
            require_document_after_days=data.get('require_document_after_days', 3),
            allow_half_day=data.get('allow_half_day', True),
            allow_negative_balance=data.get('allow_negative_balance', False),
            max_negative_days=data.get('max_negative_days', 0),
            require_approval=data.get('require_approval', True),
            auto_approve_if_balance=data.get('auto_approve_if_balance', False),
            weekend_days=data.get('weekend_days', [6]),
        )
        return Response(serialize_leave_policy(lp), status=201)


class LeavePolicyDetailView(APIView):
    @require_permission('hrms.leave_policy.read')
    def get(self, request, lp_id):
        try:
            lp = LeavePolicy.objects.get(id=lp_id)
        except LeavePolicy.DoesNotExist:
            return Response({'message': 'Leave policy not found'}, status=404)
        return Response(serialize_leave_policy(lp))

    @require_permission('hrms.leave_policy.update')
    def put(self, request, lp_id):
        try:
            lp = LeavePolicy.objects.get(id=lp_id)
        except LeavePolicy.DoesNotExist:
            return Response({'message': 'Leave policy not found'}, status=404)
        data = request.data
        for field in ['min_days_advance_notice', 'max_consecutive_days', 'require_document_after_days',
                      'allow_half_day', 'allow_negative_balance', 'max_negative_days',
                      'require_approval', 'auto_approve_if_balance', 'weekend_days']:
            if field in data:
                setattr(lp, field, data[field])
        lp.save()
        return Response(serialize_leave_policy(lp))

    @require_permission('hrms.leave_policy.delete')
    def delete(self, request, lp_id):
        try:
            lp = LeavePolicy.objects.get(id=lp_id)
        except LeavePolicy.DoesNotExist:
            return Response({'message': 'Leave policy not found'}, status=404)
        lp.delete()
        return Response({'message': 'Leave policy deleted'})


class HolidayListView(APIView):
    @require_permission('hrms.holiday.read')
    def get(self, request):
        holidays = Holiday.objects.all()
        org_id = request.GET.get('organization_id')
        if org_id:
            holidays = holidays.filter(organization_id=org_id)
        fy_id = request.GET.get('fiscal_year_id')
        if fy_id:
            holidays = holidays.filter(fiscal_year_id=fy_id)
        return Response([serialize_holiday(h) for h in holidays])

    @require_permission('hrms.holiday.add')
    def post(self, request):
        data = request.data
        h = Holiday.objects.create(
            organization_id=data.get('organization_id'),
            name=data.get('name', ''),
            date=data.get('date'),
            is_optional=data.get('is_optional', False),
            fiscal_year_id=data.get('fiscal_year_id'),
        )
        return Response(serialize_holiday(h), status=201)


class HolidayDetailView(APIView):
    @require_permission('hrms.holiday.read')
    def get(self, request, h_id):
        try:
            h = Holiday.objects.get(id=h_id)
        except Holiday.DoesNotExist:
            return Response({'message': 'Holiday not found'}, status=404)
        return Response(serialize_holiday(h))

    @require_permission('hrms.holiday.update')
    def put(self, request, h_id):
        try:
            h = Holiday.objects.get(id=h_id)
        except Holiday.DoesNotExist:
            return Response({'message': 'Holiday not found'}, status=404)
        data = request.data
        for field in ['name', 'date', 'is_optional', 'fiscal_year_id']:
            if field in data:
                setattr(h, field, data[field])
        h.save()
        return Response(serialize_holiday(h))

    @require_permission('hrms.holiday.delete')
    def delete(self, request, h_id):
        try:
            h = Holiday.objects.get(id=h_id)
        except Holiday.DoesNotExist:
            return Response({'message': 'Holiday not found'}, status=404)
        h.delete()
        return Response({'message': 'Holiday deleted'})


class LeaveBalanceListView(APIView):
    @require_permission('hrms.leave_balance.read')
    def get(self, request):
        balances = LeaveBalance.objects.select_related('leave_type', 'fiscal_year').all()
        emp_id = request.GET.get('employee_id')
        if emp_id:
            balances = balances.filter(employee_id=emp_id)
        fy_id = request.GET.get('fiscal_year_id')
        if fy_id:
            balances = balances.filter(fiscal_year_id=fy_id)
        return Response([serialize_leave_balance(lb) for lb in balances])


class LeaveBalanceAllocateView(APIView):
    @require_permission('hrms.leave_balance.add')
    def post(self, request):
        data = request.data
        employee_ids = data.get('employee_ids', [])
        fiscal_year_id = data.get('fiscal_year_id')
        organization_id = data.get('organization_id')

        if not fiscal_year_id or not organization_id:
            return Response({'message': 'fiscal_year_id and organization_id are required'}, status=400)

        leave_types = LeaveType.objects.filter(organization_id=organization_id, status='active')
        created = 0
        for emp_id in employee_ids:
            emp = Employee.objects.filter(id=emp_id).first()
            for lt in leave_types:
                allocated = lt.default_days
                if emp and emp.department_id:
                    dept_alloc = DepartmentLeaveAllocation.objects.filter(
                        department_id=emp.department_id, leave_type=lt
                    ).first()
                    if dept_alloc:
                        allocated = dept_alloc.allocated_days

                _, was_created = LeaveBalance.objects.get_or_create(
                    employee_id=emp_id,
                    leave_type=lt,
                    fiscal_year_id=fiscal_year_id,
                    defaults={'allocated_days': allocated},
                )
                if was_created:
                    created += 1

        return Response({'message': f'{created} leave balances allocated'})


class LeaveRequestListView(APIView):
    @require_permission('hrms.leave_request.read')
    def get(self, request):
        reqs = LeaveRequest.objects.select_related('leave_type').all()
        emp_id = request.GET.get('employee_id')
        if emp_id:
            reqs = reqs.filter(employee_id=emp_id)
        status_filter = request.GET.get('status')
        if status_filter:
            reqs = reqs.filter(status=status_filter)
        org_id = request.GET.get('organization_id')
        if org_id:
            emp_ids = Employee.objects.filter(organization_id=org_id).values_list('id', flat=True)
            reqs = reqs.filter(employee_id__in=emp_ids)
        return Response([serialize_leave_request(lr) for lr in reqs[:200]])

    @require_permission('hrms.leave_request.add')
    def post(self, request):
        data = request.data
        employee_id = data.get('employee_id')
        leave_type_id = data.get('leave_type_id')
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        is_half_day = data.get('is_half_day', False)

        if not all([employee_id, leave_type_id, start_date, end_date]):
            return Response({'message': 'employee_id, leave_type_id, start_date, end_date are required'}, status=400)

        start = datetime.strptime(start_date, '%Y-%m-%d').date()
        end = datetime.strptime(end_date, '%Y-%m-%d').date()
        if end < start:
            return Response({'message': 'End date cannot be before start date'}, status=400)

        days_count = Decimal('0.5') if is_half_day else Decimal(str((end - start).days + 1))

        emp = Employee.objects.filter(id=employee_id).first()
        if emp and emp.organization_id:
            policy = LeavePolicy.objects.filter(organization_id=emp.organization_id).first()
            if policy:
                if policy.weekend_days:
                    business_days = Decimal('0')
                    current = start
                    while current <= end:
                        if current.weekday() not in policy.weekend_days:
                            business_days += 1
                        current += timedelta(days=1)
                    if not is_half_day:
                        days_count = business_days

                if days_count > policy.max_consecutive_days:
                    return Response({'message': f'Cannot request more than {policy.max_consecutive_days} consecutive days'}, status=400)

                if policy.min_days_advance_notice > 0:
                    days_ahead = (start - date.today()).days
                    if days_ahead < policy.min_days_advance_notice:
                        return Response({'message': f'Leave must be requested at least {policy.min_days_advance_notice} days in advance'}, status=400)

                if not policy.allow_half_day and is_half_day:
                    return Response({'message': 'Half-day leave is not allowed'}, status=400)

        lr = LeaveRequest.objects.create(
            employee_id=employee_id,
            leave_type_id=leave_type_id,
            start_date=start,
            end_date=end,
            days_count=days_count,
            is_half_day=is_half_day,
            half_day_period=data.get('half_day_period'),
            reason=data.get('reason'),
            document_url=data.get('document_url'),
        )
        return Response(serialize_leave_request(lr), status=201)


class LeaveRequestDetailView(APIView):
    @require_permission('hrms.leave_request.read')
    def get(self, request, lr_id):
        try:
            lr = LeaveRequest.objects.select_related('leave_type').get(id=lr_id)
        except LeaveRequest.DoesNotExist:
            return Response({'message': 'Leave request not found'}, status=404)
        return Response(serialize_leave_request(lr))

    @require_permission('hrms.leave_request.update')
    def put(self, request, lr_id):
        try:
            lr = LeaveRequest.objects.get(id=lr_id)
        except LeaveRequest.DoesNotExist:
            return Response({'message': 'Leave request not found'}, status=404)
        if lr.status != 'pending':
            return Response({'message': 'Only pending requests can be edited'}, status=400)
        data = request.data
        for field in ['start_date', 'end_date', 'reason', 'is_half_day', 'half_day_period', 'document_url']:
            if field in data:
                setattr(lr, field, data[field])
        lr.save()
        return Response(serialize_leave_request(lr))

    @require_permission('hrms.leave_request.delete')
    def delete(self, request, lr_id):
        try:
            lr = LeaveRequest.objects.get(id=lr_id)
        except LeaveRequest.DoesNotExist:
            return Response({'message': 'Leave request not found'}, status=404)
        if lr.status not in ('pending', 'rejected'):
            return Response({'message': 'Cannot delete an approved leave request'}, status=400)
        lr.delete()
        return Response({'message': 'Leave request deleted'})


class LeaveRequestApproveView(APIView):
    @require_permission('hrms.leave_request.approve')
    def post(self, request, lr_id):
        try:
            lr = LeaveRequest.objects.get(id=lr_id)
        except LeaveRequest.DoesNotExist:
            return Response({'message': 'Leave request not found'}, status=404)
        if lr.status != 'pending':
            return Response({'message': 'Only pending requests can be approved'}, status=400)

        user_id = request.session.get('userId')
        lr.status = 'approved'
        lr.approved_by = user_id
        lr.approved_at = timezone.now()
        lr.save()

        current_fy = FiscalYear.objects.filter(is_current=True).first()
        if current_fy:
            balance = LeaveBalance.objects.filter(
                employee_id=lr.employee_id,
                leave_type=lr.leave_type,
                fiscal_year=current_fy,
            ).first()
            if balance:
                balance.used_days += lr.days_count
                balance.save()

        start_d = lr.start_date
        end_d = lr.end_date
        current_d = start_d
        while current_d <= end_d:
            AttendanceRecord.objects.update_or_create(
                employee_id=lr.employee_id,
                date=current_d,
                defaults={'status': 'on_leave', 'notes': f'Leave: {lr.leave_type.name}'},
            )
            current_d += timedelta(days=1)

        return Response(serialize_leave_request(lr))


class LeaveRequestRejectView(APIView):
    @require_permission('hrms.leave_request.approve')
    def post(self, request, lr_id):
        try:
            lr = LeaveRequest.objects.get(id=lr_id)
        except LeaveRequest.DoesNotExist:
            return Response({'message': 'Leave request not found'}, status=404)
        if lr.status != 'pending':
            return Response({'message': 'Only pending requests can be rejected'}, status=400)

        lr.status = 'rejected'
        lr.rejection_reason = request.data.get('rejection_reason', '')
        lr.approved_by = request.session.get('userId')
        lr.approved_at = timezone.now()
        lr.save()
        return Response(serialize_leave_request(lr))


class AttendanceListView(APIView):
    @require_permission('hrms.attendance.read')
    def get(self, request):
        records = AttendanceRecord.objects.all()
        emp_id = request.GET.get('employee_id')
        if emp_id:
            records = records.filter(employee_id=emp_id)
        date_from = request.GET.get('date_from')
        if date_from:
            records = records.filter(date__gte=date_from)
        date_to = request.GET.get('date_to')
        if date_to:
            records = records.filter(date__lte=date_to)
        dept_id = request.GET.get('department_id')
        if dept_id:
            emp_ids = Employee.objects.filter(department_id=dept_id).values_list('id', flat=True)
            records = records.filter(employee_id__in=emp_ids)
        org_id = request.GET.get('organization_id')
        if org_id:
            emp_ids = Employee.objects.filter(organization_id=org_id).values_list('id', flat=True)
            records = records.filter(employee_id__in=emp_ids)
        the_date = request.GET.get('date')
        if the_date:
            records = records.filter(date=the_date)
        return Response([serialize_attendance(a) for a in records[:500]])

    @require_permission('hrms.attendance.add')
    def post(self, request):
        data = request.data
        att, created = AttendanceRecord.objects.update_or_create(
            employee_id=data.get('employee_id'),
            date=data.get('date'),
            defaults={
                'check_in': data.get('check_in'),
                'check_out': data.get('check_out'),
                'check_in_method': data.get('check_in_method', 'manual'),
                'check_out_method': data.get('check_out_method'),
                'status': data.get('status', 'present'),
                'notes': data.get('notes'),
            },
        )
        return Response(serialize_attendance(att), status=201 if created else 200)


class AttendanceDetailView(APIView):
    @require_permission('hrms.attendance.read')
    def get(self, request, att_id):
        try:
            att = AttendanceRecord.objects.get(id=att_id)
        except AttendanceRecord.DoesNotExist:
            return Response({'message': 'Attendance record not found'}, status=404)
        return Response(serialize_attendance(att))

    @require_permission('hrms.attendance.update')
    def put(self, request, att_id):
        try:
            att = AttendanceRecord.objects.get(id=att_id)
        except AttendanceRecord.DoesNotExist:
            return Response({'message': 'Attendance record not found'}, status=404)
        data = request.data
        for field in ['check_in', 'check_out', 'check_in_method', 'check_out_method',
                      'status', 'notes', 'is_late', 'is_early_leave', 'late_minutes', 'early_leave_minutes']:
            if field in data:
                setattr(att, field, data[field])
        att.save()
        return Response(serialize_attendance(att))


class OnlineCheckInView(APIView):
    @require_auth
    def post(self, request):
        user_id = request.session.get('userId')
        employee = get_employee_for_user(user_id)
        if not employee:
            return Response({'message': 'No employee profile linked to your account'}, status=404)

        perm = OnlineCheckInPermission.objects.filter(employee_id=employee.id, is_allowed=True).first()
        if not perm:
            return Response({'message': 'You do not have permission for online check-in'}, status=403)

        data = request.data
        today = date.today()
        now = timezone.now()

        existing = AttendanceRecord.objects.filter(employee_id=employee.id, date=today).first()
        if existing and existing.check_in:
            return Response({'message': 'You have already checked in today'}, status=400)

        dept = None
        is_late = False
        late_mins = 0
        if employee.department_id:
            dept = Department.objects.filter(id=employee.department_id).first()
            if dept:
                work_start = datetime.combine(today, dept.work_start_time)
                work_start = timezone.make_aware(work_start)
                diff = (now - work_start).total_seconds() / 60
                if diff > dept.late_threshold_minutes:
                    is_late = True
                    late_mins = int(diff)

        att, _ = AttendanceRecord.objects.update_or_create(
            employee_id=employee.id,
            date=today,
            defaults={
                'check_in': now,
                'check_in_method': 'online',
                'check_in_location': data.get('location'),
                'check_in_photo_url': data.get('photo_url'),
                'is_late': is_late,
                'late_minutes': late_mins,
                'status': 'present',
            },
        )

        if is_late:
            send_late_notification(employee, att, dept)

        return Response(serialize_attendance(att))


class OnlineCheckOutView(APIView):
    @require_auth
    def post(self, request):
        user_id = request.session.get('userId')
        employee = get_employee_for_user(user_id)
        if not employee:
            return Response({'message': 'No employee profile linked to your account'}, status=404)

        perm = OnlineCheckInPermission.objects.filter(employee_id=employee.id, is_allowed=True).first()
        if not perm:
            return Response({'message': 'You do not have permission for online check-out'}, status=403)

        data = request.data
        today = date.today()
        now = timezone.now()

        att = AttendanceRecord.objects.filter(employee_id=employee.id, date=today).first()
        if not att or not att.check_in:
            return Response({'message': 'You have not checked in today'}, status=400)
        if att.check_out:
            return Response({'message': 'You have already checked out today'}, status=400)

        dept = None
        is_early = False
        early_mins = 0
        if employee.department_id:
            dept = Department.objects.filter(id=employee.department_id).first()
            if dept:
                work_end = datetime.combine(today, dept.work_end_time)
                work_end = timezone.make_aware(work_end)
                diff = (work_end - now).total_seconds() / 60
                if diff > dept.early_leave_threshold_minutes:
                    is_early = True
                    early_mins = int(diff)

        if att.check_in:
            work_seconds = (now - att.check_in).total_seconds()
            att.work_hours = Decimal(str(round(work_seconds / 3600, 2)))

        att.check_out = now
        att.check_out_method = 'online'
        att.check_out_location = data.get('location')
        att.check_out_photo_url = data.get('photo_url')
        att.is_early_leave = is_early
        att.early_leave_minutes = early_mins
        att.save()

        if is_early:
            send_early_leave_notification(employee, att, dept)

        return Response(serialize_attendance(att))


class DeviceSyncView(APIView):
    @require_permission('hrms.attendance.add')
    def post(self, request):
        records = request.data.get('records', [])
        synced = 0
        errors = []
        for rec in records:
            device_user_id = rec.get('user_id')
            punch_time_str = rec.get('punch_time')
            punch_type = rec.get('punch_type', 'in')

            mapping = DeviceMapping.objects.filter(device_user_id=device_user_id).first()
            if not mapping:
                errors.append(f'No mapping for device user {device_user_id}')
                continue

            try:
                punch_time = datetime.fromisoformat(punch_time_str)
                if timezone.is_naive(punch_time):
                    punch_time = timezone.make_aware(punch_time)
            except (ValueError, TypeError):
                errors.append(f'Invalid punch_time: {punch_time_str}')
                continue

            punch_date = punch_time.date()
            att, _ = AttendanceRecord.objects.get_or_create(
                employee_id=mapping.employee_id,
                date=punch_date,
                defaults={'device_user_id': device_user_id}
            )

            employee = Employee.objects.filter(id=mapping.employee_id).first()
            dept = Department.objects.filter(id=employee.department_id).first() if employee and employee.department_id else None

            if punch_type == 'in' and not att.check_in:
                att.check_in = punch_time
                att.check_in_method = 'device'
                att.status = 'present'
                if dept:
                    work_start = datetime.combine(punch_date, dept.work_start_time)
                    work_start = timezone.make_aware(work_start)
                    diff = (punch_time - work_start).total_seconds() / 60
                    if diff > dept.late_threshold_minutes:
                        att.is_late = True
                        att.late_minutes = int(diff)
                att.save()
                if att.is_late and employee:
                    send_late_notification(employee, att, dept)
            elif punch_type == 'out':
                att.check_out = punch_time
                att.check_out_method = 'device'
                if att.check_in:
                    att.work_hours = Decimal(str(round((punch_time - att.check_in).total_seconds() / 3600, 2)))
                if dept:
                    work_end = datetime.combine(punch_date, dept.work_end_time)
                    work_end = timezone.make_aware(work_end)
                    diff = (work_end - punch_time).total_seconds() / 60
                    if diff > dept.early_leave_threshold_minutes:
                        att.is_early_leave = True
                        att.early_leave_minutes = int(diff)
                att.save()
                if att.is_early_leave and employee:
                    send_early_leave_notification(employee, att, dept)

            synced += 1

        return Response({'synced': synced, 'errors': errors})


class AttendanceDashboardView(APIView):
    @require_permission('hrms.attendance.read')
    def get(self, request):
        today = request.GET.get('date', date.today().isoformat())
        org_id = request.GET.get('organization_id')
        dept_id = request.GET.get('department_id')

        employees = Employee.objects.filter(status='active')
        if org_id:
            employees = employees.filter(organization_id=org_id)
        if dept_id:
            employees = employees.filter(department_id=dept_id)

        emp_ids = list(employees.values_list('id', flat=True))
        attendance = AttendanceRecord.objects.filter(employee_id__in=emp_ids, date=today)
        att_map = {str(a.employee_id): a for a in attendance}

        present = []
        absent = []
        on_leave = []
        late = []

        for emp in employees:
            emp_data = {
                'id': str(emp.id),
                'full_name': emp.full_name,
                'department': emp.department,
                'position': emp.position,
            }
            att = att_map.get(str(emp.id))
            if att:
                if att.status == 'on_leave':
                    on_leave.append(emp_data)
                else:
                    present.append({
                        **emp_data,
                        'check_in': att.check_in.isoformat() if att.check_in else None,
                        'check_out': att.check_out.isoformat() if att.check_out else None,
                        'is_late': att.is_late,
                        'late_minutes': att.late_minutes,
                    })
                    if att.is_late:
                        late.append(emp_data)
            else:
                absent.append(emp_data)

        leave_reqs = LeaveRequest.objects.filter(
            employee_id__in=emp_ids,
            status='approved',
            start_date__lte=today,
            end_date__gte=today,
        )
        for lr in leave_reqs:
            emp = employees.filter(id=lr.employee_id).first()
            if emp and str(emp.id) not in [o['id'] for o in on_leave]:
                on_leave.append({
                    'id': str(emp.id),
                    'full_name': emp.full_name,
                    'department': emp.department,
                    'position': emp.position,
                    'leave_type': lr.leave_type.name if lr.leave_type else None,
                })

        return Response({
            'date': today,
            'total_employees': len(emp_ids),
            'present_count': len(present),
            'absent_count': len(absent),
            'on_leave_count': len(on_leave),
            'late_count': len(late),
            'present': present,
            'absent': absent,
            'on_leave': on_leave,
            'late': late,
        })


class DeviceMappingListView(APIView):
    @require_permission('hrms.device_mapping.read')
    def get(self, request):
        mappings = DeviceMapping.objects.all()
        data = []
        for m in mappings:
            emp_name = None
            try:
                emp = Employee.objects.get(id=m.employee_id)
                emp_name = emp.full_name
            except Employee.DoesNotExist:
                pass
            data.append({
                'id': str(m.id),
                'employee_id': str(m.employee_id),
                'employee_name': emp_name,
                'device_user_id': m.device_user_id,
                'device_name': m.device_name,
            })
        return Response(data)

    @require_permission('hrms.device_mapping.add')
    def post(self, request):
        data = request.data
        dm = DeviceMapping.objects.create(
            employee_id=data.get('employee_id'),
            device_user_id=data.get('device_user_id'),
            device_name=data.get('device_name', 'ZKT K40'),
        )
        return Response({'id': str(dm.id), 'message': 'Device mapping created'}, status=201)


class DeviceMappingDetailView(APIView):
    @require_permission('hrms.device_mapping.delete')
    def delete(self, request, dm_id):
        try:
            dm = DeviceMapping.objects.get(id=dm_id)
        except DeviceMapping.DoesNotExist:
            return Response({'message': 'Device mapping not found'}, status=404)
        dm.delete()
        return Response({'message': 'Device mapping deleted'})


class OnlineCheckInPermissionListView(APIView):
    @require_permission('hrms.online_checkin.read')
    def get(self, request):
        perms = OnlineCheckInPermission.objects.all()
        data = []
        for p in perms:
            emp_name = None
            try:
                emp = Employee.objects.get(id=p.employee_id)
                emp_name = emp.full_name
            except Employee.DoesNotExist:
                pass
            data.append({
                'id': str(p.id),
                'employee_id': str(p.employee_id),
                'employee_name': emp_name,
                'is_allowed': p.is_allowed,
                'require_photo': p.require_photo,
                'require_location': p.require_location,
            })
        return Response(data)

    @require_permission('hrms.online_checkin.add')
    def post(self, request):
        data = request.data
        perm, created = OnlineCheckInPermission.objects.update_or_create(
            employee_id=data.get('employee_id'),
            defaults={
                'is_allowed': data.get('is_allowed', True),
                'require_photo': data.get('require_photo', True),
                'require_location': data.get('require_location', True),
                'allowed_by': request.session.get('userId'),
            },
        )
        return Response({
            'id': str(perm.id),
            'is_allowed': perm.is_allowed,
            'message': 'Permission updated' if not created else 'Permission created',
        }, status=201 if created else 200)


class OnlineCheckInPermissionDetailView(APIView):
    @require_permission('hrms.online_checkin.delete')
    def delete(self, request, perm_id):
        try:
            perm = OnlineCheckInPermission.objects.get(id=perm_id)
        except OnlineCheckInPermission.DoesNotExist:
            return Response({'message': 'Permission not found'}, status=404)
        perm.delete()
        return Response({'message': 'Permission deleted'})


class SalaryStructureListView(APIView):
    @require_permission('hrms.salary.read')
    def get(self, request):
        structs = SalaryStructure.objects.all()
        emp_id = request.GET.get('employee_id')
        if emp_id:
            structs = structs.filter(employee_id=emp_id)
        status = request.GET.get('status')
        if status:
            structs = structs.filter(status=status)
        return Response([serialize_salary_structure(ss) for ss in structs])

    @require_permission('hrms.salary.add')
    def post(self, request):
        data = request.data
        ss = SalaryStructure.objects.create(
            employee_id=data.get('employee_id'),
            basic_salary=data.get('basic_salary', 0),
            allowances=data.get('allowances', {}),
            deductions=data.get('deductions', {}),
            cit_type=data.get('cit_type', 'none'),
            cit_value=data.get('cit_value', 0),
            ssf_applicable=data.get('ssf_applicable', False),
            ssf_employee_percentage=data.get('ssf_employee_percentage', 11.0),
            ssf_employer_percentage=data.get('ssf_employer_percentage', 20.0),
            tax_applicable=data.get('tax_applicable', True),
            effective_from=data.get('effective_from'),
            effective_to=data.get('effective_to'),
        )
        return Response(serialize_salary_structure(ss), status=201)


class SalaryStructureDetailView(APIView):
    @require_permission('hrms.salary.read')
    def get(self, request, ss_id):
        try:
            ss = SalaryStructure.objects.get(id=ss_id)
        except SalaryStructure.DoesNotExist:
            return Response({'message': 'Salary structure not found'}, status=404)
        return Response(serialize_salary_structure(ss))

    @require_permission('hrms.salary.update')
    def put(self, request, ss_id):
        try:
            ss = SalaryStructure.objects.get(id=ss_id)
        except SalaryStructure.DoesNotExist:
            return Response({'message': 'Salary structure not found'}, status=404)
        data = request.data
        for field in ['basic_salary', 'allowances', 'deductions', 'cit_type', 'cit_value',
                      'ssf_applicable', 'ssf_employee_percentage', 'ssf_employer_percentage',
                      'tax_applicable', 'effective_from', 'effective_to', 'status']:
            if field in data:
                setattr(ss, field, data[field])
        ss.save()
        return Response(serialize_salary_structure(ss))


class PayrollRunListView(APIView):
    @require_permission('hrms.payroll.read')
    def get(self, request):
        runs = PayrollRun.objects.all()
        org_id = request.GET.get('organization_id')
        if org_id:
            runs = runs.filter(organization_id=org_id)
        return Response([{
            'id': str(r.id),
            'organization_id': str(r.organization_id),
            'organization_name': r.organization.name if r.organization else None,
            'fiscal_year_id': str(r.fiscal_year_id) if r.fiscal_year_id else None,
            'month': r.month,
            'year': r.year,
            'status': r.status,
            'total_gross': float(r.total_gross),
            'total_deductions': float(r.total_deductions),
            'total_net': float(r.total_net),
            'total_employer_contribution': float(r.total_employer_contribution),
            'payslip_count': r.payslips.count(),
            'processed_at': r.processed_at.isoformat() if r.processed_at else None,
            'created_at': r.created_at.isoformat() if r.created_at else None,
        } for r in runs])

    @require_permission('hrms.payroll.add')
    def post(self, request):
        data = request.data
        org_id = data.get('organization_id')
        month = data.get('month')
        year = data.get('year')
        if not all([org_id, month, year]):
            return Response({'message': 'organization_id, month, year are required'}, status=400)

        existing = PayrollRun.objects.filter(organization_id=org_id, month=month, year=year).first()
        if existing:
            return Response({'message': 'Payroll run already exists for this period'}, status=400)

        pr = PayrollRun.objects.create(
            organization_id=org_id,
            month=month,
            year=year,
            fiscal_year_id=data.get('fiscal_year_id'),
            created_by=request.session.get('userId'),
            notes=data.get('notes'),
        )
        return Response({
            'id': str(pr.id),
            'month': pr.month,
            'year': pr.year,
            'status': pr.status,
        }, status=201)


class PayrollRunDetailView(APIView):
    @require_permission('hrms.payroll.read')
    def get(self, request, pr_id):
        try:
            pr = PayrollRun.objects.get(id=pr_id)
        except PayrollRun.DoesNotExist:
            return Response({'message': 'Payroll run not found'}, status=404)
        payslips = Payslip.objects.filter(payroll_run=pr)
        return Response({
            'id': str(pr.id),
            'organization_id': str(pr.organization_id),
            'month': pr.month,
            'year': pr.year,
            'status': pr.status,
            'total_gross': float(pr.total_gross),
            'total_deductions': float(pr.total_deductions),
            'total_net': float(pr.total_net),
            'total_employer_contribution': float(pr.total_employer_contribution),
            'notes': pr.notes,
            'payslips': [serialize_payslip(ps) for ps in payslips],
        })

    @require_permission('hrms.payroll.delete')
    def delete(self, request, pr_id):
        try:
            pr = PayrollRun.objects.get(id=pr_id)
        except PayrollRun.DoesNotExist:
            return Response({'message': 'Payroll run not found'}, status=404)
        if pr.status == 'completed':
            return Response({'message': 'Cannot delete a completed payroll run'}, status=400)
        pr.delete()
        return Response({'message': 'Payroll run deleted'})


def calculate_nepal_tax(annual_income, marital_status='single'):
    if marital_status == 'married':
        slabs = [
            (500000, Decimal('0.01')),
            (200000, Decimal('0.10')),
            (300000, Decimal('0.20')),
            (1000000, Decimal('0.30')),
            (None, Decimal('0.36')),
        ]
    else:
        slabs = [
            (500000, Decimal('0.01')),
            (200000, Decimal('0.10')),
            (300000, Decimal('0.20')),
            (1000000, Decimal('0.30')),
            (None, Decimal('0.36')),
        ]

    remaining = Decimal(str(annual_income))
    total_tax = Decimal('0')
    for limit, rate in slabs:
        if limit is None:
            total_tax += remaining * rate
            break
        if remaining <= 0:
            break
        taxable = min(remaining, Decimal(str(limit)))
        total_tax += taxable * rate
        remaining -= taxable

    return total_tax


class PayrollRunProcessView(APIView):
    @require_permission('hrms.payroll.process')
    def post(self, request, pr_id):
        try:
            pr = PayrollRun.objects.get(id=pr_id)
        except PayrollRun.DoesNotExist:
            return Response({'message': 'Payroll run not found'}, status=404)

        if pr.status == 'completed':
            return Response({'message': 'Payroll already processed'}, status=400)

        pr.status = 'processing'
        pr.save()

        employees = Employee.objects.filter(organization_id=pr.organization_id, status='active')
        total_gross = Decimal('0')
        total_deductions = Decimal('0')
        total_net = Decimal('0')
        total_employer = Decimal('0')

        month_start = date(pr.year, pr.month, 1)
        if pr.month == 12:
            month_end = date(pr.year + 1, 1, 1) - timedelta(days=1)
        else:
            month_end = date(pr.year, pr.month + 1, 1) - timedelta(days=1)

        for emp in employees:
            sal = SalaryStructure.objects.filter(
                employee_id=emp.id, status='active',
                effective_from__lte=month_end,
            ).order_by('-effective_from').first()

            if not sal:
                continue

            basic = sal.basic_salary
            allowances_total = sum(Decimal(str(v)) for v in sal.allowances.values()) if sal.allowances else Decimal('0')
            gross = basic + allowances_total

            cit_deduction = Decimal('0')
            if sal.cit_type == 'percentage':
                cit_deduction = gross * sal.cit_value / 100
            elif sal.cit_type == 'flat':
                cit_deduction = sal.cit_value

            ssf_employee = Decimal('0')
            ssf_employer = Decimal('0')
            if sal.ssf_applicable:
                ssf_employee = gross * sal.ssf_employee_percentage / 100
                ssf_employer = gross * sal.ssf_employer_percentage / 100

            tax_deduction = Decimal('0')
            if sal.tax_applicable:
                annual_taxable = (gross - cit_deduction - ssf_employee) * 12
                annual_tax = calculate_nepal_tax(annual_taxable, emp.marital_status or 'single')
                tax_deduction = (annual_tax / 12).quantize(Decimal('0.01'))

            other_deductions = sal.deductions or {}
            other_ded_total = sum(Decimal(str(v)) for v in other_deductions.values()) if other_deductions else Decimal('0')
            total_ded = cit_deduction + ssf_employee + tax_deduction + other_ded_total
            net = gross - total_ded

            att_records = AttendanceRecord.objects.filter(
                employee_id=emp.id, date__gte=month_start, date__lte=month_end
            )
            present_count = att_records.filter(status='present').count()
            absent_count = att_records.filter(status='absent').count()
            leave_count = att_records.filter(status='on_leave').count()
            late_count = att_records.filter(is_late=True).count()
            early_count = att_records.filter(is_early_leave=True).count()
            working_days = (month_end - month_start).days + 1

            Payslip.objects.update_or_create(
                payroll_run=pr,
                employee_id=emp.id,
                defaults={
                    'month': pr.month,
                    'year': pr.year,
                    'basic_salary': basic,
                    'allowances': sal.allowances or {},
                    'gross_salary': gross,
                    'cit_deduction': cit_deduction,
                    'ssf_employee_deduction': ssf_employee,
                    'ssf_employer_contribution': ssf_employer,
                    'tax_deduction': tax_deduction,
                    'other_deductions': other_deductions,
                    'total_deductions': total_ded,
                    'net_salary': net,
                    'working_days': working_days,
                    'present_days': present_count,
                    'absent_days': absent_count,
                    'leave_days': leave_count,
                    'late_count': late_count,
                    'early_leave_count': early_count,
                    'status': 'generated',
                },
            )

            total_gross += gross
            total_deductions += total_ded
            total_net += net
            total_employer += ssf_employer

        pr.status = 'completed'
        pr.total_gross = total_gross
        pr.total_deductions = total_deductions
        pr.total_net = total_net
        pr.total_employer_contribution = total_employer
        pr.processed_at = timezone.now()
        pr.save()

        return Response({
            'message': 'Payroll processed successfully',
            'payslip_count': pr.payslips.count(),
            'total_gross': float(total_gross),
            'total_net': float(total_net),
        })


class PayslipListView(APIView):
    @require_permission('hrms.payslip.read')
    def get(self, request):
        payslips = Payslip.objects.all()
        emp_id = request.GET.get('employee_id')
        if emp_id:
            payslips = payslips.filter(employee_id=emp_id)
        pr_id = request.GET.get('payroll_run_id')
        if pr_id:
            payslips = payslips.filter(payroll_run_id=pr_id)
        month = request.GET.get('month')
        year = request.GET.get('year')
        if month:
            payslips = payslips.filter(month=month)
        if year:
            payslips = payslips.filter(year=year)
        return Response([serialize_payslip(ps) for ps in payslips])


class PayslipDetailView(APIView):
    @require_permission('hrms.payslip.read')
    def get(self, request, ps_id):
        try:
            ps = Payslip.objects.get(id=ps_id)
        except Payslip.DoesNotExist:
            return Response({'message': 'Payslip not found'}, status=404)
        return Response(serialize_payslip(ps))


class NotificationSettingView(APIView):
    @require_permission('hrms.notification.read')
    def get(self, request):
        org_id = request.GET.get('organization_id')
        if not org_id:
            return Response({'message': 'organization_id is required'}, status=400)
        ns = NotificationSetting.objects.filter(organization_id=org_id).first()
        if not ns:
            return Response(None)
        return Response({
            'id': str(ns.id),
            'organization_id': str(ns.organization_id),
            'late_arrival_notify_employee': ns.late_arrival_notify_employee,
            'late_arrival_notify_manager': ns.late_arrival_notify_manager,
            'late_arrival_notify_hr': ns.late_arrival_notify_hr,
            'early_leave_notify_employee': ns.early_leave_notify_employee,
            'early_leave_notify_manager': ns.early_leave_notify_manager,
            'early_leave_notify_hr': ns.early_leave_notify_hr,
            'hr_email': ns.hr_email,
            'late_email_subject': ns.late_email_subject,
            'late_email_template': ns.late_email_template,
            'early_leave_email_subject': ns.early_leave_email_subject,
            'early_leave_email_template': ns.early_leave_email_template,
        })

    @require_permission('hrms.notification.update')
    def post(self, request):
        data = request.data
        org_id = data.get('organization_id')
        if not org_id:
            return Response({'message': 'organization_id is required'}, status=400)

        ns, _ = NotificationSetting.objects.update_or_create(
            organization_id=org_id,
            defaults={k: v for k, v in data.items() if k != 'organization_id'},
        )
        return Response({'message': 'Notification settings updated'})


class MyProfileView(APIView):
    @require_auth
    def get(self, request):
        user_id = request.session.get('userId')
        employee = get_employee_for_user(user_id)
        if not employee:
            return Response({'message': 'No employee profile linked'}, status=404)

        org = None
        dept = None
        if employee.organization_id:
            org = Organization.objects.filter(id=employee.organization_id).first()
        if employee.department_id:
            dept = Department.objects.filter(id=employee.department_id).first()

        return Response({
            'id': str(employee.id),
            'full_name': employee.full_name,
            'email': employee.email,
            'phone': employee.phone,
            'position': employee.position,
            'department': dept.name if dept else employee.department,
            'organization': org.name if org else None,
            'join_date': employee.join_date.isoformat() if employee.join_date else None,
            'profile_photo_url': employee.profile_photo_url,
            'employment_type': employee.employment_type,
        })


class MyAttendanceView(APIView):
    @require_auth
    def get(self, request):
        user_id = request.session.get('userId')
        employee = get_employee_for_user(user_id)
        if not employee:
            return Response({'message': 'No employee profile linked'}, status=404)

        records = AttendanceRecord.objects.filter(employee_id=employee.id)
        date_from = request.GET.get('date_from')
        if date_from:
            records = records.filter(date__gte=date_from)
        date_to = request.GET.get('date_to')
        if date_to:
            records = records.filter(date__lte=date_to)

        month = request.GET.get('month')
        year = request.GET.get('year')
        if month and year:
            records = records.filter(date__month=month, date__year=year)

        online_perm = OnlineCheckInPermission.objects.filter(employee_id=employee.id, is_allowed=True).exists()

        return Response({
            'records': [serialize_attendance(a) for a in records[:100]],
            'online_checkin_allowed': online_perm,
        })


class MyLeaveBalanceView(APIView):
    @require_auth
    def get(self, request):
        user_id = request.session.get('userId')
        employee = get_employee_for_user(user_id)
        if not employee:
            return Response({'message': 'No employee profile linked'}, status=404)

        current_fy = FiscalYear.objects.filter(is_current=True).first()
        if not current_fy:
            return Response([])

        balances = LeaveBalance.objects.select_related('leave_type', 'fiscal_year').filter(
            employee_id=employee.id, fiscal_year=current_fy
        )
        return Response([serialize_leave_balance(lb) for lb in balances])


class MyLeaveRequestsView(APIView):
    @require_auth
    def get(self, request):
        user_id = request.session.get('userId')
        employee = get_employee_for_user(user_id)
        if not employee:
            return Response({'message': 'No employee profile linked'}, status=404)

        reqs = LeaveRequest.objects.select_related('leave_type').filter(employee_id=employee.id)
        status_filter = request.GET.get('status')
        if status_filter:
            reqs = reqs.filter(status=status_filter)
        return Response([serialize_leave_request(lr) for lr in reqs[:100]])

    @require_auth
    def post(self, request):
        user_id = request.session.get('userId')
        employee = get_employee_for_user(user_id)
        if not employee:
            return Response({'message': 'No employee profile linked'}, status=404)

        data = request.data
        data['employee_id'] = str(employee.id)

        leave_type_id = data.get('leave_type_id')
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        is_half_day = data.get('is_half_day', False)

        if not all([leave_type_id, start_date, end_date]):
            return Response({'message': 'leave_type_id, start_date, end_date are required'}, status=400)

        start = datetime.strptime(start_date, '%Y-%m-%d').date()
        end = datetime.strptime(end_date, '%Y-%m-%d').date()
        if end < start:
            return Response({'message': 'End date cannot be before start date'}, status=400)

        days_count = Decimal('0.5') if is_half_day else Decimal(str((end - start).days + 1))

        if employee.organization_id:
            policy = LeavePolicy.objects.filter(organization_id=employee.organization_id).first()
            if policy:
                if policy.weekend_days:
                    business_days = Decimal('0')
                    current = start
                    while current <= end:
                        if current.weekday() not in policy.weekend_days:
                            business_days += 1
                        current += timedelta(days=1)
                    if not is_half_day:
                        days_count = business_days

                if days_count > policy.max_consecutive_days:
                    return Response({'message': f'Cannot request more than {policy.max_consecutive_days} consecutive days'}, status=400)

                if policy.min_days_advance_notice > 0:
                    days_ahead = (start - date.today()).days
                    if days_ahead < policy.min_days_advance_notice:
                        return Response({'message': f'Leave must be requested at least {policy.min_days_advance_notice} days in advance'}, status=400)

                if not policy.allow_half_day and is_half_day:
                    return Response({'message': 'Half-day leave is not allowed'}, status=400)

                if not policy.allow_negative_balance:
                    current_fy = FiscalYear.objects.filter(is_current=True).first()
                    if current_fy:
                        balance = LeaveBalance.objects.filter(
                            employee_id=employee.id,
                            leave_type_id=leave_type_id,
                            fiscal_year=current_fy,
                        ).first()
                        if balance and balance.remaining_days < days_count:
                            return Response({'message': f'Insufficient leave balance. Available: {float(balance.remaining_days)} days'}, status=400)

        lr = LeaveRequest.objects.create(
            employee_id=employee.id,
            leave_type_id=leave_type_id,
            start_date=start,
            end_date=end,
            days_count=days_count,
            is_half_day=is_half_day,
            half_day_period=data.get('half_day_period'),
            reason=data.get('reason'),
            document_url=data.get('document_url'),
        )
        return Response(serialize_leave_request(lr), status=201)


class MyPayslipsView(APIView):
    @require_auth
    def get(self, request):
        user_id = request.session.get('userId')
        employee = get_employee_for_user(user_id)
        if not employee:
            return Response({'message': 'No employee profile linked'}, status=404)

        payslips = Payslip.objects.filter(employee_id=employee.id)
        year = request.GET.get('year')
        if year:
            payslips = payslips.filter(year=year)
        return Response([serialize_payslip(ps) for ps in payslips])
