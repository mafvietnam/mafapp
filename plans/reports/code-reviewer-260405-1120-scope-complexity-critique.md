# Scope & Complexity Critique: MAF Platform SP2-SP7

**Reviewer:** code-reviewer (Scope & Complexity Critic)
**Date:** 2026-04-05
**Plan:** `plans/260331-0121-maf-platform-sp2-sp7/`
**Files reviewed:** plan.md, phase-01-sp2-backend.md, phase-02-sp2-frontend.md, phase-03-sp2-integration.md

---

## Finding 1: 3-Node Redis Cluster is egregious over-engineering for Day 1

- **Severity:** Critical
- **Location:** Phase 1, section "Week 1: Project Setup + DB + Scaling Infrastructure", steps 9-10; plan.md "Scaling Strategy" and "Key Scaling Components"
- **Flaw:** The plan specifies a 3-node Redis Cluster with 21 GB total memory, auto-sharding of 16K slots, and separate eviction policies from Sprint 2 — before a single user exists. The current production runs the entire app on ~3.8 GB RAM total (4 Docker services on a 16 GB VPS). The plan wants to burn 21 GB on Redis alone.
- **Failure scenario:** Week 1 is consumed debugging Redis Cluster formation, cluster-aware client configuration, cross-node slot migration, and Docker networking for 3 Redis containers. Dev A delivers zero business value (no auth, no Strava) while fighting infrastructure. The single VPS (16 GB RAM) cannot even run the full stack with 21 GB Redis + PostgreSQL + PgBouncer + API + workers + Prometheus + Grafana.
- **Evidence:** `"Redis Cluster running (3-node, cluster-enabled)"` is a Week 1 todo. Plan says `"Redis Cluster 3 nodes x 7 GB = 21 GB"` while production server has 16 GB total. Tier 1 in the plan's own growth path says "Single VPS — PM2 cluster (4 processes) + all services on Docker Compose" for 0-5K users — yet SP2 builds Tier 3/4 infrastructure.
- **Suggested fix:** Single Redis instance (standalone, 512 MB-1 GB). Add Cluster in Tier 3 when you actually have 20K users and data to justify it. Use the plan's own tiered strategy instead of contradicting it.

## Finding 2: PgBouncer is premature — Prisma already pools connections

- **Severity:** High
- **Location:** Phase 1, steps 3 and 8; plan.md "Key Scaling Components" item 1
- **Flaw:** PgBouncer is added in Week 1 as a mandatory dependency. Prisma Client already manages a connection pool (`connection_limit` in the datasource URL). For a system with 0 concurrent users and a single API process, adding PgBouncer introduces operational complexity (transaction vs session pooling mode, prepared statement incompatibilities with Prisma, pgbouncer.ini configuration) with zero benefit.
- **Failure scenario:** PgBouncer in `transaction` mode breaks Prisma interactive transactions and `PREPARE` statements. Dev A spends days debugging "prepared statement does not exist" errors that are a well-known Prisma + PgBouncer pain point. This is documented in Prisma's own docs as requiring workarounds.
- **Evidence:** `"pool_mode=transaction, max_client_conn=1000, default_pool_size=25"` — these settings are for handling hundreds of concurrent connections. The current app has zero API connections to PostgreSQL. Prisma docs explicitly warn about transaction pool mode issues.
- **Suggested fix:** Remove PgBouncer from SP2 entirely. Set Prisma `connection_limit=10` in the datasource URL. Add PgBouncer only when connection count monitoring shows pool exhaustion (Tier 2+).

## Finding 3: The plan builds for 40K users but has zero evidence of even 100

