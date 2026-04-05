# Security Adversary Plan Review (Session 2)

**Plan:** MAF Platform SP2-SP7
**Reviewer:** Security Adversary (hostile)
**Date:** 2026-04-05
**Scope:** Full plan including new Tech Stack Timeline, VPS capacity, CCU estimates

---

## Finding 1: SharedModule Architecture Diagram Still References PgBouncer + Redis Cluster + Prometheus

- **Severity:** Critical
- **Location:** Phase 1, section "Architecture" (lines 101-106)
- **Flaw:** The architecture diagram in Phase 1 explicitly states `PrismaService (→ PgBouncer → PostgreSQL, pool_size=50)`, `RedisService (Redis Cluster 3-node for horizontal scaling)`, and `MetricsService (Prometheus /metrics endpoint)`. These were supposed to be removed in Validation Session 1 (Tier 1 infra: no PgBouncer, no Redis Cluster, no Prometheus). The Key Insights section (line 24) says "No PgBouncer, no Prometheus/Grafana in SP2" but the architecture diagram, the todo list, and the success criteria all contradict this.
- **Failure scenario:** Dev A follows the architecture diagram (the canonical implementation guide) and deploys Redis Cluster 3-node on a single 16GB VPS already hosting WordPress + MySQL + PostgreSQL + NestJS. Three Redis nodes at 2-4GB each = 6-12GB RAM, leaving 4-10GB for everything else. Under load, Linux OOM-killer terminates PostgreSQL or WordPress, taking down both maf.run (SSO provider) and api.maf.run simultaneously. Single-server blast radius is total.
- **Evidence:**
  - Line 102: `PrismaService (→ PgBouncer → PostgreSQL, pool_size=50)`
  - Line 103: `RedisService (Redis Cluster 3-node for horizontal scaling)`
  - Line 104: `MetricsService (Prometheus /metrics endpoint)`
  - Line 366: Todo `PgBouncer configured and Prisma connecting through it`
  - Line 367: Todo `Redis Cluster running (3-node, cluster-enabled)`
  - Line 369: Todo `Prometheus /metrics endpoint exposing key metrics`
  - Line 383: Todo `Grafana dashboard for job monitoring`
  - Line 396: Success criteria `Prometheus metrics visible at /metrics`
  - Line 397: Success criteria `Grafana dashboards showing job health`
  - Contradicted by line 24: "No PgBouncer, no Prometheus/Grafana in SP2"
  - Contradicted by plan.md line 85: "Direct Prisma → PostgreSQL — pool size 5"
- **Suggested fix:** Purge all PgBouncer, Redis Cluster, and Prometheus/Grafana references from the architecture diagram, todo list, success criteria, and implementation steps in Phase 1. Replace with: `PrismaService (direct → PostgreSQL, pool_size=5)`, `RedisService (Redis standalone)`, remove MetricsService entirely. Same for Phase 3 todo line 78 (`PgBouncer + Redis Sentinel stable under load`) and line 79 (`Grafana dashboards operational`).

---

## Finding 2: WorkerModule "Separate Docker Container" Contradicts Tier 1 In-Process Decision

- **Severity:** High
- **Location:** Phase 1, section "Architecture" (line 85), section "Implementation Steps" Week 3 (line 304)
- **Flaw:** The architecture diagram shows `WorkerModule (separate Docker container)` at line 85. Implementation step 25 (line 304) says "BullMQ, runs in worker container." But the validated Tier 1 decision (Key Insights line 24, Implementation step 11 line 247) says "BullMQ runs in-process with API (Tier 1 — no separate worker container)." The `api/src/worker.ts` and `api/src/worker.module.ts` files are still listed as files to create (lines 207-208). The CronService step 28 (line 328) says "runs in worker container."
- **Failure scenario:** Dev A creates a separate worker Docker container per the architecture diagram. This doubles NestJS memory footprint on the VPS (400MB x2 = 800MB), requires inter-process Redis communication for job coordination, and introduces deployment complexity for a beta with <1K users. More critically, if the worker container connects to PostgreSQL with its own pool, that is 10 connections total (5 API + 5 worker) for a database also serving WordPress/MySQL on the same VPS — connection exhaustion under even moderate cron load.
- **Evidence:**
  - Line 85: `WorkerModule (separate Docker container)`
  - Line 247: `BullMQ runs in-process with API (Tier 1 — no separate worker container)`
  - Lines 207-208: Files to create include `api/src/worker.ts`, `api/src/worker.module.ts`
