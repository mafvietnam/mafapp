# Scope & Complexity Critique: MAF Platform SP2-SP7 Plan (Round 2)

**Reviewer:** Scope & Complexity Critic (YAGNI Enforcer)
**Date:** 2026-04-05
**Target:** `plans/260331-0121-maf-platform-sp2-sp7/`
**Perspective:** This plan was previously red-teamed and scope-reduced. This review asks: did the reduction go far enough? Is the plan still over-engineered for a product with zero authenticated users?

---

## Finding 1: The CCU Capacity Analysis Is a Fantasy Document for a Product With 0 Users

- **Severity:** High
- **Location:** `plan.md`, section "VPS Capacity & CCU Analysis" (lines 212-261)
- **Flaw:** 50 lines of detailed CCU tables, RAM headroom projections across 4 phases, and req/s estimates for a product that does not exist yet. Nobody is using this app. The CCU analysis models behavior of 4,000 peak concurrent users when you have not validated that even 10 people want accounts.
- **Failure scenario:** The team spends mental energy debating "NestJS on 4 vCPU: ~1,500-3,000 req/s" and "PostgreSQL with indexes: ~500-1,000 TPS" when the actual next step is shipping a login form and seeing if anyone uses it. Worse, these numbers become anchors that justify premature optimization decisions ("we need Redis sorted sets for leaderboards because our analysis says 500 CCU at SP4").
- **Evidence:** `"Peak CCU = 5-10% of registered users"` -- this assumption is fabricated. You have no user data. Your conversion rate from "person who visits maf.run" to "person who creates account on app.maf.run" could be 0.1% or 50%. The entire table is speculative fiction.
- **Suggested fix:** Delete the CCU Analysis section entirely. Replace with one line: "Single VPS (16 GB/4 vCPU) is sufficient for beta. Revisit scaling when we hit 1K registered users." You will know your actual CCU patterns from real logs, not from a spreadsheet.

---

## Finding 2: Scaling Decision Points Are Decision Theater -- They Distract From Shipping

- **Severity:** High
- **Location:** `plan.md`, section "Scaling Decision Points" (lines 243-253)
- **Flaw:** Six scaling triggers documented (PgBouncer at 5K, separate workers at 10K, Redis pub/sub at 3K WS connections, Prometheus at 15K, 2nd VPS at 30K, load balancer at 50K). This is a scaling runbook for a company that has not shipped its first sprint. These "decision points" will be stale and wrong by the time they become relevant (months or years from now), because the actual architecture will have diverged from this plan.
- **Failure scenario:** A developer reaches 5K users 8 months from now. They open this plan, see "Add PgBouncer," and blindly follow it instead of measuring actual connection pool pressure. Or they add PgBouncer preemptively because "the plan says so." Either way, the plan is harmful: it substitutes for thinking in the moment.
- **Evidence:** `"Add PgBouncer (connection pooling)"` at >5K, but the Phase 1 architecture diagram (line 102) still references `PrismaService (→ PgBouncer → PostgreSQL, pool_size=50)` despite the Validation Session explicitly removing PgBouncer. The plan contradicts itself because future scaling notes were not cleaned up when the current-sprint architecture was simplified.
- **Suggested fix:** Delete the Scaling Decision Points table. Scaling decisions should be made when you have metrics, not pre-scripted in a plan document 8 months early.

---

## Finding 3: Phase 1 Architecture Diagram Was Not Updated After Red-Team / Validation

- **Severity:** Critical
- **Location:** `phase-01-sp2-backend.md`, Architecture section (lines 85-107)
- **Flaw:** The architecture diagram still references infrastructure that was explicitly removed during validation:
  - Line 102: `PrismaService (→ PgBouncer → PostgreSQL, pool_size=50)` -- PgBouncer was removed in Validation Session 1
  - Line 103: `RedisService (Redis Cluster 3-node for horizontal scaling)` -- Redis Cluster was removed, replaced with Redis standalone
  - Line 104: `MetricsService (Prometheus /metrics endpoint)` -- Prometheus was removed for SP2
  - Line 85: `WorkerModule (separate Docker container)` -- Workers run in-process per Tier 1 validation
