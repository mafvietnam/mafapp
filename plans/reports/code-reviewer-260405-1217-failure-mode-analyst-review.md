# Failure Mode Analyst Review (Session 2)

**Reviewer:** Failure Mode Analyst (hostile)
**Date:** 2026-04-05
**Scope:** Full plan.md + all 8 phase files, post-Session-1 red-team updates
**Focus:** Single-VPS failure modes, cascading crashes, RAM budget integrity, CCU estimate flaws, recovery gaps

---

## Finding 1: Phase 1 Architecture Block Contradicts Validated Tier 1 Decisions

- **Severity:** Critical
- **Location:** Phase 1 (`phase-01-sp2-backend.md`), Architecture section (lines 102-107), Todo List (lines 366-383)
- **Flaw:** The architecture diagram and todo list still reference infrastructure that was explicitly removed during Validation Session 1. The architecture block shows `PrismaService (-> PgBouncer -> PostgreSQL, pool_size=50)`, `RedisService (Redis Cluster 3-node for horizontal scaling)`, and `MetricsService (Prometheus /metrics endpoint)`. The todo list includes items for "PgBouncer configured and Prisma connecting through it", "Redis Cluster running (3-node, cluster-enabled)", "Prometheus /metrics endpoint", and "Grafana dashboard for job monitoring". Meanwhile, the Key Insights section (line 24) says "No PgBouncer, no Prometheus/Grafana in SP2" and plan.md confirms Tier 1.
- **Failure scenario:** A developer reads the architecture diagram (the most authoritative section of a phase file) and deploys PgBouncer + a 3-node Redis Cluster on a 16GB VPS. Redis Cluster minimum is 3 nodes * ~2GB = 6GB. Combined with PostgreSQL, NestJS, WordPress, you blow past RAM on day one. Alternatively, Dev A reads the todo list, sees "Redis Cluster running (3-node)" as a checkbox, and spends a week configuring clustering that the plan says not to do. Either way: wasted time or OOM on first deploy.
- **Evidence:** Architecture line 102: `PrismaService (-> PgBouncer -> PostgreSQL, pool_size=50)`, line 103: `RedisService (Redis Cluster 3-node for horizontal scaling)`, line 104: `MetricsService (Prometheus /metrics endpoint)`. Todo line 368: `PgBouncer configured and Prisma connecting through it`. Todo line 369: `Redis Cluster running (3-node, cluster-enabled)`. Todo line 371: `Prometheus /metrics endpoint exposing key metrics`. Todo line 384: `Grafana dashboard for job monitoring`. Key Insights line 24: "No PgBouncer, no Prometheus/Grafana in SP2."
- **Suggested fix:** Rewrite the Phase 1 architecture block to match Tier 1: `PrismaService (direct -> PostgreSQL, pool_size=5)`, `RedisService (Redis standalone)`, remove MetricsService. Rewrite todo items to match. This is not cosmetic; contradictory architecture diagrams cause wrong deployments.

---

## Finding 2: Worker Container Contradiction — In-Process vs Separate

- **Severity:** High
- **Location:** Phase 1 (`phase-01-sp2-backend.md`), Architecture section (lines 85-89), Implementation Week 1 step 11 (line 247), Week 3 steps 25/28 (lines 304, 325), Success Criteria (line 395), Phase 3 Todo (line 78)
- **Flaw:** The architecture shows `WorkerModule (separate Docker container)` with CriticalWorker, DefaultWorker, LowWorker. Step 25 says "runs in worker container". Step 28 says cron "runs in worker container". Implementation step 11 says "BullMQ runs in-process with API (Tier 1 - no separate worker container)". Phase 3 references "Production Docker build passing (api + worker + infra)" and "production deploy: app.maf.run + api.maf.run + worker + monitoring". The plan says both in-process and separate container for the same sprint.
- **Failure scenario:** Dev A builds a separate `worker.ts` bootstrap with its own Docker service, consuming an extra 200-400MB RAM on a VPS where every MB matters. Or Dev A builds in-process and Phase 3 integration fails because the todo expects a separate worker service in docker-compose. Either path wastes a week of debugging and rework.
- **Evidence:** Architecture line 85: `WorkerModule (separate Docker container)`. Step 11 line 247: `BullMQ runs in-process with API (Tier 1)`. Step 25 line 304: `runs in worker container`. Phase 3 line 78: `PgBouncer + Redis Sentinel stable under load` (also wrong -- there is no Sentinel). Phase 3 line 85: `production deploy: app.maf.run + api.maf.run + worker + monitoring`.
- **Suggested fix:** Decide once: in-process for SP2 (Tier 1). Remove `worker.ts`, `worker.module.ts` from Files to Create. Remove "separate Docker container" from architecture. Remove "worker" from Phase 3 deploy steps. Add a scaling decision: "SP6 trigger: >10K registered -> extract workers to separate container."

