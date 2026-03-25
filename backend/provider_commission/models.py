from django.db import models


class ProviderCommissionConfig(models.Model):
    id = models.AutoField(primary_key=True)
    sub_agent_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=70.00)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = 'provider_commission_config'


class ProviderCommissionEntry(models.Model):
    COMMISSION_BASIS_CHOICES = [
        ('1_year', '1 Year'),
        ('2_semesters', '2 Semesters'),
        ('full_course', 'Full Course'),
        ('per_semester', 'Per Semester'),
        ('per_year', 'Per Year'),
        ('per_trimester', 'Per Trimester'),
        ('one_time', 'One Time'),
    ]

    DEGREE_LEVEL_CHOICES = [
        ('any', 'Any'),
        ('undergraduate', 'Undergraduate'),
        ('postgraduate', 'Postgraduate'),
        ('vet', 'VET'),
        ('foundation', 'Foundation'),
        ('diploma', 'Diploma'),
        ('phd', 'PhD'),
        ('english', 'English Language'),
    ]

    id = models.AutoField(primary_key=True)
    provider_name = models.CharField(max_length=255, default='')
    degree_level = models.CharField(max_length=255, default='any')
    territory = models.TextField(blank=True, default='')
    commission_value = models.DecimalField(max_digits=10, decimal_places=2)
    commission_type = models.CharField(max_length=16, default='percentage')
    currency = models.CharField(max_length=3, default='AUD')
    commission_basis = models.CharField(max_length=32, choices=COMMISSION_BASIS_CHOICES, default='full_course')
    notes = models.TextField(blank=True, default='')
    is_active = models.BooleanField(default=True)
    sub_agent_percentage = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    copied_from_rule_id = models.IntegerField(null=True, blank=True)
    created_by = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'provider_commission_entries'
        ordering = ['provider_name', 'degree_level']


class ProviderCommissionAuditLog(models.Model):
    id = models.AutoField(primary_key=True)
    provider_name = models.CharField(max_length=255)
    action = models.CharField(max_length=64)
    old_value = models.CharField(max_length=255, blank=True, default='')
    new_value = models.CharField(max_length=255, blank=True, default='')
    changed_by = models.CharField(max_length=255, null=True, blank=True)
    changed_by_name = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'provider_commission_audit_log'
        ordering = ['-created_at']
