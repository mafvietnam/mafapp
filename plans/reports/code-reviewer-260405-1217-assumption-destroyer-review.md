# Assumption Destroyer Review: MAF Platform SP2-SP7 Plan (Post-Update)

**Reviewer:** Code Reviewer (Assumption Destroyer perspective)
**Date:** 2026-04-05
**Scope:** plan.md, phase-01 (SP2 backend), phase-04 (SP3 nutrition), phase-05 (SP4 challenges), phase-08 (SP7 AI coaching)
**Focus:** RAM estimates, CCU calculations, throughput assumptions, cost completeness, integration assumptions

---

## Finding 1: NestJS 1,500-3,000 req/s throughput claim is fiction with Prisma + Redis in the loop

- **Severity:** Critical
- **Location:** plan.md, "CCU Capacity Estimates" section, assumption bullet 2
- **Flaw:** The plan states "NestJS on 4 vCPU: ~1,500-3,000 req/s (mixed CRUD + analysis)." This number appears to come from raw NestJS/Fastify hello-world benchmarks. A real request that traverses Prisma ORM (query building + client overhead), hits PostgreSQL (disk I/O, index lookup), and reads/writes Redis (network hop) will deliver 200-600 req/s for mixed workloads on 4 vCPU. Prisma adds 3-10ms overhead per query vs raw SQL. JSON serialization of activity objects with analysis data adds more.
- **Failure scenario:** At SP6-SP7, the plan expects 150-300 req/s at peak CCU. This is actually within realistic throughput -- but the plan uses the inflated 1,500-3,000 number to conclude "no bottleneck" up to SP5 and "monitor" at SP6. If actual throughput is 400 req/s and a Strava webhook storm adds 200 req/s of background job DB writes competing for the same PostgreSQL connection pool, the API hits saturation at roughly half the user count projected.
- **Evidence:** "NestJS on 4 vCPU: ~1,500-3,000 req/s (mixed CRUD + analysis)" -- no benchmark source cited. Phase 1 architecture shows Prisma as ORM, Redis for every cache check, BullMQ sharing Redis. All add latency.
- **Suggested fix:** Replace with realistic estimate: 300-800 req/s for Prisma+PG+Redis mixed CRUD on 4 vCPU. Re-derive CCU ceiling from this. The actual peak req/s numbers (5-300) still fit, but the "Hard ceiling ~4,000 CCU" and "~40K registered" claims need recalculation with honest throughput numbers. Add a load test gate at end of SP2 to validate real throughput.

---

## Finding 2: "Peak CCU = 5-10% of registered users" is unvalidated and likely wrong for a fitness community app

- **Severity:** High
- **Location:** plan.md, "CCU Capacity Estimates", assumption bullet 5
- **Flaw:** The 5-10% peak CCU ratio is a generic SaaS assumption. Fitness/running apps have highly correlated usage patterns: users check after morning runs (6-8 AM), after evening runs (6-9 PM), and during/after community challenges. A running community in a single timezone (Vietnam, UTC+7) will have extreme peak concentration. During an active challenge with leaderboard (SP4), 20-30% of active users could be online simultaneously checking standings.
- **Failure scenario:** At 10K registered users during an SP4 challenge, instead of 500-1,000 CCU (5-10%), you get 2,000-3,000 CCU (20-30%) all hitting the leaderboard endpoint. The leaderboard reads from Redis sorted sets (fast) but each page load also fetches user profiles, challenge progress, and activity data from PostgreSQL. The "Comfortable" verdict at SP3-SP4 becomes "Degraded" or "Down."
- **Evidence:** No citation for the 5-10% ratio. No analysis of Vietnam single-timezone peak concentration. Phase 5 (challenges) introduces leaderboards that create exactly the "thundering herd" pattern that breaks this assumption.
- **Suggested fix:** Model two scenarios: baseline (5-10%) and challenge-peak (20-30% of active users). Size infrastructure for challenge-peak. Add rate limiting per endpoint, not just per user. Consider pre-computing leaderboard pages and serving from cache with 30-60s staleness.

---

## Finding 3: WordPress MySQL and NestJS PostgreSQL share the same VPS but RAM budget ignores MySQL memory pressure under concurrent OAuth

