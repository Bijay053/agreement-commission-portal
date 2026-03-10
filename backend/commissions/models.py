from django.db import models


class AgreementCommissionRule(models.Model):
    id = models.AutoField(primary_key=True)
    agreement_id = models.IntegerField()
    label = models.CharField(max_length=255)
    study_level = models.CharField(max_length=32, null=True, blank=True)
    commission_mode = models.CharField(max_length=16)
    percentage_value = models.DecimalField(max_digits=6, decimal_places=3, null=True, blank=True)
    flat_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, null=True, blank=True)
    basis = models.CharField(max_length=24)
    pay_event = models.CharField(max_length=24, default='enrolment')
    subject_rules = models.JSONField(null=True, blank=True)
    conditions_text = models.TextField(null=True, blank=True)
    effective_from = models.DateField(null=True, blank=True)
    effective_to = models.DateField(null=True, blank=True)
    priority = models.IntegerField(default=100)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = 'agreement_commission_rules'
