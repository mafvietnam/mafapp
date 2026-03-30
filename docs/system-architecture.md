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
App (App.tsx)
├─ activeTab: 'PLAN' | 'LAB'
├─ verifiedMafPace: string | null
├─ WelcomeModal
├─ RecoveryModal
├─ AppHeader
├─ TabNavigation
└─ main
    ├─── PLAN tab ──────────────────
    │    ├─ UserInputForm
    │    │  ├─ Age/Height/Weight inputs
    │    │  ├─ Experience selector
    │    │  ├─ Health checkboxes
    │    │  ├─ CommitmentSelector (3 cards)
    │    │  ├─ PaceComparison section
    │    │  ├─ LongRunHistory (optional)
    │    │  └─ Calculate button
    │    │
    │    └─ ResultDisplay (if result exists)
    │       ├─ ResultHeartRateCard
    │       ├─ VolumeAdjustmentCard
    │       ├─ ResultScheduleTable
    │       ├─ ResultAlertsSection
    │       └─ ResultMindsetCard
    │
    └─── LAB tab ──────────────────
         └─ MafLab
            ├─ Step 1: Warmup checklist
            ├─ Step 2: Data entry (pace + HR)
            └─ Step 3: Results summary
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

## Offline Architecture

100% client-side after load:
- React SPA bundles all logic
- localStorage: user profile + history
- No API calls for calculations
- Optional: Service Worker for asset caching

---

## Performance Targets

- Initial load: <500ms first paint
- MAF calculation: <100ms
- Re-render: <50ms (React batching)
- Bundle: <200KB gzipped
- Mobile TTI: <1s (4G)

---

## Edge Case Handling

| Scenario | Action |
|----------|--------|
| Age < 16 | "Play naturally" guide (no structured plan) |
| Age > 120 | Clamped to 120, alert shown |
| BMI = 0 | Alert: "Check height/weight" |
| BMI ≥ 30 | Force walking mode + joint warning |
| No verified pace | Auto-select based on BMI |
| Injured (probation) | -10 bpm, 70% volume, 14-day unlock |

---

**Version:** 1.0.0 | **Last Updated:** March 30, 2026