- **Severity:** Critical
- **Location:** plan.md "Scaling Strategy (40K+ Users)" and "Capacity Estimates"; all three phase files reference 40K throughout
- **Flaw:** The current product is an offline-first calculator with no user accounts, no database interaction, no analytics. There is no evidence of current user count, traffic data, or growth projections. The 40K number appears invented and drives the entire architecture (3-node Redis, PgBouncer, 9 worker processes, 2-3 VPS nodes, monthly-partitioned tables, Prometheus + Grafana). Every design decision is optimized for a scale that may never arrive.
- **Failure scenario:** The team spends 40 weeks building infrastructure for 40K users, launches, gets 200 signups. The NestJS API + BullMQ workers + Redis Cluster + PgBouncer + Prometheus + Grafana stack costs more to operate and maintain than the value it delivers to 200 users. Meanwhile, a simple Express server with SQLite could have shipped the same features in 4 weeks.
- **Evidence:** README says "Version: 1.0.0, Last Updated: November 27, 2025." No user count metrics anywhere. The system-architecture.md describes a 100% client-side calculator. plan.md says "40,000 registered, ~2,000-8,000 DAU" as a design target with no market validation or funnel analysis backing it.
- **Suggested fix:** Define Tier 1 architecture (single-process NestJS, single Redis, direct Prisma-to-PostgreSQL) as the SP2 deliverable. Build only what you need for the first 1,000 users. Add a monitoring milestone at 5K users to evaluate scaling needs. Cut all references to worker containers, Redis Cluster, PgBouncer, and multi-VPS from SP2 scope.

## Finding 4: Prometheus + Grafana in SP2 is gold plating

- **Severity:** High
- **Location:** Phase 1, steps 12 and 37; Phase 3, steps 14-15
- **Flaw:** Full Prometheus metrics endpoint with `prom-client` plus pre-built Grafana dashboards with API response times, job queue depth, cache hit rate, Strava rate limit usage, and worker CPU/memory — all specified for Sprint 2 of a product that currently has zero backend. This is monitoring infrastructure for a production system at scale, not for an MVP launch.
- **Failure scenario:** Dev A spends 2-3 days instrumenting every service with Prometheus counters/histograms, building Grafana dashboards, configuring scrape intervals, and debugging Docker networking between Prometheus and all targets. This is time not spent on auth or Strava integration. With 0 users, the dashboards show flat lines for months.
- **Evidence:** Phase 1 todo list includes both `"Prometheus /metrics endpoint exposing key metrics"` and `"Grafana dashboard for job monitoring"` alongside core auth and Strava deliverables in a 4-week sprint.
- **Suggested fix:** Use structured JSON logging (already planned) + Docker `docker logs` for SP2. Add Prometheus/Grafana as a separate ops sprint when there's actual traffic to monitor. Alternatively, use a free tier of a hosted service (Grafana Cloud free plan has 10K metrics) to avoid self-hosting overhead.

## Finding 5: 1-week integration phase is fiction for the scope described

- **Severity:** Critical
- **Location:** Phase 3, all sections
- **Flaw:** Phase 3 allocates 5 days to: align API contracts, E2E test all flows (anonymous, login, profile, Strava, dashboard mobile, dashboard desktop, activity detail, logout), test 7 edge cases, validate performance benchmarks (p95 < 200ms, pipeline < 30s, simulate 100 concurrent jobs, cache hit > 80%), deploy production Docker images for 6+ services, configure Cloudflare Tunnel routing, verify Grafana dashboards, and smoke test on mobile + desktop. This is 2-3 weeks of work compressed into 5 days.
- **Failure scenario:** Day 1-2: API contract mismatches are found (they always are). Dev A and Dev B spend 3 days fixing request/response shape drift, CORS issues, cookie auth cross-origin problems, and Strava callback URL misconfigurations. No time left for E2E testing, performance validation, or production deployment. Sprint slips by 2+ weeks.
- **Evidence:** Phase 3 step 7 alone says "Performance validation (40K-readiness): simulate 100 concurrent jobs" — load testing infrastructure setup and execution is a multi-day effort by itself. Step 10 says "Update docker-compose.yml with all services (api, worker, redis, pgbouncer, prometheus, grafana)" — configuring 6+ Docker services for production is not a one-line change.
- **Suggested fix:** Expand integration to 2-3 weeks. Cut performance validation against 40K benchmarks (see Finding 3). Define integration as iterative: deploy to staging first, fix issues in cycles, then promote to production. Accept that API contract drift will consume at least 3-5 days.

## Finding 6: BullMQ 3-tier priority queue system with separate worker containers is over-engineered for SP2 job volume

