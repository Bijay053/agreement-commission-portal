from django.db import models


class User(models.Model):
    id = models.AutoField(primary_key=True)
    email = models.CharField(max_length=255, unique=True)
    full_name = models.CharField(max_length=255)
    password_hash = models.TextField()
    is_active = models.BooleanField(default=True)
    password_changed_at = models.DateTimeField(null=True, blank=True)
    last_login_at = models.DateTimeField(null=True, blank=True)
    last_login_ip = models.CharField(max_length=45, null=True, blank=True)
    force_password_change = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = 'users'


class Role(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=64, unique=True)
    description = models.TextField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = 'roles'


class Permission(models.Model):
    id = models.AutoField(primary_key=True)
    code = models.CharField(max_length=64, unique=True)
    module = models.CharField(max_length=64, null=True, blank=True)
    resource = models.CharField(max_length=64, null=True, blank=True)
    action = models.CharField(max_length=64, null=True, blank=True)
    description = models.TextField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = 'permissions'


class RolePermission(models.Model):
    id = models.AutoField(primary_key=True)
    role_id = models.IntegerField()
    permission_id = models.IntegerField()

    class Meta:
        managed = False
        db_table = 'role_permissions'


class UserRole(models.Model):
    id = models.AutoField(primary_key=True)
    user_id = models.IntegerField()
    role_id = models.IntegerField()

    class Meta:
        managed = False
        db_table = 'user_roles'


class UserCountryAccess(models.Model):
    id = models.AutoField(primary_key=True)
    user_id = models.IntegerField()
    country_id = models.IntegerField()

    class Meta:
        managed = False
        db_table = 'user_country_access'


class UserSession(models.Model):
    id = models.AutoField(primary_key=True)
    user_id = models.IntegerField()
    session_token = models.CharField(max_length=128, null=True, blank=True)
    ip_address = models.CharField(max_length=45, null=True, blank=True)
    browser = models.CharField(max_length=128, null=True, blank=True)
    os = models.CharField(max_length=64, null=True, blank=True)
    device_type = models.CharField(max_length=32, null=True, blank=True)
    location = models.CharField(max_length=255, null=True, blank=True)
    login_at = models.DateTimeField(auto_now_add=True)
    last_activity_at = models.DateTimeField(auto_now_add=True)
    logout_at = models.DateTimeField(null=True, blank=True)
    logout_reason = models.CharField(max_length=32, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    otp_verified = models.BooleanField(default=False)

    class Meta:
        managed = False
        db_table = 'user_sessions'


class LoginVerificationCode(models.Model):
    id = models.AutoField(primary_key=True)
    user_id = models.IntegerField()
    code_hash = models.CharField(max_length=128)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    attempts = models.IntegerField(default=0)
    resend_count = models.IntegerField(default=0)
    status = models.CharField(max_length=16, default='pending')

    class Meta:
        managed = False
        db_table = 'login_verification_codes'


class SecurityAuditLog(models.Model):
    id = models.AutoField(primary_key=True)
    user_id = models.IntegerField(null=True, blank=True)
    event_type = models.CharField(max_length=64)
    ip_address = models.CharField(max_length=45, null=True, blank=True)
    device_info = models.TextField(null=True, blank=True)
    metadata = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'security_audit_logs'


class PasswordHistory(models.Model):
    id = models.AutoField(primary_key=True)
    user_id = models.IntegerField()
    password_hash = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'password_history'


class UserDevice(models.Model):
    id = models.AutoField(primary_key=True)
    user_id = models.IntegerField()
    fingerprint = models.CharField(max_length=64)
    device_name = models.CharField(max_length=255, null=True, blank=True)
    browser = models.CharField(max_length=128, null=True, blank=True)
    os = models.CharField(max_length=64, null=True, blank=True)
    ip_address = models.CharField(max_length=45, null=True, blank=True)
    location = models.CharField(max_length=255, null=True, blank=True)
    first_login = models.DateTimeField(auto_now_add=True)
    last_login = models.DateTimeField(auto_now=True)
    is_trusted = models.BooleanField(default=True)

    class Meta:
        managed = False
        db_table = 'user_devices'


class PasswordResetToken(models.Model):
    id = models.AutoField(primary_key=True)
    user_id = models.IntegerField()
    token_hash = models.CharField(max_length=64)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    request_ip = models.CharField(max_length=45, null=True, blank=True)
    user_agent = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'password_reset_tokens'
