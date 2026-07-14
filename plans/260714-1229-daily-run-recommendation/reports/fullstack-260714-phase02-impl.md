# Phase 2 Implementation Report — Content Library, Guidance & R.E.S.T

**Date:** 2026-07-14
**Agent:** fullstack-developer

## Status: DONE_WITH_CONCERNS

(Concerns are non-blocking: PDF gap extraction blocked by missing credentials, handled per spec's own fallback; content review gate is a human sign-off step outside this agent's scope, flagged below.)

## Files Created

- `src/content/guidance-types.ts` (55 LOC) — `GuidanceCard`, `GuidanceCitation`, `GuidanceAppliesTo`, `GuidanceFlag`, `GuidanceFlagsInput`. Reuses `BookRef` from `maf-coaching-insights.ts` and `DailyRecommendation`/`ReadinessTier` from `types.ts` (DRY).
- `src/content/pre-run.ts` (73 LOC) — 6 cards: `pre_warm_up_aerobic`, `avoid_static_stretching`, `pre_meal_timing`, `pre_caffeine`, `pre_hydration_check`, `avoid_pre_run_refined_carbs`.
- `src/content/post-run.ts` (56 LOC) — 3 cards: `post_cool_down` (sourced), `post_meal_guidance` + `post_hydration` (TODO gap placeholders, see below).
- `src/content/supplementary.ts` (69 LOC) — 5 bài bổ trợ cards: `strength_bodyweight`, `stability_training`, `strength_deadlift`, `strength_nutrition`, `avoid_junk_food_strength_training`.
- `src/content/rest.ts` (78 LOC) — 7 R.E.S.T cards (Recovery x3, Eat x2, Sleep x1, Time x1).
- `src/content/readiness.ts` (46 LOC) — 4 readiness-education cards.
- `src/content/safety.ts` (17 LOC) — `safety_general_disclaimer` (persistent, shared w/ Phase 3).
- `src/content/select-guidance-cards.ts` (132 LOC) — pure `selectGuidanceCards()` + exported `cardMatches()` helper.
- `src/components/today/guidance-card-list.tsx` (83 LOC) — renders selected cards; compact condenses to top 2 + disclaimer, prominent shows full set; citation links use `rel="noopener noreferrer"`.
- `src/utils/__tests__/select-guidance-cards.test.ts` (186 LOC, 44 tests).

## Files Modified

