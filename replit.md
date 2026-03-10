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
- **Production WSGI**: Gunicorn (3 workers)

### Project Structure
```
├── backend/             # Django backend (Python)
│   ├── config/          # Django project settings, URLs, WSGI
│   ├── core/            # Shared utilities, permissions, middleware, exceptions
│   ├── accounts/        # Auth (login/OTP/logout/password), user/role/permission CRUD
│   ├── agreements/      # Agreement CRUD, status counts, alerts
│   ├── providers/       # University/provider CRUD
│   ├── contacts/        # Agreement contacts CRUD
│   ├── targets/         # Agreement targets + bonus rules
│   ├── commissions/     # Commission rules CRUD
│   ├── documents/       # S3 document upload/view/download with PDF password protection
│   ├── commission_tracker/ # Student commission tracking, entries, terms, bulk upload
│   ├── sub_agent/       # Sub-agent commission tracking, sync, margin calculation
│   ├── audit/           # Audit logs
│   ├── notifications/   # Agreement expiry notifications (3 branded templates)
│   ├── dashboard/       # Dashboard stats, expiring agreements, recent activity
│   └── requirements.txt # Python dependencies
├── client/              # React frontend
│   └── src/             # Components, pages, hooks, lib
├── shared/              # Shared TypeScript types and constants (used by frontend only)
│   ├── schema.ts        # Pure TS interfaces and const arrays (no Drizzle)
│   └── intake-utils.ts  # Intake parsing utilities
├── Dockerfile           # Multi-stage: Python + Node (Vite build) → Gunicorn production
├── docker-compose.yml   # App + PostgreSQL services
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
- All Django models use `managed = False` with `db_table` matching existing PostgreSQL tables
- Password hashing: bcrypt via Python `bcrypt` package
- PDF download password: configured via `PDF_DOWNLOAD_PASSWORD` env var

### API Endpoints (80+)
All endpoints under `/api/`:
- **Auth**: login, verify-otp, resend-otp, logout, logout-others, me, heartbeat, change-password, forgot-password, reset-password, sessions, security-logs, client-info
- **Admin**: users, roles, permissions/schema, user sessions/security-logs
- **Agreements**: CRUD, status-counts, alerts, trigger-notification-check
- **Providers/Universities**: CRUD
- **Contacts**: list all, list by agreement, CRUD
- **Targets**: CRUD + bonus rules
- **Commissions**: commission rules CRUD, bonus rules CRUD, bonus calculate
- **Documents**: list by agreement, upload, view (signed URL), download (PDF protected), delete
- **Commission Tracker**: students CRUD, entries CRUD, terms CRUD, dashboard, yearly dashboard, filters, years, all-entries, all-student-providers, bulk-upload preview/confirm, sample-sheet, recalculate, student-providers CRUD
- **Sub-Agent**: dashboard, master list, update master, sync, term entries CRUD
- **Dashboard**: stats, expiring, recent
- **Audit Logs**: list with filters
- **Notifications**: agreement notifications list, expiry reminder emails (3 branded templates: reminder 30-60d, urgent 7-14d, expired follow-up)

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

### JavaScript (frontend only)
- **React + Vite**: Frontend build
- **TanStack Query**: Data fetching
- **shadcn/ui + Radix**: UI components
- **wouter**: Client-side routing

## Deployment
- **Production URL**: https://portal.studyinfocentre.com
- **EC2**: `65.0.18.210`
- **Deploy command**: `cd ~/agreement-commission-portal && git pull origin main && docker-compose down && docker-compose up -d --build`
- Production uses Gunicorn with 3 workers behind Nginx with SSL
- `DEBUG=False`, restricted `ALLOWED_HOSTS`, explicit CORS origins