- **Suggested fix:** Remove "separate Docker container" from architecture diagram. Remove `worker.ts` and `worker.module.ts` from files-to-create. Update all "runs in worker container" references to "runs in-process." This is a documentation fix — the decision is already made, the diagram just was not updated.

---

## Finding 3: WordPress as Single Sign-On Provider is a Single-Server Auth SPOF with No Degradation Path

- **Severity:** Critical
- **Location:** plan.md "Architecture" section, Phase 1 Week 2 (lines 254-277)
- **Flaw:** WordPress on maf.run is the sole authentication provider. It runs on the SAME VPS as the NestJS API. If WordPress/MySQL goes down (OOM, crash, MySQL corruption, WordPress plugin conflict, or a failed WP update), no new users can log in, no tokens can be refreshed (because the initial JWT issuance requires a WP OAuth round-trip), and existing sessions expire within 15 minutes (access token TTL). There is no degradation strategy — no cached auth fallback, no emergency bypass.
- **Failure scenario:** A WordPress plugin auto-update breaks WP OAuth Server at 3 AM. NestJS API is healthy but cannot authenticate anyone. All active users lose access within 15 minutes as access tokens expire and refresh-token flow tries to hit WP for revalidation. The app is fully down despite the API being up. On a single VPS, MySQL crashing also risks PostgreSQL stability (memory pressure).
- **Evidence:**
  - plan.md line 71: `Auth (SSO) | WP OAuth Server + PKCE`
  - Phase 1 line 262: callback flow requires WP REST API to fetch user info
  - No mention of: WP health check before auth redirect, cached WP user validation, offline auth grace period, or WordPress auto-update policy
- **Suggested fix:** (1) Add a WordPress health check to the auth flow — if WP is down, return a clear error, not a hang. (2) Document that refresh tokens are validated against Redis only (not WP), so existing sessions survive WP downtime. (3) Disable WordPress auto-updates for plugins in production (or at minimum, disable auto-updates for the OAuth Server plugin). (4) Add WP health to the staging deploy checklist.

---

## Finding 4: No Network Isolation Between WordPress/MySQL and NestJS/PostgreSQL/Redis on Shared VPS

- **Severity:** High
- **Location:** plan.md "Architecture" section, "VPS Baseline" section
- **Flaw:** The plan hosts WordPress (PHP + MySQL), NestJS (Node.js + PostgreSQL + Redis), and Cloudflare Tunnel on a single VPS with no mention of network segmentation, Docker network isolation, or firewall rules between services. All services can reach all other services' ports. A vulnerability in WordPress (historically the most attacked CMS) gives an attacker lateral access to PostgreSQL (user data, encrypted Strava tokens), Redis (session tokens, job queues), and the NestJS API.
- **Failure scenario:** Attacker exploits a known WordPress plugin vulnerability (they appear monthly). Gains PHP code execution on the maf.run container. From there, connects to PostgreSQL on localhost:5432 (likely no auth or trust auth for Docker internal), dumps the `maf` database including AES-256-GCM encrypted Strava tokens. If the STRAVA_ENCRYPTION_KEY is in an env file readable by the compromised container (same Docker Compose network), the attacker decrypts all tokens and gains access to every user's Strava account.
- **Evidence:**
  - plan.md shows all services on one VPS with Docker Compose, no mention of network isolation
  - Phase 1 line 416: "CORS whitelist: only app.maf.run" (HTTP-level only, not network-level)
  - No Docker network segmentation plan, no firewall rules, no mention of PostgreSQL authentication hardening
- **Suggested fix:** (1) Create separate Docker networks: `wp-net` (WordPress + MySQL only) and `api-net` (NestJS + PostgreSQL + Redis only). WordPress communicates with NestJS only via HTTP through Cloudflare Tunnel (already the case for OAuth). (2) PostgreSQL must use password auth, not trust. (3) Redis must have `requirepass` set. (4) Env files for NestJS (containing STRAVA_ENCRYPTION_KEY, JWT_PRIVATE_KEY) must not be mounted into WordPress containers.

---

## Finding 5: AES-256-GCM Encryption Key Management Has No Rotation, No Envelope, Single Point of Compromise