- **Failure scenario:** Dev A opens Phase 1, reads the architecture diagram (the most prominent visual), and implements Redis Cluster + PgBouncer + Prometheus + separate worker container. The validation corrections are buried in HTML comments and the plan.md's Validation Log. The developer builds the wrong thing because the most visible artifact is stale.
- **Evidence:** Architecture block says `Redis Cluster 3-node` while Key Insights (line 24) says "Single Redis 2-4GB." The same file contradicts itself within 80 lines.
- **Suggested fix:** Delete or rewrite the architecture diagram to match Tier 1 validated decisions. This is the single most dangerous inconsistency in the plan because it will be read first and believed.

---

## Finding 4: Phase 1 Todo List References Deleted Infrastructure

- **Severity:** Critical
- **Location:** `phase-01-sp2-backend.md`, Todo List (lines 363-384)
- **Flaw:** The todo list -- the operational checklist a developer will actually follow -- contains items for infrastructure that was removed:
  - Line 366: `"PgBouncer configured and Prisma connecting through it"` -- PgBouncer removed
  - Line 367: `"Redis Cluster running (3-node, cluster-enabled)"` -- Redis Cluster removed, standalone only
  - Line 369: `"Prometheus /metrics endpoint exposing key metrics"` -- Prometheus removed
  - Line 383: `"Grafana dashboard for job monitoring"` -- Grafana removed
- **Failure scenario:** Dev A follows the checklist, spends 1-2 days setting up PgBouncer + Redis Cluster + Prometheus + Grafana because the checklist says to. Then discovers the Key Insights section contradicts the checklist. Trust in the plan collapses. The developer stops consulting the plan entirely.
- **Evidence:** Compare line 24 ("No PgBouncer, no Prometheus/Grafana in SP2") with line 366 ("PgBouncer configured and Prisma connecting through it"). Direct contradiction.
- **Suggested fix:** Rewrite the todo list to match validated Tier 1 decisions. Every item must be actionable and current.

---

## Finding 5: SP6-SP7 Detail Level Is Waste -- You Are Planning WebSocket Memory Budgets 9 Months Out

- **Severity:** High
- **Location:** `plan.md` Long-Term section (lines 170-209), `phase-07-sp6-mentoring.md`, `phase-08-sp7-ai-coaching.md`
- **Flaw:** SP6 is ~7 months away. SP7 is ~9 months away. The plan specifies WebSocket per-connection memory (~50 KB/conn), Claude API monthly cost estimates ($10-60), detailed DB schemas (messages, training_plans, plan_versions, races, race_results), and specific API endpoints (12+ endpoints across the two phases). This level of detail for work starting in November 2026 is wasted effort. The product will be fundamentally different after 6 months of user feedback.
- **Failure scenario:** You ship SP2 in May, get 200 beta users, and learn that nobody cares about AI coaching -- they want better Strava analytics. But the plan has 6-8 weeks of AI coaching baked in as Phase 8, and the team feels committed to it. The plan becomes a constraint instead of a guide. Alternatively, by November you have pivoted the messaging approach entirely and the SP6 spec is worthless.
- **Evidence:** `phase-08-sp7-ai-coaching.md` specifies `"Race prediction within 10% of actual finish time (for well-trained users)"` as a success criterion. This is a product hypothesis masquerading as a requirement, for a feature 9+ months away, for users who do not exist yet.
- **Suggested fix:** Reduce SP6-SP7 to one-paragraph summaries each. "SP6: mentoring system (trainer-trainee relationships, messaging). SP7: AI coaching (Claude-generated plans, race prediction). Details deferred until SP5 is complete." Delete the phase files. Write them when you are 4 weeks from starting.

---

## Finding 6: Phase 2 Frontend "MVP" Is Still 10 Dashboard Widgets, Not 3-4

- **Severity:** High
- **Location:** `phase-02-sp2-frontend.md`, Week 3 implementation steps (lines 293-346)
- **Flaw:** The Validation Session explicitly scoped the dashboard to "3-4 essential widgets: MAF zone card, activity list, trend chart, profile" and "~20 files." But the implementation steps list 10 separate dashboard component creation tasks (steps 25-34): maf-zone-card, maf-assistant-card, ecosystem-icons, latest-maf-test-card, maf-trend-chart, weekly-stats-row, activity-history-list, activity-history-table, maf-formula-widget, ecosystem-links-widget. The validation notes on line 28 say "Deferred to SP3: Ecosystem icons, AI assistant widget, formula widget, glass-card effects" but the implementation steps still build them all.
- **Evidence:** Line 28: `"Deferred to SP3: Ecosystem icons, AI assistant widget, formula widget, glass-card effects"`. Line 326: `"Create src/components/dashboard/maf-assistant-card.tsx"`. Line 327: `"Create src/components/dashboard/ecosystem-icons.tsx"`. Line 333: `"Create src/components/dashboard/maf-formula-widget.tsx"`. These are the same items marked as deferred, still in the build steps.
- **Suggested fix:** Delete steps 26 (maf-assistant-card), 27 (ecosystem-icons), 33 (maf-formula-widget), 34 (ecosystem-links-widget) from Week 3. Remove the corresponding component files from the architecture section. The validated scope is 3-4 widgets; enforce it.