---

## Finding 3: Phase 3 Integration Checks Reference Non-Existent Infrastructure

- **Severity:** High
- **Location:** Phase 3 (`phase-03-sp2-integration.md`), Day 3-4 section (lines 40-41), Day 5-7 (lines 78-79), Success Criteria (lines 89-90)
- **Flaw:** Phase 3 integration tests reference PgBouncer, Redis Sentinel, and Grafana -- none of which exist in the SP2 Tier 1 deployment. Line 40: "PgBouncer connection under load -> pool handles correctly". Todo line 78: "PgBouncer + Redis Sentinel stable under load". Line 79: "Grafana dashboards operational". Success criteria line 90: "Grafana shows healthy metrics."
- **Failure scenario:** Integration week is 5-7 days. If the team spends 2 days trying to set up PgBouncer + Redis Sentinel + Grafana because the integration checklist demands them, they burn 40% of the integration phase on infra that was explicitly scoped out. The alternative -- skipping these checklist items -- means the phase is never "complete" by its own success criteria, eroding trust in the plan.
- **Evidence:** Phase 3 line 40: `PgBouncer connection under load -> pool handles correctly`. Line 78: `PgBouncer + Redis Sentinel stable under load`. Line 79: `Grafana dashboards operational`. Line 90: `Grafana shows healthy metrics`.
- **Suggested fix:** Rewrite Phase 3 to reflect actual Tier 1 infra. Replace PgBouncer test with "Prisma direct connection pool (5) stable under simulated load". Remove Redis Sentinel. Replace Grafana checks with "structured JSON log output verified, docker logs queryable." Update success criteria accordingly.

---

## Finding 4: CCU Analysis Ignores WebSocket Memory Under Failure Conditions

- **Severity:** High
- **Location:** `plan.md`, VPS Capacity & CCU Analysis section (lines 212-253), SP7 RAM Budget (lines 186-196)
- **Flaw:** The CCU table shows SP6 at 1,000-1,500 peak CCU with "WS memory" as bottleneck, and the SP7 RAM budget allocates 800MB for NestJS including WebSocket connections. The plan estimates ~50KB per WebSocket connection (line 179). At 3,000 CCU (the stated ceiling), WebSocket memory alone is 3,000 * 50KB = 150MB -- looks fine. But this estimate ignores: (a) zombie connections that fail to close (mobile users losing signal, app backgrounded), (b) reconnect storms after a NestJS restart where all 3,000 clients reconnect simultaneously, (c) per-connection buffers in Node.js event loop during message fan-out. Real-world WebSocket memory is 2-5x the naive per-connection estimate due to buffered messages, serialization overhead, and GC pressure.
- **Failure scenario:** SP6 launches with 1,500 active WebSocket connections. A deploy restarts NestJS. All 1,500 clients reconnect within 5 seconds. Each connection allocates buffers, auth handshake state, Redis pub/sub subscription. Memory spikes from 800MB to 2-3GB transiently. Node.js GC cannot keep up. NestJS OOMs. Docker restarts it. All clients reconnect again. Infinite restart loop. Meanwhile, the API is unavailable for HTTP requests too because WebSocket and HTTP share the same NestJS process.
- **Evidence:** plan.md line 179: `Per-connection memory (~50 KB/conn)`. Line 238: `SP6 peak CCU 1,000-1,500, WS memory bottleneck`. Line 191: `NestJS API 800 MB (+300 MB WebSocket connections + modules)`. No mention of reconnect storms, zombie connection cleanup, or WebSocket process isolation.
- **Suggested fix:** (1) Add Docker `mem_limit` on NestJS container so OOM kills the container, not the whole box. (2) Add reconnect backoff requirement: clients must use exponential backoff (1s, 2s, 4s, 8s) on disconnect, not instant reconnect. (3) Plan to separate WebSocket gateway from HTTP API at SP6 (two NestJS processes) so a WS OOM does not kill HTTP. (4) Add a connection limit hard cap (e.g., 2,000 WS connections, reject beyond that with 503).

