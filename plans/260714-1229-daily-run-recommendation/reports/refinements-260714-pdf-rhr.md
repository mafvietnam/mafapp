# Refinements 260714 — PDF content gaps + RHR Garmin labeling

Plan: `plans/260714-1229-daily-run-recommendation/`. Branch `dev`. No deploy, no commit/push, no prod touch.

## TASK 1 — PDF extraction (free/local only)

Tool used: venv pypdf (`.claude\skills\.venv\Scripts\python.exe`, pypdf 6.9.2, already installed — no install needed). Wrote a throwaway script (scratchpad, deleted with session) that dumped all 895 pages of `docs/the-big-book-of-endurance-training-and-racing.pdf` to a text file, then grepped for each topic and read the surrounding pages via `sed`. **Zero paid APIs used** (no Gemini/OpenAI key touched).

### What the book DID cover (extracted, cited, now in code)

1. **Post-run meal/nutrition timing** — CH18 "Eating and Drinking Your Way to Better Endurance," section "After Competition" (p.457). Real numbers: eat within 15–30 min of finishing a long/hard session (carb+protein+fat combo), continue eating normally + water every ~2h after that window, avoid alcohol/caffeine during recovery. Book's own caveat carried into copy: this protocol is written for long/hard/competition recovery — CH18 itself notes fat-adapted athletes on ordinary 2–3h aerobic sessions typically need nothing but water. → `post_meal_guidance` in `src/content/post-run.ts`.
2. **Post-run hydration** — CH17 "Water and Electrolytes," section "Rehydrating" (p.433-434). Real numbers: ~500ml water every 30 min after long/hard workout (better than one large dose — avoids diuretic rebound); drink before+immediately after workouts; urine-color self-check (pale=hydrated, dark=dehydrated, except first morning void); sodium/electrolyte add-back for long/hot sessions. → `post_hydration` in `src/content/post-run.ts`.
3. **Beginner progression** — CH3 "Developing Maximum Aerobic Function," the 180 Formula categories (p.120), specifically category (b): inconsistent/just-getting-back-into-training → extra −5bpm MAF ceiling (deliberate, not temporary) + CH4's MAF Test consistency-tracking framing ("gradual increases in total time" = real progress signal, not distance pressure). This mirrors the app's own existing `maf-calculator-orchestrator.ts` NONE/REGULAR_NEW mindset copy ("bắt đầu thật chậm... đi bộ ngay nếu vượt MAF") — confirms the book source rather than contradicting app behavior. → `progression_beginner_maf` in `src/content/supplementary.ts`, flag-gated `beginner`.
4. **Running form/economy** — searched full text for drill/gait/stride/economy/forefoot/cadence: **the book has no structured drill routine** (no A-skips/high-knees/etc.). Its real, explicit stance is CONTRARIAN: CH2's "Kim" case study (runner injured after being coached to lengthen stride + lift knees higher) + CH10's overstriding-under-fatigue passage ("allow your stride length to be governed by your brain and the body's energy levels rather than by your image of what you should look like"). Sourced as the honest answer — not invented drills. → `running_form_brain_led` in `src/content/supplementary.ts`.

### What the book genuinely lacks
No numeric "10% rule" / week-by-week beginner volume ramp — Maffetone writes for athletes already training, not couch-to-5k starters. No conventional running-form drills. Both gaps are documented honestly in code comments rather than papered over with invented specifics.

### BookRef type note
`BookRef` (maf-coaching-insights.ts) is a closed CH3–CH9 union feeding a UI label map (`guidance-card-list.tsx`'s `BOOK_LABEL`). CH17/CH18/CH2/CH10 sit outside it. Rather than widen a shared type for a few one-off citations (YAGNI, avoids touching an unrelated coaching-insights subsystem + its UI map), citations for those chapters put the real chapter name directly in `citation.label` (existing precedent: `rest.ts`'s `time_detraining` and several `pre-run.ts` cards already omit `bookRef` the same way). CH3-sourced content (`progression_beginner_maf`) does use `bookRef: 'CH3'` since it's in-union.

### Selector wiring (`select-guidance-cards.ts`)
`SUPPLEMENTARY_LIMIT` bumped 1→2 so the new cards can coexist with the existing strength rotation without dead content. Array order in `supplementary.ts` does the real work: `progression_beginner_maf` is flag-gated (`appliesTo.flags: ['beginner']`) and first, so a beginner profile claims that slot instead of a strength suggestion (avoids pushing deadlift/bodyweight work on someone who can't yet run without exceeding MAF HR — contradicts CH3's "start very slow" otherwise); `running_form_brain_led` is second, unconditional. Net effect: non-beginner GREEN day → `[running_form_brain_led, strength_bodyweight]`; beginner GREEN day → `[progression_beginner_maf, running_form_brain_led]`, no strength card. `post_meal_guidance`/`post_hydration` stay capped out of the default post-run view (`POST_RUN_LIMIT` unchanged at 1) — same "library > displayed" pattern already used for pre-run's unused caffeine/meal-timing cards; comments updated to say they're real content now, just design-capped, not review-gated.

