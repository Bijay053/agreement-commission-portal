# Technical Improvement Plan
## Agreement & Commission Management Portal — Security Hardening, Reliability & Operational Maturity

**Prepared:** March 2026
**Current Stack:** Node.js/Express + TypeScript, PostgreSQL, AWS S3, Docker, EC2
**Production URL:** https://portal.studyinfocentre.com

---

## Executive Summary

The portal has a solid functional foundation with PostgreSQL as the source of truth, fine-grained RBAC, comprehensive audit logging, S3 document storage with server-side encryption, and Docker-based deployment. This plan addresses the gaps in production hardening across seven priority areas, organized into four implementation phases.

**Estimated total effort:** 8–12 development days across all phases.

---

## Current State Assessment

### What's Already Working Well
| Area | Current Implementation |
|---|---|
| Sessions | PostgreSQL-backed via `connect-pg-simple` (persistent, not in-memory) |
| Authentication | Email/password + OTP two-factor authentication |
| Session cookies | `httpOnly`, `sameSite: lax`, `secure` in production |
| RBAC | 60+ fine-grained permissions, checked per route via `requirePermission()` |
| Audit logging | Comprehensive — login, document actions, user management, agreements |
| File validation | Multer with 50MB limit, PDF/DOC/DOCX filter |
| File storage | S3 with AES256 server-side encryption |
| Download protection | qpdf password encryption on PDF downloads, no-cache headers, nosniff |
| Login protection | Map-based tracker: 5 failed attempts → 15-minute lockout |
| Password reset protection | IP-based rate limiting: 5 requests per 15 minutes |
| OTP protection | Max 5 verification attempts, max 3 resends |
| Deployment | Docker multi-stage build, docker-compose with PostgreSQL health checks |
| Proxy trust | `trust proxy` enabled in production for secure cookies behind reverse proxy |

### Gaps to Address
| Area | Gap |
|---|---|
| Security headers | No `helmet` middleware for HTTP security headers |
| CSRF protection | Relies solely on `sameSite` cookies — no token-based CSRF |
| Global rate limiting | Only login and forgot-password have rate limits |
| Request size limits | `express.json()` has no explicit size limit |
| Schema validation | Not all API routes validate request bodies with Zod |
| Reverse proxy / TLS | No Nginx in Docker; external setup is optional and manual |
| App health check | No health check endpoint for the application service |
| Monitoring | Console logging only — no Sentry, no structured logging |
| Signed URLs | Server proxies all S3 file access instead of using signed URLs |
| Virus scanning | No malware scanning on uploaded files |
| Background jobs | `setInterval`-based scheduler, no job queue |
| CDN | No CloudFront for document delivery |

---

## Phase 1: API Security & Input Validation
**Priority:** Critical
**Effort:** 2–3 days
**Risk:** Low (additive changes, no data migration)

### 1.1 Security Headers — Helmet Middleware

**What:** Add `helmet` to set HTTP security headers on all responses.

**Implementation:**
- Install `helmet` package
- Add to Express middleware chain in `server/index.ts` before routes
- Configure Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security, Referrer-Policy

