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


class EmailTemplate(models.Model):
    id = models.AutoField(primary_key=True)
    template_key = models.CharField(max_length=128, unique=True)
    name = models.CharField(max_length=255)
    subject = models.CharField(max_length=512)
    html_body = models.TextField()
    plain_body = models.TextField(null=True, blank=True)
    variables = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_by_user_id = models.IntegerField(null=True, blank=True)
    updated_by_user_id = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = 'email_templates'
