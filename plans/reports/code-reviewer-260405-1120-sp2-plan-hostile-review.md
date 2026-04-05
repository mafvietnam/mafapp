# Hostile Plan Review: MAF Platform SP2-SP7

**Reviewer:** code-reviewer (Failure Mode Analyst)
**Date:** 2026-04-05
**Scope:** plan.md, phase-01-sp2-backend.md, phase-02-sp2-frontend.md, phase-03-sp2-integration.md
**Verdict:** Multiple blocking and high-severity flaws. Plan is not safe to execute as-written.

---

## Finding 1: api.maf.run domain collision — N8N already owns it

- **Severity:** Critical
- **Location:** plan.md, Architecture section; Phase 1, Week 4 step 38; Phase 3, Day 5 step 12
- **Flaw:** The plan assigns `api.maf.run` to the new NestJS backend, but the production Cloudflare Tunnel config (`config/tunnel-config.yml`) already routes `api.maf.run` to N8N on port 5678. The plan says "add api.maf.run route" to the tunnel config (Phase 1, Files to Modify), but never mentions migrating, relocating, or sunsetting N8N.
- **Failure scenario:** The moment the tunnel config is updated, N8N becomes unreachable. Any N8N automations currently running in production (webhooks, workflows, integrations) silently break. There is no rollback step. If N8N handles any critical automation (and it exists in production Docker Compose as a primary service), this is an outage with data loss potential.
- **Evidence:** `config/tunnel-config.yml` line: `- hostname: api.maf.run` → `service: http://n8n:5678`. Plan says: "add api.maf.run route" with zero mention of N8N.
- **Suggested fix:** Decide the N8N fate explicitly: (a) move N8N to a different subdomain (e.g., `n8n.maf.run`), (b) deprecate N8N and migrate its workflows first, or (c) use a different subdomain for the NestJS API (e.g., `backend.maf.run`). Document the migration step with a rollback plan.

---

## Finding 2: PostgreSQL shared database — no schema isolation strategy

- **Severity:** Critical
- **Location:** Phase 1, Key Insights: "PostgreSQL 15 already exists (N8N uses it) — add new schemas, don't create new DB instance"
- **Flaw:** The plan co-locates MAF application tables in the same PostgreSQL instance used by N8N. But the Prisma schema in Phase 1 creates tables (User, Activity, etc.) without specifying a separate PostgreSQL schema or database. Prisma defaults to the `public` schema. N8N also uses the `public` schema. There is no namespace isolation.
- **Failure scenario:** Prisma `migrate dev` or `migrate deploy` runs against the N8N database. If table names collide (unlikely but unverified), N8N data is destroyed. More likely: Prisma's migration lock or shadow database mechanism interferes with N8N's tables. Even without collision, a bad migration rollback could drop the wrong tables. PgBouncer config points at which database? The plan doesn't specify.
- **Evidence:** Phase 1 step 3: "Set up Prisma with PostgreSQL connection (via PgBouncer)" — no mention of database name, schema name, or separation from N8N. docker-compose.yml shows: `POSTGRES_DB:-n8n`.
- **Suggested fix:** Create a dedicated PostgreSQL database (not schema) for the MAF app: `CREATE DATABASE maf;`. Use a separate PgBouncer pool entry pointing to this database. Prisma's `DATABASE_URL` must target the new database, not N8N's. Document the separation explicitly.

---

## Finding 3: Redis Cluster in Docker Compose on single VPS is operationally fragile

- **Severity:** High
- **Location:** Phase 1, Week 1, step 9; plan.md, Scaling Strategy
- **Flaw:** The plan specifies Redis Cluster (3-node) in Docker Compose on a single VPS for the Tier 1 (0-5K users) phase. Redis Cluster requires a minimum of 3 masters for quorum. Running all 3 on one host provides zero fault tolerance — any Docker restart loses quorum until all 3 are back. Additionally, cluster-mode Redis has significantly more operational complexity (slot assignment, `CLUSTER MEET`, node discovery by IP) that is error-prone in Docker networking. The plan allocates 7GB per node (21GB total) on a 16GB RAM server that also runs PostgreSQL, N8N, the API, workers, Prometheus, and Grafana.
- **Failure scenario:** During deployment, the 3 Redis containers consume 21GB+ of committed memory on a 16GB server. OOM killer starts killing containers. Even if `maxmemory` is set, the total footprint across all services exceeds host RAM. Alternatively, a Docker Compose restart causes all 3 Redis nodes to come up with different IPs, breaking cluster topology. BullMQ jobs stall, sessions are lost, and the rate limiter stops working.
- **Evidence:** plan.md: "Redis Cluster 3-node × 7 GB = 21 GB". docker-compose.yml: server is 16GB RAM. Phase 1 step 9: "redis-server --cluster-enabled yes --maxmemory 7gb".
- **Suggested fix:** For Tier 1-2, use standalone Redis (single instance, 2-4GB maxmemory). This is more than sufficient for 0-20K users. Reserve Redis Cluster for Tier 3+ when multi-VPS is available. Remove the 21GB allocation entirely for Phase 1.

