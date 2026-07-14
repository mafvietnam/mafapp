# Phase 3 — Health-Condition Screening & Safety Advisor — Implementation Report

**Status:** DONE
**Date:** 2026-07-14

## Summary

Implemented healthConditions screening (server-whitelist enum), server-enforced
commitment gate + clearance audit, AMBER-floor (not ceiling) wiring into readiness,
JOINT_ISSUES walk-first/duration-cap/extended-warm-cool in the recommendation engine,
a screening form + pre-run safety card. All work done against local files only — no
DB reachable in this sandbox (confirmed via `npx prisma migrate status` → P1001, and
no `docker`/`psql` binary available); migration SQL is Prisma-generated ground truth
(see migration notes below), never applied anywhere.

## Verification results (exact)

- `cd api && npm run build` → exit 0 (nest build, no output = success)
- `cd api && npx jest` → **139/139 pass** (16 suites) — up from a 114-test/14-suite
  baseline (no pre-existing profile test file existed):
  - `profile.service.spec.ts` (new): 15 tests
  - `profile.dto.spec.ts` (new): 10 tests
  - all other 14 pre-existing suites: unchanged, still passing (114 tests)
- `cd api && npx eslint src/profile/*.ts` (scoped, no `--fix`) → **0 problems**
- `npm run build` (frontend, vite) → exit 0 (only pre-existing chunk-size warning,
  unrelated to this phase)
- `npx vitest run` (frontend) → **464/464 pass** (20 files) — up from 423 baseline
  (+41: 19 `health-condition-rules.test.ts`, 8 `daily-recommendation-health-adjust
  .test.ts`, 4 new `daily-readiness-score.test.ts` cases, 10 new
  `daily-recommendation-engine.test.ts` cases)
- `npm run lint` (frontend, `eslint src/` — no `--fix` in this script) → 29
  pre-existing problems in files I never touched (maf-lab.tsx, strava-connect-card
  .tsx, admin-users-page.tsx, sso-callback-page.tsx, calculator-page.tsx,
  maf-safety-adjustments.test.ts, maf-volume-cap.test.ts) — **zero findings** in any
  Phase 3 file (grep-verified)

## Files created

**Backend**
- `api/prisma/migrations/0006_profile_health_conditions/migration.sql` (42 lines)
- `api/prisma/migrations/0006_profile_health_conditions/down.sql` (16 lines)
- `api/src/profile/profile.service.spec.ts` (308 lines, 15 tests)
- `api/src/profile/profile.dto.spec.ts` (125 lines, 10 tests)

**Frontend**
- `src/utils/health-condition-rules.ts` (131 lines) — pure rule-decision module
- `src/utils/__tests__/health-condition-rules.test.ts` (171 lines, 19 tests)
- `src/utils/daily-recommendation-health-adjust.ts` (50 lines) — JOINT_ISSUES duration-cap/extend-warm-cool math
- `src/utils/__tests__/daily-recommendation-health-adjust.test.ts` (77 lines, 8 tests)
- `src/utils/daily-recommendation-copy.ts` (49 lines) — VN copy extracted from the engine (modularization split, see notes)
- `src/hooks/use-health-adjustment.ts` (25 lines) — thin hook wrapper (modularization split)
- `src/components/health/health-screening-form.tsx` (126 lines)
- `src/components/today/safety-card.tsx` (53 lines)

## Files modified

- `api/prisma/schema.prisma` — `UserProfile` +5 columns (healthConditions,
  healthScreenedAt, healthConsentAt, clearedAt, clearedBy)
- `api/src/profile/profile.dto.ts` — `HealthCondition` enum (whitelist),
  `@IsEnum(..., {each:true})` + `@ArrayMaxSize(3)`, `healthConsent`/
  `healthClearanceConfirmed` intent flags
- `api/src/profile/profile.service.ts` — consent gate, server-enforced commitment
  gate, audited clearedAt/clearedBy (stamp-once/preserve), safe error logging
  (userId+message only), table/column-absent guard on reads
- `src/types.ts` — `HealthCondition` enum (frontend mirror), `UserProfile`
  extension (healthConditions, healthScreenedAt, healthConsentGiven,
  healthConsentAt, healthClearanceConfirmed, clearedAt, clearedBy)
