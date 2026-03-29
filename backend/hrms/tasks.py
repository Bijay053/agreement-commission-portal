from celery import shared_task
from datetime import date
from django.utils import timezone


@shared_task
def check_missing_checkouts():
    from hrms.models import (
        AttendanceRecord, Organization, Department,
        NotificationSetting, LeaveRequest,
    )
    from hrms.views import send_no_checkout_notification
    from employees.models import Employee
    import zoneinfo

    nepal_tz = zoneinfo.ZoneInfo('Asia/Kathmandu')
    now_npt = timezone.now().astimezone(nepal_tz)
    today = now_npt.date()

    missing = AttendanceRecord.objects.filter(
        date=today,
        check_in__isnull=False,
        check_out__isnull=True,
        status='present',
    )

    on_leave_emp_ids = set(
        LeaveRequest.objects.filter(
            status='approved',
            start_date__lte=today,
            end_date__gte=today,
        ).values_list('employee_id', flat=True)
    )

    count = 0
    for att in missing:
        if att.employee_id in on_leave_emp_ids:
            continue

        try:
            employee = Employee.objects.get(id=att.employee_id)
        except Employee.DoesNotExist:
            continue

        dept = None
        if employee.department_id:
            dept = Department.objects.filter(id=employee.department_id).first()

        if dept and dept.work_end_time:
            work_end = now_npt.replace(
                hour=dept.work_end_time.hour,
                minute=dept.work_end_time.minute,
                second=0, microsecond=0,
            )
            if now_npt < work_end:
                continue

        send_no_checkout_notification(employee, att, dept)
        count += 1

    return f'Sent {count} missing checkout notifications for {today}'
