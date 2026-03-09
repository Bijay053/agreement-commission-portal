# Agreement & Commission Management Portal

## Overview
This project is an internal portal for Study Info Centre, designed to streamline the management of partnership agreements with educational providers (universities, colleges, B2B entities). It provides robust commission tracking, target and bonus management, secure document handling, and comprehensive audit logging. The portal aims to enhance operational efficiency, ensure compliance, and provide a secure, role-based access environment for sensitive business data. The business vision is to centralize and automate agreement lifecycle management, reducing manual overhead and improving data accuracy for financial reconciliation and strategic planning.

## User Preferences
I prefer clear, concise communication. When making changes, please outline the proposed modifications and explain the reasoning before execution. For new features or significant architectural decisions, I expect detailed explanations. Do not make changes to files outside the `client/src` and `server/` directories unless explicitly instructed. Prioritize secure and maintainable code.

## System Architecture
The portal adopts a client-server architecture. The frontend is built with **React, TypeScript, and Vite**, utilizing `shadcn/ui` for a modern, consistent UI, `wouter` for routing, and `TanStack Query` for efficient data fetching. The backend is powered by **Express.js (Node.js)**, implementing session-based authentication with `bcryptjs` for secure password hashing. **PostgreSQL** serves as the primary database, managed through the **Drizzle ORM**. Local file uploads are handled via `multer`.

Key architectural decisions and features include:
- **Role-Based Access Control (RBAC)**: Fine-grained permissions (`module.resource.action`) control UI elements, route access, and API endpoints. Roles are managed dynamically via an admin UI.
- **Secure Authentication & Session Management**:
    - Session-based authentication with robust password policies (12+ chars, complexity, 90-day forced change, history check).
    - Token-based "Forgot Password" functionality.
    - Mandatory Email OTP Verification for every login (6-digit, 5-min expiry, rate-limited).
    - Inactivity auto-logout with warnings.
    - Comprehensive session tracking (device, browser, IP) and active session management (logout specific/all other sessions).
    - Security audit logging for all authentication-related events.
- **Agreement Management**: Full CRUD operations for agreements, including metadata, commission rules, targets, contacts, and documents. Supports multi-territory agreements (Global or Country-Specific).
- **Commission & Bonus Management**:
    - Flexible commission rule configuration per agreement.
    - Advanced Target Bonus System with various structures (per-student tier, flat, country-based, tiered flat).
    - Global "Commission & Bonus Master Table" for comprehensive overview and filtering.
- **Commission Tracker v2**: Spreadsheet-style student enrollment tracking with dynamic terms (T1_YYYY, T2_YYYY), year-based navigation. Features separate **Dashboard** (provider-wise analytics, intake filter, per-term commission/bonus student list), **Master** (editable student table with add/delete), and **T1/T2/T3** term tabs. Includes mandatory `Agentsic ID`, duplicate prevention, bulk CSV upload with preview/validation, auto-calculated commissions and payments with cascade logic, and multi-provider row merging (rowspan for shared student info).
- **Sub-Agent Commission**: Tracks commission paid to sub-agents from SIC-received commission. Mirrors main commission tracker students with sub-agent-specific rate, GST, payment tracking per term. Features: auto-sync from main tracker, per-term editable Fee (Net), commission rate auto/override, bonus, GST, payment status (Invoice Waiting/PO Send/Payment Made/Hold), margin and overpay warnings, status color coding, **intake filter** (All/T1/T2/T3), and enhanced dashboard with 5 summary cards (Total Agents, Total Students, Total Paid, Total Pending, Total Margin) plus agent-wise student/commission breakdown. Hard rule: sub-agent commission cannot exceed main commission per term. Database tables: `sub_agent_entries`, `sub_agent_term_entries`. Permission module: `sub_agent_commission`.
- **Document Management**: Secure document viewer with blob URL rendering, watermarking (Confidential, user email, timestamp), disabled right-click/print/download (unless permitted), and detailed audit logging for view/download actions.
- **UI/UX**: Consistent design using `shadcn/ui` components. Features like searchable dropdowns, global filter reset buttons, and sidebar status sub-menus enhance usability.
- **Multi-Provider Students**: Each student profile can have multiple providers and student IDs. Primary provider is stored on `commission_students`, additional providers in `student_providers` table. The UI shows a "+" button in the provider cell to add more providers, and additional providers appear in blue text below the primary.
- **Data Integrity**: Duplicate prevention implemented for providers, targets, and agreements (using Student Name + Agentsic ID + Provider combo). Period key validation (YYYY, YYYY-MM, T1-YYYY) ensures data consistency.
- **Agreement Expiry & Renewal Reminder System**: Automated daily cron job (08:00 AM) checks all agreements and sends email notifications at 90, 60, 30, 14, and 7 days before expiry. Also sends expired-agreement alerts and renewal-delay reminders (every 7 days if status is "Renewal in Progress" and expired). Email templates follow branded formatting with urgency levels. Notifications are logged to `agreement_notifications` table with deduplication. Dashboard includes "Agreement Alerts" tab (filterable by urgency, provider, country) and "Notification Log" tab. Manual "Run Check Now" button available for admins. Recipients: au@studyinfocentre.com, info@studyinfocentre.com, partners@studyinfocentre.com.
- **Audit Logging**: Comprehensive logging for all key actions, including role/permission changes, document access, and security events, tracking user, IP, user agent, and metadata.

## External Dependencies
- **PostgreSQL**: Primary database for all application data.
- **Node.js (Express.js)**: Backend runtime and framework.
- **React**: Frontend library.
- **Vite**: Frontend build tool.
- **TypeScript**: Superset of JavaScript used across frontend and backend.
- **Drizzle ORM**: Object-Relational Mapper for PostgreSQL.
- **bcryptjs**: Library for password hashing.
- **multer**: Node.js middleware for handling `multipart/form-data`, primarily for file uploads.
- **shadcn/ui**: Component library for React.
- **wouter**: Small routing library for React.
- **TanStack Query (React Query)**: Data fetching and caching library.
- **cmdk**: Command palette component used in searchable dropdowns.