---

## Finding 4: Strava rate limit numbers are internally inconsistent

- **Severity:** High
- **Location:** Phase 1, Key Insights vs. Phase 1, Week 3 step 24; plan.md, Scaling Strategy section
- **Flaw:** The plan cites three different Strava rate limits across the document:
  - plan.md line 62: "200 req/15min, 2,000 req/day"
  - Phase 1 Key Insights: "100 req/15min, 1000/day"
  - Phase 1 step 24: "200 req/15min, 2000 req/day"
  - Phase 1 step 24 rate limiter code block: "Key: strava:rate:15min → counter (200 max)" but step 92 in rate limiter module says "app-wide: 100/15min, 1000/day"
  
  These are completely different budgets (factor of 2x). The entire scaling architecture depends on this number being correct.
- **Failure scenario:** If the actual limit is 100/15min (the lower number), the budget allocation and token bucket algorithm configured for 200/15min will blow through the real limit, triggering Strava's rate-limit response (HTTP 429) and potentially getting the app's API credentials suspended. At scale, this means all 40K users lose Strava sync capability.
- **Evidence:** Phase 1 Key Insights: "Strava allows 100 req/15min, 1000/day". Phase 1 step 24: "Strava limit is 200 req/15min, 2000 req/day PER APP". These cannot both be correct.
- **Suggested fix:** Verify the actual Strava API rate limits from Strava's developer documentation (they changed in 2023). Lock a single source-of-truth number into the plan. Update all references. The correct current limits (as of 2024) are 100 requests per 15 minutes AND 1,000 requests per day for read endpoints.

---

## Finding 5: Integration phase (Phase 3) has no rollback plan and deploys to production on Day 5