---

## Finding 7: Per-User Tier Quota System Is Gold-Plating for a Free Beta

- **Severity:** Medium
- **Location:** `phase-01-sp2-backend.md`, Week 3 step 24 (lines 294-303)
- **Flaw:** The Strava rate limiter design includes `"Per-user quota: premium=daily sync, standard=3-day, free=weekly"` and `"Budget: webhooks don't count (free) → API reserved for bulk sync + enrichment"` with percentage allocations (60% webhooks, 30% scheduled, 10% manual). For a beta with <1K users and no monetization model, building a tiered quota system is gold-plating. The rate budget math (lines 293-303) is elaborate for an app that will consume ~1% of its Strava API budget at launch.
- **Failure scenario:** Dev A spends 2-3 days implementing a Redis token bucket with per-tier quotas, budget allocation percentages, and auto-throttling at 90%/95% thresholds. For a beta where total daily usage will be ~50 API calls. The complexity adds bugs (rate limiter incorrectly blocks legitimate syncs) and maintenance burden for zero benefit.
- **Evidence:** `"At scale → webhook-first architecture essential"` (line 293). But the plan already states webhooks are the primary sync mechanism. The rate limiter is protecting against a problem that does not exist at <1K users: 1 sync/user/day = 1000 req/day, exactly at the limit, but only if ALL users sync on the same day AND webhooks are broken.
- **Suggested fix:** Implement a simple global counter (2 Redis keys: `strava:15min`, `strava:daily`). No per-user tiers. No budget allocation percentages. No auto-throttle thresholds. If you hit the limit, queue the request. Add tiers when you have paying users.

---

## Finding 8: "Separate Docker Container" Worker Appears in Phase 1 Despite In-Process Validation

- **Severity:** Medium
- **Location:** `phase-01-sp2-backend.md`, multiple locations
- **Flaw:** Week 1 step 11 correctly says "BullMQ runs in-process with API (Tier 1 -- no separate worker container)." But the architecture diagram (line 85) shows `WorkerModule (separate Docker container)` with dedicated `CriticalWorker`, `DefaultWorker`, `LowWorker` processors. Steps 25 and 28 reference "runs in worker container." The file creation list (lines 206-207) includes both `api/src/main.ts (API app bootstrap)` and `api/src/worker.ts (Worker bootstrap)` -- implying a separate worker process.
- **Evidence:** Line 11: "no separate worker container." Line 85: "(separate Docker container)." Line 207: `api/src/worker.ts — Worker bootstrap (no HTTP, only BullMQ processors)`. Three conflicting decisions in one file.
- **Suggested fix:** Remove `worker.ts`, `worker.module.ts` from files-to-create. Remove the "separate Docker container" annotation. For Tier 1, BullMQ processors register in the main NestJS app. One process, one container.

---

## Finding 9: Phase 4 (Nutrition) and Phase 5 (Challenges) Are Feature Creep Before Product-Market Fit

