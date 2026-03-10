# Python Backend Architecture & Migration Plan
## Agreement & Commission Management Portal

**Prepared:** March 2026
**Current Stack:** Node.js/Express + TypeScript, PostgreSQL, AWS S3, Docker, EC2
**Target Stack:** Python/Django + DRF, PostgreSQL, Redis, Celery, S3, Nginx, Docker

---

## 1. Target Python Architecture

### 1.1 Project Structure

```
backend/
├── manage.py
├── requirements/
│   ├── base.txt
│   ├── dev.txt
│   └── prod.txt
├── config/
│   ├── __init__.py
│   ├── settings/
│   │   ├── __init__.py
│   │   ├── base.py
│   │   ├── dev.py
│   │   └── prod.py
│   ├── urls.py
│   ├── wsgi.py
│   ├── asgi.py
│   └── celery.py
├── apps/
│   ├── core/                         # Shared utilities
│   │   ├── models.py                 # Base model (TimestampMixin, etc.)
│   │   ├── permissions.py            # Custom DRF permission classes
│   │   ├── middleware.py             # Audit, security headers, rate limit
│   │   ├── pagination.py            # Standard pagination
│   │   ├── exceptions.py            # Custom exception handler
│   │   ├── validators.py            # Shared validators
│   │   └── utils.py
│   ├── accounts/                     # Users, roles, permissions, auth
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   ├── services.py              # Auth logic, OTP, password policy
│   │   ├── permissions.py
│   │   ├── tasks.py                 # Celery: OTP email, session cleanup
│   │   └── admin.py
│   ├── agreements/                   # Agreements, territories
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   ├── services.py
│   │   ├── filters.py               # django-filter integration
│   │   └── tasks.py
│   ├── targets/                      # Targets, bonus rules, tiers
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   └── services.py
│   ├── commissions/                  # Commission rules
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   └── services.py
│   ├── contacts/                     # Agreement contacts
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   └── filters.py
│   ├── documents/                    # Document upload, view, download
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   ├── services.py              # S3 operations, signed URLs, qpdf
│   │   ├── tasks.py                 # Celery: virus scan, cleanup
│   │   └── validators.py            # File type, size, magic byte checks
│   ├── commission_tracker/           # Student commission tracking
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   ├── services.py              # Recalculation, bulk import
│   │   ├── filters.py
│   │   └── tasks.py                 # Celery: bulk CSV processing
│   ├── sub_agent/                    # Sub-agent commissions
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   └── services.py              # Sync, margin calc, dashboard
│   ├── audit/                        # Audit logs, security logs
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   ├── middleware.py             # Auto-capture audit context
│   │   └── mixins.py                # AuditableMixin for views
│   ├── notifications/                # Email notifications, reminders
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   ├── services.py              # Email templates, SMTP
│   │   └── tasks.py                 # Celery: scheduled checks, email queue
│   ├── providers/                    # Universities/providers
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   └── filters.py
│   └── dashboard/                    # Dashboard aggregations
│       ├── views.py
│       ├── urls.py
│       └── services.py
├── templates/
│   └── emails/                       # HTML email templates
│       ├── otp.html
│       ├── password_reset.html
│       ├── expiry_reminder.html
│       └── base.html
└── tests/
    ├── conftest.py
    ├── factories.py                  # Model factories (factory_boy)
    ├── test_accounts/
    ├── test_agreements/
    ├── test_documents/
    ├── test_commission_tracker/
    └── test_sub_agent/
```

### 1.2 Layer Architecture

```
┌─────────────────────────────────────────┐
│              Nginx (TLS, headers)       │
├─────────────────────────────────────────┤
│          Gunicorn (WSGI server)         │
├─────────────────────────────────────────┤
│     Django + DRF (API Layer)            │
│  ┌──────────────┐  ┌─────────────────┐  │
│  │   Views/      │  │  Serializers    │  │
│  │   ViewSets    │  │  (validation)   │  │
│  ├──────────────┤  ├─────────────────┤  │
│  │   Services   │  │  Permissions    │  │
│  │   (logic)    │  │  (RBAC)         │  │
│  ├──────────────┤  ├─────────────────┤  │
│  │   Models     │  │  Filters        │  │
│  │   (ORM)      │  │  (query)        │  │
│  └──────────────┘  └─────────────────┘  │
├─────────────────────────────────────────┤
│     Celery Workers (background jobs)    │
├─────────────────────────────────────────┤
│  PostgreSQL  │  Redis  │  S3 (files)   │
└──────────────┴─────────┴───────────────┘
```

