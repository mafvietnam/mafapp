# System Architecture

## Data Flow Diagram

```
USER INPUT (UserInputForm)
    ↓
User Profile State (use-user-profile hook)
    age, weight, height, experience, commitment, etc.
    ↓
[Calculate Button]
    ↓
MAF Calculation (use-maf-calculator hook)
    ├─ Parse inputs & validate
    ├─ Calculate base MAF (180 - age)
    ├─ Apply adjustments (recovery, injury, experience)
    ├─ Generate schedule (BASE structure from constants)
    ├─ Check safety (BMI → walking vs running)
    ├─ Compare pace (vs. previous month)
    ├─ Smart long-run (history-based)
    ├─ Enforce volume cap (max weekly minutes)
    ├─ Apply probation mode (if recovering)
    └─ Format session details (15/15 rule)
    ↓
MAF Result State (MafResult interface)
    ├─ mafHeartRate, zones
    ├─ schedule: ScheduleItem[]
    ├─ notes: string[]
    └─ messages (pace comparison, long-run adjustment)
    ↓
Result Display (ResultDisplay component)
    ├─ ResultHeartRateCard
    ├─ ResultScheduleTable
    ├─ ResultAlertsSection
    ├─ VolumeAdjustmentCard
    └─ ResultMindsetCard
```

---

## Component Hierarchy

```
App
├── WelcomeModal (first visit)
├── RecoveryModal (injury guidance)
├── AppHeader (logo, title)
├── TabNavigation (PLAN | LAB tabs)
└── main
    ├─── PLAN tab:
    │    ├── UserInputForm (collects runner data)
    │    │   ├── Age/Height/Weight inputs
    │    │   ├── Health assessment checkboxes
    │    │   ├── Experience level selector
    │    │   ├── CommitmentSelector (cards)
    │    │   ├── PaceComparison (previous vs current)
    │    │   ├── LongRunHistory (optional)
    │    │   └── [Calculate] button
    │    │
    │    └── ResultDisplay (if result exists)
    │        ├── ResultHeartRateCard (zones + BMI)
    │        ├── VolumeAdjustmentCard (progress/regression)
    │        ├── ResultScheduleTable (7-day plan)
    │        ├── ResultAlertsSection (notes & warnings)
    │        └── ResultMindsetCard (motivational message)
    │
    └─── LAB tab:
         └── MafLab
             ├── MafLabStepChecklist (warmup instructions)
             ├── MafLabStepDataEntry (collect pace/HR)
             └── MafLabStepResults (show verified pace)
```

---

## State Management

### Global State (in App.tsx)
```typescript
const [activeTab, setActiveTab] = useState<'PLAN' | 'LAB'>('PLAN');
const [verifiedMafPace, setVerifiedMafPace] = useState<string | null>(null);
```

### UserProfile Hook
```typescript
const {
  userProfile,         // Full profile object
  setUserProfile,      // Update entire profile
  handleInputChange,   // Handle form inputs
  handleCheckboxChange,
  handleCommitmentSelect,
  ageNum, isSenior, isChild, isNewbie,
  getBMI,
} = useUserProfile();
```

Stores in localStorage:
- Age, weight, height, BMI category
- Experience level, commitment
- Recovery/medication status
- Previous month pace (for comparison)
- Last long-run history (duration, HR, feeling)
- Probation status + start date

### MAF Calculator Hook
```typescript
const {
  result,              // Calculated schedule + zones
  calculateMAF,        // Trigger calculation
  calculateRawMaf,     // Get base MAF only
  getVolumeCapText,
} = useMafCalculator();
```

---

## Calculation Pipeline

### 1. Base MAF Formula
```
MAF = 180 - age
      ↓
if recovering: MAF -= 10
if medicated/injured: MAF -= 5
if probation: MAF -= 10 (extra safety)
experience adjustment: ±5
```

### 2. Training Schedule Generator
```
Select base schedule (HEALTH|BASE|PERFORMANCE)
  ├─ 3 commitment levels from constants
  └─ Fixed weekly structure (Mon-Sun)

Apply safety adjustments:
  ├─ BMI >= 30 → Replace "Run" with "Walk" everywhere
  ├─ BMI >= 25 → Add "Jogging/" option
  └─ Age 60+ → Swap Wed intensity for cross-train
```

### 3. Pace Comparison Logic
```
If user has BOTH current + previous month pace:
  delta = currentPace - previousPace
  ├─ delta < -10s: PROGRESS → Long-run +10%
  ├─ delta > +10s: REGRESSION → All activities -30%
  └─ else: STABLE → Keep schedule
```

### 4. Smart Long-Run
```
If runner has experience + history:
  Check: lastLongRunDuration, lastLongRunHeartRate, lastLongRunFeeling
  ├─ HR > MAF + 5: Felt tired → Decrease 10%
  ├─ HR < MAF - 5: Good day → Can maintain or +5%
  └─ Age 60+: Cap long-run at 90min
  └─ Newbie: Cap long-run at 60min
```

### 5. Volume Cap Enforcement
```
Calculate total weekly minutes
IF exceeds commitment cap:
  Reduce activities (preserve rest days)
  └─ HEALTH: max 240min
  └─ BASE: max 360min
  └─ PERFORMANCE: max 720min
```

### 6. Probation Mode (Injury Recovery)
```
If probation status active:
  Every activity duration *= 0.7 (70% volume)
  Auto-unlock after 14 days (use-probation hook)
```

### 7. Session Details (15/15 Rule)
```
For each RUN/LONG_RUN/WALK:
  Generate: "Warm 5min | Main 60min | Cool 5min"
  └─ Based on type + duration + MAF zone
```

---

## Key Utilities

| Module | Responsibility |
|--------|---|
| `maf-schedule-generator` | Get base schedule from constants |
| `maf-safety-adjustments` | BMI/age-based activity swaps |
| `maf-session-formatter` | Format "Warm\|Main\|Cool" details |
| `maf-smart-long-run` | History-based long-run calculation |
| `maf-volume-cap` | Enforce max weekly minutes per level |
| `maf-types` | Shared types (VOLUME_CAPS, etc.) |

---

## No Backend Required

**Client-side only.** All calculations happen in JavaScript:
- ✅ MAF formula
- ✅ Schedule generation
- ✅ Pace comparison
- ✅ History tracking (localStorage)

**Optional Backend (N8N):**
- User authentication (future)
- Data persistence (cloud backup)
- Advanced analytics

---

## Offline Capability

App works 100% offline after initial load:
- ServiceWorker (if enabled) caches assets
- All data stored in localStorage
- No API calls required for core functionality

---

## Performance Characteristics

| Metric | Target |
|--------|--------|
| Initial load | <500ms first paint |
| Calculation | <100ms (MAF math) |
| Re-renders | <50ms (React batching) |
| Bundle size | <200KB gzipped |
| Mobile TTI | <1s on 4G |

---

## Error Boundaries & Safety

| Edge Case | Handling |
|---|---|
| Invalid age/BMI | Alert user, prevent calculation |
| Age < 16 | Special children's plan (play naturally) |
| BMI >= 30 | Force walking mode, warn about joints |
| No MAF pace | Auto-select pace based on BMI |
| Recovered from injury | Probation mode with auto-unlock |

---

**Last Updated:** March 30, 2026 | **Version:** 1.0.0