- **Severity:** High
- **Location:** Phase 1, Week 3 step 22b (line 282-285), plan.md line 73
- **Flaw:** Strava token encryption uses a single AES-256-GCM key from `STRAVA_ENCRYPTION_KEY` env var. There is no key rotation strategy, no envelope encryption (where a data key is wrapped by a master key), and the key sits in an env file on the same VPS that also runs WordPress. If this key is compromised, ALL Strava tokens (past and present) are decryptable. There is no way to rotate the key without re-encrypting all tokens, and no plan describes that procedure.
- **Evidence:**
  - Phase 1 line 283: "AES-256-GCM encrypt accessToken + refreshToken before write, decrypt after read"
  - Phase 1 line 284: "Key from STRAVA_ENCRYPTION_KEY env var (openssl rand -hex 32)"
  - No mention of: key rotation, key versioning, envelope encryption, or incident response for key compromise
- **Suggested fix:** (1) Add a `keyVersion` field to the StravaConnection model (default: 1). When encrypting, prepend the version. When decrypting, look up the correct key by version. (2) Document a key rotation procedure: generate new key → set as version N+1 → background job re-encrypts all tokens → remove old key. (3) For a beta this is acceptable as informational, but must be addressed before >1K users (where a breach becomes reportable).

---

## Finding 6: CCU Estimates Ignore WebSocket Memory Bomb on Shared WordPress VPS

