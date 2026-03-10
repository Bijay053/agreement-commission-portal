from django.db import models


class SubAgentEntry(models.Model):
    id = models.AutoField(primary_key=True)
    commission_student_id = models.IntegerField()
    sub_agent_commission_rate_pct = models.DecimalField(max_digits=8, decimal_places=4, default=0)
    gst_applicable = models.CharField(max_length=3, default='No')
    sic_received_total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    sub_agent_paid_total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    margin = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    overpay_warning = models.CharField(max_length=128, null=True, blank=True)
    status = models.CharField(max_length=32, default='Under Enquiry')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = 'sub_agent_entries'


class SubAgentTermEntry(models.Model):
    id = models.AutoField(primary_key=True)
    commission_student_id = models.IntegerField()
    term_name = models.CharField(max_length=16)
    academic_year = models.CharField(max_length=16, default='Year 1')
    fee_net = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    main_commission = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    commission_rate_auto = models.DecimalField(max_digits=8, decimal_places=4, default=0)
    commission_rate_override_pct = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)
    commission_rate_used_pct = models.DecimalField(max_digits=8, decimal_places=4, default=0)
    sub_agent_commission = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    bonus_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    gst_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    gst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    payment_status = models.CharField(max_length=32, default='Invoice Waiting')
    student_status = models.CharField(max_length=32, default='Under Enquiry')
    rate_override_warning = models.CharField(max_length=128, null=True, blank=True)
    exceeds_main_warning = models.CharField(max_length=128, null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = 'sub_agent_term_entries'