- **Severity:** Critical
- **Location:** Phase 3, Day 5, steps 9-15
- **Flaw:** Phase 3 takes a brand new backend (NestJS), new auth system (WordPress OAuth), new external integration (Strava), new infrastructure services (PgBouncer, Redis, BullMQ workers, Prometheus, Grafana), and deploys all of it to production in one `docker-compose up -d` on Day 5 of a 5-day sprint. There is no staging environment, no canary, no blue-green deployment, no feature flags, and critically no rollback procedure. The existing production stack (maf-app, N8N, PostgreSQL, Cloudflare tunnel) is being modified in-place.
- **Failure scenario:** The new docker-compose.yml adds ~7 new services. One fails (e.g., PgBouncer can't connect, Redis Cluster topology broken, worker OOM). The entire `docker-compose up -d` partially succeeds — some containers running, some not. The Cloudflare tunnel config has already been changed to route api.maf.run to the new API. N8N is gone. The old frontend still works but the new auth flow doesn't. Users see broken login. Rolling back requires manually reverting docker-compose.yml, tunnel config, and hoping PostgreSQL migrations didn't corrupt anything.
- **Evidence:** Phase 3 step 11: "Deploy: `docker-compose up -d`". No mention of staging, feature flags, rollback, or backup steps anywhere in Phase 3.
- **Suggested fix:** (1) Add a staging environment (even a separate docker-compose.staging.yml on the same VPS with different ports). (2) Backup PostgreSQL before migration. (3) Deploy infrastructure services first (PgBouncer, Redis) and verify, then API, then worker, then flip the tunnel. (4) Document explicit rollback: old docker-compose.yml.bak, old tunnel config, `prisma migrate rollback` command.

---

## Finding 6: Strava OAuth tokens stored "encrypted at rest" with no specification of how

- **Severity:** High
- **Location:** Phase 1, Security Considerations; Phase 1, Week 3 step 23
- **Flaw:** The plan says "Strava tokens encrypted at rest (Prisma middleware or DB-level)" but provides no concrete implementation. The Prisma schema shows `accessToken String` and `refreshToken String` as plain strings. There is no mention of an encryption key, key rotation, or which encryption algorithm. "Prisma middleware" for encryption is a non-trivial implementation that the plan hand-waves.
- **Failure scenario:** Developer implements the schema as written (plain `String` fields), ships it. Strava OAuth tokens are stored in plaintext in PostgreSQL. A SQL injection (even via N8N if schemas aren't isolated per Finding 2), a database backup leak, or an admin access compromise exposes all users' Strava tokens. Attacker can read/write activities for every connected user.
- **Evidence:** Prisma schema: `accessToken String` / `refreshToken String` (no `@db.Bytea`, no custom type, no encryption annotation). Security section: "encrypted at rest (Prisma middleware or DB-level)" — zero implementation detail.
- **Suggested fix:** Specify the encryption approach in the implementation steps: (a) application-level AES-256-GCM encryption via Prisma middleware with key from env var, (b) document key rotation strategy, (c) add a TODO item specifically for implementing and testing token encryption before the Strava integration step.

---

## Finding 7: JWT refresh token rotation has a race condition window

- **Severity:** High
- **Location:** Phase 1, Week 2, steps 16-17
- **Flaw:** The plan specifies "Refresh token: 7-day TTL, stored in Redis (one per user, rotation on use)." Token rotation means: when a refresh token is used, it is invalidated and a new one is issued. But with a single-page app, multiple concurrent requests can trigger refresh simultaneously (e.g., two tabs, or a request retry racing with the interceptor's refresh call). The first request succeeds and rotates the token. The second request arrives with the now-invalidated old token and gets rejected — logging the user out.
- **Failure scenario:** User has dashboard open in two browser tabs. JWT expires. Both tabs simultaneously call `POST /auth/refresh` with the same refresh token. Tab 1 succeeds, gets new tokens, old refresh token invalidated. Tab 2's request arrives milliseconds later with the invalidated token — server rejects it. Tab 2 shows "session expired" and redirects to login. If the server interprets this as a token theft attempt (common in rotation schemes), it may invalidate ALL tokens for the user, logging out Tab 1 too.
- **Evidence:** Phase 1 step 17: "Refresh token: 7-day TTL, stored in Redis (one per user, rotation on use)". Phase 2 step 2: "Response interceptor: on 401 → try refresh → retry or redirect to login". No mention of race condition handling.
- **Suggested fix:** Implement a grace period for the old refresh token (e.g., 30-60 seconds after rotation, old token still accepted but returns same new token pair). Or use a refresh token family approach where the server detects reuse of a rotated token within the grace window and returns the already-issued new tokens instead of treating it as theft.

---

## Finding 8: Phase 2 frontend development against non-existent API — MSW mocks risk contract drift

- **Severity:** Medium
- **Location:** Phase 2, Risk Assessment; Phase 2, Week 1-3 (all API-dependent work)
- **Flaw:** Phase 1 (backend) and Phase 2 (frontend) run in parallel for 4 weeks. The OpenAPI spec is generated in Phase 1, Week 4, step 35-36 — the LAST week. Frontend development in Weeks 1-3 uses "mock API (MSW) with agreed types" (Phase 2 Risk Assessment). But the "agreed types" are based on a verbal/text contract, not a generated spec. The spec doesn't exist until backend Week 4.
- **Failure scenario:** Dev B builds the entire auth flow, dashboard, and activity pages against MSW mocks. Dev A's actual API returns different response shapes (e.g., nested objects vs flat, different date formats, different error response structure, pagination using `cursor` vs `offset`). Phase 3 (integration, 1 week) becomes a rewrite sprint where every `src/services/*` file needs modification. The 1-week integration window is blown.
- **Evidence:** Phase 1, step 35-36 (Week 4): "Add Swagger/OpenAPI documentation → Generate OpenAPI spec → share with Dev B for frontend types." Phase 2 Risk: "Use mock API (MSW) with agreed types; swap to real API later."
- **Suggested fix:** Move OpenAPI spec creation to Week 1 of Phase 1 (before any implementation). Define the contract first, generate types for both sides, then Dev A implements to match the spec and Dev B mocks from the spec. This is API-first design, not API-last.

---

## Finding 9: Worker OOM and bulk sync have inadequate safeguards

- **Severity:** Medium
- **Location:** Phase 1, Week 3, step 26; Risk Assessment
- **Flaw:** Bulk sync fetches "last 3 months, paginated, ~30 API calls" per user. Each activity's `rawData Json?` field stores the "full Strava response" (which can be 50-200KB per activity with stream data). For an active runner with 90 activities in 3 months, that's ~18MB of JSON parsed and held in memory in the worker. If 10 users connect simultaneously (first day of launch), that's 180MB in the worker process, plus Prisma's ORM overhead. The plan says "batch 100 activities max" and "Docker memory limits" but doesn't specify the actual Docker memory limit or how backpressure works when the limit is hit.
- **Failure scenario:** Launch day. 50 users connect Strava. 50 bulk sync jobs enter the queue. Worker picks up jobs concurrently (BullMQ default concurrency). Memory grows until Docker kills the container. Jobs are partially completed — some activities saved, some not. When worker restarts, it retries the same jobs, re-fetching already-saved activities (duplicates if stravaId unique constraint catches them, wasted API calls against the rate limit if it doesn't). Each retry burns Strava API budget.
- **Evidence:** Phase 1 step 26: "syncInitial(userId) → queue bulk fetch (last 3 months, paginated, ~30 API calls)". Risk table: "Worker OOM on bulk sync → Job timeout 30s, batch 100 activities max, Docker memory limits" — no actual memory limit value specified.
- **Suggested fix:** (1) Set explicit BullMQ concurrency to 1-2 for bulk sync jobs. (2) Specify Docker memory limit (e.g., `mem_limit: 512m`). (3) Implement resumable sync — track last synced page per user so retries don't restart from scratch. (4) Don't store full `rawData` during bulk sync; fetch stream data lazily on activity detail view.

---

## Finding 10: Phase 3 performance validation is aspirational — no load testing tool or methodology specified

- **Severity:** Medium
- **Location:** Phase 3, Day 3-4, step 7
- **Flaw:** Phase 3 mandates "Performance validation (40K-readiness)" including "simulate 100 concurrent jobs", "Redis cache hit rate > 80%", and "API p95 < 200ms". But there is no load testing tool specified (k6, artillery, locust, etc.), no test data seeding strategy (how do you get enough activities in the DB to test index performance?), no mention of where load tests run (from the same VPS? from external?), and the timeline allocates this to Day 3-4 of a 5-day sprint alongside manual E2E testing.
- **Failure scenario:** Day 3 arrives. Developers manually click through flows and declare "it feels fast." The "performance validation" checkbox gets checked without actual load testing. The system deploys to production. First 100 concurrent users hit the dashboard, the DB has no data to cache, cold-start latency is 2+ seconds, PgBouncer pool exhausts because nobody tested concurrent connections, and the Strava webhook endpoint takes >2s to respond (Strava drops the webhook subscription after repeated timeouts).
- **Evidence:** Phase 3 step 7: "Dashboard API: < 200ms (p95) with cached stats ... BullMQ throughput: simulate 100 concurrent jobs" — no tool, no script, no test data, no methodology.
- **Suggested fix:** (1) Add a specific load testing tool to the stack (k6 is lightweight, scriptable). (2) Add a data seeding step: generate 10K synthetic activities before load test. (3) Run load tests from outside the VPS (or at minimum, from a separate container). (4) Make load testing a Phase 3 prerequisite for deployment, not a same-day activity.

---

## Summary

| # | Finding | Severity |
|---|---------|----------|
| 1 | api.maf.run domain collision with N8N | Critical |
| 2 | No PostgreSQL schema isolation from N8N | Critical |
| 3 | Redis Cluster 21GB on 16GB server | High |
| 4 | Strava rate limit numbers inconsistent (100 vs 200) | High |
| 5 | Production deploy with no rollback plan | Critical |
| 6 | Token encryption hand-waved, schema stores plaintext | High |
| 7 | JWT refresh token rotation race condition | High |
| 8 | OpenAPI spec generated last, frontend builds blind | Medium |
| 9 | Worker OOM on bulk sync launch day | Medium |
| 10 | Performance validation has no tooling or methodology | Medium |

**3 Critical, 4 High, 3 Medium. Plan should not proceed without addressing Findings 1, 2, and 5 at minimum.**