- **Severity:** High
- **Location:** plan.md, SP2 RAM Budget table
- **Flaw:** WordPress + MySQL is budgeted at a flat 800 MB across all phases. But MySQL is the OAuth token store. When SP2 launches and users authenticate via WP OAuth Server, every login/refresh triggers MySQL queries (token validation, user metadata). The plan caches WP user data in PostgreSQL (Phase 1, step 19), but the OAuth token exchange itself still hits WordPress MySQL on every login and every token refresh that falls through to WP. At 1K users with 15-min JWT expiry, that is ~4,000 refresh attempts/hour hitting WordPress if the Redis refresh token is valid (NestJS handles it) -- but on first login and token rotation failures, it falls through to WP.
- **Failure scenario:** WordPress MySQL with default `innodb_buffer_pool_size` (128MB on low-config installs) starts swapping under concurrent OAuth requests. MySQL memory usage climbs from 800MB to 1.2-1.5GB. Combined with PostgreSQL and Redis, actual RAM usage exceeds the tidy budget. WordPress becomes slow, OAuth callbacks time out, users cannot log in.
- **Evidence:** RAM budget shows "WordPress + MySQL: 800 MB" unchanged from pre-SP2 through SP7. No mention of MySQL tuning for OAuth load. WordPress is currently serving a content site; adding it as an identity provider is a fundamentally different workload profile.
- **Suggested fix:** Add MySQL memory tuning step in Phase 0. Set `innodb_buffer_pool_size` to 256-512MB explicitly. Stress-test WP OAuth with 50 concurrent logins before SP2 launch. Budget WordPress+MySQL at 1.0-1.2GB, not 800MB. Alternatively, add WP Redis object cache (mentioned in research report but not in implementation steps).

---

## Finding 4: Phase 1 architecture diagram contradicts validated Tier 1 decisions -- still references PgBouncer, Redis Cluster, Prometheus, separate worker container

- **Severity:** Critical
- **Location:** phase-01-sp2-backend.md, Architecture section (lines 102-107), Todo List (lines 366-383)
- **Flaw:** The Validation Session explicitly confirmed "Tier 1: Single Redis 2-4GB, direct Prisma->PG, single BullMQ queue. No PgBouncer, no Prometheus/Grafana in SP2." But the architecture diagram still shows `PrismaService (-> PgBouncer -> PostgreSQL, pool_size=50)`, `RedisService (Redis Cluster 3-node for horizontal scaling)`, and `MetricsService (Prometheus /metrics endpoint)`. The Todo List includes checkboxes for "PgBouncer configured and Prisma connecting through it", "Redis Cluster running (3-node, cluster-enabled)", "Prometheus /metrics endpoint". The WorkerModule is described as a "separate Docker container" but step 11 says "BullMQ runs in-process with API (Tier 1)".
- **Evidence:** Architecture line 102: `PrismaService (-> PgBouncer -> PostgreSQL, pool_size=50)`. Todo line 367: `PgBouncer configured and Prisma connecting through it`. Todo line 368: `Redis Cluster running (3-node, cluster-enabled)`. Todo line 370: `Prometheus /metrics endpoint exposing key metrics`. These directly contradict the validated decisions in plan.md lines 431-433.
- **Failure scenario:** Dev A reads Phase 1 and implements PgBouncer + Redis Cluster + Prometheus + separate worker container. Wastes 1+ week of the 4-week sprint on infrastructure that was explicitly rejected. Or worse: partially implements both approaches, creating a confused architecture that is neither Tier 1 nor Tier 2.
- **Suggested fix:** The Phase 1 file was not updated after Validation Session 1. Every reference to PgBouncer, Redis Cluster (3-node), Prometheus/Grafana, and separate worker container must be removed from the architecture diagram, implementation steps, and todo list. This is a blocking issue -- a developer following this plan will build the wrong thing.

---

## Finding 5: Strava API budget math breaks at 1K users despite plan claiming "within budget"

