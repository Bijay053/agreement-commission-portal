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
- **Portal Access Control**: Users have a `portal_access` field (`admin`, `employee`, or `both`) controlling which portal they can log into. `admin` = portal.studyinfocentre.com only, `employee` = people.studyinfocentre.com only, `both` = both portals. Enforced at login via `Host` header check.
- **UI/UX**: `shadcn/ui` and Radix provide a modern, consistent interface.
- **Feature Specifications**:
    - **Agreement Management**: CRUD operations, status tracking, alerts, and notifications.
    - **Commission Tracking**: Student and sub-agent commission tracking, bulk uploads, recalculations, and **commission prediction** (predicts receivable amounts for the selected year based on historical data, analyzed by country and study level, with term-wise breakdown showing actual vs predicted values).
    - **Document Management**: Secure upload, view, and download of documents (including PDF password protection) with integrated malware scanning.
    - **Employee Management**: CRUD for employee profiles, employment agreements (with e-signature via draw or image upload with auto background removal, unique PDF passwords per agreement emailed to employees, and professional PDF generation), and offer letters (with e-signature signing flow matching agreements — send for e-signing, employee signs via `/sign-offer/:token`, company signs in portal, fully signed PDF emailed with unique password), all with multi-status workflows, e-signature legal metadata capture (IP, user agent, timestamp), and secure document handling.
    - **HRMS (people.studyinfocentre.com)**: Full HR management system with organization management (multi-company: Nepal + Australia), department management (custom working hours, late/early thresholds per department), attendance tracking (ZKT K40 biometric device sync + online check-in/out with geolocation and live photo), leave management (configurable leave types, department-based allocation, policy-driven leave requests with advance notice/balance checks, approval workflow), payroll (Nepal-specific: CIT with per-employee percentage/flat rate, SSF, income tax slab calculation, unpaid leave deduction, bonus inclusion, travel expense reimbursement, advance payment installment deduction, payslip generation), bonus management (festival/performance/yearly/special with approval workflow and taxable flag), travel & expense management (categorized expenses with approval/rejection/reimbursement workflow), advance payment management (with configurable monthly deductions, progress tracking, auto-deduction in payroll), staff profile & salary structure management (inline salary editor with allowances, deductions, CIT, SSF configuration), configurable tax slabs (single vs married with dashboard editor, auto-used in payroll calculation), government CIT/tax records (monthly breakdown of all payable taxes with annual totals), holiday management, fiscal year management, and email notifications for late arrivals and early departures. Employee self-service APIs for viewing own attendance, leave balance, payslips, and requesting leave.
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