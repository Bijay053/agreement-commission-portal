from django.db import models


class AgreementContact(models.Model):
    id = models.AutoField(primary_key=True)
    agreement_id = models.IntegerField()
    full_name = models.CharField(max_length=255)
    position_title = models.CharField(max_length=255, null=True, blank=True)
    phone = models.CharField(max_length=64, null=True, blank=True)
    email = models.CharField(max_length=255, null=True, blank=True)
    country_id = models.IntegerField(null=True, blank=True)
    city = models.CharField(max_length=255, null=True, blank=True)
    is_primary = models.BooleanField(default=False)
    notes = models.TextField(null=True, blank=True)
    created_by_user_id = models.IntegerField(null=True, blank=True)
    updated_by_user_id = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = 'agreement_contacts'