## TASK 2 — RHR Garmin-only labeling + hide-when-absent

Confirmed the existing fail-safe already works exactly as required, with no scoring-logic change: `rhrSignal` in `src/utils/daily-readiness-signals.ts` builds its n≥7 baseline **exclusively** from `ctx.dailySummaries` (Garmin). With `FEATURE_GARMIN` off (prod default) that array is always empty → `history.length < 7` → always `[]`, no reason ever renders. Added a doc comment on `rhrSignal` spelling this out (baseline is Garmin-only even though *today's* single reading falls back check-in→Garmin).

Appended `(dữ liệu nhịp tim nghỉ từ thiết bị Garmin)` to both `rhr_bad` and `rhr_warn` reason `text` strings — only text changed, thresholds/severity/bookRef untouched.

**Deliberately did NOT touch `api/src/coaching/recompute/daily-readiness-signals.ts`** (a separate server-side port, flagged in its own header comment as "DRY debt, reconcile if logic changes"). Checked it: its `rhrSignal` baseline comes from check-in history only (`rhrHistory: number[]` param), explicitly *not* Garmin (its header comment says Garmin daily summaries are deliberately omitted server-side). Appending a Garmin-attribution note there would be **factually wrong** — that signal can fire from self-reported check-in data alone. Flagging as an unresolved item below rather than silently leaving it inconsistent.

## Files modified

- `src/content/post-run.ts` (52 LOC) — real CH18/CH17 content replacing the two `// REVIEW:` TODOs; header comment rewritten.
- `src/content/supplementary.ts` (115 LOC) — 2 new cards (`progression_beginner_maf`, `running_form_brain_led`) + header/array-order comments.
- `src/content/select-guidance-cards.ts` (135 LOC) — `SUPPLEMENTARY_LIMIT` 1→2, comments updated (POST_RUN_LIMIT note, cardMatches doc, cap-note).
- `src/utils/daily-readiness-signals.ts` (160 LOC) — Garmin-attribution note appended to `rhr_bad`/`rhr_warn` text; doc comment added confirming hide-when-absent.
- `src/utils/__tests__/daily-readiness-signals.test.ts` — added `checkin()` helper + 4 new tests (2 hide-when-absent, 2 asserting the Garmin note text on fire).
- `src/utils/__tests__/select-guidance-cards.test.ts` — added 3 tests covering the new beginner/form supplementary wiring.

All files stay under the 200-LOC modularization guideline.

## Verification (exact results)

- `npm run build` → vite build, **exit 0** (2419 modules, only a pre-existing >500kB chunk-size warning, unrelated to these changes).
- `npx vitest run` (full suite) → **473 passed / 473, 20 test files, 0 failed**.
- `npm run lint` → 29 pre-existing findings (4 errors, 25 warnings), **zero in any file I touched** — confirmed via `npm run lint | grep -i "post-run\|supplementary\|select-guidance-cards\|daily-readiness-signals"` returning empty. All 29 findings live in unrelated files (`maf-lab.tsx`, `strava-connect-card.tsx`, `admin-users-page.tsx`, `sso-callback-page.tsx`, `calculator-page.tsx`, `auth-context.tsx`, `use-strava-activity-detail.ts`, `maf-safety-adjustments.test.ts`, `maf-volume-cap.test.ts`).
- No paid API touched — pypdf (already installed, free/local) was the only extraction tool.
- `git status` shows unrelated pre-existing dirty state (`api/prisma/schema.prisma`, plan.md, an untracked migration dir, a dashboard-snapshot.md, a phase-05 plan file) that predates this session — confirmed via `git diff --stat` restricted to my 6 target files, none of that other churn is mine.

## Unresolved questions

1. `api/src/coaching/recompute/daily-readiness-signals.ts` (server-side recompute port) has its own `rhr_bad`/`rhr_warn` text, sourced from check-in-only RHR (no Garmin blending at all per its own header comment). If that path ever surfaces user-facing text (e.g. push notifications), it needs its OWN correct attribution note (something like "từ nhật ký check-in hằng ngày", not Garmin) rather than copying today's frontend change — left untouched since it's out of the stated task scope and the two signals have genuinely different data provenance.
2. `post_meal_guidance`/`post_hydration` are real content now but still capped out of the default post-run card view (`POST_RUN_LIMIT=1`) — same design as pre-run's unused extras. If the product wants these two actually visible to users, that's a follow-up UI/limit decision, not something I changed unilaterally given it would blow the existing AMBER "cap at 4" test's budget.
