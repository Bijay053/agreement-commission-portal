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
- **Duplicate prevention** — providers (name+country unique), targets (type+metric+period unique)
- **Period key validation** — yearly=YYYY, monthly=YYYY-MM, intake=T1-YYYY
- **Password policy** — 12+ chars, uppercase, lowercase, number required for new users
- Fine-grained RBAC with 24 permission codes across 6 roles
- Audit logging for all key actions
- Confidentiality level hidden (defaults to "high" for all agreements)

## Data Model
- `countries` — Reference table for territories and provider countries
- `universities` — Provider records (university/college/b2b_company/other) with type, country, status, notes
- `users` — System users with password hashing
- `roles`, `permissions`, `role_permissions`, `user_roles` — RBAC tables
- `agreements` — Core agreement records with status, dates, territory_type (global/country_specific)
- `agreement_territories` — Many-to-many: agreement ↔ territory countries
- `agreement_targets` — Performance targets with bonus fields (bonusEnabled, bonusAmount, bonusCurrency, bonusCondition, bonusNotes)
- `target_bonus_rules` — Bonus rule definitions per target (tier_per_student, flat_on_target, country_bonus, tiered_flat)
- `target_bonus_tiers` — Tier ranges for bonus rules (min/max students, amount, calculation type)
- `target_bonus_country` — Country-specific bonus entries
- `agreement_commission_rules` — Flexible commission configuration
- `agreement_contacts` — Provider contacts for renewals
- `agreement_documents` — Versioned document uploads
- `audit_logs` — System activity tracking

## Default Users (Seeded)
- **Super Admin**: admin@studyinfocentre.com / admin123
- **Viewer**: viewer@studyinfocentre.com / viewer123
- **Editor**: editor@studyinfocentre.com / editor123

## API Endpoints
- `GET/POST /api/providers` — Provider CRUD with duplicate checking
- `PATCH /api/providers/:id` — Update provider
- `GET/POST /api/agreements` — Agreement CRUD with territory support
- `POST /api/agreements` — accepts `territoryType` and `territoryCountryIds[]`
- `GET/POST /api/agreements/:id/targets` — Target CRUD with period validation + duplicate check
- `GET/POST /api/targets/:id/bonus-rules` — Bonus rule management with tier/country entries
- `POST /api/bonus/calculate` — Bonus preview calculator (accepts targetId, studentCount)
- `DELETE /api/bonus-rules/:id` — Delete bonus rule

## Project Structure
```
client/src/
  components/
    agreement/        # Agreement detail tab components (overview, commission, targets, contacts, docs, audit)
    app-sidebar.tsx   # Main navigation sidebar
    ui/               # shadcn/ui components
  lib/
    auth.tsx          # Auth context and hooks
    queryClient.ts    # TanStack Query setup
  pages/
    login.tsx
    dashboard.tsx
    agreements-list.tsx    # With provider country + territory country filters
    agreement-detail.tsx   # 6-tab detail view
    agreement-form.tsx     # Create/edit with inline provider add modal, multi-territory
    providers-list.tsx     # Provider management with search, filter, add/edit/view
    users-management.tsx
    audit-logs.tsx
server/
  auth.ts            # Auth middleware, session, password utilities
  db.ts              # Database connection
  routes.ts          # API endpoints with validation
  seed.ts            # Database seed data
  storage.ts         # Data access layer
shared/
  schema.ts          # Drizzle schema, types, insert schemas, constants
```