**Design principles:**
- **Views** handle HTTP request/response only — no business logic
- **Serializers** handle validation and data transformation
- **Services** contain all business logic (calculations, multi-step operations)
- **Models** define data structure and simple queries
- **Tasks** define Celery background jobs
- **Permissions** enforce RBAC at the view level
- **Middleware** handles cross-cutting concerns (audit, security)

### 1.3 Key Technology Choices

| Component | Package | Purpose |
|---|---|---|
| Framework | Django 5.1 + DRF 3.15 | API framework |
| WSGI Server | Gunicorn + uvicorn workers | Production server |
| Database ORM | Django ORM | Models, migrations |
| Validation | DRF Serializers + django-filter | Input validation, query filtering |
| Auth | django-rest-framework-simplejwt | JWT tokens (or session-based) |
| RBAC | Custom (Django groups + DRF permissions) | Fine-grained permissions |
| Rate Limiting | django-ratelimit + Redis | API throttling |
| CSRF | Django built-in | CSRF protection |
| Cache | django-redis | Response caching, session store |
| Background Jobs | Celery 5.4 + Redis broker | Notifications, scanning, reports |
| Scheduled Tasks | Celery Beat | Daily agreement checks |
| File Storage | django-storages + boto3 | S3 integration |
| Email | Django email backend | SMTP via Nodemailer equivalent |
| Security Headers | django-csp + SecurityMiddleware | CSP, HSTS, X-Frame-Options |
| Logging | Python logging + structlog | Structured JSON logging |
| Error Tracking | sentry-sdk | Error monitoring |
| Testing | pytest + factory_boy + faker | Unit and integration tests |
| API Docs | drf-spectacular | OpenAPI/Swagger auto-generation |
| CORS | django-cors-headers | Cross-origin requests |
| PDF Protection | pikepdf (Python qpdf) | Password-protect downloads |

---

## 2. Migration Scope — Node.js → Python Module Mapping

### 2.1 Feature-to-Module Map

| Current Node.js | Python Django App | Models | API Endpoints | Complexity |
|---|---|---|---|---|
| `server/auth.ts` + auth routes | `apps/accounts/` | User, Role, Permission, UserRole, RolePermission, UserCountryAccess, UserSession, LoginVerificationCode, PasswordHistory, PasswordResetToken | 16 endpoints | High |
| Agreement routes | `apps/agreements/` | Agreement, AgreementTerritory | 7 endpoints | Medium |
| Target/bonus routes | `apps/targets/` | AgreementTarget, TargetBonusRule, TargetBonusTier, TargetBonusCountry | 7 endpoints | Medium |
| Commission rule routes | `apps/commissions/` | AgreementCommissionRule | 5 endpoints | Low |
| Contact routes | `apps/contacts/` | AgreementContact | 5 endpoints | Low |
| Document routes + `server/s3.ts` | `apps/documents/` | AgreementDocument | 5 endpoints | High |
| Commission tracker routes | `apps/commission_tracker/` | CommissionStudent, CommissionEntry, StudentProvider, CommissionTerm | 15+ endpoints | High |
| Sub-agent routes | `apps/sub_agent/` | SubAgentEntry, SubAgentTermEntry | 8 endpoints | Medium |
| Audit routes | `apps/audit/` | AuditLog, SecurityAuditLog | 2 endpoints | Low |
| Notification routes + `server/agreement-notifications.ts` | `apps/notifications/` | AgreementNotification | 2 endpoints + Celery tasks | Medium |
| Provider routes | `apps/providers/` | University (renamed Provider) | 4 endpoints | Low |
| Dashboard routes | `apps/dashboard/` | No new models | 4 endpoints | Low |

**Total: ~80 API endpoints across 12 Django apps**

### 2.2 Detailed Model Mapping