- **Severity:** High
- **Location:** `phase-04-sp3-nutrition.md`, `phase-05-sp4-challenges.md`
- **Flaw:** After SP2 (auth + Strava + dashboard), the plan immediately jumps to building two large feature modules -- nutrition tracking with Two-Week Test wizards, and community challenges with Redis sorted-set leaderboards and 63 pre-seeded province groups. These are significant features that assume the core product (Strava MAF analysis) is validated and users are asking for more. Neither assumption has been tested. SP3 and SP4 together are 8-12 weeks of development for features that might not be what users want.
- **Failure scenario:** You ship SP2, get 100 beta users who say "the MAF analysis is interesting but I wish it had better Strava analytics / multi-sport support / GPS overlay / better charts." Instead of iterating on the core, you spend 3 months building a nutrition logger and province leaderboards because the plan says to. The 100 users leave because the core is unpolished, and the nutrition/challenge features sit unused.
- **Evidence:** `phase-04-sp3-nutrition.md` includes hydration tracking, a Two-Week Test wizard with 14-day elimination diet protocol, and meal plan content management. This is a standalone nutrition app bolted onto a running analytics tool, not an incremental improvement to the core product.
- **Suggested fix:** After SP2, insert a "SP2.5: Beta Feedback Sprint" (2 weeks). Collect feedback from actual users. Let that feedback determine whether SP3 is nutrition, challenges, better analytics, or something else entirely. Keep SP3-SP7 phase files as aspirational sketches, not detailed specs.

---

## Finding 10: Tech Stack Timeline Tables Are Decision Documentation, Not Action Plans

- **Severity:** Medium
- **Location:** `plan.md`, "Tech Stack Timeline" section (lines 36-168)
- **Flaw:** The Tech Stack Timeline occupies 130 lines with detailed tables listing every technology choice, version number, "Why" column, "Alternatives rejected" column, and RAM impact. For SP2, the Tech Stack table has 18 rows including items like "TypeScript 5.8+" and "Tailwind CSS 3 (existing)." Documenting that you are keeping your existing CSS framework is not useful. The "Alternatives rejected" column (Express, Fastify, TypeORM, Drizzle, Firebase Auth, Axios) is architecture decision record (ADR) content, not sprint plan content.
- **Failure scenario:** The plan is already 500+ lines. Adding 130 lines of tech stack tables with version pinning and rejection rationale makes the plan harder to navigate. Developers skip reading it because it is too long, missing the actually critical content (implementation steps, todo lists, validation corrections).
- **Evidence:** `"Routing | React Router 7 | existing | Already in deps | —"` -- documenting that an existing dependency continues to exist adds zero information.
- **Suggested fix:** Move the Tech Stack Timeline to a separate `tech-decisions.md` reference document. Keep only the NEW additions in the plan: NestJS, Prisma, Redis, BullMQ, WP OAuth Server. Existing stack does not need a row.

---

## Summary

| # | Finding | Severity | Category |
|---|---------|----------|----------|
| 1 | CCU analysis for 0-user product | High | Premature optimization |
| 2 | Scaling decision points are stale-by-design | High | YAGNI violation |
| 3 | Architecture diagram contradicts validated decisions | Critical | Stale artifact |
| 4 | Todo list references deleted infrastructure | Critical | Stale artifact |
| 5 | SP6-SP7 detailed 9 months early | High | Premature planning |
| 6 | "MVP" dashboard still has 10 widgets, not 3-4 | High | Scope creep |
| 7 | Per-user tier quota for free beta | Medium | Gold-plating |
| 8 | Separate worker container despite in-process validation | Medium | Inconsistency |
| 9 | SP3-SP4 before product-market fit | High | Feature creep |
| 10 | Tech stack tables bloat the plan | Medium | Document hygiene |

**Bottom line:** The previous red-team correctly identified the problems. The validation session made the right decisions. But the plan document was not fully rewritten to reflect those decisions. The result is a plan that says "Tier 1, simple, MVP" in its narrative but still contains Tier 3 infrastructure in its architecture diagrams, todo lists, and implementation steps. A developer following this plan will build the wrong thing because the actionable artifacts (diagrams, checklists, steps) were not updated to match the strategic corrections.

The two Critical findings (3 and 4) must be fixed before any developer opens Phase 1. Findings 5 and 6 should be addressed before sprint planning. The rest can be cleaned up incrementally.

---

## Unresolved Questions

1. Has anyone installed WP OAuth Server on maf.run yet? The 1-day spike (Phase 0) is the highest-risk item and nothing in the plan indicates it has been attempted.
2. The plan assumes 2 developers working in parallel. Are these actual people with confirmed availability, or hypothetical resources?
3. The Refactor Plan (blocker) status is "pending." When does it start? SP2 cannot begin until it finishes. This is the real critical path, not any of the scaling analysis.

**Status:** DONE
**Summary:** 10 findings (2 Critical, 5 High, 3 Medium). Core issue: validation decisions were not propagated into actionable artifacts. The plan says MVP but the checklists say enterprise.