- **Severity:** High
- **Location:** plan.md, "Strava API Budget" section
- **Flaw:** The plan states "At <1K users: ~1 sync/user/day = ~1,000 req/day (within budget)." But a single activity sync is not 1 API call. Phase 1 step 26 describes `syncActivity(stravaActivityId)` as "single fetch + streams (2 API calls)." `syncInitial(userId)` is "last 3 months, paginated, ~30 API calls." If 10 new users connect per day and each triggers initial sync (30 calls), that is 300 calls just for new user onboarding. Plus daily webhook-triggered syncs: if 500 active users each log 1 activity (2 API calls for detail + stream), that is 1,000 calls. Total: 1,300 calls/day, exceeding the 1,000/day limit.
- **Failure scenario:** During early beta growth (100-500 users), a burst of new signups triggers initial syncs that exhaust the daily API budget by noon. Existing users' webhook-triggered syncs queue up but cannot execute. Users see "activities not syncing" for hours. Rate limiter pauses all API calls until midnight reset.
- **Evidence:** plan.md: "~1 sync/user/day = ~1,000 req/day". Phase 1 step 26: "syncInitial(userId) -> queue bulk fetch (last 3 months, paginated, ~30 API calls)". Phase 1 step 26: "syncActivity(stravaActivityId) -> single fetch + streams (2 API calls)". Webhooks are free but the data fetch they trigger is not.
- **Suggested fix:** Recalculate budget honestly: initial sync costs ~30 calls/user, daily sync costs ~2 calls/activity. Cap new user onboarding to 10-20/day during beta. Implement initial sync throttling (spread over multiple days: sync last 2 weeks immediately, backfill older data overnight). Budget: reserve 200 calls/day for new user sync, 700 for ongoing sync, 100 for token refresh.

---

## Finding 6: NestJS API RAM budget of 400MB (SP2) is unrealistic with in-process BullMQ workers doing activity analysis

