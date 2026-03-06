# Agreement & Commission Management Portal

## Overview
A secure internal portal for Study Info Centre — managing provider (university/college/B2B) partnership agreements with role-based access control, commission tracking, target & bonus management, document handling, and audit logging.

## Architecture
- **Frontend**: React + TypeScript + Vite, using shadcn/ui components, wouter for routing, TanStack Query for data fetching
- **Backend**: Express.js (Node.js), session-based auth with bcryptjs password hashing
- **Database**: PostgreSQL with Drizzle ORM
- **Storage**: Local file uploads via multer

## Key Features
- Session-based authentication with role-based permissions (RBAC)
- Dashboard with expiring agreements and recent activity
- Full CRUD for agreements with metadata, commission rules, targets, contacts, documents
- **Provider Management** (University / College / B2B Company) with type, country, status
- **Multi-territory support** — agreements can be Global or Country-Specific (multiple countries)
- **Target Bonus System** — bonus toggle + amount/condition on targets, with bonus calculation API
- **Target Bonus Rules** — per-student tier, flat on target, country-based, tiered flat bonus structures
- **Duplicate prevention** — providers (name+country), targets (type+metric+period), agreements (provider+type+date+territory)
- **Period key validation** — yearly=YYYY, monthly=YYYY-MM, intake=T1-YYYY
- **Password policy** — 12+ chars, uppercase, lowercase, number required
- **Forgot Password** — token-based reset with 30-minute expiry, console-logged reset URLs
- **Role & Permission Management** — admin UI for creating/editing/deleting/duplicating roles, dynamic permission grid by module/resource/action
- **Global Contacts Page** — view/filter/add/edit/delete all contacts across agreements with search, country, and status filters; Contact Location column shows country + city
- **Searchable Dropdowns** — All Select/dropdown fields use SearchableSelect component (Popover + Command/cmdk) with type-to-filter, keyboard support, "No results found"
- **Reset Filters** — Contacts page has Reset button (RotateCcw icon) that clears all active filters; empty state shows clickable "Reset filters" link
- **Sidebar Status Sub-menu** — Agreements sidebar with expandable status filters and count badges
- **Agreement List Filters** — search, status, provider, provider country, territory country
- Fine-grained RBAC with module.resource.action permission codes
- Audit logging for all key actions including role/permission changes
- Confidentiality level hidden (defaults to "high" for all agreements)

## Data Model
- `countries` — Reference table for territories and provider countries
- `universities` — Provider records (university/college/b2b_company/other) with type, country, status, notes
- `users` — System users with password hashing
- `roles`, `permissions`, `role_permissions`, `user_roles` — RBAC tables
- `password_reset_tokens` — Forgot password token storage with hash, expiry, used_at
- `agreements` — Core agreement records with status, dates, territory_type (global/country_specific)
- `agreement_territories` — Many-to-many: agreement ↔ territory countries
- `agreement_targets` — Performance targets with bonus fields
- `target_bonus_rules`, `target_bonus_tiers`, `target_bonus_country` — Bonus structures
- `agreement_commission_rules` — Flexible commission configuration
- `agreement_contacts` — Provider contacts for renewals
- `agreement_documents` — Versioned document uploads
- `audit_logs` — System activity tracking

## Default Users (Seeded)
- **Super Admin**: admin@studyinfocentre.com / admin123
- **Viewer**: viewer@studyinfocentre.com / viewer123
- **Editor**: editor@studyinfocentre.com / editor123

## API Endpoints
### Auth
- `POST /api/auth/login` — Login
- `POST /api/auth/logout` — Logout
- `GET /api/auth/me` — Current user + permissions
- `POST /api/auth/forgot-password` — Request password reset (generic response)
- `POST /api/auth/reset-password` — Reset password with token

### Agreements
- `GET /api/agreements` — List with filters: status, search, providerId, countryId, providerCountryId
- `GET /api/agreements/status-counts` — Status count badges for sidebar
- `GET/POST /api/agreements/:id` — CRUD with territory support
- `GET/POST /api/agreements/:id/targets` — Target CRUD with period validation + duplicate check
- `GET/POST /api/agreements/:id/commission-rules` — Commission CRUD
- `GET/POST /api/agreements/:id/contacts` — Contact CRUD per agreement
- `GET/POST /api/agreements/:id/documents` — Document upload

### Contacts (Global)
- `GET /api/contacts` — All contacts across agreements with filters: q, providerId, providerCountryId, contactCountryId, agreementStatus
- `PATCH /api/contacts/:id` — Update contact
- `DELETE /api/contacts/:id` — Delete contact

### Providers
- `GET/POST /api/providers` — Provider CRUD with duplicate checking
- `PATCH /api/providers/:id` — Update provider

### Roles & Permissions (Admin)
- `GET /api/roles` — List roles with user counts
- `POST /api/roles` — Create role
- `PATCH /api/roles/:id` — Update role
- `DELETE /api/roles/:id` — Delete (with safety checks)
- `POST /api/roles/:id/duplicate` — Duplicate role with permissions
- `GET /api/roles/:id/permissions` — Get role permission IDs
- `PUT /api/roles/:id/permissions` — Set role permissions
- `PUT /api/users/:id/roles` — Set user roles (multi-role)
- `GET /api/admin/permissions/schema` — Dynamic permission registry

### Bonus
- `GET/POST /api/targets/:id/bonus-rules` — Bonus rule management
- `POST /api/bonus/calculate` — Bonus preview calculator

## Project Structure
```
client/src/
  components/
    agreement/        # Tab components (overview, commission, targets, contacts, docs, audit)
    app-sidebar.tsx   # Navigation with agreement status sub-menu + count badges
    ui/               # shadcn/ui components (searchable-select, checkbox, dialog, etc.)
  lib/
    auth.tsx          # Auth context and hooks
    queryClient.ts    # TanStack Query setup
  pages/
    login.tsx              # Login with forgot password link
    forgot-password.tsx    # Email-based password reset request
    reset-password.tsx     # Token-based password reset with policy display
    dashboard.tsx
    contacts-list.tsx      # Global contacts table with filters, add/edit/delete
    agreements-list.tsx    # 5 filters: search, status, provider, provider country, territory
    agreement-detail.tsx   # 6-tab detail view
    agreement-form.tsx     # Create/edit with inline provider add, multi-territory
    providers-list.tsx     # Provider management
    roles-management.tsx   # Role CRUD + permission grid editor
    users-management.tsx   # User management with multi-role assignment
    audit-logs.tsx
server/
  auth.ts            # Auth middleware, session, password utilities
  db.ts              # Database connection
  routes.ts          # API endpoints with validation
  seed.ts            # Database seed data with permission registry
  storage.ts         # Data access layer
shared/
  schema.ts          # Drizzle schema, types, constants, PERMISSION_REGISTRY
```
