import os
import dj_database_url
import sentry_sdk

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SECRET_KEY = os.environ.get('SESSION_SECRET', 'django-insecure-dev-key-change-me')

DEBUG = os.environ.get('DEBUG', 'True').lower() in ('true', '1', 'yes')

ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', '*').split(',') if not DEBUG else ['*']

INSTALLED_APPS = [
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.auth',
    'rest_framework',
    'corsheaders',
    'core',
    'accounts',
    'providers',
    'agreements',
    'contacts',
    'targets',
    'commissions',
    'documents',
    'commission_tracker',
    'sub_agent',
    'audit',
    'notifications',
    'dashboard',
    'templates_manager',
    'employees',
    'employment_agreements',
    'employee_documents',
    'offer_letters',
    'provider_commission',
    'hrms',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'core.middleware.CsrfExemptPreAuthMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'core.middleware.CSPMiddleware',
    'core.middleware.SessionAuthMiddleware',
]

X_FRAME_OPTIONS = 'DENY'

SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'
SECURE_SSL_REDIRECT = not DEBUG
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

CSRF_COOKIE_HTTPONLY = False
CSRF_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SECURE = not DEBUG
CSRF_TRUSTED_ORIGINS = os.environ.get('CSRF_TRUSTED_ORIGINS', 'https://portal.studyinfocentre.com').split(',') if not DEBUG else []

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

DATABASE_URL = os.environ.get('DATABASE_URL', '')
if DATABASE_URL:
    DATABASES = {
        'default': dj_database_url.parse(DATABASE_URL, conn_max_age=600)
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': 'agreement_portal',
            'USER': 'portal_user',
            'PASSWORD': '',
            'HOST': 'localhost',
            'PORT': '5432',
        }
    }

REDIS_URL = os.environ.get('REDIS_URL', '')

if REDIS_URL:
    CACHES = {
        'default': {
            'BACKEND': 'django_redis.cache.RedisCache',
            'LOCATION': REDIS_URL,
            'OPTIONS': {
                'CLIENT_CLASS': 'django_redis.client.DefaultClient',
                'SOCKET_CONNECT_TIMEOUT': 5,
                'SOCKET_TIMEOUT': 5,
                'RETRY_ON_TIMEOUT': True,
                'CONNECTION_POOL_KWARGS': {'max_connections': 50},
            },
        }
    }
    SESSION_ENGINE = 'django.contrib.sessions.backends.cache'
    SESSION_CACHE_ALIAS = 'default'
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'default-cache',
        }
    }
    SESSION_ENGINE = 'django.contrib.sessions.backends.db'
SESSION_COOKIE_NAME = 'connect.sid'
SESSION_COOKIE_AGE = 3600
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_SAMESITE = 'Lax'
SESSION_SAVE_EVERY_REQUEST = True

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'core.authentication.SessionCsrfAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [],
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'EXCEPTION_HANDLER': 'core.exceptions.custom_exception_handler',
    'DEFAULT_PAGINATION_CLASS': 'core.pagination.StandardPagination',
    'PAGE_SIZE': 50,
    'UNAUTHENTICATED_USER': None,
    'DEFAULT_THROTTLE_CLASSES': [
        'core.authentication.SessionAwareAnonThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '60/minute',
        'login': '5/minute',
    },
}

DATA_UPLOAD_MAX_MEMORY_SIZE = 30 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 30 * 1024 * 1024

CORS_ALLOWED_ORIGINS = os.environ.get('CORS_ORIGINS', 'https://portal.studyinfocentre.com').split(',') if not DEBUG else []
CORS_ALLOW_ALL_ORIGINS = DEBUG
CORS_ALLOW_CREDENTIALS = True

AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID', '')
AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY', '')
AWS_S3_REGION_NAME = os.environ.get('AWS_S3_REGION', 'ap-south-1')
AWS_S3_BUCKET_NAME = os.environ.get('AWS_S3_BUCKET', 'studyinfocentre-portal-documents')

EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = os.environ.get('SMTP_HOST', 'email-smtp.ap-south-1.amazonaws.com')
EMAIL_PORT = int(os.environ.get('SMTP_PORT', '587'))
EMAIL_USE_TLS = True
EMAIL_HOST_USER = os.environ.get('SMTP_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('SMTP_PASS', '')
DEFAULT_FROM_EMAIL = os.environ.get('FROM_EMAIL', 'noreply@studyinfocentre.com')
FROM_NAME = os.environ.get('FROM_NAME', 'Agreement Portal - Study Info Centre')
NOTIFICATION_BCC_EMAILS = [e.strip() for e in os.environ.get('NOTIFICATION_BCC_EMAILS', '').split(',') if e.strip()]

PORTAL_URL = os.environ.get('PORTAL_URL', 'https://portal.studyinfocentre.com')

PDF_DOWNLOAD_PASSWORD = os.environ.get('PDF_DOWNLOAD_PASSWORD', 'Study@2o19')

PASSWORD_EXPIRY_DAYS = 90
PASSWORD_WARNING_DAYS = 14
OTP_EXPIRY_MINUTES = 5
MAX_OTP_ATTEMPTS = 5
MAX_OTP_RESENDS = 3

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = False
USE_TZ = True

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

STATIC_URL = '/assets/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

SPA_ROOT = os.path.join(os.path.dirname(BASE_DIR), 'dist', 'public')
WHITENOISE_ROOT = SPA_ROOT if os.path.isdir(SPA_ROOT) else None
STATICFILES_DIRS = [SPA_ROOT] if os.path.isdir(SPA_ROOT) else []

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
}

SENTRY_DSN = os.environ.get('SENTRY_DSN', '')
if SENTRY_DSN:
    sentry_sdk.init(dsn=SENTRY_DSN, traces_sample_rate=0.1, profiles_sample_rate=0.1)
