import os
import sys

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = 'Validates production deployment configuration'

    def handle(self, *args, **options):
        checks = []
        checks.append(self._check_debug())
        checks.append(self._check_allowed_hosts())
        checks.append(self._check_secret_key())
        checks.append(self._check_csrf())
        checks.append(self._check_hsts())
        checks.append(self._check_database())
        checks.append(self._check_s3())
        checks.append(self._check_sentry())
        checks.append(self._check_redis())
        checks.append(self._check_email())

        passed = sum(1 for ok, _, _ in checks if ok)
        warned = sum(1 for ok, _, _ in checks if ok is None)
        failed = sum(1 for ok, _, _ in checks if ok is False)

        self.stdout.write('')
        self.stdout.write('=' * 60)
        self.stdout.write('  DEPLOY CHECK RESULTS')
        self.stdout.write('=' * 60)

        for ok, name, msg in checks:
            if ok is True:
                self.stdout.write(self.style.SUCCESS(f'  PASS  {name}: {msg}'))
            elif ok is None:
                self.stdout.write(self.style.WARNING(f'  WARN  {name}: {msg}'))
            else:
                self.stdout.write(self.style.ERROR(f'  FAIL  {name}: {msg}'))

        self.stdout.write('=' * 60)
        self.stdout.write(f'  {passed} passed, {warned} warnings, {failed} failed')
        self.stdout.write('=' * 60)

        if failed > 0:
            sys.exit(1)

    def _check_debug(self):
        if settings.DEBUG:
            return (False, 'DEBUG', 'DEBUG is True — must be False in production')
        return (True, 'DEBUG', 'DEBUG is False')

    def _check_allowed_hosts(self):
        hosts = settings.ALLOWED_HOSTS
        if not hosts or hosts == ['*']:
            return (False, 'ALLOWED_HOSTS', 'ALLOWED_HOSTS is not restricted')
        return (True, 'ALLOWED_HOSTS', f'Set to {hosts}')

    def _check_secret_key(self):
        key = settings.SECRET_KEY
        insecure_defaults = [
            'django-insecure-dev-key-change-me',
            'generate_a_strong_secret_here',
            'changeme',
        ]
        if key in insecure_defaults or len(key) < 32:
            return (False, 'SECRET_KEY', 'Using default or weak secret key')
        return (True, 'SECRET_KEY', 'Custom secret key is set')

    def _check_csrf(self):
        middleware = settings.MIDDLEWARE
        if 'django.middleware.csrf.CsrfViewMiddleware' not in middleware:
            return (False, 'CSRF', 'CsrfViewMiddleware not in MIDDLEWARE')
        return (True, 'CSRF', 'CSRF middleware is enabled')

    def _check_hsts(self):
        seconds = getattr(settings, 'SECURE_HSTS_SECONDS', 0)
        if seconds < 31536000:
            return (False, 'HSTS', f'SECURE_HSTS_SECONDS is {seconds} (should be >= 31536000)')
        return (True, 'HSTS', f'HSTS configured for {seconds}s')

    def _check_database(self):
        try:
            with connection.cursor() as cursor:
                cursor.execute('SELECT 1')
            return (True, 'DATABASE', 'PostgreSQL connection successful')
        except Exception as e:
            return (False, 'DATABASE', f'Connection failed: {e}')

    def _check_s3(self):
        key_id = getattr(settings, 'AWS_ACCESS_KEY_ID', '')
        secret = getattr(settings, 'AWS_SECRET_ACCESS_KEY', '')
        bucket = getattr(settings, 'AWS_S3_BUCKET_NAME', '')
        if not key_id or not secret:
            return (False, 'S3', 'AWS credentials not set')
        if not bucket:
            return (False, 'S3', 'S3 bucket name not set')
        return (True, 'S3', f'Configured for bucket: {bucket}')

    def _check_sentry(self):
        dsn = getattr(settings, 'SENTRY_DSN', '')
        if not dsn:
            return (None, 'SENTRY', 'SENTRY_DSN not configured (optional)')
        return (True, 'SENTRY', 'Sentry DSN is configured')

    def _check_redis(self):
        redis_url = os.environ.get('REDIS_URL', '')
        if not redis_url:
            return (None, 'REDIS', 'REDIS_URL not set (optional, using local memory cache)')
        cache_backend = settings.CACHES.get('default', {}).get('BACKEND', '')
        if 'redis' in cache_backend.lower():
            return (True, 'REDIS', f'Redis cache backend configured')
        return (None, 'REDIS', 'REDIS_URL set but cache backend is not Redis')

    def _check_email(self):
        smtp_user = os.environ.get('SMTP_USER', '') or getattr(settings, 'EMAIL_HOST_USER', '')
        smtp_pass = os.environ.get('SMTP_PASS', '') or getattr(settings, 'EMAIL_HOST_PASSWORD', '')
        if not smtp_user or not smtp_pass:
            return (None, 'EMAIL', 'SMTP credentials not fully configured (optional)')
        return (True, 'EMAIL', 'SMTP credentials are set')