- **Severity:** High
- **Location:** Phase 1, section "Architecture" (WorkerModule), steps 11 and 25
- **Flaw:** The plan specifies 3 priority queue tiers (critical/default/low), 3 separate worker types (CriticalWorker, DefaultWorker, LowWorker), a separate Docker container for workers with its own NestJS bootstrap, job chaining (fetch.completed -> analysis -> aggregation), dead letter queues, and a CronService with 4 scheduled tasks — all in SP2. The actual SP2 job volume is: Strava webhooks (maybe 10-50/day for early adopters) and initial bulk syncs (a few per new user signup).
- **Failure scenario:** Dev A spends Week 3 building the worker infrastructure, job chaining logic, dead letter queue handling, and cron schedules instead of getting basic Strava sync working. When testing with 5 beta users generating 3 webhooks/day, the 3-tier priority system adds latency (queue overhead) versus just processing inline.
- **Evidence:** `"9 worker processes"` specified in plan.md for Tier 3. Phase 1 step 25 shows a 4-stage job chain. Step 28 specifies 4 separate cron schedules including "Weekly: re-sync users with stale data." The current product has zero background jobs.
- **Suggested fix:** Single BullMQ queue, single worker process (can run in the same NestJS process initially). One job type: "process Strava webhook." Add priority tiers and separate workers when job volume justifies it (thousands/day, not dozens). Inline MAF analysis during activity fetch — it's a pure CPU calculation that takes milliseconds.

## Finding 7: WordPress OAuth2 with PKCE is high-risk and under-researched for a critical path item

- **Severity:** High
- **Location:** Phase 1, Week 2 (steps 14-21); plan.md Risk Assessment
- **Flaw:** The plan depends on installing a third-party WordPress plugin ("WP OAuth Server") on the main maf.run site to act as an OAuth2 provider with PKCE support. This is the sole authentication mechanism — there is no fallback path that doesn't require WP plugin configuration. PKCE support in WordPress OAuth plugins is unreliable: most free-tier WP OAuth plugins support Authorization Code flow but not PKCE. The "fallback" mentioned (WP REST API + application passwords) is a completely different auth model that would require rewriting the entire auth module.
- **Failure scenario:** Dev A installs WP OAuth Server, discovers the free tier doesn't support PKCE or has bugs in the code_verifier validation. Spends a week debugging WordPress PHP plugin internals. Falls back to "application passwords" which is a server-to-server auth mechanism, not a user-facing SSO flow. The entire auth architecture must be redesigned mid-sprint.
- **Evidence:** Risk table says `"WP OAuth plugin complexity — Medium"` and fallback is `"WP REST API + application passwords"`. Application passwords are basic-auth credentials per user — they are not an OAuth flow and cannot replace SSO redirect-based login. The risk is underrated.
- **Suggested fix:** Validate the WordPress OAuth plugin before any planning or coding. Spend 2 hours installing the plugin on a staging WP instance and testing the full PKCE flow. If it fails, decide on an alternative auth strategy (e.g., email/password with JWT, or Auth0 free tier, or Supabase Auth) before committing to the sprint. Add a "Spike: validate WP OAuth PKCE" as a Week 0 pre-requisite.

## Finding 8: Frontend creates 30+ new files and a full design system in 4 weeks alongside learning a new theme

- **Severity:** Medium
- **Location:** Phase 2, "Files to Create" and "Architecture" sections
- **Flaw:** Phase 2 creates: 6 page components, 2 context providers, 5 service modules, 4 layout components, 3 UI primitives (glass-card, desktop-card, gradient-button), 10 dashboard widgets, 4 activity components, 4 auth components, 3 hooks, 1 types file — totaling approximately 38 new files. The dashboard alone has 10 widget components with pixel-perfect specifications from HTML mockups. This is accompanied by a dark/light theme split where authenticated pages use a completely different design language than the existing app.
- **Failure scenario:** Dev B ships functional pages but the glassmorphism effects have cross-browser issues (backdrop-blur is not consistent across Safari/Chrome/Firefox on mobile), the responsive breakpoints between mobile glass-card and desktop solid-card layouts create visual bugs at tablet sizes, and the 10 dashboard widgets aren't wired to real data because the API isn't ready until Week 4. Integration week reveals the widgets display wrong because the API response shapes don't match the hardcoded mock data.
- **Evidence:** Phase 2 specifies exact CSS values like `"backdrop-blur(28px)"`, `"rgba(255,255,255,0.05)"`, `"rounded-t-[32px]"`, `"-top-6 offset"` for 10+ components. This pixel-precision on 38 files in 4 weeks (roughly 2 files/day) leaves no buffer for iteration.
- **Suggested fix:** Cut the dashboard to 3-4 core widgets for SP2 (MAF zone card, trend chart, activity list). Ship the remaining widgets in SP3. Use a single responsive card component instead of separate glass-card and desktop-card. Skip the glassmorphism effects — use solid dark cards on all viewports. Pretty UI is not MVP; working data display is.

