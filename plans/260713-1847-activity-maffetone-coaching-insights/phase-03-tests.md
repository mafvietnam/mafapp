# Phase 03 — Unit Tests + Typecheck/Build

**Priority:** High · **Status:** pending · **Depends:** phase-01, phase-02
**Create:** `src/utils/__tests__/maf-coaching-insights.test.ts` (vitest, mirrors `maf-activity-analysis.test.ts`)

## Test cases (one `describe` per concern)
### Tier
- in-zone effective: timeInZone above%=0, drift=3 → `aerobic-effective`.
- mixed: above%=25 → `mixed`.
- mixed via drift: above%=0, drift=7 → `mixed` (drift downgrades).
- above-zone: above%=55 → `above-zone`.
- avgHr-only above (no streams): verdict above, timeInZone=null → tier `above-zone`, zone finding present.

### Findings
- Zone finding cites CH3, warn when above%≥10, good otherwise.
- Drift finding cites CH4 (or CH8), warn at ≥5, good below.
- Warm-up finding fires only when splits[0].average_heartrate > zone.upper (CH5).
- Overreach finding fires only for BASE_TYPES + movingTime≥20min + above-zone (CH9); does NOT fire for a 10-min run or type 'Workout'.
- Efficiency info finding present when aerobicEff!=null and findings<... ; capped so total ≤4.

### Recommendations
- above-zone → contains "Giảm tốc" rec (CH3); ≤3 recs.
- driftBad → contains hydration rec (CH4).
- good session (no warns) → contains maintain rec (CH4).

### Degradation / guards
- `zone.upper<=0` → returns null.
- verdict=null && timeInZone=null → returns null.
- empty splits → no warm-up finding, no crash.
- drift=null → no drift finding.

### RED-TEAM regression tests (MANDATORY — these bugs must not ship)
- **A7 zero-findings:** avgHr-only `verdict.status='in'`, timeInZone=null, drift=null, splits=[], aerobicEff=null → `findings.length >= 1` (zone good finding).
- **A7 avgHr-only below:** verdict='below' → `findings.length >= 1`, tier `aerobic-effective`.
- **A1 avgHr-only above (1 bpm over):** verdict='above' (deltaBpm=1), timeInZone=null, type=Run, movingTime=2400 → tier is `mixed` (NOT `above-zone`), and **NO overreach finding** (gated on timeInZone).
- **A3 mixed-tier recs non-empty:** timeInZone above%≈25 (aboveFrac 0.25), drift=2, verdict='in' → tier `mixed` AND `recommendations.length >= 1`.
- **A2 overreach phrasing:** above-zone Run w/ streams → overreach finding text contains "Nếu đây là buổi chạy nền/dễ".
- **A2 overreach NOT on non-base type:** type='Workout' above-zone → no overreach finding/rec.
- **A4 warm-up via split pattern:** splits where a later split `average_speed` > splits[0] AND not above-zone → warm-up finding present; all-hard (above-zone) → suppressed; aerobic-effective → severity `info` not `warn`.
- **A5 undefined split average_heartrate:** splits present but `average_heartrate` undefined → no crash, no `NaN`/`undefined` substring in any finding text.
- **A8 avgSpeed→eff 0:** aerobicEff=0 → no efficiency finding.
- **A8 negative drift:** drift=-8 → good finding, text has no "-8"/"NaN" artifact (uses "cải thiện" copy).
- **A9 cap:** construct 4 warn-capable + 1 info (efficiency) → `findings.length===4` and efficiency info is the dropped one.

### Card render test (A3 — new; add `training-effectiveness-card.test.tsx`)
- insight with `recommendations: []` → "Khuyến nghị" heading NOT in the DOM.
- insight with `findings: []` (defensive) → findings list not rendered, no crash.

## Verification commands
```
npx vitest run src/utils/__tests__/maf-coaching-insights.test.ts
npx tsc --noEmit
npm run build
npm run lint
```

## Success Criteria
- All new tests pass; existing suite still green (no regressions).
- tsc + build + lint clean.
