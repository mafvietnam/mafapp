# Phase 2 — Content Library, Guidance & R.E.S.T

## Context Links

- Source of truth: `../reports/brainstorm-260714-1229-daily-run-recommendation-maf.md` §5 Phase 2
- Content skeleton (35 items + citations + gaps): `research/researcher-01-maffetone-content-report.md`
- Domain rules: `../../docs/MAF_RULES_SUMMARY.md` (Ch5, Ch7)
- Consumes Phase 1: `daily-recommendation-engine.ts` output (dayType + tier + reasons), `TodayCard`
- Book PDF for gap extraction: `../../docs/the-big-book-of-endurance-training-and-racing.pdf`

## Overview

- **Priority:** P1
- **Status:** pending (depends on Phase 1)
- **Effort:** 2.5 days
- **Description:** Curated static Vietnamese content library (`src/content/` TS constants) for pre/post-run guidance,
  bài bổ trợ (Maffetone strength/stability, anti-static-stretching), and R.E.S.T recovery cards. Rule-based selection
  by day type + readiness tier + flags. No runtime generation. Replaces Phase 1 REST minimal copy.

## Key Insights

- Content is DATA, not logic: static TS constants, each item cites a book chapter or a philmaffetone.com URL
  (matches `maf-coaching-insights.ts` citation ethos). No AI here — that's Phase 4.
- Maffetone is **skeptical of static stretching** (research §3): warm-up/cool-down + dynamic movement REPLACE
  stretching. This is contrarian vs mainstream VN running advice → MUST survive content review, flagged for owner.
- Selection is a pure rule map (`dayType × tier × flags → cardIds[]`), reusing Phase 1's `DailyRecommendation`.
  KISS: no CMS, no DB — YAGNI until content needs non-dev editing.
- Research flagged gaps requiring the PDF (post-run meal timing, form drills, beginner progressions) — extract with
  `ai-multimodal` skill, but gate ship on content review.
- <!-- RED TEAM FIX #14: `GuidanceCitation.bookRef?: BookRef` reuses the coaching-insights union — Phase 1 extends it
  with CH6/CH7. Any card citing CH6/CH7 depends on that extension having landed (Phase 1 step 1). -->
- <!-- RED TEAM FIX #13: RED-tier / readiness cards must NOT suggest a light RUN. RED = REST or gentle recovery WALK only.
  The `readiness_rhr_red` + REST cards phrase rest/walk, never "chạy nhẹ". Keep consistent with the engine. -->

## Requirements

### Functional
1. Content library modules under `src/content/` with typed `GuidanceCard` items (id, category, title VN, body VN,
   citation, appliesTo tags).
2. `selectGuidanceCards(recommendation, flags)` pure fn → ordered `GuidanceCard[]` for the TodayCard.
3. Categories: pre-run, post-run, bài bổ trợ, R.E.S.T (Recovery/Eat/Sleep/Time), readiness-education, safety-disclaimer.
4. REST-day TodayCard renders full R.E.S.T cards (supersedes Phase 1 minimal copy).
5. Anti-static-stretching guidance surfaced as pre/post-run "what to do instead" card.

### Non-Functional
- Each content file <200 LOC; split by category (pre-run.ts, post-run.ts, supplementary.ts, rest.ts, readiness.ts, safety.ts).
- Every card has a non-empty `citation`. No card ships without a source.
- All copy Vietnamese; source cited inline (chapter or URL).

## Architecture

### Content model (`src/content/guidance-types.ts`)

```ts
export type GuidanceCategory =
  | 'pre-run' | 'post-run' | 'supplementary'
  | 'recovery' | 'eat' | 'sleep' | 'time'      // R.E.S.T
  | 'readiness-edu' | 'safety-disclaimer';

export interface GuidanceCitation { label: string; bookRef?: BookRef; url?: string }

export interface GuidanceCard {
  id: string;                 // stable, e.g. 'pre_warm_up_aerobic'
  category: GuidanceCategory;
  title: string;              // VN
  body: string;               // VN, template-literal (XSS-safe)
  citation: GuidanceCitation;
  appliesTo: {                // selection predicates
    dayTypes?: DailyRecommendation['dayType'][];
    tiers?: ('GREEN'|'AMBER'|'RED')[];
    flags?: ('probation'|'recovering'|'beginner'|'highBmi')[];
  };
}
```

