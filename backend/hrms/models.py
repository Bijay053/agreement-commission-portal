import uuid
from django.db import models


class Organization(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    short_code = models.CharField(max_length=32, unique=True)
    address = models.TextField(null=True, blank=True)
    country = models.CharField(max_length=64, null=True, blank=True)
    phone = models.CharField(max_length=32, null=True, blank=True)
    email = models.EmailField(null=True, blank=True)
    registration_number = models.CharField(max_length=64, null=True, blank=True)
    registration_label = models.CharField(max_length=64, default='Registration No.')
    pan_number = models.CharField(max_length=64, null=True, blank=True)
    pan_label = models.CharField(max_length=64, default='PAN No.')
    logo_url = models.URLField(null=True, blank=True)
    currency = models.CharField(max_length=8, default='NPR')
    status = models.CharField(max_length=24, default='active')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'hrms_organizations'
        ordering = ['name']

    def __str__(self):
        return self.name


class Department(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='departments')
    name = models.CharField(max_length=255)
    head_employee_id = models.UUIDField(null=True, blank=True)
    working_days_per_week = models.IntegerField(default=6)
    work_start_time = models.TimeField(default='10:00:00')
    work_end_time = models.TimeField(default='18:00:00')
    late_threshold_minutes = models.IntegerField(default=15)
    early_leave_threshold_minutes = models.IntegerField(default=15)
    status = models.CharField(max_length=24, default='active')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'hrms_departments'
        ordering = ['name']
        unique_together = ['organization', 'name']

    def __str__(self):
        return f"{self.name} ({self.organization.short_code})"


class FiscalYear(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='fiscal_years')
    name = models.CharField(max_length=64)
    start_date = models.DateField()
    end_date = models.DateField()
    is_current = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'hrms_fiscal_years'
        ordering = ['-start_date']

    def __str__(self):
        return self.name


class LeaveType(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='leave_types')
    name = models.CharField(max_length=128)
    code = models.CharField(max_length=32)
    default_days = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    is_paid = models.BooleanField(default=True)
    is_carry_forward = models.BooleanField(default=False)
    max_carry_forward_days = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    requires_document = models.BooleanField(default=False)
    document_required_after_days = models.IntegerField(default=0)
    color = models.CharField(max_length=7, default='#3B82F6')
    status = models.CharField(max_length=24, default='active')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'hrms_leave_types'
        ordering = ['name']
        unique_together = ['organization', 'code']

    def __str__(self):
        return f"{self.name} ({self.organization.short_code})"


class DepartmentLeaveAllocation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='leave_allocations')
    leave_type = models.ForeignKey(LeaveType, on_delete=models.CASCADE, related_name='department_allocations')
    allocated_days = models.DecimalField(max_digits=5, decimal_places=1)

    class Meta:
        db_table = 'hrms_department_leave_allocations'
        unique_together = ['department', 'leave_type']


class LeavePolicy(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='leave_policies')
    min_days_advance_notice = models.IntegerField(default=1)
    max_consecutive_days = models.IntegerField(default=14)
    require_document_after_days = models.IntegerField(default=3)
    allow_half_day = models.BooleanField(default=True)
    allow_negative_balance = models.BooleanField(default=False)
    max_negative_days = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    require_approval = models.BooleanField(default=True)
    auto_approve_if_balance = models.BooleanField(default=False)
    weekend_days = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'hrms_leave_policies'


class Holiday(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='holidays')
    name = models.CharField(max_length=255)
    date = models.DateField()
    is_optional = models.BooleanField(default=False)
    fiscal_year = models.ForeignKey(FiscalYear, on_delete=models.CASCADE, null=True, blank=True, related_name='holidays')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'hrms_holidays'
        ordering = ['date']
        unique_together = ['organization', 'date', 'name']