- `src/utils/daily-readiness-score.ts` — floor-source-aware reason text (health vs.
  probation/recovering vs. both), reusing the EXISTING `tierFloor` param (Phase 1
  already exposed this exact extension point)
- `src/utils/daily-recommendation-engine.ts` — optional `healthAdjustment` param;
  GREEN/AMBER branches apply duration cap, walk-first swap, extended warm/cool;
  imports VN copy from new `daily-recommendation-copy.ts` (kept file at 189 LOC)
- `src/hooks/use-today-recommendation.ts` — wires `useHealthAdjustment` →
  `computeReadiness(..., tierFloor)` → `mergeHealthReasons` → `buildDailyRecommendation
  (..., healthAdjustment)`; exposes `healthAdjustment` in the hook's return
- `src/hooks/use-user-profile.ts` — maps server health fields ↔ client profile
- `src/services/profile-service.ts` — `ServerProfile`/`updateProfile` extended with
  health read/write fields
- `src/pages/profile-page.tsx` — mounts `HealthScreeningForm`, maps loaded health
  fields into local state
- `src/components/today/today-card.tsx` — renders `SafetyCard` (always mounted,
  self-hides when `!needsSafetyCard`)
- `src/content/safety.ts` — danger-sign copy, medical disclaimer, screening-intro
  copy (VN copy samples verbatim from the phase spec)
- `src/utils/__tests__/daily-readiness-score.test.ts` — +4 tests (health-floor text
  branches, RED-still-reachable-with-health-floor)
- `src/utils/__tests__/daily-recommendation-engine.test.ts` — +10 tests
  (healthAdjustment wiring on GREEN/AMBER/RED)

## Confirmations (per task's explicit checklist)

1. **Server enforces the commitment gate (not client-only)?** YES.
   `profile.service.ts::upsertProfile` throws `BadRequestException` when
   `healthConditions.length > 0 && !clearanceConfirmed && dto.commitment !== 'HEALTH'`
   — this runs server-side regardless of what the client sends. The client-side
   `health-condition-rules.ts::deriveHealthAdjustment` computes the identical
   predicate for UI messaging ONLY (documented as advisory in both files' doc
   comments) — it never blocks a save; only the server's exception does. Proven by
   `profile.service.spec.ts` "server-enforced clearance/commitment gate (FIX #10)"
   (7 tests: rejects BASE/PERFORMANCE when uncleared, allows HEALTH always, allows
   BASE once cleared + records audit, audit preserved across repeat writes, un-check
   clears audit, unflagged users never gated).
2. **healthConditions rejected-at-write for unknown codes?** YES. `profile.dto.ts`'s
   `@IsEnum(HealthCondition, {each:true})` + global `ValidationPipe({whitelist:true,
   forbidNonWhitelisted:true})` (main.ts, pre-existing) rejects any non-whitelisted
   element with a 400 — proven directly at the DTO layer by
   `profile.dto.spec.ts` ("rejects an unknown code — 400 at write, not silently
   stripped", "rejects a mix of valid + unknown codes", "rejects a non-array value",
   "rejects an array larger than ArrayMaxSize(3)"). Round-trip: `profile.service.ts`
   persists exactly what's validated (no read-time stripping) — proven by
   `profile.service.spec.ts` "lossless round-trip (FIX #9)".