#### accounts app
```python
class User(AbstractBaseUser, PermissionsMixin):
    email (EmailField, unique)
    full_name (CharField)
    is_active (BooleanField)
    password_changed_at (DateTimeField, nullable)
    last_login_ip (GenericIPAddressField, nullable)
    force_password_change (BooleanField)
    created_at, updated_at (auto timestamps)

class Role(Model):
    name (CharField, unique)
    description (TextField)

class Permission(Model):
    code (CharField, unique)       # e.g. "agreements.agreement.read"
    module (CharField)             # e.g. "agreements"
    resource (CharField)           # e.g. "agreement"
    action (CharField)             # e.g. "read"
    description (TextField)

class RolePermission(Model):
    role (FK → Role, CASCADE)
    permission (FK → Permission, CASCADE)

class UserRole(Model):
    user (FK → User, CASCADE)
    role (FK → Role, CASCADE)

class UserCountryAccess(Model):
    user (FK → User, CASCADE)
    country (FK → Country, CASCADE)

class UserSession(Model):
    user (FK → User, CASCADE)
    session_id (CharField)
    ip_address, browser, os_name (CharFields)
    login_at, last_activity_at, logout_at (DateTimeFields)
    is_active (BooleanField)
    otp_verified (BooleanField)

class LoginVerificationCode(Model):
    user (FK → User, CASCADE)
    code_hash (CharField)
    attempts, resend_count (IntegerFields)
    status (CharField)             # pending/verified/expired/exhausted
    expires_at (DateTimeField)

class PasswordHistory(Model):
    user (FK → User, CASCADE)
    password_hash (CharField)
    created_at (DateTimeField)

class PasswordResetToken(Model):
    user (FK → User, CASCADE)
    token_hash (CharField)
    expires_at (DateTimeField)
    used_at (DateTimeField, nullable)
    request_ip (GenericIPAddressField)
```

#### agreements app
```python
class Agreement(Model):
    university (FK → Provider)
    agreement_code (CharField, unique)
    title (CharField)
    agreement_type (CharField)     # agency/commission_schedule/renewal
    status (CharField)             # draft/active/expired/renewal_in_progress
    territory_type (CharField)
    territory_country (FK → Country, nullable)
    start_date, expiry_date (DateFields)
    auto_renew (BooleanField)
    confidentiality_level (CharField)
    internal_notes (TextField)
    created_by, updated_by (FK → User)
    created_at, updated_at (auto timestamps)

class AgreementTerritory(Model):
    agreement (FK → Agreement, CASCADE)
    country (FK → Country, CASCADE)
```

#### commission_tracker app
```python
class CommissionTerm(Model):
    term_name (CharField, unique)  # T1_2025
    term_label (CharField)         # T1 2025
    year (IntegerField)
    term_number (IntegerField)
    sort_order (IntegerField)
    is_active (BooleanField)

class CommissionStudent(Model):
    agent_name, student_id, agentsic_id, student_name (CharFields)
    provider, country (CharFields)
    start_intake, course_level, course_name (CharFields)
    course_duration_years (DecimalField)
    commission_rate_pct (DecimalField, nullable)
    gst_rate_pct (DecimalField)
    gst_applicable (CharField)
    scholarship_type (CharField)
    scholarship_value (DecimalField)
    status (CharField)
    notes (TextField)
    total_received (DecimalField)

class CommissionEntry(Model):
    commission_student (FK → CommissionStudent, CASCADE)
    student_provider (FK → StudentProvider, nullable)
    term_name (CharField)
    academic_year (CharField)
    fee_gross (DecimalField)
    commission_rate_auto, commission_rate_override, commission_rate_used (DecimalFields)
    commission_amount, bonus, gst_amount, total_amount (DecimalFields)
    payment_status (CharField)     # Pending/Received/Reversed/Hold
    paid_date (DateField, nullable)
    invoice_no, payment_ref (CharFields)
    student_status (CharField)
    scholarship fields (multiple DecimalFields)
    notes (TextField)

class StudentProvider(Model):
    commission_student (FK → CommissionStudent, CASCADE)
    provider, student_id, country (CharFields)
    course_level, course_name (CharFields)
    commission_rate_pct (DecimalField)
    gst_rate_pct (DecimalField)
    gst_applicable (CharField)
    scholarship_type, scholarship_value (fields)
    status (CharField)
```

*(Similar patterns for targets, commissions, contacts, documents, sub_agent, audit, notifications — following the existing schema exactly)*

### 2.3 Business Logic to Migrate

