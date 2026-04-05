# Hostile Plan Review: MAF Platform SP2-SP7 (Assumption Destroyer)
**Reviewer:** code-reviewer (Assumption Destroyer perspective)  
**Date:** 2026-04-05  
**Scope:** plan.md, phase-01, phase-02, phase-03

---

## Finding 1: Strava Rate Limits Are Self-Contradictory — The Plan Will Be Built on Wrong Numbers

- **Severity:** Critical
- **Location:** Phase 1, section "Key Insights" (line 22) vs "Implementation Steps" step 24 (line 279) vs plan.md line 60
- **Flaw:** The plan uses **three different Strava rate limit numbers** across its own documents:
  - Phase 1 Key Insights: `100 req/15min, 1000/day`
  - Phase 1 Architecture RateLimiterModule: `100/15min, 1000/day`
  - Phase 1 Success Criteria: `100/15min budget allocation`
  - Phase 1 Implementation Step 24: `200 req/15min, 2000 req/day`
  - plan.md Overview: `200 req/15min, 2,000 req/day`
  
  The architecture, the rate limiter spec, and success criteria use the lower numbers (100/1000). The overview and one implementation step use the higher numbers (200/2000). Only one can be correct.
- **Failure scenario:** Dev A implements the rate limiter with the wrong constant. If built on 100/15min but actual is 200/15min, you waste 50% of available capacity. If built on 200/15min but actual is 100/15min, you exceed the limit and get 429s, blocking ALL Strava sync for the entire application. At 40K users this is a platform-wide outage.
- **Evidence:** Phase 1 line 22: `Strava allows 100 req/15min, 1000/day`; Phase 1 line 279: `CRITICAL: Strava limit is 200 req/15min, 2000 req/day`; Phase 1 line 92: `app-wide: 100/15min, 1000/day`; Phase 1 line 382: `respects 100/15min budget allocation`
- **Suggested fix:** Verify against Strava's current API docs. Correct ALL references to one consistent number. Add env-var-driven constants (`STRAVA_RATE_15MIN`, `STRAVA_RATE_DAILY`) so the numbers can be updated without code changes.

---

## Finding 2: api.maf.run Domain Collision — N8N Already Owns It

- **Severity:** Critical
- **Location:** Phase 1, "Requirements" (`NestJS API serving at api.maf.run`); Phase 3, step 12
- **Flaw:** The current production `docker-compose.yml` routes `api.maf.run` to N8N (port 5678). The tunnel config confirms: `hostname: api.maf.run → service: http://n8n:5678`. The plan assigns `api.maf.run` to NestJS without mentioning N8N's existence, migration, retirement, or coexistence. N8N has its own database dependency, webhook URLs, and automation workflows that may be in active use.
- **Failure scenario:** Tunnel route is updated to point at NestJS. N8N becomes unreachable. Any existing N8N workflows with webhook URLs at `api.maf.run/*` break silently. Alternatively, if the route is not updated, the NestJS API is unreachable and the entire SP2 backend is dead on arrival.
- **Evidence:** `docker-compose.yml` line 131: `N8N_HOST=${N8N_HOST:-api.maf.run}`; line 134: `WEBHOOK_URL=${WEBHOOK_URL:-https://api.maf.run/}`; `tunnel-config.yml` line 36: `hostname: api.maf.run → service: http://n8n:5678`
- **Suggested fix:** Explicitly plan N8N disposition: retire it, move it to `n8n.maf.run`, or path-split (`api.maf.run/n8n/*` vs `api.maf.run/v1/*`). Sequence tunnel config changes with N8N migration. This is a prerequisite for Phase 1.

---

## Finding 3: Redis Cluster 21GB Requirement Exceeds Server Capacity of 16GB

