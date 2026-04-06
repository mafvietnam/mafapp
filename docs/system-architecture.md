# System Architecture

## User Input → Calculation → Display

```
UserInputForm (React component)
    ↓ userProfile state
useUserProfile hook
    └─ localStorage persistence
    ↓
[Calculate button]
    ↓
useMafCalculator hook
    ├─ 1. Parse & validate inputs
    ├─ 2. Calculate base MAF (180 - age)
    ├─ 3. Apply adjustments (recovery, injury, experience, probation)
    ├─ 4. Get base schedule (HEALTH|BASE|PERFORMANCE)
    ├─ 5. Apply BMI safety (walking if BMI ≥ 30)
    ├─ 6. Compare pace vs. previous month
    ├─ 7. Smart long-run adjustment (history-based)
    ├─ 8. Enforce volume caps
    ├─ 9. Apply 15/15 session formatting
    └─ 10. Return MafResult object
    ↓
ResultDisplay component
    ├─ ResultHeartRateCard (MAF zone + BMI)
    ├─ VolumeAdjustmentCard (progress/regression message)
    ├─ ResultScheduleTable (weekly plan)
    └─ ResultAlertsSection (notes + warnings)
```

---

## Component Tree

```
App (App.tsx, 128 LOC)
├─ activeTab: 'PLAN' | 'LAB'
├─ verifiedMafPace: string | null
├─ WelcomeModal (first-visit, localStorage-gated)
├─ RecoveryModal (injury info)
├─ AppHeader
├─ TabNavigation (PLAN | LAB tabs)
│
└─ main
    ├─── PLAN Tab ──────────────────────────
    │    ├─ UserInputForm (orchestrator, 104 lines)
    │    │  ├─ FormPersonalInfo (Age/Height/Weight, 81L)
    │    │  ├─ FormHealthChecklist (Recovery, medicated, etc., 79L)
    │    │  ├─ CommitmentSelector (3 cards: HEALTH/BASE/PERFORMANCE)
    │    │  ├─ FormPaceAndLongRun (Pace comparison, long-run history, 168L)
    │    │  └─ Calculate button
    │    │
    │    └─ ResultDisplay (conditional render)
    │       ├─ ResultHeartRateCard (MAF zone + BMI)
    │       ├─ VolumeAdjustmentCard (progress/regression)
    │       ├─ ResultScheduleTable (7-day plan)
    │       ├─ ResultAlertsSection (notes + warnings)
    │       ├─ ResultChildrenDisplay (if age <16)
    │       └─ ResultMindsetCard (motivational)
    │
    ├─── LAB Tab ──────────────────────────
    │    └─ MafLab (143 LOC wizard)
    │       ├─ Step 1: MafLabStepChecklist (warmup instructions)
    │       ├─ Step 2: MafLabStepDataEntry (pace + HR input)
    │       └─ Step 3: MafLabStepResults (verified pace display)
    │
    └─── Guide Route (/guide) ──────────────
         └─ GuidePage (121 LOC)
            ├─ GuideGettingStarted (welcome)
            ├─ GuidePlanTab (schedule explanation)
            ├─ GuideLab (lab instructions)
            ├─ GuideResults (interpret results)
            └─ GuideSpecialCases (children, seniors, injured)
```

---

## State Management

**App-level:**
- `activeTab` — 'PLAN' or 'LAB'
- `verifiedMafPace` — Pace from lab, used to override auto-selection

**useUserProfile hook:**
- Manages: age, height, weight, experience, commitment, health flags
- Stores in localStorage
- Returns: userProfile, handlers, computed flags (ageNum, isSenior, isChild, isNewbie, getBMI)

**useMafCalculator hook:**
- Manages: result (MafResult object)
- Calculates MAF when triggered
- Returns: result, calculateMAF function, helper utilities

**useProbationAutoUnlock hook:**
- Watches probation status
- Auto-clears after 14 days

---

## MAF Calculation Steps

### 1. Formula
```
MAF = 180 - age
if recovering:       MAF -= 10
if medicated/injury: MAF -= 5
if probation:        MAF -= 10
experience:          ±5
Zone = MAF ± 10 bpm
```

### 2. Schedule Selection
Choose base from constants based on commitment level:
- HEALTH: 3 runs/week, 45-60 min, 1 long-run
- BASE: 4-5 runs/week, 45-90 min, 1 long-run
- PERFORMANCE: 6 runs/week, 45-120 min, 1 long-run

