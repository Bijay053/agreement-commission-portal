from celery import shared_task
from datetime import date
from django.utils import timezone


@shared_task
def check_missing_checkouts():
    from hrms.models import AttendanceRecord, Organization, Department, NotificationSetting
    from hrms.views import send_no_checkout_notification
    from employees.models import Employee

    today = date.today()
    missing = AttendanceRecord.objects.filter(
        date=today,
        check_in__isnull=False,
        check_out__isnull=True,
        status='present',
    )

    count = 0
    for att in missing:
        try:
            employee = Employee.objects.get(id=att.employee_id)
        except Employee.DoesNotExist:
            continue

        dept = None
        if employee.department_id:
            dept = Department.objects.filter(id=employee.department_id).first()

        if dept and dept.work_end_time:
            work_end = timezone.now().replace(
                hour=dept.work_end_time.hour,
                minute=dept.work_end_time.minute,
                second=0, microsecond=0,
            )
            if timezone.now() < work_end:
                continue

        send_no_checkout_notification(employee, att, dept)
        count += 1

    return f'Sent {count} missing checkout notifications for {today}'