- **Severity:** High
- **Location:** Phase 1, step 9; plan.md "Resource Estimates"
- **Flaw:** The plan specifies 3-node Redis Cluster with 7GB per node = 21GB total. The production VPS has 16GB total RAM, of which the resource summary allocates ~3.8GB to existing services, leaving ~12GB. Even if all existing services are stopped, 21GB > 16GB. Redis Cluster on a single VPS also provides zero fault tolerance (all nodes fail together) and adds substantial operational complexity (cluster init, slot management, topology). For Tier 1 (0-5K users), this is pure YAGNI — a single Redis instance handles 5K users trivially.
- **Failure scenario:** Dev A runs `docker-compose up` in Week 1. Redis Cluster nodes either OOM-kill immediately or start with lower memory limits. Under load, eviction policies fight each other. Dev A spends days debugging Redis Cluster topology in Docker instead of building auth and Strava integration. The 4-week backend sprint slips by a week before any business logic is written.
- **Evidence:** plan.md line 79: `Redis Cluster: 3 nodes x 7 GB = 21 GB`; `docker-compose.yml` line 273: `Total Allocated Resources (of 16GB available)`; Phase 1 step 9: `Add Redis Cluster Docker services (3-node minimum)`
- **Suggested fix:** Start with single Redis instance (Tier 1). Abstract behind a service layer. Plan Redis Cluster migration for when user count justifies it (Tier 3, 20K+). This saves 2-3 days of Week 1 and all ongoing operational overhead.

---

## Finding 4: WordPress OAuth PKCE Is an Unvalidated Single Point of Failure on the Critical Path

- **Severity:** High
- **Location:** Phase 1, steps 14-20 ("Week 2: WordPress SSO")
- **Flaw:** The entire auth system depends on installing "WP OAuth Server" plugin on maf.run (a production WordPress site). The plan assumes: (a) free tier supports PKCE with S256, (b) plugin version 4.3.2 is compatible with maf.run's WordPress version, (c) maf.run hosting allows plugin installation, (d) no conflicting plugins exist. None of these are verified. The fallback mention is a single parenthetical: "Alternative: miniOrange OAuth if WP OAuth Server lacks features" — but miniOrange is a SaaS product with different API surface, and switching would require rewriting the auth module.
- **Failure scenario:** Dev A starts Week 2, tries to install the plugin. Discovers maf.run is on managed hosting that blocks plugin installs. Or the plugin is installed but PKCE support is Pro-tier only. The entire auth flow is blocked. Phase 2 (frontend auth) is also blocked. Phase 3 (integration) is blocked. Everything after SP2 is blocked. The project stops dead for an indeterminate time while a WordPress plugin issue is researched and resolved.
- **Evidence:** Phase 1 step 14: `Install WP OAuth Server plugin on maf.run (free tier supports Authorization Code + PKCE)` — unverified claim. Research report line 37: cites wp-oauth.com docs but doesn't confirm maf.run compatibility.
- **Suggested fix:** Add a Sprint 0 validation task (1-2 days): install plugin on a staging WordPress, confirm PKCE works end-to-end, confirm maf.run hosting allows it. If this fails, switch to fallback BEFORE committing to the 4-week plan. This is the single highest-risk dependency in the entire plan.

---

## Finding 5: Shared PostgreSQL with N8N — No Isolation, `migrate reset` Destroys Everything

- **Severity:** High
- **Location:** Phase 1, "Key Insights" line 20, steps 3-5
- **Flaw:** Plan says "PostgreSQL 15 already exists (N8N uses it) — add new schemas, don't create new DB instance." The existing database is named `n8n` (from `docker-compose.yml` line 75: `POSTGRES_DB=${POSTGRES_DB:-n8n}`). The plan never specifies whether Prisma targets a separate database or the same `n8n` database with a separate schema. Prisma's default behavior uses the `public` schema. If Prisma targets the `n8n` database, `npx prisma migrate reset` (which developers commonly run during development) drops ALL tables — including N8N's workflow data, credentials, and execution history.
- **Failure scenario:** Dev A runs `npx prisma migrate reset` during development to fix a migration issue. The command drops every table in the target database. N8N's entire workflow configuration, credentials vault, and execution history are destroyed. Recovery requires a database backup that may not exist (no backup strategy is mentioned in the plan).
- **Evidence:** Phase 1 line 20: `add new schemas, don't create new DB instance`; `docker-compose.yml` line 75: `POSTGRES_DB=${POSTGRES_DB:-n8n}`; Prisma schema has no `schema` configuration.
- **Suggested fix:** Create a separate database (`maf_app`) in the same PostgreSQL instance. Configure Prisma `DATABASE_URL` to target it. Add `.env` validation that rejects connections to the `n8n` database. Add a CI/pre-commit check that blocks `prisma migrate reset` commands.

---

## Finding 6: Phase 3 Is 3x Under-Scoped and Contains a Redis Architecture Contradiction

