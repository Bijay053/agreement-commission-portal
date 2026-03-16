from django.db import models


class PortalCredential(models.Model):
    id = models.AutoField(primary_key=True)
    portal_name = models.CharField(max_length=255)
    portal_url = models.TextField(blank=True, default='')
    domain = models.CharField(max_length=255, blank=True, default='')
    username = models.CharField(max_length=255, blank=True, default='')
    encrypted_password = models.TextField(blank=True, default='')
    username_selector = models.CharField(max_length=255, blank=True, default='')
    password_selector = models.CharField(max_length=255, blank=True, default='')
    submit_selector = models.CharField(max_length=255, blank=True, default='')
    category = models.CharField(max_length=64, blank=True, default='')
    country = models.CharField(max_length=64, blank=True, default='')
    team = models.CharField(max_length=128, blank=True, default='')
    notes = models.TextField(blank=True, default='')
    status = models.CharField(max_length=16, default='active')
    created_by = models.IntegerField(null=True, blank=True)
    updated_by = models.IntegerField(null=True, blank=True)
    password_updated_at = models.DateTimeField(null=True, blank=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = 'portal_credentials'


class PortalAccessLog(models.Model):
    id = models.AutoField(primary_key=True)
    portal_id = models.IntegerField()
    user_id = models.IntegerField()
    user_name = models.CharField(max_length=255, blank=True, default='')
    user_email = models.CharField(max_length=255, blank=True, default='')
    action = models.CharField(max_length=64)
    portal_name = models.CharField(max_length=255, blank=True, default='')
    ip_address = models.CharField(max_length=64, blank=True, default='')
    result = models.CharField(max_length=16, default='success')
    note = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'portal_access_logs'