- `src/components/today/today-card.tsx` — imports `GuidanceCardList`, destructures `guidanceCards` from the hook, renders `<GuidanceCardList cards={guidanceCards} compact={compact} />` below `TodayCardReasons` (per delegator's explicit placement instruction: "below the workout/reasons").
- `src/hooks/use-today-recommendation.ts` — added `guidanceCards` computed via `useMemo(() => selectGuidanceCards(recommendation, flags))`, gated to `[]` for children/missing recommendation (mirrors RED TEAM FIX #6). `flags` derived from existing profile state: `isProbation`, `isRecovering`, `isBeginner: isNewbie`, `highBmi: bmi >= 30` (30 = existing "Béo phì"/obese cut-point already used in `maf-calculator-orchestrator.ts`).

No files outside this list were touched. `git status --porcelain -- src/` confirms exactly 2 modified + 3 new paths (today-card.tsx, use-today-recommendation.ts, guidance-card-list.tsx, src/content/, select-guidance-cards.test.ts) — matches File Ownership exactly.

## Design Decisions (where spec was ambiguous)

1. **Ordering conflict resolved via "Output:" line.** Spec's Rules bullet says readiness-education is "prepended"; the Architecture's explicit "Output:" line says the order is pre-run, bài bổ trợ, post-run, *then* education/disclaimer. I followed the more specific "Output:" line — readiness-edu is appended, directly before the always-last disclaimer. Documented in a code comment at the top of `select-guidance-cards.ts`.
2. **Per-category selection limits, not dump-then-slice.** A naive `[...preRun, ...supplementary, ...postRun].slice(0,4)` let the 6-card pre-run library crowd out post-run entirely (caught by my own tests — first test run failed 6/44). Fixed by curating essentials per category (`PRE_RUN_LIMIT=2`, `POST_RUN_LIMIT=1`, `SUPPLEMENTARY_LIMIT=1`) so GREEN days = 2+1+1=4 cards, AMBER = 2+1+1(education)=4. The full 6-item pre-run / 3-item post-run libraries still exist and are citation-tested; only the essentials render by default.
3. **Safety-disclaimer outside the cap.** Spec's cap (≤4) applies to substantive content cards; the disclaimer is "Always include... (short)" — treated as a persistent footer outside the cap, mirroring how `TodayCardReasons` sits outside `MAX_FINDINGS` in `maf-coaching-insights.ts`.
4. **REST day is uncapped by design** (Success Criteria literally says "shows full R.E.S.T card set") — all matching R.E.S.T cards render, plus readiness-edu (AMBER/RED) + disclaimer.
5. **Supplementary "72h rule" simplified (YAGNI).** `selectGuidanceCards` only receives today's `DailyRecommendation` + profile flags — no strength-session history. Rather than fabricate untracked state, it shows one standing bài bổ trợ suggestion on GREEN active-training days only (never AMBER — "recovery-leaning"). Documented as a follow-up if a future phase adds strength-session tracking.
6. **Anti-static-stretching as ONE card covering both pre/post.** `avoid_static_stretching` body explicitly says "trước và sau khi chạy" (before and after) rather than duplicating the card in both categories — satisfies the "pre/post-run 'what to do instead' card" requirement without double-counting against the cap.
7. **File-ownership constraint vs. "no Phase 1 minimal copy remains".** Success Criteria says the REST-day minimal `restCopy` bubble should be superseded. That bubble is rendered by `today-card-workout-summary.tsx`, which is NOT in this phase's file-ownership list (only `today-card.tsx` + the hook are). I did not touch it — `GuidanceCardList` is added alongside/below it instead of replacing it. Net effect: REST days now show the full R.E.S.T set in addition to the existing short headline. Flagging for follow-up if the owner wants the short bubble suppressed when guidance cards render (would need a ~3-line prop addition to `today-card-workout-summary.tsx`, out of this phase's scope).

## PDF Gap Extraction — Attempted, Blocked (per spec §4 fallback used)

Attempted `ai-multimodal` (Gemini) extraction over `docs/the-big-book-of-endurance-training-and-racing.pdf` for post-run meal timing, form drills, beginner progressions:
- `check_setup.py` → no `GEMINI_API_KEY` reachable (not in `~/.claude/.env`, no skill-local `.env`).
- `gemini` CLI (v0.34.0, installed) → no auth method configured.
- Root `.env` / `api/.env` are the only candidate sources — both hit the privacy-block hook, which requires `AskUserQuestion` for approval. This subagent has no `AskUserQuestion` tool and no path to the user, so per the hook's protocol ("never work around it without explicit approval") I did not read those files.

Per spec §4's explicit fallback ("If extraction is inconclusive, add the item as a clearly-marked TODO placeholder... do NOT block the phase"), I added:
- `post_meal_guidance` (post-run.ts) — TODO placeholder, body restates only the already-sourced "real foods" principle, explicitly states no timing/macro specifics are confirmed.
- `post_hydration` (post-run.ts) — TODO placeholder, same pattern (general hydration only, no invented post-run protocol).
- Form drills / beginner progressions — NOT added as cards at all (no safe generic fallback available without inventing specifics); researcher-01 report's Unresolved Questions #6 covers this gap for a future pass.

Both TODO cards are marked `// REVIEW: pending owner sign-off` in code, excluded from default TodayCard rendering (selection limits only surface `post_cool_down`), but present in the content library + fully citation-tested.

**Recommend to human reviewer:** obtain `GEMINI_API_KEY` (or explicitly approve `.env` read) to re-attempt PDF extraction for these 2 gaps + the form-drills/beginner-progression items in a follow-up pass.

## Content Sourced vs. Placeholder

**Sourced (24 cards, all cite a philmaffetone.com article and/or book chapter CH5/CH7):**
pre_warm_up_aerobic, avoid_static_stretching, pre_meal_timing, pre_caffeine, pre_hydration_check, avoid_pre_run_refined_carbs, post_cool_down, strength_bodyweight, stability_training, strength_deadlift, strength_nutrition, avoid_junk_food_strength_training, rest_active_recovery, rest_hard_run_recovery, rest_strength_recovery, eat_fat_adaptation, eat_real_foods, sleep_target, time_detraining, readiness_rhr_baseline, readiness_rhr_red, readiness_sleep_quality, readiness_mood_fatigue, safety_general_disclaimer.

**TODO / PDF-gap placeholders (2 cards, not shown by default in TodayCard):**
`post_meal_guidance`, `post_hydration` (both in `src/content/post-run.ts`, marked `// REVIEW:`).

## Anti-Stretching Stance — Flagged for Human Review

`avoid_static_stretching` (pre-run.ts) is contrarian vs. mainstream Vietnamese running advice (static stretching is widely taught/expected). Content is book-grounded ("The Growing Case Against Stretching", philmaffetone.com) and frames it constructively ("what to do instead": aerobic warm-up + gradual cool-down + strength), but per phase-02 spec's Content Review Gate this needs explicit owner sign-off before it's considered fully shipped-and-confirmed. No code gate blocks it from rendering (spec says "Autonomous run: no owner review gate... flag for later human review" per the delegating task) — it is live in the selector's default output today.

## Low-Confidence Items Flagged

1. `post_meal_guidance` / `post_hydration` — see PDF Gap section above.
2. Supplementary "72h non-consecutive day" spacing — not enforced (no session-history input available); only a single standing suggestion shown on GREEN days.
3. `use-today-recommendation.ts` is now 193 LOC (started at 174; +19 for guidanceCards wiring) — under the 200-line ceiling but close; flagging in case Phase 3/4 additions push it over (would then need splitting per project rules).
4. `vite.config.ts`'s `coverage.include` is scoped to `src/utils/**` only — the new `src/content/**` logic (select-guidance-cards.ts) won't appear in the `npm run test:coverage` numeric report even though it's fully unit-tested (44 tests, all branches incl. dayType/tier/flag predicates via synthetic fixtures). `vite.config.ts` is not in this phase's file-ownership list, so I did not touch it — flagging for a follow-up config change if coverage reporting for `src/content/` is wanted.

## Verification Results (exact)

- `npm run lint`: 4 errors, 25 warnings — **all pre-existing, zero in files I created/modified** (verified: none of the flagged files are `src/content/*`, `src/components/today/guidance-card-list.tsx`, `src/components/today/today-card.tsx`, `src/hooks/use-today-recommendation.ts`, or the new test file).
- `npm test`: **423 passed** (18 test files) — 379 pre-existing + 44 new in `select-guidance-cards.test.ts`. No existing test weakened or skipped.
- `npm run build` (vite): **exit 0**, `✓ built in 4.81s`. Pre-existing >500kB chunk-size warning unrelated to this phase (LineChart/recharts + main bundle, unchanged by this work).
- `cd api && npm run build`: **exit 0**, untouched (no api files in this phase's scope).

## Todo List Status (from phase-02-content-library-guidance.md)

- [x] `guidance-types.ts`
- [x] Category content files (pre-run, post-run, supplementary, rest, readiness, safety)
- [x] PDF gap extraction attempted (ai-multimodal) — blocked on credentials, drafts marked REVIEW per spec fallback
- [x] `select-guidance-cards.ts` + tests (44 tests)
- [x] `guidance-card-list.tsx`
- [x] TodayCard + hook integration (REST → R.E.S.T set added; Phase 1 restCopy bubble NOT removed — see Design Decision #7)
- [ ] Owner content review sign-off (anti-stretching + PDF gaps) — outside this agent's authority, flagged above for human follow-up
- [x] Lint + tests green

## Unresolved Questions

1. Should `today-card-workout-summary.tsx` be touched in a follow-up micro-phase to suppress the Phase 1 `restCopy` bubble when guidance cards render on REST days (to literally satisfy "no Phase 1 minimal copy remains")? Currently both render.
2. Owner sign-off needed on `avoid_static_stretching` content before considering it fully confirmed (currently live, not gated).
3. GEMINI_API_KEY provisioning needed to complete PDF-gap extraction for post-run meal timing/hydration + form drills/beginner progressions (researcher-01 Unresolved Questions #1, #6).