- **Severity:** High
- **Location:** Phase 3, all sections
- **Flaw:** Phase 3 allocates 5 days to: align API contracts, fix mismatches, E2E test all flows, performance-validate for 40K, build Docker images, set up Prometheus + Grafana, deploy to production, configure Cloudflare routes, and smoke test. This is at minimum 2-3 weeks of work, compressed into 1. Additionally, the todo list (line 68) says "PgBouncer + Redis Sentinel stable under load" while every other document specifies Redis Cluster. Sentinel and Cluster are fundamentally different architectures (Sentinel = HA failover for standalone, Cluster = sharding + HA). The inconsistency means nobody has actually thought through which Redis topology is being deployed.
- **Failure scenario:** Days 1-2 reveal API contract mismatches (inevitable after 4 weeks of parallel development without continuous integration). Days 3-4 are consumed fixing them. Day 5 arrives with no deployment, no monitoring, no performance testing. Sprint extends 2+ weeks, cascading delays into SP3/SP4. Or: Dev A deploys Redis Sentinel because the Phase 3 todo says so, while the API code expects Redis Cluster connections.
- **Evidence:** Phase 3 effort: `1 week`; Phase 3 line 68: `PgBouncer + Redis Sentinel stable under load` — contradicts all other mentions of Redis Cluster; Phase 3 step 7: `simulate 100 concurrent jobs` — this alone is a multi-day effort including test harness setup.
- **Suggested fix:** Extend to 2 weeks minimum. Add continuous contract testing during Phases 1-2 (shared OpenAPI types, weekly sync). Split deployment into its own step with a rollback plan. Fix Sentinel/Cluster contradiction globally.

---

## Finding 7: Strava Token Encryption Is a Security Spec Without a Design

- **Severity:** High
- **Location:** Phase 1, "Security Considerations" and step 23; Prisma schema
- **Flaw:** Security section says "Strava tokens encrypted at rest (Prisma middleware or DB-level)" — two fundamentally different approaches offered as parenthetical alternatives with no decision. The Prisma schema (lines 144-145) defines `accessToken String` and `refreshToken String` as plain strings with no encryption annotation. No encryption key management is specified. No key rotation strategy. The worker containers need to decrypt tokens for Strava API calls — how do they get the key? Is it an env var? Vault? Hardcoded?
- **Failure scenario:** Schema is implemented as written (plaintext). System goes to production. A database breach, accidental log exposure, or Prisma debug logging leaks every user's Strava access tokens. Strava tokens grant access to users' fitness data, GPS routes, location history, and heart rate data. At 40K users, this is a mass privacy violation.
- **Evidence:** Security section: `Strava tokens encrypted at rest (Prisma middleware or DB-level)` — no decision. Schema line 144: `accessToken String` — plaintext.
- **Suggested fix:** Decide: AES-256-GCM via Prisma middleware. Key from env var `STRAVA_ENCRYPTION_KEY`. Update schema comments. Add encryption/decryption to Week 3 implementation steps explicitly, not as a post-hoc security note.

---

## Finding 8: Launch-Day Bulk Sync Exhausts Daily Rate Limit for 50 Users

- **Severity:** High
- **Location:** Phase 1, step 26 and step 24
- **Flaw:** Step 26: `syncInitial(userId) → queue bulk fetch (last 3 months, paginated, ~30 API calls)`. If 50 users connect Strava on launch day: 50 x 30 = 1,500 API calls. Daily limit = 1,000 or 2,000 (Finding 1). At the lower limit (1,000), 33 users' initial sync consumes the entire daily budget. At the higher limit (2,000), 66 users. Remaining budget for webhook enrichment, token refresh, and manual sync: zero. The "premium/free tier" budget allocation system is irrelevant because initial sync drains everything.
- **Failure scenario:** Platform launches. Early adopters connect Strava. The rate limiter pauses after 33-66 users. Remaining users see "Connected to Strava" but zero activities for 24+ hours. The most engaged early adopters — exactly the people you want to impress — have the worst experience.
- **Evidence:** Phase 1 step 26: `last 3 months, paginated, ~30 API calls`; plan.md line 60: `200 req/15min, 2,000 req/day`; Phase 1 line 92: `app-wide: 100/15min, 1000/day`
- **Suggested fix:** Reduce initial sync to 2 weeks (not 3 months). Implement progressive loading: show webhook-derived new activities immediately, backfill history over days. Show sync progress to users. Consider requesting Strava rate limit increase before launch. Stagger launch invitations.