### Selection (`src/content/select-guidance-cards.ts`, pure)

- **Input:** `DailyRecommendation` + `{ isProbation; isRecovering; isBeginner; highBmi }`.
- **Rules:**
  - `dayType === 'REST'` → R.E.S.T set (recovery + sleep + eat + time), suppress pre/post-run.
  - RUN/WALK/LONG_RUN/RECOVERY → pre-run set (warm-up, hydration, meal timing, caffeine, anti-stretching) +
    post-run set (cool-down, refuel) + optional bài bổ trợ (strength on non-consecutive days per 72h rule).
  - `tier === 'AMBER'|'RED'` → prepend readiness-education card explaining the signal.
  - Always include the persistent safety-disclaimer card (short).
- **Output:** ordered `GuidanceCard[]` (pre-run first, then bài bổ trợ, then post-run, then education/disclaimer).
- Cap rendered count (e.g. ≤4) to avoid overwhelming the card; mirror `MAX_FINDINGS` cap idea from coaching-insights.

### Content population (from research §"Vietnamese Content Library Skeleton")

- **pre-run.ts:** `pre_warm_up_aerobic`, `pre_meal_timing`, `pre_caffeine`, `pre_hydration_check`, `avoid_static_stretching`,
  `avoid_pre_run_refined_carbs`.
- **post-run.ts:** `post_cool_down`, `post_meal_guidance` (gap — PDF), `post_hydration` (gap — PDF).
- **supplementary.ts:** `strength_deadlift`, `strength_bodyweight`, `stability_training`, `strength_nutrition`,
  `avoid_junk_food_strength_training`. Frame per Maffetone: slow/heavy low-rep neural strength, bodyweight, stability;
  NOT hypertrophy circuits.
- **rest.ts (R.E.S.T):** Recovery (`rest_active_recovery`, `rest_hard_run_recovery` 24-48h, `rest_strength_recovery` 72h),
  Eat (`eat_fat_adaptation`, `eat_real_foods`), Sleep (`sleep_target` 7-9h), Time/sTress (`time_detraining`).
- **readiness.ts:** `readiness_rhr_baseline`, `readiness_rhr_red`, `readiness_sleep_quality`, `readiness_mood_fatigue`
  (education cards explaining the readiness signals from Phase 1).
- **safety.ts:** `safety_general_disclaimer` (persistent "app không thay thế bác sĩ") — shared w/ Phase 3.

### TodayCard integration

- Extend Phase 1 `TodayCard` to render a `GuidanceCard[]` section under the recommendation (collapsible on compact variant).
- REST day: swap Phase 1 `restCopy` for the R.E.S.T card set.

## Related Code Files

### Create
- `src/content/guidance-types.ts`
- `src/content/pre-run.ts`
- `src/content/post-run.ts`
- `src/content/supplementary.ts`
- `src/content/rest.ts`
- `src/content/readiness.ts`
- `src/content/safety.ts`
- `src/content/select-guidance-cards.ts`
- `src/utils/__tests__/select-guidance-cards.test.ts`
- `src/components/today/guidance-card-list.tsx`

### Modify
- `src/components/today/today-card.tsx` (render guidance list; REST uses R.E.S.T set)
- `src/hooks/use-today-recommendation.ts` (call `selectGuidanceCards`)

### Delete
- None

## Implementation Steps

1. `guidance-types.ts` — types + shared `BookRef` import from coaching-insights (DRY).
2. Populate category files from research skeleton (VN copy, citations). One file per category, <200 LOC.
3. **Gap extraction (owner-gated):** run `ai-multimodal` skill over `docs/the-big-book-of-endurance-training-and-racing.pdf`
   for post-run meal timing, form drills, beginner progressions. Draft cards; mark `// REVIEW: pending owner sign-off`.