---

## Finding 5: No OOM Protection Strategy for Shared VPS

- **Severity:** Critical
- **Location:** `plan.md`, VPS Capacity section (lines 212-253), all phase Docker references
- **Flaw:** The plan shows 77% headroom at SP7 peak (3.7GB used / 16GB total). This looks comfortable. But there is no Docker memory limit (`mem_limit`) specified for any container except a passing mention in Phase 1 Risk Assessment for worker OOM. Without memory limits, a single runaway process (PostgreSQL vacuum on a large table, a BullMQ job processing a malformed 500MB Strava response, a Redis `KEYS *` in production, or Node.js memory leak from unclosed streams) will consume all 16GB, triggering the Linux OOM killer. The OOM killer's victim selection is unpredictable -- it might kill PostgreSQL (data corruption risk), Redis (session loss, job loss), or WordPress (maf.run down).
- **Failure scenario:** A user connects Strava with 5 years of history. The bulk sync job fetches all activities. Strava returns paginated responses, each held in memory for parsing. Node.js accumulates 4GB of parsed JSON. No mem_limit. The kernel OOM killer targets PostgreSQL (highest RSS). PostgreSQL dies mid-transaction. The WAL is corrupted. On restart, PostgreSQL refuses to start without manual recovery. maf.run (WordPress) is also down because MySQL shares the same VPS and the OOM event destabilized I/O. The entire platform is offline.
- **Evidence:** plan.md shows RAM budgets but no `mem_limit` directives. Phase 1 line 409: "Docker memory limits" mentioned only in risk assessment for worker OOM, not in implementation steps. No `deploy.resources.limits.memory` in any docker-compose reference. No Linux `vm.overcommit_memory` or `oom_score_adj` configuration.
- **Suggested fix:** Add mandatory Docker `mem_limit` for every container in the docker-compose implementation steps: NestJS 1GB, PostgreSQL 2GB, Redis 2GB (matching maxmemory), WordPress+MySQL 1.5GB. Set `oom_score_adj` to protect PostgreSQL (lowest score = last to be killed). Add to Phase 1 Week 1 as a concrete implementation step, not a risk mitigation afterthought.

---

## Finding 6: PostgreSQL Shared by WordPress (MySQL?) and NestJS -- Conflicting Claims

- **Severity:** Medium
- **Location:** `plan.md` RAM Budget tables (lines 44-53, 99-112), Architecture section (line 289)
- **Flaw:** The RAM budget shows "WordPress + MySQL" as a single line item (800MB). The architecture shows PostgreSQL 15 as the NestJS database. But N8N was using PostgreSQL, not WordPress. WordPress uses MySQL/MariaDB. The plan conflates two different database engines on the same VPS without acknowledging it. The pre-SP2 budget shows PostgreSQL 500MB (for N8N). The SP2 budget shows PostgreSQL 500MB (for maf DB). But MySQL for WordPress is hidden inside the "WordPress + MySQL 800MB" line. The total database footprint is actually PostgreSQL 500MB + MySQL ~300MB = 800MB in databases alone, not 500MB.
- **Failure scenario:** This is less about immediate failure and more about RAM budget integrity. If the budget is wrong by 300MB, the "77% headroom" claim is slightly inflated. More concerning: when PostgreSQL and MySQL both compete for disk I/O on the same NVMe, checkpoint operations overlap, causing I/O spikes that slow both databases. The plan does not account for I/O contention at all -- only RAM and CPU.
- **Evidence:** plan.md line 48: `WordPress + MySQL ~800 MB`. Line 49: `PostgreSQL 15 ~500 MB (N8N data, repurposed in SP2)`. Line 106: `PostgreSQL 15 500 MB (maf DB, dedicated)`. No mention of MySQL continuing to run separately. No I/O contention analysis.
- **Suggested fix:** Explicitly list MySQL/MariaDB as a separate line item in RAM budgets. Add a note about disk I/O contention between PostgreSQL and MySQL. Consider whether PostgreSQL innodb_buffer_pool_size and PG shared_buffers need tuning to avoid I/O storms during concurrent checkpoint/vacuum operations.

---

## Finding 7: Strava Bulk Sync at 1,000 Users Exceeds Daily API Budget

