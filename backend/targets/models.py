from django.db import models


class AgreementTarget(models.Model):
    id = models.AutoField(primary_key=True)
    agreement_id = models.IntegerField()
    target_type = models.CharField(max_length=16)
    metric = models.CharField(max_length=32)
    value = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, null=True, blank=True)
    period_key = models.CharField(max_length=32)
    notes = models.TextField(null=True, blank=True)
    bonus_enabled = models.BooleanField(default=False)
    bonus_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    bonus_currency = models.CharField(max_length=3, null=True, blank=True)
    bonus_condition = models.TextField(null=True, blank=True)
    bonus_notes = models.TextField(null=True, blank=True)
    created_by_user_id = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = 'agreement_targets'


class TargetBonusRule(models.Model):
    id = models.AutoField(primary_key=True)
    target_id = models.IntegerField()
    bonus_type = models.CharField(max_length=32)
    currency = models.CharField(max_length=3, default='AUD')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'target_bonus_rules'


class TargetBonusTier(models.Model):
    id = models.AutoField(primary_key=True)
    bonus_rule_id = models.IntegerField()
    min_students = models.IntegerField()
    max_students = models.IntegerField(null=True, blank=True)
    bonus_amount = models.DecimalField(max_digits=12, decimal_places=2)
    calculation_type = models.CharField(max_length=16, default='per_student')

    class Meta:
        managed = False
        db_table = 'target_bonus_tiers'


class TargetBonusCountry(models.Model):
    id = models.AutoField(primary_key=True)
    bonus_rule_id = models.IntegerField()
    country_id = models.IntegerField()
    student_count = models.IntegerField()
    bonus_amount = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        managed = False
        db_table = 'target_bonus_country'
