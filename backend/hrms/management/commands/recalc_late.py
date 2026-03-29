from django.core.management.base import BaseCommand
from datetime import datetime
from decimal import Decimal
import zoneinfo


class Command(BaseCommand):
    help = 'Recalculate is_late and is_early_leave for all attendance records'

    def handle(self, *args, **options):
        from hrms.models import AttendanceRecord, Department
        from employees.models import Employee
        from hrms.views import _get_employee_schedule

        nepal_tz = zoneinfo.ZoneInfo('Asia/Kathmandu')
        records = AttendanceRecord.objects.filter(status='present')
        total = records.count()
        updated_late = 0
        updated_early = 0

        emp_cache = {}
        dept_cache = {}

        for i, att in enumerate(records.iterator()):
            if str(att.employee_id) not in emp_cache:
                try:
                    emp_cache[str(att.employee_id)] = Employee.objects.get(id=att.employee_id)
                except Employee.DoesNotExist:
                    emp_cache[str(att.employee_id)] = None

            emp = emp_cache[str(att.employee_id)]
            if not emp:
                continue

            dept = None
            if emp.department_id:
                if str(emp.department_id) not in dept_cache:
                    dept_cache[str(emp.department_id)] = Department.objects.filter(id=emp.department_id).first()
                dept = dept_cache[str(emp.department_id)]

            schedule = _get_employee_schedule(emp, dept)
            changed = False

            if att.check_in and schedule['work_start_time'] and dept:
                ci_npt = att.check_in.astimezone(nepal_tz)
                work_start = datetime.combine(att.date, schedule['work_start_time'])
                work_start = work_start.replace(tzinfo=nepal_tz)
                diff = (ci_npt - work_start).total_seconds() / 60
                is_late = diff > dept.late_threshold_minutes
                late_mins = int(diff) if is_late else 0
                if att.is_late != is_late or att.late_minutes != late_mins:
                    att.is_late = is_late
                    att.late_minutes = late_mins
                    changed = True
                    if is_late:
                        updated_late += 1

            if att.check_out and schedule['work_end_time'] and dept:
                co_npt = att.check_out.astimezone(nepal_tz)
                work_end = datetime.combine(att.date, schedule['work_end_time'])
                work_end = work_end.replace(tzinfo=nepal_tz)
                diff = (work_end - co_npt).total_seconds() / 60
                is_early = diff > dept.early_leave_threshold_minutes
                early_mins = int(diff) if is_early else 0
                if att.is_early_leave != is_early or att.early_leave_minutes != early_mins:
                    att.is_early_leave = is_early
                    att.early_leave_minutes = early_mins
                    changed = True
                    if is_early:
                        updated_early += 1

            if att.check_in and att.check_out:
                wh = Decimal(str(round((att.check_out - att.check_in).total_seconds() / 3600, 2)))
                if att.work_hours != wh:
                    att.work_hours = wh
                    changed = True

            if changed:
                att.save()

            if (i + 1) % 100 == 0:
                self.stdout.write(f'  Processed {i + 1}/{total}...')

        self.stdout.write(self.style.SUCCESS(
            f'Done. Processed {total} records. '
            f'Marked {updated_late} as late, {updated_early} as early leave.'
        ))