- **Severity:** High
- **Location:** `plan.md` Strava API Budget (lines 93-97), Phase 1 Step 26 (lines 316-319)
- **Flaw:** The plan states: "At <1K users: ~1 sync/user/day = ~1,000 req/day (within budget)." But Phase 1 step 26 says initial bulk sync fetches "last 3 months, paginated, ~30 API calls" per user. When a new user connects Strava, the bulk sync alone costs 30 API calls. If 34 users connect on the same day (realistic for a launch event or community post), that is 34 * 30 = 1,020 API calls, consuming the entire daily budget. No other API calls (token refresh, activity detail fetches, manual re-syncs) can happen for the rest of the day. The "1 sync/user/day" estimate only applies to incremental sync via webhooks (which are free). The onboarding day for any batch of users will blow the budget.
- **Failure scenario:** You announce the beta on your MAF running community (say, a Facebook group). 100 people sign up on day one. Each triggers a bulk sync of 30 API calls. Total: 3,000 API calls. You hit the 1,000/day limit after the first 33 users. The remaining 67 users see "Strava sync failed" on their first experience. They leave, never return. You have 15-minute rate limits too: 100/15min means only ~3 bulk syncs can run per 15-minute window. At that rate, syncing 100 users takes 100/3 * 15min = ~8 hours, assuming zero other API usage.
- **Evidence:** plan.md line 97: `~1 sync/user/day = ~1,000 req/day (within budget)`. Phase 1 line 317: `syncInitial(userId) -> queue bulk fetch (last 3 months, paginated, ~30 API calls)`.
- **Suggested fix:** (1) Acknowledge that onboarding days are budget-hostile. Plan for staggered sync: queue initial syncs with delay between users, process over multiple days if needed. (2) Add a "sync pending" UI state so users know their data is coming. (3) Consider reducing initial sync to 1 month (10 API calls) instead of 3 months. (4) Add budget reservation: reserve 200/day for token refresh + webhook enrichment, leaving 800/day for bulk sync = max 26 new user bulk syncs per day.

---

## Finding 8: Rollback Plan Assumes Clean Docker State That Deployment Breaks

- **Severity:** High
- **Location:** Phase 3 (`phase-03-sp2-integration.md`), Day 5-7 section (lines 62-64)
- **Flaw:** The rollback plan says: "Keep old docker-compose.yml as `docker-compose.old.yml`. If API fails: revert tunnel config, `docker-compose -f docker-compose.old.yml up -d`." But the old compose file references N8N services, which were removed and whose Docker images/volumes were cleaned up in Phase 1 Step 8. Rolling back to docker-compose.old.yml would try to start N8N, which no longer has its image or data volumes. Additionally, if a Prisma migration has run and created new tables/columns, rolling back the API code without rolling back the database leaves the DB in a forward-migrated state that the old code does not understand.
- **Failure scenario:** SP2 deploy goes wrong. API crashes on boot. Team runs `docker-compose -f docker-compose.old.yml up -d`. N8N image is gone (cleaned up). Docker pulls N8N:latest which is a different version. N8N tries to start with no database (archived/dropped). WordPress is fine but api.maf.run points to nothing because the old compose does not have NestJS. You are now in a state where neither the old nor new stack works. The DB has been migrated forward with Prisma but there is no Prisma downgrade migration planned.
- **Evidence:** Phase 3 line 63: `If API fails: revert tunnel config, docker-compose -f docker-compose.old.yml up -d`. Phase 1 step 8 line 238-242: `Remove N8N service from docker-compose.yml ... Archive N8N database ... then optionally drop`.
- **Suggested fix:** (1) Rollback compose should be a pre-SP2 snapshot of the compose WITHOUT N8N (i.e., a minimal compose that only runs WordPress+MySQL+Nginx+Cloudflared -- the services that existed before SP2 minus N8N). (2) Add Prisma `migrate resolve` or `migrate down` steps for DB rollback. (3) Tag Docker images with version (`maf-api:sp2-v1`) so rollback uses a known image, not latest. (4) Test the rollback procedure on staging before production deploy.

---

## Finding 9: Mentor Data Access Has No Authorization Boundary