class LeaveBalance(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee_id = models.UUIDField()
    leave_type = models.ForeignKey(LeaveType, on_delete=models.CASCADE, related_name='balances')
    fiscal_year = models.ForeignKey(FiscalYear, on_delete=models.CASCADE, related_name='leave_balances')
    allocated_days = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    used_days = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    carried_forward_days = models.DecimalField(max_digits=5, decimal_places=1, default=0)

    class Meta:
        db_table = 'hrms_leave_balances'
        unique_together = ['employee_id', 'leave_type', 'fiscal_year']

    @property
    def remaining_days(self):
        return self.allocated_days + self.carried_forward_days - self.used_days


LEAVE_REQUEST_STATUS = [
    ('pending', 'Pending'),
    ('approved', 'Approved'),
    ('rejected', 'Rejected'),
    ('cancelled', 'Cancelled'),
]


class LeaveRequest(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee_id = models.UUIDField()
    leave_type = models.ForeignKey(LeaveType, on_delete=models.CASCADE, related_name='requests')
    start_date = models.DateField()
    end_date = models.DateField()
    days_count = models.DecimalField(max_digits=5, decimal_places=1)
    is_half_day = models.BooleanField(default=False)
    half_day_period = models.CharField(max_length=16, null=True, blank=True)
    reason = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=24, default='pending', choices=LEAVE_REQUEST_STATUS)
    approved_by = models.UUIDField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(null=True, blank=True)
    document_url = models.URLField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'hrms_leave_requests'
        ordering = ['-created_at']


CHECK_METHOD_CHOICES = [
    ('device', 'Biometric Device'),
    ('online', 'Online Check-in'),
    ('manual', 'Manual Entry'),
]

ATTENDANCE_STATUS_CHOICES = [
    ('present', 'Present'),
    ('absent', 'Absent'),
    ('half_day', 'Half Day'),
    ('on_leave', 'On Leave'),
    ('holiday', 'Holiday'),
    ('weekend', 'Weekend'),
]


class AttendanceRecord(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee_id = models.UUIDField()
    date = models.DateField()
    check_in = models.DateTimeField(null=True, blank=True)
    check_out = models.DateTimeField(null=True, blank=True)
    check_in_method = models.CharField(max_length=16, default='device', choices=CHECK_METHOD_CHOICES)
    check_out_method = models.CharField(max_length=16, null=True, blank=True, choices=CHECK_METHOD_CHOICES)
    check_in_location = models.JSONField(null=True, blank=True)
    check_out_location = models.JSONField(null=True, blank=True)
    check_in_photo_url = models.URLField(null=True, blank=True)
    check_out_photo_url = models.URLField(null=True, blank=True)
    is_late = models.BooleanField(default=False)
    is_early_leave = models.BooleanField(default=False)
    late_minutes = models.IntegerField(default=0)
    early_leave_minutes = models.IntegerField(default=0)
    status = models.CharField(max_length=24, default='present', choices=ATTENDANCE_STATUS_CHOICES)
    work_hours = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    overtime_hours = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    notes = models.TextField(null=True, blank=True)
    device_user_id = models.CharField(max_length=64, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'hrms_attendance_records'
        ordering = ['-date', 'check_in']
        unique_together = ['employee_id', 'date']


class OnlineCheckInPermission(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee_id = models.UUIDField(unique=True)
    is_allowed = models.BooleanField(default=False)
    require_photo = models.BooleanField(default=True)
    require_location = models.BooleanField(default=True)
    allowed_by = models.UUIDField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'hrms_online_checkin_permissions'


class DeviceMapping(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee_id = models.UUIDField(unique=True)
    device_user_id = models.CharField(max_length=64, unique=True)
    device_name = models.CharField(max_length=128, default='ZKT K40')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'hrms_device_mappings'


CIT_TYPE_CHOICES = [
    ('percentage', 'Percentage of Salary'),
    ('flat', 'Flat Amount'),
    ('none', 'Not Applicable'),
]


class SalaryStructure(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee_id = models.UUIDField()
    basic_salary = models.DecimalField(max_digits=12, decimal_places=2)
    allowances = models.JSONField(default=dict)
    deductions = models.JSONField(default=dict)
    cit_type = models.CharField(max_length=16, default='none', choices=CIT_TYPE_CHOICES)
    cit_value = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    ssf_applicable = models.BooleanField(default=False)
    ssf_employee_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=11.00)
    ssf_employer_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=20.00)
    tax_applicable = models.BooleanField(default=True)
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=24, default='active')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'hrms_salary_structures'
        ordering = ['-effective_from']


PAYROLL_STATUS_CHOICES = [
    ('draft', 'Draft'),
    ('processing', 'Processing'),
    ('processed', 'Processed'),
    ('approved', 'Approved'),
    ('paid', 'Paid'),
    ('completed', 'Completed'),
    ('cancelled', 'Cancelled'),
]


class PayrollRun(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='payroll_runs')
    fiscal_year = models.ForeignKey(FiscalYear, on_delete=models.SET_NULL, null=True, blank=True, related_name='payroll_runs')
    month = models.IntegerField()
    year = models.IntegerField()
    status = models.CharField(max_length=24, default='draft', choices=PAYROLL_STATUS_CHOICES)
    total_gross = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_deductions = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_net = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_employer_contribution = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    created_by = models.UUIDField(null=True, blank=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'hrms_payroll_runs'
        ordering = ['-year', '-month']
        unique_together = ['organization', 'month', 'year']


class Payslip(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    payroll_run = models.ForeignKey(PayrollRun, on_delete=models.CASCADE, related_name='payslips')
    employee_id = models.UUIDField()
    month = models.IntegerField()
    year = models.IntegerField()
    basic_salary = models.DecimalField(max_digits=12, decimal_places=2)
    allowances = models.JSONField(default=dict)
    gross_salary = models.DecimalField(max_digits=12, decimal_places=2)
    cit_deduction = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    ssf_employee_deduction = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    ssf_employer_contribution = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    tax_deduction = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    bonus_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    travel_reimbursement = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    advance_deduction = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    unpaid_leave_deduction = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    other_deductions = models.JSONField(default=dict)
    total_deductions = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    net_salary = models.DecimalField(max_digits=12, decimal_places=2)
    working_days = models.IntegerField(default=0)
    present_days = models.IntegerField(default=0)
    absent_days = models.IntegerField(default=0)
    leave_days = models.IntegerField(default=0)
    late_count = models.IntegerField(default=0)
    early_leave_count = models.IntegerField(default=0)
    status = models.CharField(max_length=24, default='draft')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'hrms_payslips'
        ordering = ['-year', '-month']
        unique_together = ['payroll_run', 'employee_id']


BONUS_TYPE_CHOICES = [
    ('festival', 'Festival Bonus'),
    ('dashain', 'Dashain Bonus'),
    ('performance', 'Performance Bonus'),
    ('target', 'Target Achievement Bonus'),
    ('attendance', 'Attendance Bonus'),
    ('referral', 'Referral Bonus'),
    ('joining', 'Joining Bonus'),
    ('retention', 'Retention Bonus'),
    ('commission', 'Commission Incentive'),
    ('yearly', 'Year-End Bonus'),
    ('special', 'Special Bonus'),
    ('other', 'Other'),
]

BONUS_STATUS_CHOICES = [
    ('pending', 'Pending'),
    ('approved', 'Approved'),
    ('paid', 'Paid'),
    ('cancelled', 'Cancelled'),
]


class Bonus(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee_id = models.UUIDField()
    bonus_type = models.CharField(max_length=32, default='other', choices=BONUS_TYPE_CHOICES)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    reason = models.TextField(null=True, blank=True)
    month = models.IntegerField()
    year = models.IntegerField()
    is_taxable = models.BooleanField(default=True)
    status = models.CharField(max_length=24, default='pending', choices=BONUS_STATUS_CHOICES)
    approved_by = models.UUIDField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'hrms_bonuses'
        ordering = ['-year', '-month']


EXPENSE_STATUS_CHOICES = [
    ('pending', 'Pending'),
    ('approved', 'Approved'),
    ('rejected', 'Rejected'),
    ('reimbursed', 'Reimbursed'),
]

EXPENSE_CATEGORY_CHOICES = [
    ('travel', 'Travel'),
    ('accommodation', 'Accommodation'),
    ('food', 'Food & Meals'),
    ('transport', 'Local Transport'),
    ('client_meeting', 'Client Meeting'),
    ('training', 'Training'),
    ('other', 'Other'),
]


class TravelExpense(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee_id = models.UUIDField()
    category = models.CharField(max_length=24, default='travel', choices=EXPENSE_CATEGORY_CHOICES)
    description = models.TextField()
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    expense_date = models.DateField()
    receipt_url = models.URLField(null=True, blank=True)
    month = models.IntegerField()
    year = models.IntegerField()
    include_in_salary = models.BooleanField(default=True)
    status = models.CharField(max_length=24, default='pending', choices=EXPENSE_STATUS_CHOICES)
    approved_by = models.UUIDField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'hrms_travel_expenses'
        ordering = ['-expense_date']


ADVANCE_STATUS_CHOICES = [
    ('pending', 'Pending'),
    ('approved', 'Approved'),
    ('active', 'Active (Being Deducted)'),
    ('completed', 'Fully Repaid'),
    ('cancelled', 'Cancelled'),
]


class AdvancePayment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee_id = models.UUIDField()
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    reason = models.TextField(null=True, blank=True)
    request_date = models.DateField()
    monthly_deduction = models.DecimalField(max_digits=12, decimal_places=2)
    deduction_start_month = models.IntegerField()
    deduction_start_year = models.IntegerField()
    total_deducted = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    remaining_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=24, default='pending', choices=ADVANCE_STATUS_CHOICES)
    approved_by = models.UUIDField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'hrms_advance_payments'
        ordering = ['-request_date']

    def save(self, *args, **kwargs):
        if not self.remaining_balance and self.amount:
            self.remaining_balance = self.amount - self.total_deducted
        super().save(*args, **kwargs)


class NotificationSetting(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='notification_settings')
    late_arrival_notify_employee = models.BooleanField(default=True)
    late_arrival_notify_manager = models.BooleanField(default=False)
    late_arrival_notify_hr = models.BooleanField(default=False)
    early_leave_notify_employee = models.BooleanField(default=True)
    early_leave_notify_manager = models.BooleanField(default=False)
    early_leave_notify_hr = models.BooleanField(default=False)
    hr_email = models.EmailField(null=True, blank=True)
    late_email_subject = models.CharField(max_length=255, default='Late Arrival Notification')
    late_email_template = models.TextField(default='Dear {employee_name},\n\nThis is to notify you that you checked in at {check_in_time} on {date}, which is {late_minutes} minutes after the scheduled start time of {start_time}.\n\nPlease ensure punctuality.\n\nRegards,\nHR Department')
    early_leave_email_subject = models.CharField(max_length=255, default='Early Departure Notification')
    early_leave_email_template = models.TextField(default='Dear {employee_name},\n\nThis is to notify you that you checked out at {check_out_time} on {date}, which is {early_minutes} minutes before the scheduled end time of {end_time}.\n\nPlease ensure you complete your working hours.\n\nRegards,\nHR Department')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'hrms_notification_settings'


class CountryTaxLabel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    country = models.CharField(max_length=100, unique=True)
    tax_id_label = models.CharField(max_length=100, default='Tax ID No.')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'hrms_country_tax_labels'
        managed = False
        ordering = ['country']


class TaxSlab(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='tax_slabs', null=True, blank=True)
    fiscal_year = models.ForeignKey('FiscalYear', on_delete=models.SET_NULL, null=True, blank=True)
    country = models.CharField(max_length=100, null=True, blank=True)
    marital_status = models.CharField(max_length=16, choices=[('single', 'Single'), ('married', 'Married')], default='single')
    slab_order = models.IntegerField(default=1)
    lower_limit = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    upper_limit = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'hrms_tax_slabs'
        ordering = ['marital_status', 'slab_order']