| Logic Area | Current Location | Python Location | Notes |
|---|---|---|---|
| Login flow (email + OTP) | `server/routes.ts:108-230` | `accounts/services.py` | 2-step auth with rate limiting |
| Password policy (8+ chars, history) | `server/routes.ts:75-100` | `accounts/validators.py` | Reuse existing rules exactly |
| Password expiry (90 days) | `server/auth.ts:74-96` | `accounts/middleware.py` | Middleware to check on every request |
| Session heartbeat | `server/routes.ts` | `accounts/views.py` | Update last_activity_at |
| Inactivity logout (15 min) | Client-side | Client-side (unchanged) | Frontend stays the same |
| Permission checking | `server/auth.ts:54-72` | `core/permissions.py` | Custom DRF permission class |
| Agreement CRUD | `server/routes.ts` | `agreements/views.py` | ViewSet with filters |
| Commission recalculation | `server/routes.ts:1900+` | `commission_tracker/services.py` | Complex calculation logic |
| Sub-agent sync | `server/storage.ts` | `sub_agent/services.py` | Sync from main tracker |
| S3 upload/download | `server/s3.ts` | `documents/services.py` | boto3 + django-storages |
| PDF password protection | `server/routes.ts` (qpdf) | `documents/services.py` | pikepdf library |
| Notification scheduler | `server/agreement-notifications.ts` | `notifications/tasks.py` | Celery Beat scheduled task |
| Email sending | `server/email.ts` | `notifications/services.py` | Django email backend |
| Audit logging | `server/storage.ts` | `audit/middleware.py` + `audit/mixins.py` | Auto-capture via mixin |
| Dashboard aggregation | `server/storage.ts` | `dashboard/services.py` | Raw SQL or ORM aggregates |
| Bulk CSV import | `server/routes.ts:2615+` | `commission_tracker/tasks.py` | Celery task for large files |

---

## 3. Migration Strategy

### 3.1 Approach: Phased Migration (Not Big Bang)

A phased migration is recommended for several reasons:
- The system is in production with active users
- Total codebase is substantial (~80 endpoints, ~25 models)
- Risk of big-bang rewrite is too high for a system handling sensitive documents

**Strategy: Strangler Fig Pattern**

```
Phase 1-3: Build Django backend alongside Node.js
Phase 4-5: Route traffic gradually to Django
Phase 6:   Decommission Node.js
```

### 3.2 How the Current System Stays Operational

During migration:
- The **Node.js backend continues serving all traffic** until each Django module is validated
- Both backends share the **same PostgreSQL database** and **same S3 bucket**
- Nginx routes requests to either backend based on URL path
- The **React frontend is unchanged** — it talks to the same API paths regardless of which backend serves them

```
                    ┌──────────────┐
                    │    Nginx     │
                    │  (routing)   │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
     ┌────────▼───┐  ┌─────▼─────┐  ┌──▼──────────┐
     │  Django    │  │  Node.js  │  │   React     │
     │  (new)     │  │  (legacy) │  │  (unchanged)│
     └─────┬──────┘  └─────┬─────┘  └─────────────┘
           │               │
     ┌─────▼───────────────▼─────┐
     │      PostgreSQL           │
     │      (shared database)    │
     └───────────────────────────┘
```

### 3.3 Database Compatibility

**Approach: Reuse the existing PostgreSQL schema with Django managed migrations.**

This is the safest approach:

1. **Phase 1 (Foundation):** Create Django models that map exactly to the existing tables using `db_table` Meta option and `managed = False` initially
2. **Phase 2 (Validation):** Verify Django models read/write correctly against the existing data
3. **Phase 3 (Takeover):** Switch to `managed = True` and let Django own the migration history going forward
4. **Schema refinements** (field renames, index additions, constraint improvements) are done after cutover via standard Django migrations

**Example of mapping an existing table:**

```python
class Agreement(models.Model):
    university = models.ForeignKey('providers.Provider', on_delete=models.PROTECT, db_column='university_id')
    agreement_code = models.CharField(max_length=64, unique=True, db_column='agreement_code')
    title = models.CharField(max_length=255)
    agreement_type = models.CharField(max_length=32, db_column='agreement_type')
    status = models.CharField(max_length=24, default='draft')
    territory_type = models.CharField(max_length=16, db_column='territory_type')
    territory_country = models.ForeignKey('core.Country', null=True, on_delete=models.SET_NULL, db_column='territory_country_id')
    start_date = models.DateField(db_column='start_date')
    expiry_date = models.DateField(db_column='expiry_date')
    auto_renew = models.BooleanField(default=False, db_column='auto_renew')
    confidentiality_level = models.CharField(max_length=16, default='high', db_column='confidentiality_level')
    internal_notes = models.TextField(blank=True, default='', db_column='internal_notes')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='created_agreements', on_delete=models.PROTECT, db_column='created_by_user_id')
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='updated_agreements', on_delete=models.PROTECT, db_column='updated_by_user_id')
    created_at = models.DateTimeField(auto_now_add=True, db_column='created_at')
    updated_at = models.DateTimeField(auto_now=True, db_column='updated_at')

    class Meta:
        db_table = 'agreements'
        managed = False  # Phase 1: read existing table, don't modify schema
```