**Headers applied:**
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 0
Strict-Transport-Security: max-age=31536000; includeSubDomains
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'
```

**Files:** `server/index.ts`
**Effort:** 0.5 hours

### 1.2 Global Rate Limiting

**What:** Apply rate limiting to all API endpoints, with stricter limits on authentication routes.

**Implementation:**
- Install `express-rate-limit` package
- Global limit: 100 requests per minute per IP
- Auth endpoints (`/api/auth/*`): 10 requests per minute per IP
- Document endpoints: 30 requests per minute per IP
- Replace existing Map-based login tracker with the centralized rate limiter

**Note:** For Phase 2 (Redis), the rate limiter store will be upgraded from in-memory to `rate-limit-redis` for multi-instance support.

**Files:** `server/index.ts`, `server/routes.ts`
**Effort:** 2 hours

### 1.3 CSRF Protection

**What:** Add double-submit cookie CSRF protection for state-changing requests.

**Implementation:**
- Install `csrf-sync` package (synchronizer token pattern)
- Generate CSRF token on session creation, serve via a `/api/auth/csrf-token` endpoint
- Frontend sends token in `X-CSRF-Token` header on POST/PUT/PATCH/DELETE requests
- Validate token server-side on all mutating endpoints
- Exempt: login, OTP verification (pre-session endpoints)

**Files:** `server/auth.ts`, `server/index.ts`, `client/src/lib/queryClient.ts`
**Effort:** 3 hours

### 1.4 Request Body Size Limits

**What:** Enforce explicit body size limits on `express.json()` and `express.urlencoded()`.

**Implementation:**
- Set `express.json({ limit: '1mb' })` globally
- Set `express.urlencoded({ limit: '1mb', extended: false })`
- Multer already handles file upload limits (50MB for documents, 10MB for CSV)

**Files:** `server/index.ts`
**Effort:** 0.5 hours

### 1.5 Comprehensive Zod Validation on All Routes

**What:** Ensure every API endpoint that accepts user input validates the request body, params, and query with Zod schemas.

**Current coverage:** Login, user creation, some agreement routes.
**Missing coverage:** Agreement updates, commission tracker entries, contact management, target management, bonus rules, document metadata, bulk operations.

**Implementation:**
- Audit every POST/PUT/PATCH route in `server/routes.ts`
- Create Zod schemas for each endpoint using existing Drizzle insert schemas where possible
- Add `.safeParse()` validation with proper error responses (400 + field-level errors)
- Validate URL params (`:id` as positive integer) and query strings

**Files:** `server/routes.ts`, `shared/schema.ts`
**Effort:** 6–8 hours

### 1.6 Authentication/Permission Audit

**What:** Verify every API endpoint has proper auth and permission checks.

**Implementation:**
- Audit all routes in `server/routes.ts` to confirm:
  - Every route has `requireAuth` middleware (except public auth endpoints)
  - Every route has appropriate `requirePermission()` checks
  - The global `requireActivePassword` middleware covers all protected routes
- Add automated test to verify no unprotected routes exist

**Files:** `server/routes.ts`
**Effort:** 2 hours

### Phase 1 Rollback Strategy
All changes are additive middleware. Rollback by removing the middleware from the chain and redeploying. No database changes required.

---

## Phase 2: Infrastructure Stability (Redis, Nginx, TLS)
**Priority:** High
**Effort:** 2–3 days
**Risk:** Medium (infrastructure changes, requires Docker and deployment updates)

### 2.1 Redis Integration

**What:** Add Redis for rate limiting store, caching, and future horizontal scaling support.

**Note:** Sessions already use PostgreSQL via `connect-pg-simple`, which is reliable and appropriate for the current scale. No need to migrate sessions to Redis unless scaling demands it.

**Implementation:**
- Add Redis service to `docker-compose.yml`
- Install `ioredis` package
- Create `server/redis.ts` with connection management and health checks
- Upgrade `express-rate-limit` store to `rate-limit-redis`
- Add Redis-based caching for frequently-accessed data:
  - Permission lookups (per-user, 5-minute TTL)
  - Country/provider lists (10-minute TTL)
  - Dashboard statistics (1-minute TTL)

**Docker-compose addition:**
```yaml
redis:
  image: redis:7-alpine
  restart: unless-stopped
  command: redis-server --requirepass ${REDIS_PASSWORD} --maxmemory 256mb --maxmemory-policy allkeys-lru
  volumes:
    - redis_data:/data
  healthcheck:
    test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
    interval: 5s
    timeout: 3s
    retries: 5
```

**Files:** `docker-compose.yml`, `server/redis.ts`, `server/index.ts`, `server/routes.ts`
**Effort:** 4–5 hours

### 2.2 Nginx Reverse Proxy in Docker

**What:** Add Nginx as a containerized reverse proxy with TLS termination, security headers, and request filtering.

**Implementation:**
- Add Nginx service to `docker-compose.yml`
- Create `nginx/nginx.conf` with:
  - TLS termination (Let's Encrypt certificates mounted from host)
  - HTTP → HTTPS redirect
  - Security headers (redundant with helmet, defense in depth)
  - Request buffering and size limits
  - Rate limiting at the edge
  - Proxy pass to the Node.js app container
  - Static asset caching headers
  - WebSocket support for Vite HMR (development only)
- Change app service to only expose port internally (remove `80:5000` mapping)
- Nginx exposes ports 80 and 443

**Nginx security configuration:**
```nginx
# Request filtering
client_max_body_size 50m;
client_body_timeout 10s;
client_header_timeout 10s;

# Security headers
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "0" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

# Block common attack paths
location ~* \.(env|git|svn|htaccess|htpasswd|ini|log|sh|sql|bak|config)$ {
    deny all;
    return 404;
}
```

**Files:** `docker-compose.yml`, `nginx/nginx.conf`, `nginx/Dockerfile`
**Effort:** 4–5 hours

### 2.3 Application Health Check Endpoint

**What:** Add a `/health` endpoint that checks database and Redis connectivity.

**Implementation:**
- Create `GET /health` endpoint (unauthenticated)
- Check: database connection (simple query), Redis connection (PING), disk space
- Return JSON with component status and response time
- Add Docker health check for app service using this endpoint
- Can be used by AWS ALB target group health checks

**Response format:**
```json
{
  "status": "healthy",
  "timestamp": "2026-03-10T08:00:00Z",
  "uptime": 86400,
  "components": {
    "database": { "status": "healthy", "responseTime": 2 },
    "redis": { "status": "healthy", "responseTime": 1 },
    "s3": { "status": "healthy" }
  }
}
```

**Files:** `server/routes.ts`, `docker-compose.yml`
**Effort:** 1–2 hours

### Phase 2 Rollback Strategy
- Redis: Remove Redis service from docker-compose, revert rate limiter to in-memory store
- Nginx: Revert docker-compose to expose app on port 80 directly
- All changes are in Docker configuration; application code changes are backward-compatible

---

## Phase 3: Monitoring & Observability
**Priority:** High
**Effort:** 2–3 days
**Risk:** Low (additive, no data changes)

### 3.1 Sentry Error Tracking

**What:** Integrate Sentry for real-time error tracking and alerting.

**Implementation:**
- Install `@sentry/node` package
- Initialize Sentry in `server/index.ts` before other middleware
- Add Sentry error handler after routes
- Configure:
  - Environment tagging (production, development)
  - Release tracking (from git commit hash or package version)
  - User context (user ID, email — no PII in breadcrumbs)
  - Performance monitoring (transaction tracing at 10% sample rate)
  - Alert rules: error spike, new error type, P95 response time

**Frontend (optional):**
- Install `@sentry/react`
- Add error boundary with Sentry reporting
- Track frontend performance (page loads, API call duration)

**Files:** `server/index.ts`, `client/src/main.tsx`
**Effort:** 3–4 hours
**Requires:** Sentry account and DSN (can use self-hosted or cloud)

### 3.2 Structured Logging

**What:** Replace console.log with structured JSON logging for machine-parseable log analysis.

**Implementation:**
- Install `pino` (fast JSON logger) and `pino-http` for Express request logging
- Create `server/logger.ts` with configured Pino instance
- Replace all `console.log`/`console.error` calls with logger methods
- Log levels: `fatal`, `error`, `warn`, `info`, `debug`, `trace`
- Include context in every log: request ID, user ID, IP, route
- Configure log rotation in Docker (JSON format for CloudWatch ingestion)

**Log format:**
```json
{
  "level": "info",
  "time": "2026-03-10T08:00:00.000Z",
  "requestId": "abc-123",
  "userId": 1,
  "method": "GET",
  "path": "/api/agreements",
  "statusCode": 200,
  "duration": 45,
  "msg": "request completed"
}
```

**Files:** `server/logger.ts`, `server/index.ts`, `server/routes.ts`, `server/auth.ts`, `server/agreement-notifications.ts`
**Effort:** 4–5 hours

### 3.3 CloudWatch Integration

**What:** Ship structured logs to AWS CloudWatch for centralized monitoring and alerting.

**Implementation:**
- Configure Docker logging driver to `awslogs` in docker-compose
- Create CloudWatch Log Group for the portal
- Set up CloudWatch Metric Filters for:
  - Error rate (level=error count)
  - Response time P95
  - Authentication failures
  - Document access events
- Create CloudWatch Alarms:
  - Error rate > 5 errors/minute → SNS notification
  - Health check failures → SNS notification
  - CPU/Memory thresholds on EC2

**Files:** `docker-compose.yml`, AWS Console configuration
**Effort:** 2–3 hours
**Requires:** AWS IAM permissions for CloudWatch

### Phase 3 Rollback Strategy
- Sentry: Remove SDK initialization; application continues without error tracking
- Structured logging: Revert to console.log (not recommended, but simple)
- CloudWatch: Remove Docker log driver configuration

---

## Phase 4: Document Security, Background Jobs & Performance
**Priority:** Medium-High
**Effort:** 2–3 days
**Risk:** Medium (S3 access pattern change, new Redis dependency for jobs)

### 4.1 Enhanced Document Security

**What:** Harden file upload validation, add virus scanning, implement signed URLs.

**Implementation:**

**a) Strict file type validation (beyond MIME type):**
- Install `file-type` package to detect file type from magic bytes (not just extension/MIME)
- Validate that file content matches declared MIME type
- Reject files with mismatched types

**b) Virus/malware scanning:**
- Option A (recommended for simplicity): Install ClamAV in a sidecar Docker container
- Option B (AWS-native): Use S3 event → Lambda → ClamAV scanning
- Scan all uploads before storing; quarantine flagged files
- Add `scanStatus` field to documents table: `pending`, `clean`, `infected`

**c) S3 signed URLs:**
- Generate short-lived signed URLs (5-minute expiry) for document viewing
- Remove server-side proxying for file viewing (reduce server load)
- Keep server-side proxying for downloads (needed for qpdf password encryption)
- Add CloudFront signed URLs when CDN is implemented

**d) Enhanced access control:**
- Log all access attempts (already done)
- Add IP allowlisting capability per user or role (optional)
- Add document access expiry (time-limited access links)

**Files:** `server/s3.ts`, `server/routes.ts`, `docker-compose.yml`, `shared/schema.ts`
**Effort:** 6–8 hours

### 4.2 BullMQ Background Job Queue

**What:** Replace `setInterval` scheduler with BullMQ for reliable, persistent background job processing.

**Implementation:**
- Install `bullmq` package (uses Redis)
- Create `server/queue.ts` with job queue setup
- Migrate notification scheduler to BullMQ repeatable job
- Add job types:
  - `agreement-expiry-check`: Daily at 8 AM (replaces setInterval)
  - `send-notification-email`: Individual email sends (retry on failure)
  - `document-virus-scan`: Async scanning after upload
  - `audit-log-cleanup`: Monthly cleanup of old audit entries (optional)
  - `report-generation`: Future — async report generation for large exports
- Add BullMQ dashboard (Bull Board) at `/admin/queues` for monitoring
- Configure retry policies: 3 retries with exponential backoff
- Configure dead letter queue for failed jobs

**Benefits:**
- Jobs survive server restarts (persisted in Redis)
- Automatic retry with backoff on failures
- Visibility into job status and history
- Foundation for scaling with separate worker processes

**Files:** `server/queue.ts`, `server/workers/`, `server/agreement-notifications.ts`, `server/index.ts`
**Effort:** 5–6 hours

### 4.3 CloudFront CDN for Document Delivery

**What:** Place CloudFront in front of S3 for secure, fast document delivery.

**Implementation:**
- Create CloudFront distribution with S3 origin
- Configure Origin Access Control (OAC) — S3 bucket only accessible via CloudFront
- Use signed URLs/cookies for access control (replace direct S3 signed URLs)
- Configure cache behaviors:
  - Documents: No caching (private, sensitive content)
  - Static assets (if any): Cache with long TTL
- Add custom error pages
- Update `server/s3.ts` to generate CloudFront signed URLs instead of S3 signed URLs

**AWS Resources:**
- CloudFront Distribution
- CloudFront Key Group (for signed URLs)
- S3 Bucket Policy update (restrict to CloudFront OAC only)

**Files:** `server/s3.ts`, AWS Console/IaC configuration
**Effort:** 3–4 hours
**Requires:** AWS CloudFront permissions, key pair for URL signing

### Phase 4 Rollback Strategy
- File validation: Revert to current MIME-only check
- ClamAV: Remove sidecar container; uploads proceed without scanning
- Signed URLs: Revert to server-side proxying
- BullMQ: Revert to setInterval scheduler (notifications continue working)
- CloudFront: Revert to direct S3 access via server proxy

---

## Implementation Timeline

| Phase | Focus | Duration | Dependencies |
|---|---|---|---|
| **Phase 1** | API Security & Validation | 2–3 days | None |
| **Phase 2** | Redis, Nginx, TLS, Health Checks | 2–3 days | Phase 1 complete |
| **Phase 3** | Sentry, Structured Logging, CloudWatch | 2–3 days | Phase 2 complete (Redis needed) |
| **Phase 4** | Document Security, BullMQ, CloudFront | 2–3 days | Phase 2 complete (Redis needed) |

**Total estimated effort:** 8–12 development days

Phases 3 and 4 can run in parallel once Phase 2 is complete.

---

## Infrastructure Changes Summary

### New Docker Services
| Service | Image | Purpose |
|---|---|---|
| Redis | `redis:7-alpine` | Rate limiting, caching, job queue |
| Nginx | `nginx:alpine` | Reverse proxy, TLS, security headers |
| ClamAV (optional) | `clamav/clamav` | Virus scanning for uploads |

### New Environment Variables
| Variable | Purpose | Phase |
|---|---|---|
| `REDIS_PASSWORD` | Redis authentication | 2 |
| `REDIS_URL` | Redis connection string | 2 |
| `SENTRY_DSN` | Sentry error tracking | 3 |
| `CLOUDFRONT_KEY_PAIR_ID` | CloudFront signed URLs | 4 |
| `CLOUDFRONT_PRIVATE_KEY` | CloudFront URL signing | 4 |
| `CLOUDFRONT_DOMAIN` | CloudFront distribution domain | 4 |

### New NPM Packages
| Package | Purpose | Phase |
|---|---|---|
| `helmet` | Security headers | 1 |
| `express-rate-limit` | API rate limiting | 1 |
| `csrf-sync` | CSRF protection | 1 |
| `ioredis` | Redis client | 2 |
| `rate-limit-redis` | Redis-backed rate limiter | 2 |
| `@sentry/node` | Error tracking | 3 |
| `pino` + `pino-http` | Structured logging | 3 |
| `file-type` | Magic byte file validation | 4 |
| `bullmq` | Background job queue | 4 |
| `@bull-board/express` | Job queue dashboard | 4 |

### Database Schema Changes
| Table | Change | Phase |
|---|---|---|
| `agreement_documents` | Add `scanStatus` column (varchar: pending/clean/infected) | 4 |

---

## Deployment Strategy

### Per-Phase Deployment Process
1. Develop and test in Replit environment
2. Push to GitHub (`main` branch)
3. On EC2: `git pull origin main`
4. Update `docker-compose.yml` with new environment variables
5. `docker-compose down && docker-compose up -d --build`
6. Verify via health check endpoint
7. Monitor logs for 30 minutes post-deploy

### Rollback Process
1. `git log` to identify previous working commit
2. `git checkout <commit> -- <files>` to revert specific files
3. `docker-compose down && docker-compose up -d --build`
4. Verify via health check endpoint

### Zero-Downtime Considerations
- Phase 1 changes (middleware) can be deployed with a simple restart
- Phase 2 changes (Redis, Nginx) require `docker-compose down` briefly
- For true zero-downtime in the future: deploy behind AWS ALB with rolling updates

---

## What This Plan Does NOT Include

The following are explicitly out of scope for this improvement plan:

- **Stack migration to Django/DRF** — The current Node.js/Express stack is functional and appropriate. A full rewrite offers no benefit proportional to the cost. All improvements in this plan are achievable within the current stack.
- **New feature development** — No new user-facing features until hardening is complete.
- **Kubernetes/ECS migration** — EC2 with Docker is appropriate for current scale. Container orchestration can be evaluated later if needed.
- **Multi-region deployment** — Single-region (ap-south-1) is sufficient for current user base.
- **OpenSearch/Elasticsearch** — PostgreSQL full-text search can be added if search becomes a need; no separate search engine required now.

---

## Decision Required

Please review this plan and confirm:
1. **Phase priority order** — Should we start with Phase 1 (security) as proposed?
2. **Sentry preference** — Cloud Sentry (sentry.io) or self-hosted?
3. **ClamAV** — Include virus scanning in Phase 4, or defer?
4. **CloudFront** — Implement in Phase 4, or defer until user base grows?

Once approved, implementation will begin with Phase 1.
