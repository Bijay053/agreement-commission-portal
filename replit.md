# Agreement & Commission Management Portal

## Overview
This internal portal for Study Info Centre centralizes the management of partnership agreements with educational providers and B2B entities. It offers robust features for commission tracking, target and bonus management, secure document handling, and comprehensive audit logging. The project aims to streamline operations and enhance efficiency in managing agreements and commissions.

## User Preferences
I want iterative development. I prefer detailed explanations for complex features. Ask before making major changes. I prefer to use `shadcn/ui` for UI components.

## System Architecture
The portal utilizes a client-server architecture. The frontend is built with React, TypeScript, Vite, `shadcn/ui`, `wouter` for routing, and `TanStack Query` for data fetching. The backend is developed using Python/Django with Django REST Framework, connected to a PostgreSQL database where most models are managed with `managed=False`. Authentication is session-based with bcrypt and email OTP. File storage leverages AWS S3, and email services use AWS SES. Caching is handled by Redis (with memory fallback), and asynchronous tasks are managed by Celery with a Redis broker, scheduled by Celery Beat. Production deployment uses Gunicorn behind Nginx.

Key architectural decisions include:
- **Security**: Comprehensive measures like CSRF protection, security headers (HSTS, X-Frame-Options, CSP), rate limiting, malware scanning for all uploads (magic-byte validation, signature detection, ClamAV), and secure document proxying to prevent direct S3 URL exposure. Infected files are quarantined and blocked.
- **Data Integrity**: Soft deletes are implemented for key tables, and all status transitions are tracked in a `status_history` table. Extensive audit logging captures document operations and critical actions.
- **Permissions**: A fine-grained Role-Based Access Control (RBAC) system with specific permission codes (`agreement.view`, `document.upload`, etc.) is enforced via decorators and object-level permissions (e.g., territory-based access, sub-agent scoping) and field-level permissions.
- **UI/UX**: `shadcn/ui` and Radix provide a modern, consistent interface.
- **Feature Specifications**:
    - **Agreement Management**: CRUD operations, status tracking, alerts, and notifications.
    - **Commission Tracking**: Student and sub-agent commission tracking, bulk uploads, and recalculations.
    - **Document Management**: Secure upload, view, and download of documents (including PDF password protection) with integrated malware scanning.
    - **Employee Management**: CRUD for employee profiles, employment agreements (with e-signature via draw or image upload with auto background removal, unique PDF passwords per agreement emailed to employees, and professional PDF generation), and offer letters (with logo/design PDF generation), all with multi-status workflows and secure document handling.
    - **Portal Access Manager**: Secure storage for credentials with Fernet encryption and access auditing.
    - **Reporting**: Export functionalities for agreements, commission tracking, and audit logs in CSV/XLSX formats.
    - **Email Templates**: Dynamic email template management with variables and preview functionality.
    - **Health Check**: An unauthenticated `/api/health` endpoint monitors critical service statuses (DB, Redis, S3, Celery).

## External Dependencies
- **Python (backend)**:
    - **Django 6.0.3 + DRF**: Web framework.
    - **bcrypt**: Password hashing.
    - **boto3**: AWS S3 integration.
    - **pikepdf**: PDF password protection.
    - **celery + celery[redis]**: Asynchronous task queue.
    - **psycopg2-binary**: PostgreSQL database adapter.
    - **python-magic**: File type detection.
    - **pyclamd**: ClamAV antivirus integration.
    - **openpyxl**: Excel export.
    - **cryptography**: Fernet encryption.
    - **reportlab**: PDF generation.
    - **pypdf**: PDF manipulation.
- **JavaScript (frontend)**:
    - **React + Vite**: Frontend framework and build tool.
    - **TanStack Query**: Data fetching.
    - **shadcn/ui + Radix**: UI component libraries.
    - **wouter**: Client-side routing.
    - **react-signature-canvas**: E-signature capture.