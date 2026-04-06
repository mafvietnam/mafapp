---
title: "WordPress SSO + Server-Side Storage"
description: "Add WordPress SSO login, migrate localStorage to server, build dashboard UI from mockups"
status: complete
priority: P1
effort: 2.5w
branch: dev
tags: [auth, backend, frontend, sso, dashboard]
blockedBy: [260330-1924-full-modernization-refactor]
blocks: []
created: 2026-04-06
---

# WordPress SSO + Server-Side Storage

## Overview

Transform app.maf.run from offline-only calculator into authenticated platform:
1. **WordPress SSO** — Login via maf.run WordPress account (OAuth2 PKCE)
2. **Server storage** — Migrate user profile data (age, height, weight, MAF exercise) from localStorage to PostgreSQL via NestJS API
3. **Dashboard UI** — Authenticated home page with dark theme from HTML mockups

**Out of scope:** Strava integration (separate developer), AI coaching, nutrition, challenges.

## Research Reports
- [WP OAuth + Job Systems](../reports/researcher-260405-1101-wp-oauth-job-systems.md)
- [Scaling Architecture](../reports/researcher-260405-1101-scaling-architecture-40k.md)

## Cross-Plan Dependencies

| Relationship | Plan | Status |
|-------------|------|--------|
| Blocked by | [Full Modernization Refactor](../260330-1924-full-modernization-refactor/plan.md) | completed |
| Related | [SP2-SP7 Platform](../260331-0121-maf-platform-sp2-sp7/plan.md) | pending |

> This plan implements the auth + profile subset of SP2. Strava integration from SP2 Phase 1 is handled by separate developer.

## Phases

| # | Phase | Status | Effort | Blocks |
|---|-------|--------|--------|--------|
| 1 | [Backend Foundation](./phase-01-backend-foundation.md) | Complete | 3d | - |
| 2 | [WordPress SSO](./phase-02-wordpress-sso.md) | Complete | 3d | Phase 1 |
| 3 | [User Profile API](./phase-03-user-profile-api.md) | Complete | 2d | Phase 1 |
| 4 | [Frontend Auth + Data Migration](./phase-04-frontend-auth-migration.md) | Complete | 3d | Phase 2, 3 |
| 5 | [Dashboard UI](./phase-05-dashboard-ui.md) | Complete | 3d | Phase 4 |
| 6 | [Integration & Deploy](./phase-06-integration-deploy.md) | Complete | 2d | Phase 5 |

## Dependency Graph
```
Phase 1 (backend)
  ├──> Phase 2 (SSO)  ──┐
  └──> Phase 3 (profile) ├──> Phase 4 (frontend auth) ──> Phase 5 (dashboard) ──> Phase 6 (deploy)
```

## Key Decisions
- **Backend:** NestJS + TypeScript (shared types with React frontend)
- **DB:** PostgreSQL (reuse existing container, new `maf` database)
- **Cache/Sessions:** Redis 7 standalone
- **Auth:** WordPress OAuth2 PKCE (backend-initiated), JWT RS256 (15min) + Redis refresh tokens (7d)
- **ORM:** Prisma
- **Dashboard theme:** Dark theme for authenticated pages only; public calculator stays light

## Dependencies
- WP OAuth Server plugin installed on maf.run WordPress (not yet installed — setup in Phase 2)
- RSA key pair for JWT signing
- Redis 7 Docker container

## Validation Log

### Session 1 — 2026-04-06
**Trigger:** Post-plan validation interview
**Questions asked:** 6

#### Questions & Answers

1. **[Assumption]** N8N removal — any active workflows?
   - Options: Remove N8N | Keep temporarily
   - **Answer:** No, remove N8N — not in use, frees ~2GB RAM

2. **[Dependency]** WP OAuth Server plugin status?
   - Options: Not installed | Already installed | Different auth method
   - **Answer:** Not installed yet — needs full setup in Phase 2

3. **[UX]** Profile save behavior: auto-save vs explicit?
   - Options: Explicit save button | Auto-save | Auto-save + indicator
   - **Answer:** Explicit save button — matches current Calculate flow

