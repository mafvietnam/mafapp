# Failure-Mode Analyst Review — Daily Run Recommendation Plan

**Reviewer:** code-reviewer (hostile / Murphy's Law perspective)
**Date:** 2026-07-14
**Scope:** plan.md + phase-01..04 (plan documents only, no code)
**Context applied:** prod Prisma migration drift; health-safety feature (false GREEN = harm); Strava webhook NOT registered on prod (sync lag real); Asia/Ho_Chi_Minh fixed +07.

---

## Finding 1: Tier-clamp semantics inverted — "never exceeds AMBER" forbids RED for the sickest users

- **Severity:** Critical
- **Location:** Phase 3, sections "Screening flow (data flow)" + "Success Criteria"; Phase 1, section "daily-readiness-score.ts" (profile signal)
- **Flaw:** The plan uses "clamp max tier to AMBER" / "readiness tier never exceeds AMBER" for flagged and probation users. With severity ordering GREEN < AMBER < RED, "never exceeds AMBER" literally means **RED is unreachable** — the users with cardiovascular flags can never be told to REST by the readiness engine. The intent is almost certainly "never *better* than AMBER" (floor, not ceiling), but the words specify a ceiling.
- **Failure scenario:** User with CARDIOVASCULAR flag wakes with restingHR +9 bpm (a `bad` signal, Ch7 overtraining/stress sign — exactly the population where this matters most). Engine computes RED → clamp per spec caps at AMBER → app recommends a reduced 30-min walk/run instead of forced REST. A test suite written faithfully to the Phase 3 success criterion ("Flagged user's readiness tier never exceeds AMBER") **encodes the dangerous behavior and turns it green in CI.** Nobody catches it because the tests pass.
- **Evidence:** Phase 3 data-flow: "any flag → max tier AMBER"; Phase 3 Success Criteria: "Flagged user's readiness tier never exceeds AMBER"; Phase 1: "isProbation OR isRecovering → clamp max tier to AMBER (conservative)". No sentence anywhere states RED must remain reachable for flagged users.
- **Suggested fix:** Replace all clamp language with unambiguous floor semantics: "flagged/probation users' tier is AT LEAST AMBER (may still escalate to RED); RED signals are never downgraded." Rewrite the Phase 3 success criterion to: "flagged user is never GREEN; a `bad` signal still yields RED." Add an explicit unit test: flagged user + bad RHR delta → RED.

## Finding 2: Safety decision computed client-side; Phase 4 server "re-validation" cannot actually verify the tier

- **Severity:** Critical
- **Location:** Phase 4, section "Backend module" (Decision (b)); Phase 1, section "Frontend wiring" (`use-today-recommendation.ts`)
- **Flaw:** All safety-critical computation (readiness tier, adjustments) lives in frontend pure utils. Phase 4 explicitly rejects server recompute and picks option (b): "accept the client's `DailyRecommendation` but re-validate it server-side against profile + template (cheap deterministic check)." But the tier is derived from Strava activities + Garmin summaries + check-in — inputs the server does NOT re-derive under option (b). Template + profile validation can verify `totalMinutes` and `mafHr` shape, but **cannot verify tier=GREEN vs RED**. The claim "server validates, does not trust blindly" is false for the one field that matters.
- **Failure scenario:** (a) Buggy client build (stale bundle, broken hook) computes GREEN for a user whose check-in says fatigue 5. Client POSTs the wrong recommendation; server "validation" passes (template/duration match); Claude generates a warm "great day to run!" narrative; it's **cached in Redis + DB for the whole day** and served on every reload — the wrong advice is now durable and authoritative-looking. (b) Malicious client sends forged tier → server produces, signs-off, and persists AI-branded health advice it never verified. There is also zero server-side audit trail of what was actually recommended to whom — indefensible for a health feature if a user is harmed.
- **Evidence:** Phase 4: "**Decision: (b)** to avoid a shared-package refactor now (YAGNI) — server validates, does not trust blindly." No enumeration of WHAT is validated; tier is unverifiable from profile + template alone. Phase 4 Security: "Input = final JSON only" — which is precisely the untrusted client JSON.
- **Suggested fix:** Either (1) server recomputes tier from server-held data (check-ins and Garmin summaries are already in the DB; Strava activities are in the DB — server has MORE of the inputs than the client), or (2) constrain the narrative to phrase only server-verifiable fields and drop tier-dependent phrasing, or (3) at minimum log the full accepted recommendation JSON per generation for audit, and validate tier against a server-side check-in/RHR lookup (reject GREEN when today's check-in shows fatigue ≥ 4 or a bad RHR delta). Document exactly which fields option-(b) validation checks.

## Finding 3: Drifted-prod migration protocol has no ordering, partial-failure, or rollback story — and it's 3 migrations, not a footnote

- **Severity:** High
- **Location:** plan.md "Key Dependencies"; Phase 1 Implementation Step 2; Phase 3 Step 1; Phase 4 Step 1
- **Flaw:** The plan correctly repeats "manual SQL + `migrate resolve`" but stops there. Missing: (1) **deploy ordering** — Phase 1 registers `CheckinModule` "unconditional — no feature flag", so if the API container deploys before the manual SQL is applied, every `/checkins` call (and the dashboard TodayCard that fires it on load) 500s in prod; (2) **partial-failure handling** — if the hand-run psql script fails midway (e.g., Phase 3 `text[] DEFAULT '{}'` DDL mismatch, a risk the plan itself flags), an operator following the written steps still runs `migrate resolve --applied`, marking a broken migration as applied and **making the existing drift permanently worse**; (3) **rollback** — no down-SQL, no revert plan for any of the THREE migrations (daily_checkins, profile_health_conditions, coaching_narrative_cache — plan.md's risk framing reads like two); (4) "verify column presence post-deploy" (Phase 1 risk table) is verification AFTER the blast radius, not before.
- **Failure scenario:** Phase 3 deploy: manual SQL uses `DEFAULT '{}'::text[]` but Prisma client was generated expecting the column nullable/non-null variant that differs; `migrate resolve --applied` is run; API deploys; `profile.upsert` starts throwing P2022/type errors for every user who saves a profile; rollback requires hand-written reverse DDL that nobody drafted, on a Sunday, against a drifted history where `migrate diff` output can't be trusted.
- **Evidence:** Phase 1 Step 2 ends at "`migrate resolve --applied ... (drift protocol)`" — no ordering clause, no "verify with `SELECT` before resolve", no down.sql. Phase 1: "Register in app.module.ts imports (unconditional — no feature flag)."
- **Suggested fix:** Add to every migration step: (a) apply SQL → verify via `psql \d` / SELECT → only then `migrate resolve` → only then deploy API image; (b) write a `down.sql` alongside each `migration.sql`; (c) make the checkin endpoints tolerate missing-table (or flag the module for first deploy) so code-first deploys degrade instead of 500ing the dashboard.

## Finding 4: Stale Strava data produces confident false GREEN — "missing signal contributes nothing" is the wrong default for freshness

- **Severity:** High
- **Location:** Phase 1, sections "daily-readiness-score.ts" (graceful degradation, days-since-last-run, load) and "Key Insights"
- **Flaw:** The engine treats absent/missing signals as zero penalty ("missing signal contributes nothing (not a penalty)") and computes `days-since-last-run` and 7-day load from `recentActivities`. But prod Strava sync has **no webhook registered** (pending Cloudflare rule) — activities arrive with lag (manual/login-triggered sync). The plan never distinguishes "no data" from "data not yet synced," and has no freshness check on the activity feed.
- **Failure scenario:** User runs a hard 90-min session at 06:00; Strava sync hasn't fired. At 17:00 they open the dashboard: `days-since-last-run` = 3, load = low, no penalties → GREEN "Chạy nhẹ nhàng 45 phút." User doubles up on a day the engine should have flagged "ran already → lighter." Same mechanism poisons the adherence strip (today marked "missed" → guilt-trips user into a second run). The plan's own risk table covers "sparse Garmin" but never "stale Strava," which is the more common feed.
- **Evidence:** Phase 1: "Graceful degradation: each signal is optional; missing signal contributes nothing (not a penalty)." No mention of activity-feed freshness, last-sync timestamp, or webhook status anywhere in the plan.
- **Suggested fix:** Surface last-sync age on the TodayCard ("Dữ liệu Strava cập nhật X giờ trước"); when the activity feed is older than N hours, phrase the recommendation conditionally ("nếu bạn chưa chạy hôm nay…") and never show "missed" for today; trigger a sync on dashboard load before computing readiness.

## Finding 5: Timezone split-brain — "today" is defined in three places (client util, check-in endpoint, Phase 4 cache key) with only one specified

- **Severity:** High
- **Location:** Phase 1, sections "local-today.ts" + "Backend: daily_checkins" (POST /checkins date derivation); Phase 4, section "Caching" (`coaching:{userId}:{localDate}`)
- **Flaw:** `local-today.ts` is a **frontend** util. The server needs the same "local date" twice: (1) `POST /checkins` upsert key — plan waffles: "server derives date from request TZ header or accepts client `date`" (two contradictory designs, neither chosen; "TZ header" is not a standard header); (2) Phase 4 cache key `{localDate}` and `CoachingNarrative.date @db.Date` — computed server-side in an unspecified TZ. If the server (Docker, almost certainly UTC) uses its own date, the coaching cache and check-in rows roll over at **07:00 ICT, not midnight**.
- **Failure scenario:** (a) Midnight race: user submits check-in 23:59:50 ICT; request lands 00:00:20; client-sent date says yesterday (or server-derived date says today, depending on the unchosen branch) → check-in upserted under the wrong day → this morning's readiness reads `checkin: null` → fatigue-5 report silently ignored → GREEN instead of RED. (b) UTC server date: user opens app 05:30 ICT with a fresh RED check-in; Redis/DB key is still *yesterday's* date row; unique `(userId,date)` row holds yesterday's GREEN narrative; hash comparison is against the wrong row → serves yesterday's "run hard" narrative on a rest-required morning. (c) `date` accepted from client with only "validate ISO date" → any past/future date accepted → baseline and adherence poisoning.
- **Evidence:** Phase 1: "server derives date from request TZ header **or** accepts client `date` (validate ISO date)" — unresolved "or" in the data-integrity-critical path. Phase 4: "Natural daily rollover via `localDate` key" with no TZ specified. plan.md success criterion says "user-local TZ (Asia/Ho_Chi_Minh)" while local-today hardcodes ICT — also wrong for any non-VN user, contradicting "user-local."
- **Suggested fix:** One rule, stated once: **server computes local date in Asia/Ho_Chi_Minh from server clock** for check-in upsert AND coaching cache key; client `date` accepted only if within ±1 day of that (reject otherwise); add a shared `toIctDateString(Date)` on the API side with midnight-boundary tests mirroring local-today's.

## Finding 6: RHR baseline math is unguarded — sparse samples and Garmin-vs-manual source mixing produce false tiers in both directions

- **Severity:** High
- **Location:** Phase 1, section "daily-readiness-score.ts" (restingHR delta signal)
- **Flaw:** Baseline = "trailing mean of restingHeartRate over last 14 avail days" with no minimum-sample guard, and "Check-in `restingHr` used if Garmin absent" — meaning a manually-measured value can be compared against a Garmin-derived baseline (or vice versa). Garmin RHR (overnight continuous) reads systematically lower than a seated manual morning measurement; the plan's own premise is that Garmin coverage is sparse (10-athlete cap era), so 1-3-sample baselines are the *common* case, not the edge.
- **Failure scenario:** (a) False RED: user has 2 Garmin days (RHR 49, 51 → baseline 50), Garmin lapses, user manually measures 58 (normal for manual) → delta +8 → `bad` → forced REST on a healthy day; three of those in a week and the user stops trusting or opens the app less — the "daily retention driver" becomes a churn driver. (b) False GREEN (worse): baseline built from manual check-ins (~58), today Garmin returns 54 while user is actually elevated vs their true Garmin baseline of 47 → delta reads −4 → no warning → hard run recommended to a genuinely stressed user. The +5/+7 thresholds are meaningless across mixed sources.
- **Evidence:** Phase 1: "baseline = trailing mean of `restingHeartRate` over last 14 avail days (exclude today); `+5 bpm` ≥ warn, `+7 bpm` ≥ bad... Check-in `restingHr` used if Garmin absent." No min-N, no per-source baseline, no outlier trimming.
- **Suggested fix:** Require min 5 same-source samples before the RHR signal activates (else signal = absent); keep separate baselines per source (garmin vs manual); never compute a delta across sources. Add tests for 0/1/2-sample and mixed-source cases.

## Finding 7: RED rule contradicts itself — the single most safety-critical branch is ambiguous

- **Severity:** Medium
- **Location:** Phase 1, section "daily-recommendation-engine.ts" (Adjustment rules) vs Phase 1 Risk Assessment table
- **Flaw:** The RED rule reads: "`RED` → force `REST` (or easy WALK ≤30min **if scheduled item was already REST** and user wants movement)." The condition is nonsensical as written (the walk-escape applies only when the schedule already said REST — so a RED user whose schedule said RUN gets pure forced REST, but a RED user on a scheduled REST day gets offered a walk?). Meanwhile the risk table's mitigation for "over-aggressive RED" is "allow 'chạy nhẹ thay vì nghỉ'" — allow a light *run* instead of rest — directly contradicting "force REST." Two documents, three behaviors, for the branch where the app tells an overtrained user what to do.
- **Failure scenario:** Implementer resolves the ambiguity by following the risk-table mitigation (it's the user-friendlier reading) and ships a "chạy nhẹ" escape hatch on RED days. User with +8 bpm RHR and fatigue 5 taps it daily. The deterministic-safety story ("zero uncontrolled advice") is broken by the plan's own text, and Phase 4's LLM will happily narrate whichever behavior ships.
- **Evidence:** Adjustment rules: "force REST (or easy WALK ≤30min if scheduled item was already REST and user wants movement)"; Risk table: "always show 'why' + allow 'chạy nhẹ thay vì nghỉ'."
- **Suggested fix:** Rewrite the RED branch as an explicit decision table: RED → dayType=REST always; optional user-initiated escape = WALK ≤30min at ≤MAF−20 (never RUN), gated behind an explicit tap with warning copy; delete "chạy nhẹ" from the risk table. Add a test asserting RED never yields dayType RUN/LONG_RUN.

## Finding 8: AMBER duration arithmetic degenerates — 15+15 warm-up/cool-down eats the entire session

- **Severity:** Medium
- **Location:** Phase 1, section "daily-recommendation-engine.ts" (Adjustment rules: AMBER −35%, "Always: warmupMin=cooldownMin=15", "<30min → all easy")
- **Flaw:** AMBER reduces totalMinutes by ~35% (rounded to 5) and then subtracts fixed 15+15. The `<30min → allEasy` exception covers totals under 30, but the 30–35 band yields `mainMinutes` of 0–5 with a displayed MAF HR zone: a structurally absurd recommendation. Concrete: scheduled 45min, AMBER → 30 total → 15 warm-up + 15 cool-down + **0 main minutes** in zone.
- **Failure scenario:** Every HEALTH/BASE-commitment user (whose scheduled sessions are 40-50min) who logs one bad night's sleep gets "Chạy 30 phút: khởi động 15 + thả lỏng 15 + 0 phút chính, giữ vùng MAF 130–140" — visibly broken math on the flagship card, on day one, for the most common tier transition. Trust in the "deterministic engine" evaporates over an off-by-band bug the plan's own test list (`<30min all-easy`) won't catch because 30 is not <30.
- **Evidence:** "AMBER → reduce totalMinutes by ~35% (rounded to 5)... Always: warmupMin=cooldownMin=15... exception — total <30min → entirely easy... mainMinutes = totalMinutes − warmup − cooldown (≥0)." The `(≥0)` clamp proves the degenerate case was noticed and papered over rather than designed.
- **Suggested fix:** Change the all-easy threshold to `mainMinutes < 10` (i.e., total < 40 post-adjustment) or scale warm-up/cool-down proportionally for short sessions (e.g., 10+10 under 40min, citing Ch5's intent rather than its literal number). Add boundary tests at totals 30, 35, 40.

## Finding 9: Phase 4 cost bound is illusory — inputHash regeneration is unbounded and concurrent misses double-spend

- **Severity:** Medium
- **Location:** Phase 4, sections "Caching" + "Env / config" + Success Criteria
- **Flaw:** The "1 gen/user/day" cap self-destructs via its own invalidation rule: "regenerate only when inputs hash changes." Inputs include check-in (freely editable — upsert), activities (each sync mutates load/days-since numbers), and Garmin summaries. Every check-in field toggle = new hash = new paid generation; the plan says "bounded regen" with no bound number. Additionally: (a) two concurrent cache misses (two tabs, dashboard + journal both mounting TodayCard) both call Claude — no single-flight/lock is specified; the DB `@@unique([userId,date])` then makes the second write throw P2002, and "never throw to client" isn't wired to that path; (b) `AI_COACHING_DAILY_BUDGET (optional global cap)` names an env var but no enforcement mechanism — no counter, no storage, no reset semantics — it is a config knob attached to nothing.
- **Failure scenario:** User fiddles with the check-in form (sleep 3→4→3, soreness on/off) while the dashboard refetches: 6 regenerations before breakfast. Multiply by an engaged user base; the "haiku-class, ~1/user/day" cost model is off by an order of magnitude, and nobody notices until the invoice because the budget cap was never implemented (it couldn't be — it has no design). Meanwhile alternating hash writes from two tabs leave the cache row storing hash A while the live input is hash B → *every* subsequent request is a miss → regen loop for the rest of the day.
- **Evidence:** Phase 4: "Cap = at most 1 successful generation per user per day **unless inputHash changes** (bounded regen)" — the exception is the unbounded part; "`AI_COACHING_DAILY_BUDGET` (optional global cap)" appears only in the env list, absent from the service step list and data flow; no lock/single-flight anywhere in the data-flow diagram.
- **Suggested fix:** Hard per-user regen ceiling (e.g., max 3 generations/user/localDate regardless of hash churn — after that, serve last narrative or template); debounce hash inputs (exclude volatile floats; hash tier+dayType+minutes, not raw arrays); Redis `SET NX` lock around generation (single-flight); specify budget enforcement (Redis daily counter, checked at step 4) or delete the env var from the plan.

---

## Summary Table

| # | Finding | Severity |
|---|---------|----------|
| 1 | Tier-clamp inversion blocks RED/REST for flagged (cardiac) users | Critical |
| 2 | Client-side safety decision; server "re-validation" can't verify tier | Critical |
| 3 | Migration protocol: no deploy ordering, partial-failure, or rollback on drifted prod | High |
| 4 | Stale Strava (no prod webhook) → confident false GREEN | High |
| 5 | Timezone split-brain: 3 definitions of "today", midnight/UTC races | High |
| 6 | RHR baseline: no min-sample guard, Garmin-vs-manual mixing | High |
| 7 | RED rule self-contradiction (force REST vs "chạy nhẹ" escape) | Medium |
| 8 | AMBER math degenerates: 30-min total = 0 main minutes | Medium |
| 9 | Phase 4 cost bound illusory: unbounded hash regen, no single-flight, phantom budget var | Medium |

## Unresolved Questions

- Which fields exactly does Phase 4 option-(b) validation check? (Plan never enumerates — see Finding 2.)
- Is `POST /checkins` date server-derived or client-sent? The plan's "or" must be resolved before implementation (Finding 5).
- Is the app ICT-only by product decision? plan.md says "user-local TZ" while all code hardcodes Asia/Ho_Chi_Minh — pick one and state it.
