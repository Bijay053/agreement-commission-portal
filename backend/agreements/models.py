from django.db import models
from core.models import SoftDeleteMixin


class Agreement(SoftDeleteMixin):
    id = models.AutoField(primary_key=True)
    university_id = models.IntegerField()
    agreement_code = models.CharField(max_length=64, unique=True)
    title = models.CharField(max_length=255)
    agreement_type = models.CharField(max_length=32)
    status = models.CharField(max_length=24, default='draft')
    territory_type = models.CharField(max_length=16, default='country_specific')
    territory_country_id = models.IntegerField(null=True, blank=True)
    start_date = models.DateField()
    expiry_date = models.DateField()
    auto_renew = models.BooleanField(default=False)
    confidentiality_level = models.CharField(max_length=16, default='high')
    internal_notes = models.TextField(null=True, blank=True)
    created_by_user_id = models.IntegerField(null=True, blank=True)
    updated_by_user_id = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = 'agreements'


class AgreementTerritory(models.Model):
    id = models.AutoField(primary_key=True)
    agreement_id = models.IntegerField()
    country_id = models.IntegerField()

    class Meta:
        managed = False
        db_table = 'agreement_territories'