**Column naming convention:**
- The current schema uses `camelCase` column names (from Drizzle ORM)
- Django convention is `snake_case`
- Solution: Use `db_column` to map Django field names to existing column names
- No need to rename columns in the database during migration

### 3.4 Session Compatibility During Migration

Both backends must recognize the same authenticated session:
- **Option A (Recommended):** Switch to JWT tokens. Frontend stores token and sends with every request. Both Node.js and Django validate the same JWT secret.
- **Option B:** Share PostgreSQL session store. Both backends read/write the same session table. More complex but doesn't require frontend changes.

**Recommendation: Option A (JWT)** — implemented first in the Node.js app as a pre-migration step, then natively in Django.

---

## 4. Security Baseline (Built-in from Day One)

Every item below is implemented in the Django backend from the initial setup, not added later.

### 4.1 Backend Validation

```python
# Every serializer validates all input
class AgreementSerializer(serializers.ModelSerializer):
    agreement_code = serializers.CharField(max_length=64, validators=[
        UniqueValidator(queryset=Agreement.objects.all())
    ])
    title = serializers.CharField(max_length=255, min_length=1)
    start_date = serializers.DateField()
    expiry_date = serializers.DateField()

    def validate(self, data):
        if data['expiry_date'] <= data['start_date']:
            raise serializers.ValidationError("Expiry date must be after start date")
        return data
```

### 4.2 CSRF Protection

- Django's built-in CSRF middleware is enabled by default
- For API-only endpoints using JWT: CSRF not needed (token-based auth)
- For session-based endpoints: Django handles CSRF automatically

### 4.3 Rate Limiting

```python
# config/settings/base.py
REST_FRAMEWORK = {
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '20/minute',
        'user': '100/minute',
        'login': '5/minute',
        'password_reset': '3/minute',
    }
}
```

### 4.4 Session/Token Security

- JWT with short-lived access tokens (15 minutes) and refresh tokens (7 days)
- Refresh token rotation on use
- Token blacklisting on logout
- Secure, HttpOnly cookies for refresh token storage

### 4.5 File Validation

```python
# documents/validators.py
import magic

def validate_upload(file):
    # 1. Check file size (50MB max)
    if file.size > 50 * 1024 * 1024:
        raise ValidationError("File too large")
    
    # 2. Check extension whitelist
    ext = os.path.splitext(file.name)[1].lower()
    if ext not in ['.pdf', '.doc', '.docx']:
        raise ValidationError("File type not allowed")
    
    # 3. Verify magic bytes match declared type
    mime = magic.from_buffer(file.read(2048), mime=True)
    file.seek(0)
    allowed_mimes = {'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}
    if mime not in allowed_mimes:
        raise ValidationError("File content does not match declared type")
    
    # 4. ClamAV scan (async via Celery)
    return file
```

### 4.6 Audit Logging

```python
# audit/mixins.py
class AuditableMixin:
    """Add to any ViewSet to auto-log create/update/delete actions."""
    
    def perform_create(self, serializer):
        instance = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            action='CREATE',
            entity_type=self.get_entity_type(),
            entity_id=instance.pk,
            ip_address=get_client_ip(self.request),
            user_agent=self.request.META.get('HTTP_USER_AGENT', ''),
            metadata=serializer.validated_data,
        )

    def perform_update(self, serializer):
        # Capture before/after diff
        old_data = model_to_dict(serializer.instance)
        instance = serializer.save()
        new_data = model_to_dict(instance)
        changes = {k: {'old': old_data.get(k), 'new': v} for k, v in new_data.items() if old_data.get(k) != v}
        AuditLog.objects.create(
            user=self.request.user,
            action='UPDATE',
            entity_type=self.get_entity_type(),
            entity_id=instance.pk,
            ip_address=get_client_ip(self.request),
            metadata={'changes': changes},
        )
```

### 4.7 Signed/Private Document Access