4. **[Scope]** Dashboard MVP widgets?
   - Options: MAF zone + profile + nav only | Full mockup | Auth only
   - **Answer:** Essential only — MAF zone card, profile page, nav shell. Other widgets as empty placeholders.

5. **[Architecture]** Monorepo vs separate repo for API?
   - Options: Same repo api/ | Separate repository
   - **Answer:** Same repo, api/ directory — shared types, simpler

6. **[Infra]** Cookie domain .maf.run confirmation?
   - Options: Yes, control maf.run | Different setup
   - **Answer:** Yes — both app.maf.run and api.maf.run under Cloudflare control

#### Confirmed Decisions
- N8N removal: confirmed safe
- WP OAuth Server: needs install from scratch in Phase 2
- Profile save: explicit save button (not auto-save)
- Dashboard MVP: minimal widgets, placeholders for future
- Architecture: monorepo (api/ directory)
- Cookie domain: .maf.run confirmed

#### Action Items
- [x] Update Phase 4: change auto-save to explicit save button
- [x] Update Phase 5: reduce dashboard scope to essential widgets only

## Red Team Review

### Session — 2026-04-06
**Reviewers:** Security Adversary, Failure Mode Analyst, Assumption Destroyer, Scope & Complexity Critic
**Findings:** 12 (11 accepted, 1 rejected)
**Severity breakdown:** 2 Critical, 6 High, 3 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Type mismatch: frontend string vs backend number | Critical | Accept | Phase 3 |
| 2 | Refresh token race condition (no mutex) | Critical | Accept | Phase 4 |
| 3 | No rate limiting on auth endpoints | High | Accept | Phase 1, 2 |
| 4 | Missing CREATE DATABASE maf step | High | Accept | Phase 1 |
| 5 | N8N removal timing risk | High | Accept | Phase 1 |
| 6 | WP OAuth PKCE assumption unvalidated | High | Accept | Phase 2 |
| 7 | Open redirect on OAuth callback | High | Accept | Phase 2 |
| 8 | Dashboard Phase 5 still over-scoped | High | Accept | Phase 5 |
| 9 | Phase 4 success criteria says "auto-save" | Medium | Accept | Phase 4 |
| 10 | Health endpoint leaks topology | Medium | Accept | Phase 1 |
| 11 | Redis 2GB overkill for beta | Medium | Accept | Phase 1 |
| 12 | Cross-origin sameSite=lax breaks POST/PUT | High | Reject | — |

**Rejection rationale (Finding 12):** app.maf.run and api.maf.run share registrable domain maf.run → same-site, not cross-site. sameSite=lax sends cookies on all same-site requests regardless of HTTP method.

**Reports:**
- [Security Adversary](../reports/code-reviewer-260406-1529-security-adversary-review.md)
- [Failure Mode Analyst](../reports/code-reviewer-260406-1529-failure-mode-review.md)
- [Assumption Destroyer](../reports/code-reviewer-260406-1530-assumption-destroyer-review.md)
- [Scope & Complexity Critic](../reports/code-reviewer-260406-1529-scope-complexity-review.md)

## Validation Log — Session 2

### Session 2 — 2026-04-06
**Trigger:** Post-red-team validation
**Questions asked:** 3

#### Questions & Answers

1. **[Architecture]** JWT cookie vs refresh token cookie — same or separate?
   - Options: Two separate cookies | JWT cookie + refresh in response body
   - **Answer:** Two separate cookies — JWT (15min maxAge) + refresh token (7-day maxAge), both httpOnly on .maf.run

2. **[Risk]** Redis restart logs out all users — acceptable for beta?
   - Options: Acceptable | Enable RDB persistence
   - **Answer:** Acceptable for beta — users re-login, no persistence needed

3. **[Execution]** Phase 2 + 3 parallel development?
   - Options: Yes, parallel | Sequential
   - **Answer:** Yes, parallel — saves ~2 days

#### Confirmed Decisions
- Two separate httpOnly cookies: `maf_access` (15min) + `maf_refresh` (7 days)
- Redis persistence: not needed for beta
- Phase 2 + 3 developed in parallel after Phase 1