- **Severity:** High
- **Location:** plan.md, SP2 RAM Budget; phase-01, step 11
- **Flaw:** The plan allocates 400MB for NestJS API in SP2, with BullMQ running in-process (Tier 1, no separate worker). MAF analysis (step 31) processes heart rate streams, calculates zone compliance, cardiac drift, and pace efficiency. Heart rate stream data for a 1-hour run is 3,600+ data points. Processing multiple activities concurrently in-process while serving HTTP requests will spike Node.js heap well beyond 400MB. Node.js default heap is ~1.5GB; a single V8 process with Prisma client, Redis connections, BullMQ, and stream processing easily consumes 500-800MB under load.
- **Failure scenario:** 50 users connect Strava during beta launch. Each triggers initial sync (3 months, ~30 activities). BullMQ processes 1,500 activities in-process. Each activity analysis allocates arrays for HR stream data. Node.js heap climbs to 1GB+. API response times degrade because the event loop is blocked by analysis computation. Docker `mem_limit` (if set at 512MB per the budget) triggers OOM kill. API goes down.
- **Evidence:** SP2 RAM Budget: "NestJS API: 400 MB". Phase 1, step 11: "BullMQ runs in-process with API (Tier 1)". Phase 1, step 31: analyzes HR streams with zone compliance + cardiac drift + pace efficiency. Step 26: bulk sync "last 3 months."
- **Suggested fix:** Budget NestJS at 600-800MB for SP2 (still fits in 13GB headroom). Set Docker `mem_limit` to 1GB with a 768MB soft limit. Add `--max-old-space-size=768` to Node.js startup. Implement BullMQ concurrency=1 for analysis jobs to prevent heap explosion. Consider streaming HR data processing (don't load entire array into memory).

---

## Finding 7: Cost projections are incomplete -- missing backup storage, domain costs, Strava elevated tier, and WP OAuth Server Pro

- **Severity:** Medium
- **Location:** plan.md, "Total Cost Projection" section
- **Flaw:** The plan lists costs as "$0 through SP4" and "$18-68/mo at SP7." Missing line items:
  1. **Backup storage:** Phase 3 adds staging env + DB backups. Where are backups stored? If on-VPS, it eats into 100GB NVMe. If off-site (S3, Backblaze), $1-5/mo.
  2. **Domain renewals:** maf.run, app.maf.run, api.maf.run, staging.maf.run -- DNS is via Cloudflare (free), but domain renewal is $10-15/year.
  3. **WP OAuth Server Pro:** The free tier may not support PKCE or may have rate limits. Research report mentions "free tier supports Authorization Code + PKCE" but also "Pro for support." If a bug hits during beta and community support is unresponsive, Pro license is $199/year.
  4. **Strava API elevated tier:** At 1K+ users, Strava may require partnership agreement or elevated API access. This is not automatic -- Strava has been known to revoke API access for apps that exceed default tier without approval. $0 or potentially $blocked.
  5. **SSL certificates:** Cloudflare handles this, but only if using their proxy. If Cloudflare Tunnel config breaks and you need direct SSL, Let's Encrypt is free but requires cert management.
- **Failure scenario:** Not a hard failure, but the "$0 through SP4" claim creates a false sense of zero operational cost. When backup storage, domain renewal, and potential WP OAuth Pro license are needed, there is no budget allocated. More critically, Strava API access revocation could block the entire platform with zero alternative.
- **Evidence:** Cost table shows only Apple Developer, Google Play, and Claude API. No backup, domain, or contingency line items.
- **Suggested fix:** Add a "Hidden/Contingency Costs" row: $5-15/mo for backups + $15/yr domain + $200/yr WP OAuth Pro (contingency) + Strava partnership application timeline. Total realistic SP2 cost: $0-20/mo, not $0.

---

## Finding 8: Phase 1 Week 3 packs Strava OAuth + encryption + rate limiter + webhook + job pipeline + cron + bulk sync into 5 working days

- **Severity:** Critical
- **Location:** phase-01-sp2-backend.md, "Week 3: Strava Integration + Job Pipeline" (steps 22-30)
- **Flaw:** Week 3 contains 10 major implementation items: Strava OAuth flow (3 endpoints), AES-256-GCM encryption middleware, StravaApiClient with Redis token bucket rate limiter, BullMQ job pipeline with 3 priority queues and job chaining, StravaSyncService (bulk + incremental), StravaWebhookController with signature validation, CronService (4 scheduled jobs), and Strava webhook registration. Each of these is 1-2 days of work for a senior developer. The total is 10-15 days of work compressed into 5 days.
- **Failure scenario:** Dev A gets through Strava OAuth and encryption by Wednesday. Rate limiter and job pipeline take Thursday-Friday. Webhook, cron, and bulk sync slip to Week 4, which is already packed with MAF analysis + dashboard API + caching + Grafana + deployment. Week 4 overflows. SP2 backend is incomplete when integration testing (Phase 3) is supposed to start.
- **Evidence:** Steps 22-30 enumerate: Strava OAuth (3 endpoints), encryption middleware, rate limiter (Redis token bucket with budget allocation), job pipeline (BullMQ with 3 priorities + chaining), sync service (bulk + incremental), webhook controller (validation + signature), cron service (4 jobs), webhook registration. That is 9 distinct subsystems in 5 days.
- **Suggested fix:** Redistribute across 3 weeks instead of 2. Week 2: WP OAuth + Strava OAuth (auth flows together). Week 3: Job pipeline + sync + webhooks. Week 4: MAF analysis + dashboard + caching. Move Grafana to SP3 (already validated as "no Prometheus/Grafana in SP2"). Alternatively, accept 5-week SP2 backend timeline.

---

## Finding 9: WebSocket memory estimate at SP7 ignores the Strava webhook storm amplification pattern

- **Severity:** High
- **Location:** plan.md, SP7 RAM Budget and CCU table (SP6 row)
- **Flaw:** The plan estimates WebSocket memory at +200-400MB for SP6 (10K-15K users), based on ~50KB/connection. But the plan misses a critical interaction: when Strava webhooks fire for activity completion (typically 6-8 PM in Vietnam), the system must process the webhook, run MAF analysis, update leaderboards (SP4), AND push real-time updates to connected WebSocket clients. A Strava webhook storm (500 users finish their evening run within 30 minutes) triggers 500 webhook jobs -> 500 analysis jobs -> 500 leaderboard updates -> 500 WebSocket broadcast messages to all connected clients viewing the leaderboard. Each broadcast fans out to N connected viewers.
- **Failure scenario:** During a popular challenge at SP6, 1,000 users are connected via WebSocket watching the leaderboard. 300 users complete their runs between 6-7 PM. Each activity triggers: webhook processing (critical queue) -> analysis (default queue) -> leaderboard recalc (Redis ZADD) -> WebSocket broadcast to 1,000 clients. That is 300 broadcasts x 1,000 clients = 300,000 WebSocket messages in 1 hour, plus the BullMQ job processing. Node.js event loop saturates. WebSocket connections start timing out. Leaderboard appears frozen.
- **Evidence:** plan.md SP6 row: "WS memory" listed as bottleneck but only for connection count, not message throughput. Phase 5 (challenges): "Leaderboard updates within minutes of new activity sync." Phase 1 step 27: webhook must "respond 200 within 2s." No analysis of webhook -> analysis -> broadcast chain under concurrent load.
- **Suggested fix:** Add message throughput modeling, not just connection count. For leaderboard broadcasts, batch updates: collect leaderboard changes over 30-60 second windows, broadcast once. Do not broadcast per-activity. Add a "WebSocket message budget" alongside the connection budget.

---

## Finding 10: Phase 4 (Nutrition) and Phase 5 (Challenges) claim "no file conflicts" for parallel execution but share the Activity pipeline

- **Severity:** Medium
- **Location:** phase-05-sp4-challenges.md, line 9: "Can overlap with: Phase 4 (SP3) -- different modules, no file conflicts"
- **Flaw:** SP4 Challenges depend on Strava activity data for auto-progress tracking and leaderboard computation ("only count activities in MAF HR zone"). SP3 Nutrition depends on Strava activity data for training correlation insights ("correlate nutrition with Strava performance"). Both modules hook into the activity sync pipeline -- one to update challenge progress, one to generate nutrition-training correlations. If both are developed in parallel, they will both need to modify or extend the activity processing job chain (BullMQ job pipeline from Phase 1). The "no file conflicts" claim is true at the file level but false at the integration level: both need to add post-processing steps after MAF analysis completes.
- **Failure scenario:** Dev A implements challenge progress tracking as a job that runs after MAF analysis. Separately, Dev A implements nutrition correlation as another post-analysis job. Both modify the job chain in `api/src/jobs/`. When merged, the job chain has two competing extensions with no defined ordering, potential race conditions on shared activity state, and doubled DB queries on the same activity data.
- **Evidence:** Phase 5: "Auto-progress tracking from Strava activities" + "Recalculate leaderboards on new activity sync." Phase 4: "nutrition-insight.service.ts -- correlate nutrition with Strava performance." Both trigger on activity-sync-complete.
- **Suggested fix:** Define an event-driven extension pattern before SP3/SP4 starts: activity analysis emits a domain event (`ActivityAnalyzed`), and both nutrition and challenges subscribe independently. Document this pattern in Phase 1 as a deliberate extension point. This avoids direct job chain modification by multiple features.

---

## Summary

| # | Finding | Severity |
|---|---------|----------|
| 1 | NestJS throughput claim (1,500-3,000 req/s) is 3-5x inflated with Prisma+PG+Redis | Critical |
| 2 | Peak CCU 5-10% invalid for single-timezone fitness community with challenges | High |
| 3 | WordPress MySQL RAM budget ignores OAuth identity provider workload change | High |
| 4 | Phase 1 architecture/todos still reference rejected PgBouncer/Redis Cluster/Prometheus | Critical |
| 5 | Strava API budget math breaks at 1K users (initial sync cost unaccounted) | High |
| 6 | NestJS 400MB RAM budget unrealistic with in-process BullMQ + HR stream analysis | High |
| 7 | Cost projections missing backups, domain, WP OAuth Pro contingency, Strava tier risk | Medium |
| 8 | Phase 1 Week 3 packs 10-15 days of Strava integration work into 5 days | Critical |
| 9 | WebSocket memory model ignores Strava webhook storm -> broadcast amplification | High |
| 10 | SP3/SP4 "no file conflicts" is false at integration level (shared activity pipeline) | Medium |

**Critical blockers (must fix before implementation):** Findings 1, 4, 8
**High priority (must fix before SP2 launch):** Findings 2, 3, 5, 6, 9
**Address during planning:** Findings 7, 10

---

## Unresolved Questions

1. Has the WP OAuth Server plugin been tested with PKCE on the actual maf.run WordPress instance? Phase 0 spike is planned but not executed.
2. What is the actual Strava API tier for this app? Has the Strava developer application been registered? Default tier vs elevated tier changes all budget math.
3. Is PostgreSQL 15 the instance currently running N8N, or a separate install? If shared, what is the `shared_buffers` and `work_mem` configuration?
4. The plan mentions "2 developers (vibe coding)" -- does this mean AI-assisted development? If so, the 4-week timeline estimates may be even more uncertain due to AI code quality variance requiring additional review cycles.

**Status:** DONE
**Summary:** 10 findings (3 Critical, 5 High, 2 Medium). Phase 1 has unresolved contradictions with validated decisions. Throughput and CCU assumptions are optimistic. Strava API budget math is wrong. Week 3 schedule is physically impossible.
**Concerns:** Finding 4 (stale Phase 1 contradicting validated Tier 1 decisions) is the most dangerous -- a developer following Phase 1 as-written will waste time building rejected infrastructure.
