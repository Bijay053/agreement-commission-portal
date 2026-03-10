from django.db import models


class AgreementNotification(models.Model):
    id = models.AutoField(primary_key=True)
    agreement_id = models.IntegerField()
    provider_name = models.CharField(max_length=255)
    notification_type = models.CharField(max_length=64)
    sent_date = models.DateTimeField(auto_now_add=True)
    days_before_expiry = models.IntegerField(null=True, blank=True)
    status = models.CharField(max_length=32, default='sent')
    recipient_emails = models.TextField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = 'agreement_notifications'
