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


@shared_task
def sync_attendance_from_device():
    import os
    import logging
    import zoneinfo
    from datetime import datetime
    from decimal import Decimal

    from hrms.models import (
        AttendanceRecord, DeviceMapping, Department,
    )
    from hrms.views import (
        send_late_notification, send_early_leave_notification,
        _get_employee_schedule,
    )
    from employees.models import Employee

    logger = logging.getLogger('hrms.tasks')

    device_ip = os.getenv('ZK_DEVICE_IP', '192.168.16.201')
    device_port = int(os.getenv('ZK_DEVICE_PORT', '4370'))

    nepal_tz = zoneinfo.ZoneInfo('Asia/Kathmandu')
    now_npt = timezone.now().astimezone(nepal_tz)
    today = now_npt.date()

    try:
        from zk import ZK
    except ImportError:
        logger.error('pyzk not installed – cannot sync from device')
        return 'pyzk not installed'

    zk = ZK(device_ip, port=device_port, timeout=15)
    conn = None
    synced = 0
    errors = []

    try:
        conn = zk.connect()
        conn.disable_device()
        attendances = conn.get_attendance()
        conn.enable_device()

        if not attendances:
            logger.info('No attendance records on device')
            return 'No records on device'

        today_records = [a for a in attendances if a.timestamp.date() == today]

        logger.info(f'Found {len(today_records)} records for {today} (total on device: {len(attendances)})')

        for att_record in today_records:
            device_user_id = str(att_record.user_id)
            punch_time = att_record.timestamp
            if timezone.is_naive(punch_time):
                punch_time = punch_time.replace(tzinfo=nepal_tz)

            punch_type = 'in'
            if hasattr(att_record, 'punch') and att_record.punch == 1:
                punch_type = 'out'
            elif hasattr(att_record, 'status') and att_record.status == 1:
                punch_type = 'out'

            mapping = DeviceMapping.objects.filter(device_user_id=device_user_id).first()
            if not mapping:
                emp_match = Employee.objects.filter(
                    employee_id_number=device_user_id, status='active'
                ).first()
                if emp_match:
                    if not DeviceMapping.objects.filter(employee_id=emp_match.id).exists():
                        mapping = DeviceMapping.objects.create(
                            employee_id=emp_match.id,
                            device_user_id=device_user_id,
                            device_name='ZKT K40 (auto)',
                        )
                    else:
                        continue
                else:
                    continue

            punch_date = punch_time.date()
            att, created = AttendanceRecord.objects.get_or_create(
                employee_id=mapping.employee_id,
                date=punch_date,
                defaults={'device_user_id': device_user_id}
            )

            employee = Employee.objects.filter(id=mapping.employee_id).first()
            dept = Department.objects.filter(id=employee.department_id).first() if employee and employee.department_id else None

            is_checkin = False
            is_checkout = False

            if punch_type == 'out':
                is_checkout = True
            elif not att.check_in:
                is_checkin = True
            elif att.check_in and punch_time > att.check_in:
                is_checkout = True

            if is_checkin:
                att.check_in = punch_time
                att.check_in_method = 'device'
                att.status = 'present'
                emp_schedule = _get_employee_schedule(employee, dept) if employee else None
                eff_start = emp_schedule['work_start_time'] if emp_schedule else (dept.work_start_time if dept else None)
                if eff_start and dept:
                    work_start = datetime.combine(punch_date, eff_start)
                    work_start = work_start.replace(tzinfo=nepal_tz)
                    diff = (punch_time - work_start).total_seconds() / 60
                    if diff > dept.late_threshold_minutes:
                        att.is_late = True
                        att.late_minutes = int(diff)
                att.save()
                if att.is_late and employee:
                    send_late_notification(employee, att, dept)
            elif is_checkout:
                if not att.check_out or punch_time > att.check_out:
                    att.check_out = punch_time
                    att.check_out_method = 'device'
                if att.check_in:
                    att.work_hours = Decimal(str(round((att.check_out - att.check_in).total_seconds() / 3600, 2)))
                emp_schedule = _get_employee_schedule(employee, dept) if employee else None
                eff_end = emp_schedule['work_end_time'] if emp_schedule else (dept.work_end_time if dept else None)
                if eff_end and dept:
                    work_end = datetime.combine(punch_date, eff_end)
                    work_end = work_end.replace(tzinfo=nepal_tz)
                    diff = (work_end - punch_time).total_seconds() / 60
                    if diff > dept.early_leave_threshold_minutes:
                        att.is_early_leave = True
                        att.early_leave_minutes = int(diff)
                att.save()
                if att.is_early_leave and employee:
                    send_early_leave_notification(employee, att, dept)

            synced += 1

    except Exception as e:
        logger.error(f'K40 sync error: {str(e)}')
        return f'Sync failed: {str(e)}'
    finally:
        if conn:
            try:
                conn.disconnect()
            except Exception:
                pass

    return f'Synced {synced} records for {today}'