```python
# documents/services.py
import boto3
from botocore.config import Config

def generate_signed_url(storage_path, expires_in=300):
    """Generate a pre-signed S3 URL that expires in 5 minutes."""
    s3_client = boto3.client('s3', config=Config(signature_version='s3v4'))
    return s3_client.generate_presigned_url(
        'get_object',
        Params={'Bucket': settings.AWS_STORAGE_BUCKET_NAME, 'Key': storage_path},
        ExpiresIn=expires_in,
    )
```

### 4.8 Request Size Limits

```nginx
# nginx.conf
client_max_body_size 50m;
client_body_timeout 10s;
```

```python
# Django settings
DATA_UPLOAD_MAX_MEMORY_SIZE = 52428800  # 50MB
FILE_UPLOAD_MAX_MEMORY_SIZE = 52428800
```

### 4.9 Security Headers

```python
# config/settings/base.py
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    # ...
]

SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
```

### 4.10 Health and Monitoring Endpoints

```python
# core/views.py
class HealthCheckView(APIView):
    permission_classes = [AllowAny]
    
    def get(self, request):
        checks = {
            'database': self._check_db(),
            'redis': self._check_redis(),
            's3': self._check_s3(),
        }
        status = 'healthy' if all(c['status'] == 'ok' for c in checks.values()) else 'unhealthy'
        return Response({'status': status, 'components': checks, 'timestamp': now()})
```

---

## 5. Infrastructure Plan

### 5.1 Docker Services (Production)

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  nginx:
    image: nginx:1.25-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - static_files:/app/staticfiles:ro
    depends_on:
      - web
    restart: unless-stopped

  web:
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 4 --timeout 120
    volumes:
      - static_files:/app/staticfiles
    environment:
      - DATABASE_URL=postgres://portal_user:${DB_PASSWORD}@db:5432/agreement_portal
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/0
      - CELERY_BROKER_URL=redis://:${REDIS_PASSWORD}@redis:6379/1
      - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
      - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
      - AWS_S3_BUCKET=studyinfocentre-portal-documents
      - AWS_S3_REGION=ap-south-1
      - SENTRY_DSN=${SENTRY_DSN}
      - DJANGO_SECRET_KEY=${DJANGO_SECRET_KEY}
      - DJANGO_SETTINGS_MODULE=config.settings.prod
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health/"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

  celery_worker:
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: celery -A config worker -l info --concurrency=2
    environment:
      - DATABASE_URL=postgres://portal_user:${DB_PASSWORD}@db:5432/agreement_portal
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/0
      - CELERY_BROKER_URL=redis://:${REDIS_PASSWORD}@redis:6379/1
      - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
      - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
      - DJANGO_SETTINGS_MODULE=config.settings.prod
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  celery_beat:
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: celery -A config beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
    environment:
      - DATABASE_URL=postgres://portal_user:${DB_PASSWORD}@db:5432/agreement_portal
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/0
      - CELERY_BROKER_URL=redis://:${REDIS_PASSWORD}@redis:6379/1
      - DJANGO_SETTINGS_MODULE=config.settings.prod
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      - POSTGRES_USER=portal_user
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=agreement_portal
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U portal_user -d agreement_portal"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD} --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    restart: unless-stopped

volumes:
  pgdata:
  redis_data:
  static_files:
```

### 5.2 Django Dockerfile

```dockerfile
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev curl qpdf libmagic1 \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY requirements/prod.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Application code
COPY . .
RUN python manage.py collectstatic --noinput

# Run as non-root
RUN adduser --disabled-password --gecos '' appuser
USER appuser

EXPOSE 8000
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000"]
```

### 5.3 Nginx Configuration

```nginx
upstream django {
    server web:8000;
}