4. `select-guidance-cards.ts` + tests — rule map per dayType/tier/flags; cap; ordering.
5. `guidance-card-list.tsx` — render cards (title, body, citation link/chapter).
6. Wire into TodayCard + hook; REST-day R.E.S.T set replaces Phase 1 minimal copy.
7. **Content review gate** (see below) BEFORE merge.
8. Verify: `npm run lint`, `npm test`.

## Content Review Gate (blocking merge)

- Owner reviews all cards for scientific accuracy, ESPECIALLY the **anti-static-stretching stance** (contrarian) and
  any PDF-extracted gap content.
- Low-confidence research items (post-run meal timing, form drills) must be owner-confirmed or omitted — do NOT ship
  invented specifics.
- Sign-off recorded in this file's Todo before merge.

## VN Copy Samples

- Warm-up: `Khởi động 12–15 phút bằng vận động hiếu khí nhẹ (đi bộ nhanh/chạy rất chậm) — KHÔNG giãn cơ tĩnh. (Aerobic Training Guidelines)`
- Anti-stretching: `Giãn cơ tĩnh không giảm chấn thương và có thể gây hại. Thay vào đó: khởi động động + tăng sức mạnh. (The Growing Case Against Stretching)`
- R.E.S.T Recovery: `Ngày nghỉ là lúc cơ thể tái tạo mạnh hơn. Chạy nặng cần 24–48h hồi phục; tập tạ cần 72h. (Recovery: The Secret Weapon)`
- Sleep: `Ngủ 7–9 tiếng liền mạch — phần cốt lõi của hồi phục. (Recovery: The Secret Weapon)`
- Disclaimer: `Nội dung mang tính tham khảo theo phương pháp MAF, không thay thế tư vấn y tế.`

## Todo List

- [ ] `guidance-types.ts`
- [ ] Category content files (pre-run, post-run, supplementary, rest, readiness, safety)
- [ ] PDF gap extraction (ai-multimodal) — drafts marked REVIEW
- [ ] `select-guidance-cards.ts` + tests
- [ ] `guidance-card-list.tsx`
- [ ] TodayCard + hook integration (REST → R.E.S.T set)
- [ ] Owner content review sign-off (anti-stretching + PDF gaps)
- [ ] Lint + tests green

## Success Criteria

- REST-day TodayCard shows full R.E.S.T card set with citations (no Phase 1 minimal copy remains).
- Run-day card shows pre-run + post-run + (conditionally) bài bổ trợ, each citing a source.
- AMBER/RED days prepend a readiness-education card.
- Anti-static-stretching card renders on pre/post-run.
- `selectGuidanceCards` unit-tested per dayType/tier/flag combination; every card has non-empty citation (test asserts).
- Owner sign-off recorded.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Anti-stretching stance rejected by users/owner | Med | Med | Owner review gate; frame as "what to do instead", cite source |
| PDF gap content inaccurate (hallucinated) | Med | High | ai-multimodal extraction + owner confirm; omit if unresolved (no invented specifics) |
| Card overload clutters TodayCard | Med | Low | Cap ≤4; collapsible on compact; priority ordering |
| Content drifts from citations over edits | Low | Med | Test asserts non-empty citation per card; PR review |

## Security Considerations

- Content is static app data (no user input, no injection surface). Bodies are template literals rendered as text.
- External citation URLs open in new tab with `rel="noopener noreferrer"`.

## Next Steps

- Phase 3 adds special-population safety cards (reuses `safety.ts` disclaimer + adds danger-sign card).
- Phase 4 AI narrative may reference selected card IDs as grounding sources (cite-only-provided constraint).

## Unresolved Questions

- Post-run meal timing + form drills: confirmable only from PDF/owner — flagged, not blocking Phase 2 skeleton.