- **Severity:** High
- **Location:** plan.md "CCU Capacity Estimates" section (lines 226-239), "SP7 RAM Budget" (lines 188-196)
- **Flaw:** The SP7 RAM budget estimates 800MB for NestJS with WebSocket connections. The CCU table says 3,000 peak CCU at SP7. At ~50KB per WebSocket connection (plan's own estimate at line 179), 3,000 concurrent WS connections = 150MB just for connection buffers. But this ignores: V8 heap per connection handler (~200-500KB with per-connection state, message buffers, heartbeat timers), the NestJS @WebSocketGateway overhead, and Redis pub/sub memory for WS horizontal scaling. Realistic per-connection cost is 200-500KB, making 3,000 connections = 600MB-1.5GB for WebSocket alone. Combined with the base NestJS API process, this exceeds the budgeted 800MB. On a shared VPS, this triggers OOM-killer, potentially killing WordPress (the SSO provider), causing a cascading auth failure.
- **Failure scenario:** SP7 launch. Community challenge causes 2,000+ simultaneous WebSocket connections for real-time leaderboard. NestJS memory spikes to 1.8GB. OOM-killer selects MySQL (WordPress). WordPress dies. All JWT refresh flows fail. Users get logged out mid-challenge. Complete service disruption.
- **Evidence:**
  - Line 179: `~50 KB/conn` — this is the raw TCP buffer only, not application overhead
  - Line 190: NestJS API budgeted at 800MB total including WebSocket
  - Line 238: 1,500-3,000 peak CCU at SP7
  - No OOM-killer protection or Docker memory limits mentioned for SP7
- **Suggested fix:** (1) Revise per-connection estimate to 200-500KB (include V8 heap + handler state). (2) Set Docker `mem_limit` on NestJS container (1.5GB hard cap) so OOM-killer targets the right container, not WordPress. (3) Add a connection limit to WebSocketGateway (e.g., max 2,000 connections) with graceful rejection. (4) Plan shows "Second VPS" trigger at 30K users — this should be lowered to 10K-15K if WebSocket features are deployed.

---

## Finding 7: Strava OAuth Callback Has No CSRF Protection — `state` Mentioned but Not Enforced in Frontend

- **Severity:** High
- **Location:** Phase 1 Week 3 step 23 (lines 287-289), Phase 2 Week 2 step 20 (lines 287-290 in phase-02)
- **Flaw:** The WordPress OAuth flow correctly specifies `state` parameter for CSRF (Phase 1 line 261). But the Strava OAuth flow at step 23 only says "redirect to Strava OAuth" and "exchange code, store tokens" — no mention of `state` parameter, no CSRF check on the Strava callback. Phase 2's Strava callback page (step 20) says "Extract auth code from URL → Call POST /strava/callback with code" — again no `state` validation. An attacker can craft a malicious Strava OAuth callback URL that links their own Strava account to a victim's MAF account.
- **Failure scenario:** Attacker initiates Strava OAuth on their own browser, gets the authorization code, then sends the callback URL (with attacker's Strava code) to a victim who is logged into MAF. Victim clicks the link, their browser calls `/strava/callback` with the attacker's code (victim's auth cookie is attached automatically). Attacker's Strava account is now linked to victim's MAF account. Attacker can then see all of victim's running data, or worse, the victim's Strava token refresh now refreshes the attacker's token.
- **Suggested fix:** Add `state` parameter to Strava OAuth flow (same pattern as WP OAuth): backend generates random state, stores in Redis with 5min TTL, validates on callback. Update Phase 1 step 23 and Phase 2 step 20 to include state validation.

---

## Finding 8: Phase 3 Todo List and Success Criteria Still Reference Removed Infrastructure

- **Severity:** Medium
- **Location:** Phase 3, "Todo List" (lines 78-79), "Success Criteria" (lines 85, 90)
- **Flaw:** Phase 3 todo list includes "PgBouncer + Redis Sentinel stable under load" (line 78) and "Grafana dashboards operational" (line 79). Success criteria include "production deploy: app.maf.run + api.maf.run + worker + monitoring" (line 85) and "Grafana shows healthy metrics" (line 90). None of these exist in Tier 1 infrastructure. Redis Sentinel was never even mentioned in the plan — it appeared from nowhere.
- **Failure scenario:** During integration week, Dev A and Dev B waste 1-2 days trying to set up PgBouncer, Redis Sentinel, and Grafana because the Phase 3 checklist says they are required. This is the final week before deploy. Time lost on phantom requirements delays the launch.
- **Evidence:**
  - Phase 3 line 78: `PgBouncer + Redis Sentinel stable under load`
  - Phase 3 line 79: `Grafana dashboards operational`
  - Phase 3 line 90: `Grafana shows healthy metrics`
  - None of these are in Tier 1 (plan.md line 432: "strip Redis Cluster/PgBouncer/Prometheus")
- **Suggested fix:** Remove all PgBouncer, Redis Sentinel, and Grafana references from Phase 3. Replace with: "Redis standalone operational," "Structured JSON logging verified," "Docker health checks passing."

---

## Finding 9: rawData JSONB Field Has No Size Limit — Strava Bulk Sync Can Fill 100GB NVMe

- **Severity:** Medium
- **Location:** Phase 1, Database Schema (line 170), Implementation step 26 (line 318)
- **Flaw:** The `rawData Json?` field on Activity stores the Strava API response as JSONB. Step 26 says "parse: distance, duration, avg_hr, max_hr, pace, splits, stream data." Strava stream data (second-by-second HR, pace, altitude, cadence for an entire run) can be 500KB-2MB per activity. The plan says strip GPS coordinates (good), but stream arrays (heartrate_stream, velocity_stream, altitude_stream) are not GPS and would be kept. At 1,000 users with average 200 activities each = 200,000 activities. At 500KB raw data each = 100GB. That is the entire NVMe disk.
- **Failure scenario:** Bulk sync imports 3 months of activities for early adopters. Power users with daily runs have 90+ activities each. Stream data fills rawData. At ~200 beta users doing bulk sync, disk usage jumps 20-40GB. PostgreSQL WAL + indexes double that. VPS disk fills, PostgreSQL crashes, WordPress goes down (same disk).
- **Evidence:**
  - Line 170: `rawData Json?  // Strava response — MUST strip start_latlng/end_latlng before storage`
  - Line 319: `Parse: distance, duration, avg_hr, max_hr, pace, splits, stream data`
  - VPS: 100GB NVMe total (plan.md line 39)
  - No mention of: rawData size cap, selective stream storage, or disk monitoring
- **Suggested fix:** (1) Do NOT store raw Strava stream data in rawData. Extract needed fields into typed columns, discard the rest. (2) If rawData is kept for debugging, cap it at 50KB per activity (strip streams, keep only summary). (3) Add disk usage monitoring trigger to scaling decision points. (4) Consider partitioning Activity table by date if >1M rows expected.

---

## Unresolved Questions

1. Is WordPress MySQL using the same PostgreSQL instance or a separate MySQL? The plan says "WordPress + MySQL" (line 44) but also "PostgreSQL 15" (line 49). If MySQL and PostgreSQL are both running, that is two database engines on 16GB RAM — confirm both are needed and budgeted.
2. The `STRAVA_ENCRYPTION_KEY` and `JWT_PRIVATE_KEY` are stored as env vars. Are these in a `.env` file on disk? If so, what are the file permissions? Who has SSH access to the VPS? A single developer with VPS access can read all secrets.
3. The plan mentions "per-user quota: premium=daily sync, standard=3-day, free=weekly" (Phase 1 line 302) but there is no user tier system described anywhere in the plan. Is this aspirational or a real SP2 feature? If real, where is the tier assignment logic?