server {
    listen 80;
    server_name portal.studyinfocentre.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name portal.studyinfocentre.com;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 50m;
    client_body_timeout 10s;
    client_header_timeout 10s;

    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    location /static/ {
        alias /app/staticfiles/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location / {
        proxy_pass http://django;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    location ~* \.(env|git|svn|htaccess|ini|log|sh|sql|bak)$ {
        deny all;
        return 404;
    }
}
```

### 5.4 Environment Management

| Environment | Purpose | Database | Domain |
|---|---|---|---|
| **Development** | Local development | Local PostgreSQL | localhost:8000 |
| **Staging** | Pre-production testing | Separate DB on same EC2 or RDS | staging.portal.studyinfocentre.com |
| **Production** | Live system | Production PostgreSQL | portal.studyinfocentre.com |

Environment-specific settings via `DJANGO_SETTINGS_MODULE`:
- `config.settings.dev` — DEBUG=True, console email backend, no HTTPS
- `config.settings.prod` — DEBUG=False, SMTP email, HTTPS required, Sentry enabled

---

## 6. Timeline and Phases

### Phase 1: Foundation Setup (Week 1-2)
**Goal:** Django project scaffold with infrastructure ready

- [ ] Initialize Django project with the directory structure defined above
- [ ] Configure `config/settings/` (base, dev, prod)
- [ ] Set up Docker services (web, db, redis, nginx, celery_worker, celery_beat)
- [ ] Configure Gunicorn, Celery, Redis connections
- [ ] Set up `apps/core/` (base models, permission classes, pagination, exception handler)
- [ ] Configure structured logging (structlog/pino)
- [ ] Set up Sentry SDK
- [ ] Configure CORS, CSRF, security headers
- [ ] Implement health check endpoint
- [ ] Set up pytest with factory_boy
- [ ] Generate API documentation skeleton with drf-spectacular
- [ ] Verify Docker stack runs end-to-end on EC2

**Deliverable:** Running Django skeleton with infrastructure, health checks, and monitoring

### Phase 2: Core Auth & RBAC (Week 2-3)
**Goal:** Complete authentication system matching current behavior

- [ ] Create `accounts/models.py` mapping to existing user/role/permission tables
- [ ] Implement custom User model (AbstractBaseUser)
- [ ] Implement login flow: email/password → OTP → JWT token
- [ ] Implement OTP generation, hashing, validation, rate limiting
- [ ] Implement password policy (8+ chars, complexity, 3-password history, 90-day expiry)
- [ ] Implement password reset flow (token email, validation, reset)
- [ ] Implement RBAC: role → permissions → user access checking
- [ ] Implement user session tracking (multi-device, heartbeat, remote logout)
- [ ] Implement user/role CRUD endpoints for admin
- [ ] Implement country-scoped access
- [ ] Write tests for all auth flows
- [ ] Security audit: verify all edge cases (lockout, OTP exhaustion, token expiry)

**Deliverable:** Fully functional auth system with tests, compatible with existing database

### Phase 3: Feature Migration (Week 3-6)
**Goal:** Migrate all business features module by module

**Order of migration** (by dependency and complexity):

1. **`providers/`** (Week 3) — Simple CRUD, no dependencies
   - Models: Provider (university), Country
   - 4 endpoints, filters
   
2. **`agreements/`** (Week 3) — Core entity
   - Models: Agreement, AgreementTerritory
   - 7 endpoints, status counts, alerts
   - Territory management
   
3. **`contacts/`** (Week 3-4) — Depends on agreements
   - Model: AgreementContact
   - 5 endpoints, filters

4. **`targets/` + `commissions/`** (Week 4) — Depends on agreements
   - Models: AgreementTarget, BonusRule, BonusTier, BonusCountry, CommissionRule
   - 12 endpoints, bonus calculation logic

5. **`documents/`** (Week 4) — Depends on agreements + S3
   - Model: AgreementDocument
   - 5 endpoints
   - S3 integration with boto3
   - Signed URL generation
   - PDF password protection (pikepdf)
   - File type validation (magic bytes)
   - ClamAV integration (Celery task)

6. **`commission_tracker/`** (Week 5) — Complex, standalone
   - Models: CommissionStudent, CommissionEntry, StudentProvider, CommissionTerm
   - 15+ endpoints
   - Recalculation service
   - Bulk CSV import (Celery task)
   - Dashboard aggregation

7. **`sub_agent/`** (Week 5) — Depends on commission_tracker
   - Models: SubAgentEntry, SubAgentTermEntry
   - 8 endpoints
   - Sync service, margin calculation

8. **`audit/`** (Week 5-6) — Cross-cutting
   - Models: AuditLog, SecurityAuditLog
   - Audit middleware and mixin applied to all views
   - 2 query endpoints

9. **`notifications/`** (Week 6) — Background jobs
   - Model: AgreementNotification
   - Celery Beat: daily 8 AM agreement expiry check
   - Celery tasks: send individual emails
   - Email templates (HTML)

10. **`dashboard/`** (Week 6) — Aggregation views
    - 4 endpoints using ORM aggregation
    - Stats, expiring agreements, recent activity

### Phase 4: Testing & Validation (Week 6-7)
**Goal:** Ensure parity with Node.js backend

- [ ] Write integration tests for every endpoint (pytest)
- [ ] Compare Django API responses with Node.js API responses for same data
- [ ] Load test critical endpoints (locust)
- [ ] Security testing: run OWASP ZAP against Django API
- [ ] Test file upload/download/view flows end-to-end
- [ ] Test commission recalculation accuracy
- [ ] Test notification scheduling
- [ ] Test all permission combinations
- [ ] Frontend smoke tests against Django backend (Playwright)
- [ ] Performance benchmarking: compare response times

### Phase 5: Cutover (Week 7-8)
**Goal:** Switch production traffic from Node.js to Django

**Cutover plan:**

1. **Pre-cutover:**
   - Deploy Django alongside Node.js on EC2
   - Nginx routes `/api/health` to Django for validation
   - Run Django in shadow mode (receives traffic copies, responses discarded)

2. **Gradual cutover:**
   - Week 7: Route read-only endpoints to Django (GET /api/agreements, /api/dashboard, etc.)
   - Validate responses match
   - Week 7: Route auth endpoints to Django
   - Validate login/OTP/session flows
   - Week 8: Route write endpoints to Django (POST, PATCH, DELETE)
   - Validate data integrity

3. **Full cutover:**
   - Route all `/api/*` traffic to Django
   - Keep Node.js running but idle for 48 hours
   - Monitor error rates, response times, audit logs
   - If stable, decommission Node.js container

4. **Post-cutover:**
   - Remove Node.js from docker-compose
   - Clean up any Node.js-specific database tables (e.g., `session` table from connect-pg-simple)
   - Update CI/CD pipeline

### Phase 6: Rollback Strategy

**If issues found during cutover:**

1. **Immediate rollback (< 5 minutes):**
   - Nginx config change: route all traffic back to Node.js
   - `nginx -s reload`
   - No data loss (shared database)

2. **Post-cutover rollback (> 48 hours):**
   - If Django introduced schema changes, run reverse migration
   - Restart Node.js container
   - Route traffic via Nginx

**Risk mitigation:**
- No destructive schema changes until Node.js is fully decommissioned
- Django uses `managed = False` on models until cutover is complete
- Shared database means either backend can serve at any time

---

## 7. Recommendation on Current Node.js App

### 7.1 Minimum Hardening to Do Now (While Migration is Ongoing)

These are low-effort, high-impact changes that protect the system during the migration period:

| Item | Effort | Reason |
|---|---|---|
| Add `helmet` middleware | 30 min | Security headers — 3 lines of code |
| Add `express.json({ limit: '1mb' })` | 5 min | Prevent oversized payloads |
| Add `express-rate-limit` (global: 100/min) | 1 hour | Protect against abuse |
| Add health check endpoint (`GET /health`) | 30 min | Needed for monitoring during migration |

**Total effort: ~2 hours**

### 7.2 What NOT to Invest In (Will Be Replaced by Django)

| Item | Reason to Skip |
|---|---|
| Redis integration for Node.js | Django will have Redis natively |
| Nginx in Docker for Node.js | Will be set up for Django deployment |
| Sentry for Node.js | Will be set up for Django |
| Structured logging for Node.js | Will be built into Django |
| BullMQ job queue for Node.js | Django uses Celery |
| CSRF token system for Node.js | Django has built-in CSRF |
| CloudFront integration | Set up once for Django |
| Comprehensive Zod validation on every route | Django serializers will handle this |
| JWT migration for Node.js | Will be native in Django |

**Bottom line:** Spend ~2 hours on basic hardening for the Node.js app. Invest all remaining development effort into the Django migration.

---

## Summary

| Phase | Duration | Key Deliverable |
|---|---|---|
| 1. Foundation | 1-2 weeks | Django scaffold, Docker, infrastructure |
| 2. Auth & RBAC | 1-2 weeks | Complete auth system with tests |
| 3. Feature Migration | 3-4 weeks | All 12 Django apps with endpoints |
| 4. Testing | 1-2 weeks | Full test suite, security audit |
| 5. Cutover | 1-2 weeks | Gradual traffic switch |
| 6. Cleanup | 1 week | Decommission Node.js |

**Total estimated timeline: 8-12 weeks**

This plan prioritizes security from day one, maintains production availability throughout, and provides a clear rollback path at every stage.