- **Severity:** High
- **Location:** Phase 7 (`phase-07-sp6-mentoring.md`), Dev A Backend section (lines 18-37)
- **Flaw:** The plan says trainers get "shared data access: trainer reads trainee's activities, dashboard, nutrition." The API endpoints listed include `GET /mentoring/trainees` (trainer's trainee list with stats). But there is no mention of authorization enforcement: what prevents Trainer A from accessing Trainee B's data if Trainee B is assigned to Trainer C? The endpoint `GET /messages/:userId` takes a userId parameter -- can any authenticated user read any other user's messages by guessing UUIDs? There is no mention of row-level security, relationship validation, or scoped data access.
- **Failure scenario:** A malicious user registers as a trainer (the plan says auto-verification based on 6 months of activity data, which is easily achievable). They call `GET /messages/:userId` with other users' IDs. They read private mentoring conversations. They call internal dashboard endpoints with trainee IDs they are not assigned to. GDPR/privacy violation: users' health data (HR, weight, nutrition logs) exposed to unauthorized trainers.
- **Evidence:** Phase 7 line 22: `Shared data access: trainer reads trainee's activities, dashboard, nutrition`. Line 34: `GET /messages/:userId - conversation history`. No mention of `@CurrentUser` guard, relationship validation, or authorization middleware.
- **Suggested fix:** Add explicit authorization requirement: every mentoring/messaging endpoint MUST verify the requesting user has an active mentoring relationship with the target user. Add to the plan: "Authorization middleware: verify `mentoring_relationships` table has active row linking trainer<->trainee before allowing data access. Reject with 403 otherwise." For messages, scope to conversation participants only.

---

## Finding 10: No Database Backup Automation or Disaster Recovery Plan

- **Severity:** Critical
- **Location:** `plan.md` Risk Assessment (lines 378-391), Phase 3 (line 50)
- **Flaw:** The only backup mention in the entire plan is Phase 3 line 50: "Backup PostgreSQL before any migration: `pg_dump maf > backup-pre-sp2.sql`." This is a one-time manual backup before the first deploy. There is no automated backup schedule. There is no backup for Redis (sessions, cache, BullMQ jobs). There is no backup for WordPress/MySQL. There is no off-VPS backup destination (the backup file sits on the same NVMe as the data). There is no backup verification (restore test). There is no RTO/RPO target. For a platform storing user health data, Strava tokens (encrypted), training history, and mentoring conversations, this is a data loss time bomb.
- **Evidence:** Phase 3 line 50: `pg_dump maf > backup-pre-sp2.sql`. No other backup mentions in any phase file. plan.md Risk Assessment mentions no backup/recovery row. No cron-based backup job in Phase 1 CronService (line 325-329 lists token refresh, stats aggregation, cleanup, weekly re-sync -- no backup).
- **Suggested fix:** Add to Phase 1 Week 1: automated daily backup cron. Minimum: (1) `pg_dump maf` daily, retained 7 days, stored to a separate location (even a different directory is better than nothing; ideally rsync to a second server or object storage). (2) Redis RDB snapshot (already default, but verify `save` config). (3) MySQL dump for WordPress. (4) Add backup verification: weekly restore test to a scratch database. (5) Define RPO: "max 24h data loss acceptable for beta." Add this as a concrete implementation step, not a risk row.

---

## Summary

| # | Finding | Severity |
|---|---------|----------|
| 1 | Phase 1 architecture contradicts Tier 1 (PgBouncer, Redis Cluster, Prometheus still present) | Critical |
| 2 | Worker in-process vs separate container contradiction | High |
| 3 | Phase 3 integration tests reference non-existent infra | High |
| 4 | WebSocket reconnect storms not accounted in CCU/RAM estimates | High |
| 5 | No Docker mem_limit on any container -- OOM killer picks victims randomly | Critical |
| 6 | MySQL (WordPress) not listed separately in RAM budget; I/O contention ignored | Medium |
| 7 | Strava bulk sync on launch day blows entire daily API budget | High |
| 8 | Rollback plan references removed N8N stack, no DB migration rollback | High |
| 9 | Mentor data access has no authorization boundary | High |
| 10 | No automated backups, no off-VPS storage, no restore testing | Critical |

**3 Critical, 6 High, 1 Medium. Zero findings from Session 1 overlap -- all 10 are new.**

Session 1 fixed the obvious issues (rate limit inconsistency, plaintext tokens, missing PKCE). This session targets the structural contradictions introduced by partial plan updates and the operational gaps that only surface on deploy day or under real load.
