# Agreement & Commission Management Portal

## Overview
This project is an internal portal for Study Info Centre, designed to streamline the management of partnership agreements with educational providers (universities, colleges, B2B entities). It provides robust commission tracking, target and bonus management, secure document handling, and comprehensive audit logging.

## System Architecture
The portal adopts a client-server architecture:
- **Frontend**: React, TypeScript, Vite, `shadcn/ui`, `wouter` for routing, `TanStack Query` for data fetching
- **Backend**: Python/Django + Django REST Framework
- **Database**: PostgreSQL (existing tables, Django models use `managed=False`)
- **Auth**: Session-based with bcrypt password hashing, email OTP verification
- **File Storage**: AWS S3 (bucket: `studyinfocentre-portal-documents`, region: `ap-south-1`)
- **Email**: SMTP via AWS SES
- **Cache**: Redis (optional, falls back to local memory cache)
- **Task Queue**: Celery with Redis broker
- **Scheduler**: Celery Beat for periodic tasks
- **Production WSGI**: Gunicorn (3 workers) behind Nginx
- **Monitoring**: Sentry (optional), `/api/health` endpoint

### Project Structure
```
├── backend/             # Django backend (Python)
│   ├── config/          # Django project settings, URLs, WSGI, Celery
│   ├── core/            # Shared utilities, permissions, middleware, exceptions
│   │   ├── deploy_check.py      # Deploy readiness management command
│   │   ├── exceptions.py        # Custom DRF exception handler
│   │   ├── exports.py           # CSV/Excel export utilities
│   │   ├── field_permissions.py  # Field-level permission filtering
│   │   ├── file_security.py     # File magic-byte validation + ClamAV scanning
│   │   ├── health.py            # /api/health endpoint (DB, Redis, S3, Celery)
│   │   ├── middleware.py        # CSRF exemption, CSP, session auth middleware
│   │   ├── models.py            # SoftDeleteMixin, StatusHistory, shared models
│   │   ├── object_permissions.py # Object-level access helpers
│   │   ├── pagination.py        # StandardPagination (page_size=50)
│   │   ├── permissions.py       # @require_permission decorator
│   │   ├── status_history.py    # Status change tracking helper
│   │   ├── tasks.py             # Celery email tasks
│   │   ├── throttling.py        # SessionUserRateThrottle, LoginRateThrottle
│   │   └── management/commands/deploy_check.py  # `manage.py deploy_check`
│   ├── accounts/        # Auth (login/OTP/logout/password), user/role/permission CRUD
│   ├── agreements/      # Agreement CRUD, status counts, alerts
│   ├── providers/       # University/provider CRUD
│   ├── contacts/        # Agreement contacts CRUD
│   ├── targets/         # Agreement targets + bonus rules
│   ├── commissions/     # Commission rules CRUD, bonus rules CRUD
│   ├── documents/       # S3 document upload/view/download with PDF password protection
│   ├── commission_tracker/ # Student commission tracking, entries, terms, bulk upload
│   ├── sub_agent/       # Sub-agent commission tracking, sync, margin calculation
│   ├── portal_access/   # Portal credential vault with Fernet encryption, access audit logs
│   ├── audit/           # Audit logs
│   ├── notifications/   # Agreement expiry notifications, email template management
│   ├── dashboard/       # Dashboard stats, expiring agreements, recent activity
│   ├── templates_manager/ # Agreement & offer letter clause/template editor (template_type: agreement|offer_letter)
│   ├── employees/       # Employee CRUD (profile, position, salary with multi-currency, status)
│   ├── employment_agreements/ # Employment agreement lifecycle (8 statuses), PDF generation, e-signature, download
│   ├── employee_documents/   # Employee document management (9 categories: id_passport, contract_agreement, offer_letter, joining, cv, citizenship, tax, academic, other)
│   ├── offer_letters/   # Offer letter CRUD (6 statuses: draft, sent, accepted, rejected, manually_signed, completed)
│   └── requirements.txt # Python dependencies
├── client/              # React frontend
│   └── src/             # Components, pages, hooks, lib
├── shared/              # Shared TypeScript types and constants (used by frontend only)
│   ├── schema.ts        # Pure TS interfaces and const arrays (no Drizzle)
│   └── intake-utils.ts  # Intake parsing utilities
├── nginx/nginx.conf     # Nginx reverse proxy config for production
├── scripts/
│   ├── backup.sh        # PostgreSQL backup to S3 with rotation
│   └── restore.sh       # Database restore from local or S3 backup
├── Dockerfile           # Multi-stage: Python + Node (Vite build) → Gunicorn production
├── docker-compose.yml   # App + PostgreSQL + Redis + Nginx services
├── start_django.sh      # Dev startup (Django 5001 + Vite 5000)
└── vite.config.ts       # Vite config with /api proxy to Django
```

