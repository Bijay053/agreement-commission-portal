from django.db import models


class CommissionTerm(models.Model):
    id = models.AutoField(primary_key=True)
    term_name = models.CharField(max_length=16, unique=True)
    term_label = models.CharField(max_length=32)
    year = models.IntegerField()
    term_number = models.IntegerField()
    sort_order = models.IntegerField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'commission_terms'


class CommissionStudent(models.Model):
    id = models.AutoField(primary_key=True)
    agent_name = models.CharField(max_length=255)
    student_id = models.CharField(max_length=64, null=True, blank=True)
    agentsic_id = models.CharField(max_length=64, null=True, blank=True)
    student_name = models.CharField(max_length=255)
    provider = models.CharField(max_length=255)
    country = models.CharField(max_length=64, default='AU')
    start_intake = models.CharField(max_length=32, null=True, blank=True)
    course_level = models.CharField(max_length=64, null=True, blank=True)
    course_name = models.CharField(max_length=500, null=True, blank=True)
    course_duration_years = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    commission_rate_pct = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)
    gst_rate_pct = models.DecimalField(max_digits=5, decimal_places=2, default=10)
    gst_applicable = models.CharField(max_length=3, default='Yes')
    scholarship_type = models.CharField(max_length=16, default='None')
    scholarship_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=32, default='Under Enquiry')
    notes = models.TextField(null=True, blank=True)
    total_received = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = 'commission_students'


class StudentProvider(models.Model):
    id = models.AutoField(primary_key=True)
    commission_student_id = models.IntegerField()
    provider = models.CharField(max_length=255)
    student_id = models.CharField(max_length=64, null=True, blank=True)
    country = models.CharField(max_length=64, default='Australia')
    course_level = models.CharField(max_length=64, null=True, blank=True)
    course_name = models.CharField(max_length=500, null=True, blank=True)
    course_duration_years = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    start_intake = models.CharField(max_length=32, null=True, blank=True)
    commission_rate_pct = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)
    gst_rate_pct = models.DecimalField(max_digits=5, decimal_places=2, default=10)
    gst_applicable = models.CharField(max_length=3, default='Yes')
    scholarship_type = models.CharField(max_length=16, default='None')
    scholarship_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=32, default='Under Enquiry')
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'student_providers'


class CommissionEntry(models.Model):
    id = models.AutoField(primary_key=True)
    commission_student_id = models.IntegerField()
    student_provider_id = models.IntegerField(null=True, blank=True)
    term_name = models.CharField(max_length=16)
    academic_year = models.CharField(max_length=16, null=True, blank=True)
    fee_gross = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    commission_rate_auto = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)
    commission_rate_override_pct = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)
    commission_rate_used_pct = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)
    commission_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    bonus = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    gst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    payment_status = models.CharField(max_length=16, default='Pending')
    paid_date = models.DateField(null=True, blank=True)
    invoice_no = models.CharField(max_length=64, null=True, blank=True)
    payment_ref = models.CharField(max_length=128, null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    student_status = models.CharField(max_length=32, default='Under Enquiry')
    rate_change_warning = models.CharField(max_length=128, null=True, blank=True)
    scholarship_type_auto = models.CharField(max_length=16, null=True, blank=True)
    scholarship_value_auto = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    scholarship_type_override = models.CharField(max_length=16, null=True, blank=True)
    scholarship_value_override = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    scholarship_type_used = models.CharField(max_length=16, null=True, blank=True)
    scholarship_value_used = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    scholarship_change_warning = models.CharField(max_length=128, null=True, blank=True)
    scholarship_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    fee_after_scholarship = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = 'commission_entries'
