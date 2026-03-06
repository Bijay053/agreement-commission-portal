# University Agreement & Commission Management Portal

## Overview
A secure internal portal for managing University Agreements with role-based access control, commission tracking, target management, document handling, and audit logging.

## Architecture
- **Frontend**: React + TypeScript + Vite, using shadcn/ui components, wouter for routing, TanStack Query for data fetching
- **Backend**: Express.js (Node.js), session-based auth with bcryptjs password hashing
- **Database**: PostgreSQL with Drizzle ORM
- **Storage**: Local file uploads via multer

## Key Features
- Session-based authentication with role-based permissions
- Dashboard with expiring agreements and recent activity
- Full CRUD for agreements with metadata, commission rules, targets, contacts, documents
- Fine-grained RBAC with 24 permission codes across 6 roles
- Audit logging for all key actions
- Territory/country-based agreement organization

## Data Model
- `countries` - Reference table for territories
- `universities` - University/provider records
- `users` - System users with password hashing
- `roles`, `permissions`, `role_permissions`, `user_roles` - RBAC tables
- `agreements` - Core agreement records with status, dates, territory
- `agreement_targets` - Performance targets per agreement
- `agreement_commission_rules` - Flexible commission configuration
- `agreement_contacts` - University contacts for renewals
- `agreement_documents` - Versioned document uploads
- `audit_logs` - System activity tracking

## Default Users (Seeded)
- **Super Admin**: admin@studyinfocentre.com / admin123
- **Viewer**: viewer@studyinfocentre.com / viewer123
- **Editor**: editor@studyinfocentre.com / editor123

## Project Structure
```
client/src/
  components/
    agreement/        # Agreement detail tab components
    app-sidebar.tsx   # Main navigation sidebar
    ui/               # shadcn/ui components
  lib/
    auth.tsx          # Auth context and hooks
    queryClient.ts    # TanStack Query setup
  pages/
    login.tsx
    dashboard.tsx
    agreements-list.tsx
    agreement-detail.tsx
    agreement-form.tsx
    users-management.tsx
    audit-logs.tsx
server/
  auth.ts            # Auth middleware, session, password utilities
  db.ts              # Database connection
  routes.ts          # API endpoints
  seed.ts            # Database seed data
  storage.ts         # Data access layer
shared/
  schema.ts          # Drizzle schema, types, insert schemas
```