---

## Finding 9: Cookie Domain `.maf.run` Prevents Local Development Auth

- **Severity:** Medium
- **Location:** Phase 1 step 18; Phase 2 steps 2-3 and step 41
- **Flaw:** Phase 1 sets JWT cookie with `domain: .maf.run, secure: true`. Phase 2 uses `localhost:5173` with Vite proxy. Browsers will not set a cookie with `domain: .maf.run` when the page is served from `localhost`. The `secure: true` flag requires HTTPS, which `localhost:5173` does not serve. Dev B cannot test any authenticated flow without modifying `/etc/hosts` AND generating local TLS certificates — neither of which is mentioned in the plan.
- **Failure scenario:** Dev B starts Week 1, implements auth context, triggers login flow, callback succeeds but cookie is silently not set. They spend a day debugging before realizing the domain/TLS mismatch. They then spend another day setting up local TLS or hacking around cookie settings.
- **Evidence:** Phase 1 step 18: `Set JWT in httpOnly cookie (secure, sameSite: lax, domain: .maf.run)`; Phase 2 step 41: `vite.config.ts proxy: /api → http://localhost:3001`
- **Suggested fix:** Specify dev vs prod cookie config: dev uses `domain: localhost, secure: false`; prod uses `.maf.run, secure: true`. Document this in the API contract. Add to Phase 2 Week 1 implementation steps.

---

## Finding 10: Zero Rollback Strategy for a 10-Service Production Deployment

- **Severity:** Medium
- **Location:** Phase 3, steps 9-15 ("Day 5: Deploy + Monitor")
- **Flaw:** The deployment plan adds ~6 new services (maf-api, maf-worker, pgbouncer, redis, prometheus, grafana) to a production Docker Compose that currently runs 4 services. The plan says `docker-compose up -d` and then monitor. No rollback procedure. No blue-green. No canary. No database migration rollback. The existing `docker-compose.yml` is modified in-place (Phase 1 "Files to Modify").
- **Failure scenario:** New Docker Compose is deployed. PgBouncer fails to start (config error). maf-api health check fails (depends on PgBouncer). Cloudflare tunnel route is updated to point at unreachable maf-api. N8N route is also changed/removed (Finding 2). Both old and new services are unreachable. Dev SSHs in, the old `docker-compose.yml` is overwritten in git. Recovery requires `git stash/checkout`, rebuilding old images, and re-deploying — minimum 30+ minutes of downtime.
- **Evidence:** Phase 3 step 11: `Deploy: docker-compose up -d` — no backup, rollback, or staged deployment mentioned anywhere.
- **Suggested fix:** (1) Version the Docker Compose files (`docker-compose.v1.yml`, `docker-compose.v2.yml`). (2) Deploy new services with a separate compose file first, verify independently. (3) Update tunnel routes only after new services pass health checks. (4) Document a 5-minute rollback: `docker-compose -f docker-compose.v1.yml up -d`. (5) Tag the working git commit before deployment.

---

## Summary Table

| # | Finding | Severity |
|---|---------|----------|
| 1 | Strava rate limits self-contradictory (100/1000 vs 200/2000) | Critical |
| 2 | api.maf.run domain collision with N8N (no migration plan) | Critical |
| 3 | Redis Cluster 21GB exceeds 16GB server RAM | High |
| 4 | WordPress PKCE dependency unvalidated on critical path | High |
| 5 | Shared PostgreSQL — `migrate reset` destroys N8N data | High |
| 6 | Phase 3 is 3x under-scoped + Sentinel/Cluster contradiction | High |
| 7 | Strava token encryption specified but schema is plaintext | High |
| 8 | Launch-day bulk sync exhausts daily rate limit at ~50 users | High |
| 9 | Cookie `.maf.run` domain breaks localhost dev auth | Medium |
| 10 | No rollback plan for 10-service production deployment | Medium |

**Recommendation:** Do not begin implementation until Findings 1 and 2 are resolved. Add a Sprint 0 (2-3 days) to validate Finding 4. Address Finding 3 by simplifying to single Redis for Tier 1.