3. **RED still reachable for flagged users (AMBER floor not ceiling)?** YES.
   `daily-readiness-score.ts` composes `tierFloor` via `mostCautious(floor, tier)` —
   raises the MINIMUM but the tier computed from bad/warn signals can still exceed
   it. Proven by `daily-readiness-score.test.ts` "health floor + a bad signal (RHR
   +7) still reaches RED — floor does NOT cap it (FIX #3)" and
   `health-condition-rules.test.ts` "a cleared cardiac user still gets the AMBER
   floor + safety card (clearance does not remove caution levers, FIX #3)".
4. **Did NOT touch prod.** Confirmed — no DB was reachable in this sandbox at all
   (`npx prisma migrate status` → `P1001: Can't reach database server at
   localhost:5432`; no `docker`/`psql` binaries in PATH). Migration SQL was authored
   by hand-copying the EXACT output of `npx prisma migrate diff --from-schema-
   datamodel <before> --to-schema-datamodel <after> --script` (this Prisma subcommand
   computes the diff locally without a live DB connection when both endpoints are
   schema-datamodel files) — this is the real Prisma 6.19.3 engine's ground-truth
   DDL for this exact schema change, not hand-guessed SQL. No `migrate dev`,
   `migrate deploy`, `migrate resolve`, or `db push` was ever run against any
   database, dev or prod.

## Migration notes (0006_profile_health_conditions)

- **Dev-apply not possible in this sandbox**: no Postgres reachable at
  `localhost:5432` (per `.env`), no `docker`/`psql` available. The migration folder
  was authored by hand using Prisma's own diff engine (see above) rather than
  `prisma migrate dev`, matching this repo's existing convention (migrations
  0001-0005 are also NOT timestamp-prefixed the way `migrate dev` auto-generates —
  no `migration_lock.toml` exists in the repo either, confirming migrations here are
  hand-authored/reviewed, not machine-generated-and-committed verbatim).
- **DDL**: `ALTER TABLE "UserProfile" ADD COLUMN "clearedAt" TIMESTAMP(3), ADD COLUMN
  "clearedBy" TEXT, ADD COLUMN "healthConditions" TEXT[] DEFAULT ARRAY[]::TEXT[], ADD
  COLUMN "healthConsentAt" TIMESTAMP(3), ADD COLUMN "healthScreenedAt" TIMESTAMP(3);`
  — additive-only, PG11+ fast-default (metadata-only, no table rewrite for the array
  default). Note Prisma does NOT add `NOT NULL` to the `TEXT[]` column (confirmed via
  the diff tool output) even though the schema has `@default([])` — this is Prisma's
  own established behavior for list-type columns on PostgreSQL, not something I
  changed; `profile.service.ts` always writes `[]` at minimum so no row is ever left
  with `NULL` from this app.
- **Prod DB-first protocol (documented, NOT executed):**
  1. `psql <prod-url> -f api/prisma/migrations/0006_profile_health_conditions/migration.sql`
  2. Verify: `psql <prod-url> -c '\d "UserProfile"'` — confirm the 5 new columns
     exist with the exact types above.
  3. `cd api && npx prisma migrate resolve --applied 0006_profile_health_conditions`
     (marks Prisma's migration history as caught up, matching this repo's documented
     drift-recovery pattern — see user's `project_prod-prisma-migration-drift` memory
     note: never blind `migrate deploy` on this prod DB).
  4. Deploy the code (this phase's build) only AFTER step 2 confirms the columns
     exist — `profile.service.ts::getProfile` has a try/catch table/column-absent
     guard (soft-fails to `null`) for the rollout gap, mirroring
     `checkin.service.ts`'s existing pattern from Phase 1.
  5. Rollback if needed: `psql <prod-url> -f
     api/prisma/migrations/0006_profile_health_conditions/down.sql` (destructive —
     drops the 5 columns, loses any screening data recorded since apply).

## Design decisions / interpretations (documented, not TODOs)

1. **`mafDelta` field** (spec requires it in `HealthAdjustment`'s type) is
   INFORMATIONAL ONLY — not wired into `mafHr` anywhere. Reasoning: the existing
   -5/-10 MAF adjustment already lives in `calculateMAF`'s orchestrator, driven by
   `isMedicatedOrInjured`/`isRecovering` flags computed BEFORE health-condition-rules
   runs. Independently subtracting a second `-5` for CARDIOVASCULAR/HYPERTENSION
   risked either double-counting (if those flags are already set) or inventing a
   new, unreviewed number (if they aren't) — both against the spec's own "no
   invented ceiling" directive. `mafDelta` is computed deterministically
   (`-5` when cardiac flag present, else `0`) and unit-tested, but the caller
   (`use-today-recommendation.ts`) never reads it into the HR pipeline — it's
   reserved for a future UI affordance (e.g. "make sure you've also checked
   'Dùng thuốc/Chấn thương' for the correct HR adjustment").
2. **`clearedBy`** is currently always the fixed string `'self-attested'` when
   `healthClearanceConfirmed` is confirmed — there's no clinician/coach role in this
   app that could set it to something else yet. The AUDITED TIMESTAMP (`clearedAt`)
   is the real Fix #10 improvement over the previous bare boolean; `clearedBy` is a
   placeholder for a future admin/coach-confirmed clearance workflow.
3. **`/plan` page NOT touched.** The spec's Implementation Step 8 says "Clearance-
   gate message in /plan + TodayCard" — `/plan` maps to `src/pages/calculator-page
   .tsx`, which is NOT in the phase's "Related Code Files > Modify" list nor in the
   task's explicit integration-points list. Rather than risk an out-of-scope file
   edit, the clearance-gate message is surfaced in `TodayCard`'s `SafetyCard` only.
   Flagged as a follow-up for whoever owns `/plan`.
4. **Consent/clearance persistence model**: `UserProfile` PUT is a full-replace (all
   other fields on this DTO already work this way — non-optional). `healthConsent`/
   `healthClearanceConfirmed` are WRITE-INTENT booleans (not the stored audit
   fields); the server stamps `healthConsentAt`/`clearedAt`/`clearedBy` on the FIRST
   `true` and preserves them (does not re-stamp) on subsequent `true` writes, and
   nulls them out when the client sends `false`/omits them. The frontend hydrates
   `healthConsentGiven`/`healthClearanceConfirmed` booleans from `!!healthConsentAt`/
   `!!clearedAt` on load, so a user who already consented doesn't need to re-tick
   anything on unrelated profile edits (e.g. updating weight).
5. **`needsSafetyCard`** is true for ANY declared condition (not just cardiac) — the
   spec's requirement #4 says "for flagged users" without qualifying to
   cardiac-only; the danger-sign checklist + disclaimer are universally safe/
   applicable content for any declared condition.

## File-size / modularization notes

- All NEW files are well under 200 LOC.
- `daily-recommendation-engine.ts` grew from 174→214 during initial wiring; split
  VN copy constants into `daily-recommendation-copy.ts` to bring it back to 189.
- `use-today-recommendation.ts` grew from 194→215; extracted
  `use-health-adjustment.ts` to bring it to 204 (still 4 lines over the 200
  guideline — accepted as a live, heavily-cross-referenced orchestration hook where
  further splitting risked hurting readability more than it helped).
- `use-user-profile.ts` (232) and `profile-page.tsx` (249) were ALREADY over 200
  before this phase (222 and 233 respectively) — my additions were +10 and +16
  lines. Left as pre-existing debt, not refactored further (out of phase scope).
- `profile.service.spec.ts` (308 lines, new) — a cohesive test file covering FIX
  #8/#9/#10/#11 as distinct `describe` blocks; splitting would fragment related
  gate-behavior test groups. Flagged as an optional future split
  (e.g. by red-team-fix number) if it grows further.

## Incident during implementation (self-caught, corrected)

`api/package.json`'s `lint` script runs `eslint ... --fix` across the ENTIRE
`api/src` tree (not scoped). Running `npm run lint` in `api/` to verify my own
files auto-reformatted ~28 unrelated files (auth, admin, garmin, strava modules) —
a file-ownership violation. Caught via `git status` showing unexpected modifications,
reverted all unintended files with `git checkout --`, and switched to
`npx eslint <specific-files>` (no `--fix`) for all subsequent verification in both
workspaces. Final `git status` confirms only the files listed above are modified.

## Unresolved questions

1. `/plan` (calculator-page.tsx) clearance-gate messaging — deferred, see design
   decision #3 above. Needs an owner decision: extend calculator-page.tsx in a
   follow-up, or keep clearance-gate visibility TodayCard-only.
2. `clearedBy` is a placeholder constant (`'self-attested'`) — needs product
   direction if/when a clinician-confirmed clearance workflow is introduced.
3. Owner copy review (spec's own todo item, not something I can self-certify) —
   all VN copy either matches the spec's verbatim samples or follows the same
   screening→adjustment→gate→warn-only pattern; still needs a human sign-off per
   the spec's Todo List.