### 3. BMI Safety Adjustments
- BMI ≥ 30: Replace all "Chạy" → "Đi bộ" (walking mode)
- BMI 25-29: Add "Jogging/" option, suggest walking
- Obese runners: Low-impact only

### 4. Pace Comparison Logic
If BOTH current + previous month pace exist:
```
delta = currentPace - previousPace
if delta < -10s:  Progress    → Long-run +10%
if delta > +10s:  Regression  → All activities -30%
else:             Stable      → Keep as-is
```

### 5. Smart Long-Run (History-based)
Check: lastLongRunDuration, lastLongRunHeartRate, lastLongRunFeeling
- HR > MAF + 5bpm: Tired → Reduce 10%
- HR < MAF - 5bpm: Good → Can maintain or +5%
- Age 60+: Cap at 90 min
- Newbie: Cap at 60 min

### 6. Volume Caps (Weekly Max)
- HEALTH: 240 min
- BASE: 360 min
- PERFORMANCE: 720 min

Reduce durations evenly if exceeded.

### 7. Probation Mode
If injury recovery active:
- All durations × 0.7 (70% volume)
- Auto-unlock after 14 days
- Separate -10 bpm MAF penalty

### 8. Session Formatting (15/15 Rule)
Each run/walk broken into:
```
Warmup 5min (50% MAF zone)
Main X min (100% MAF zone)
Cool 5min (50% MAF zone)
```

---

## Key Utilities

| File | Purpose |
|------|---------|
| `maf-calculator-orchestrator.ts` | Pure calculateMAF(profile) → MafResult (core logic) |
| `maf-calculator-schedule-builder.ts` | Schedule assembly, safety + volume adjustments |
| `maf-schedule-generator.ts` | getWeeklySchedule(level) → base ScheduleItem[] |
| `maf-safety-adjustments.ts` | Swap activities based on BMI/age |
| `maf-session-formatter.ts` | Add warmup/main/cool breakdown |
| `maf-smart-long-run.ts` | History-based long-run adjustment |
| `maf-volume-cap.ts` | Enforce weekly minute caps |
| `maf-types.ts` | VOLUME_CAPS constant |

---

## Data Structures

```typescript
interface UserProfile {
  age, height, weight: string
  experience: ExperienceLevel
  isRecovering, isMedicatedOrInjured: boolean
  commitment: CommitmentLevel
  previousMonthPace?: string
  isProbation?: boolean
  probationStartDate?: string
  lastLongRunDuration, lastLongRunHeartRate?: number
  lastLongRunFeeling?: 'GOOD' | 'TIRED' | 'VERY_TIRED'
}

interface MafResult {
  mafHeartRate: number
  lowerZone, upperZone: number
  schedule: ScheduleItem[]
  notes: string[]
  explanation?: string
  volumeAdjustmentMessage?: string
  longRunAdjustmentMessage?: string
  scheduleTitle: string
  mindset: string
  bmi: number
  bmiCategory: string
}
```

---

## Data Persistence

- **localStorage:** userProfile (age, height, weight, experience, commitment, health flags, probation status)
- **Verified pace:** Stored in component state during session (not persisted to localStorage)
- **No backend calls:** All calculations 100% client-side
- **Optional service worker:** Asset caching not implemented (Nginx handles via cache headers)

---

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| First paint | <500ms | Vite optimized build |
| TTI (Time to Interactive) | <1s (4G) | Mobile-first |
| MAF calculation | <100ms | Pure JS, no blocking |
| Re-render | <50ms | React batching, no Context API |
| Bundle size | <200KB gzipped | Excluding public assets |

---

## Edge Cases & Safety

| Scenario | Action |
|----------|--------|
| Age < 16 | Show "children mode" — no structured plan, play naturally |
| Age > 120 | Clamp to 120, alert user |
| BMI = 0 | Alert: invalid height/weight |
| BMI ≥ 30 | Force walking activities, joint health warning |
| Recovery flag unchecked | Alert: medical clearance required |
| In probation | -10 bpm MAF, 70% volume, 14-day auto-unlock countdown |
| No verified pace | Auto-select based on BMI (safe default) |

---

**Version:** 1.0.0 | **Last Updated:** April 6, 2026 (Phase 8 complete)