## Finding 9: Strava token encryption at rest is mentioned but not designed

- **Severity:** Medium
- **Location:** Phase 1, Security Considerations: "Strava tokens encrypted at rest (Prisma middleware or DB-level)"
- **Flaw:** The plan stores Strava access and refresh tokens as plain `String` fields in Prisma schema (`accessToken String`, `refreshToken String`). The security section vaguely mentions "encrypted at rest (Prisma middleware or DB-level)" but provides no design: no encryption algorithm, no key management, no key rotation strategy, no specification of whether this is application-level encryption (Prisma middleware) or PostgreSQL column-level encryption (pgcrypto). This is a trust boundary violation — stolen DB access yields all Strava tokens for all users.
- **Failure scenario:** A SQL injection or DB backup leak exposes plain-text Strava OAuth tokens for every connected user. Attacker uses these to access users' Strava data, post on their behalf, or exfiltrate private activity locations (home addresses, workout routes).
- **Evidence:** Schema shows `accessToken String` and `refreshToken String` with no transformation. Security section says "encrypted at rest" as a one-liner with no implementation detail. No key management or rotation is mentioned.
- **Suggested fix:** Design the encryption strategy now. Recommend: application-level AES-256-GCM encryption via Prisma middleware, encryption key from environment variable, key rotation procedure documented. Add specific implementation steps in Week 3 (Strava integration) — this is not a "nice to have," it's a data protection requirement.

## Finding 10: JobLog table stored in PostgreSQL will become an unbounded growth problem

- **Severity:** Medium
- **Location:** Phase 1, Database Schema (Prisma) — `model JobLog`
- **Flaw:** Every background job (webhook, sync, analysis, aggregation, token refresh, cleanup) creates a row in the JobLog table in PostgreSQL. The plan estimates ~12K jobs/day at 40K users. That's ~4.4M rows/year. The plan mentions "cleanup daily" in CronService but doesn't define retention policy, doesn't partition the table, and doesn't limit what gets logged. BullMQ already has its own job tracking in Redis with `removeOnComplete: 100` and `removeOnFail: 500`. The PostgreSQL JobLog duplicates this.
- **Failure scenario:** Nobody implements the "cleanup" cron job properly because it has no specification (retain how many days? delete in batches? vacuum afterward?). The table grows to millions of rows over 6 months. Queries on `JobLog` slow down. The index on `createdAt` helps reads but deletes of millions of rows cause table bloat and long-running transactions that block other operations.
- **Evidence:** Phase 1 step 28 says `"Every 24h: cleanup old job logs, stale sessions, orphaned data"` with no retention period specified. The JobLog model has no partition strategy despite the Activity model being noted for "monthly partitioned" in the resource estimates. BullMQ's own Redis-based job tracking is already configured.
- **Suggested fix:** Remove JobLog from PostgreSQL entirely for SP2. Rely on BullMQ's built-in job tracking (it stores job status, attempts, errors in Redis already). If persistent job logging is needed, add it in a later sprint with: a defined retention policy (e.g., 7 days), batch deletion, and consideration of an append-only store (e.g., log files) rather than a relational table.

---

## Summary

This plan designs a Tier 3-4 platform (multi-VPS, Redis Cluster, PgBouncer, 9 workers, Prometheus+Grafana) for a product that currently has zero users, zero backend, and zero validated demand for accounts. The 40K number is aspirational with no market data supporting it. The plan contradicts its own tiered growth strategy by building Tier 3 infrastructure in Sprint 2.

**Core recommendation:** Strip SP2 down to Tier 1. Single NestJS process, single Redis instance, direct Prisma connection, single BullMQ queue, no Prometheus/Grafana, no PgBouncer. Validate WP OAuth before committing. Cut dashboard widgets to essentials. Ship auth + Strava + basic dashboard in 4 weeks, not a distributed system.