### Startup
- `start_django.sh` starts Django on port 5001 and Vite dev server on port 5000
- Vite proxies `/api/*` requests to Django on port 5001
- Workflow: `bash start_django.sh`

### Key Configuration
- Session cookie name: `connect.sid`
- Session stores `userId`, `userPermissions`, `pendingUserId`, `otpRequired`, `passwordExpired`
- Most Django models use `managed = False` with `db_table` matching existing PostgreSQL tables; newer models (OfferLetter) use `managed = True`
- Password hashing: bcrypt via Python `bcrypt` package
- PDF download password: configured via `PDF_DOWNLOAD_PASSWORD` env var

### Security Features
- **CSRF Protection**: Enforced via `SessionCsrfAuthentication` DRF auth class (DRF's `APIView` exempts Django CSRF middleware, so enforcement moved to DRF layer); `@ensure_csrf_cookie` on `MeView`/`VerifyOtpView` sets cookie; pre-auth views have `authentication_classes = []`; frontend sends `X-CSRFToken` header
- **Security Headers**: HSTS (1 year), X-Frame-Options DENY, Content-Type nosniff, Referrer-Policy
- **CSP**: Content-Security-Policy header in production (not DEBUG)
- **Rate Limiting**: DRF throttling — 30/min anonymous, 120/min authenticated, 5/min login endpoints
- **Malware Scanning**: Every upload (documents + bulk CSV) scanned before save: magic-byte validation, malicious signature detection (web shells, executables, suspicious PDF patterns), ClamAV antivirus when available. Scan-on-serve checks files from S3 before view/download — infected files quarantined and permanently blocked. Scan failures are fail-closed (access denied). All detections logged to `audit_logs` with action `MALWARE_BLOCKED` including filename, content type, user, IP, and check type
- **Document Proxying**: Document view and download endpoints proxy file content through the backend (no S3 presigned URLs exposed to browser), avoiding CORS issues and preventing URL leakage. Scan-on-serve reuses fetched bytes to avoid duplicate S3 reads
- **Soft Deletes**: Key tables use `is_deleted` flag instead of hard deletes
- **Status History**: All status transitions tracked in `status_history` table
- **Audit Logging**: All document operations (upload, view, download, delete) logged
- **Object-Level Permissions**: Territory-based agreement access, sub-agent scoping
- **Field-Level Permissions**: Financial fields and confidential data restricted by permission codes

### Pagination
`DEFAULT_PAGINATION_CLASS` set to `StandardPagination` (50 items/page). Response format:
```json
{"count": 123, "next": "...", "previous": "...", "results": [...]}
```
Paginated endpoints: agreements list, commission tracker students, audit logs, contacts (all), users, security logs, notifications.
Frontend extracts `data.results ?? data` for backward compatibility.
Small/fixed/config endpoints (roles, terms, sessions, per-agreement contacts/documents) return flat arrays.

### Export Endpoints
- `GET /api/agreements/export?format=csv|xlsx`
- `GET /api/commission-tracker/export?format=csv|xlsx`
- `GET /api/audit/export?format=csv|xlsx`

### Email Template Management
- CRUD API at `/api/email-templates`
- Templates stored in `email_templates` table with template variables
- Preview endpoint: `POST /api/email-templates/:id/preview`

### API Endpoints (80+)
All endpoints under `/api/`:
- **Auth**: login, verify-otp, resend-otp, logout, logout-others, me, heartbeat, change-password, forgot-password, reset-password, sessions, security-logs, client-info
- **Admin**: users, roles, permissions/schema, user sessions/security-logs
- **Agreements**: CRUD, status-counts, alerts, trigger-notification-check, export
- **Providers/Universities**: CRUD
- **Contacts**: list all, list by agreement, CRUD
- **Targets**: CRUD + bonus rules
- **Commissions**: commission rules CRUD, bonus rules CRUD, bonus calculate
- **Documents**: list by agreement, upload (with security scan), view (proxied from S3), download (proxied, PDF password-protected), delete
- **Commission Tracker**: students CRUD, entries CRUD, terms CRUD, dashboard, yearly dashboard, filters, years, all-entries, all-student-providers, bulk-upload preview/confirm, sample-sheet, recalculate, student-providers CRUD, export
- **Sub-Agent**: dashboard, master list, update master, sync, term entries CRUD
- **Portal Access Manager**: portal credentials CRUD, password reveal (throttled, audited), password rotate, access audit logs, categories
- **Dashboard**: stats, expiring, recent
- **Audit Logs**: list with filters, export
- **Notifications**: agreement notifications list, expiry reminder emails, email template CRUD
- **Health**: `/api/health` (no auth, checks DB/Redis/S3/Celery)
- **Templates**: CRUD for agreement/offer letter clause templates (filtered by `?type=agreement|offer_letter`)
- **Employees**: CRUD for employee profiles (with multi-currency salary: NPR, AUD, USD, GBP, CAD, BDT, EUR, NZD)
- **Employment Agreements**: create, send-for-signing, verify/submit signing token, download PDF, upload-signed, status transitions (8 statuses: draft, sent, awaiting_signature, signed, manually_signed, completed, expired, terminated)
- **Employee Documents**: upload/download/replace/delete by category (9 categories: id_passport, contract_agreement, offer_letter, joining, cv, citizenship, tax, academic, other)
- **Offer Letters**: CRUD, status transitions, upload-signed (6 statuses: draft, sent, accepted, rejected, manually_signed, completed)
- **Signing (public)**: `/api/signing/verify/:token`, `/api/signing/submit/:token` — no auth required

## Permission System
Fine-grained RBAC with permission codes like `agreement.view`, `commission_tracker.student.read`, `document.upload`, etc. Permissions are linked to roles via `role_permissions` table. Each API endpoint checks specific permission codes via `@require_permission` decorator.

## External Dependencies
### Python (backend)
- **Django 6.0.3 + DRF**: Backend framework
- **bcrypt**: Password hashing
- **boto3**: AWS S3 integration
- **pikepdf**: PDF password protection for downloads
- **dj-database-url**: Database URL parsing
- **whitenoise**: Static file serving
- **django-cors-headers**: CORS support
- **gunicorn**: Production WSGI server
- **psycopg2-binary**: PostgreSQL adapter
- **sentry-sdk[django]**: Error monitoring (optional)
- **django-redis**: Redis cache backend (optional)
- **celery + celery[redis]**: Async task queue
- **python-magic**: File type detection
- **pyclamd**: ClamAV antivirus integration (optional)
- **openpyxl**: Excel export support
- **cryptography**: Fernet encryption for portal credential vault
- **reportlab**: PDF generation for employment agreements
- **pypdf**: PDF manipulation for agreement signing

### JavaScript (frontend only)
- **React + Vite**: Frontend build
- **TanStack Query**: Data fetching
- **shadcn/ui + Radix**: UI components
- **wouter**: Client-side routing
- **react-signature-canvas**: E-Signature capture for employment agreements

## Deployment
- **Production URL**: https://portal.studyinfocentre.com
- **EC2**: `65.0.18.210`
- **Deploy command**: `cd ~/agreement-commission-portal && git pull origin main && docker-compose down && docker-compose up -d --build`
- Production uses Gunicorn with 3 workers behind Nginx with SSL
- `DEBUG=False`, restricted `ALLOWED_HOSTS`, explicit CORS origins

### Deploy Check
Run the deploy readiness check before going live:
```bash
python manage.py deploy_check
```
This validates: DEBUG=False, ALLOWED_HOSTS, SECRET_KEY, CSRF, HSTS, database connectivity, S3 credentials, Sentry DSN, Redis, and SMTP configuration.
