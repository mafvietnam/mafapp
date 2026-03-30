# Codebase Summary

## Directory Structure

```
src/
├── app.tsx                              [119 lines] App orchestrator
├── index.tsx                            Entry point (React 19)
├── index.css                            Tailwind global styles
├── types.ts                             TypeScript interfaces
├── constants.ts                         App-wide constants
│
├── components/                          Functional React components
│   ├── app-header.tsx                   Logo & title
│   ├── app-footer.tsx                   Footer with attribution
│   ├── tab-navigation.tsx               PLAN | LAB tabs
│   ├── user-input-form.tsx              Form with all inputs
│   ├── commitment-selector.tsx          Card selector (3 levels)
│   ├── result-display.tsx               Container for all results
│   ├── result-heart-rate-card.tsx       MAF zones + BMI display
│   ├── result-schedule-table.tsx        7-day training schedule
│   ├── result-alerts-section.tsx        Notes & warnings
│   ├── result-mindset-card.tsx          Motivational message
│   ├── volume-adjustment-card.tsx       Progress/regression indicator
│   ├── probation-alert.tsx              Injury recovery guidance
│   ├── maf-lab.tsx                      [143 lines] Verification lab
│   ├── maf-lab-step-checklist.tsx       Warmup instructions
│   ├── maf-lab-step-data-entry.tsx      Pace/HR input
│   ├── maf-lab-step-results.tsx         Verified pace display
│   ├── welcome-modal.tsx                First-visit greeting
│   └── recovery-modal.tsx               Injury recovery modal
│
├── hooks/                               Custom React hooks
│   ├── use-user-profile.ts              User data state + localStorage
│   ├── use-maf-calculator.ts            Calculation logic & result state
│   └── use-probation.ts                 Injury recovery auto-unlock
│
└── utils/                               Pure functions & constants
    ├── maf-logic.ts                     Barrel re-export
    ├── maf-types.ts                     Shared constants (volume caps)
    ├── maf-session-formatter.ts         Format session details (15/15)
    ├── maf-schedule-generator.ts        Get base schedule from constants
    ├── maf-safety-adjustments.ts        BMI/age adjustments
    ├── maf-smart-long-run.ts            History-based calculations
    ├── maf-volume-cap.ts                Enforce weekly max
    └── *.test.ts                        Unit tests
```

---

## Key Files & Responsibilities

### Core Application Files

**`app.tsx` (119 lines)**
- Root component: orchestrates PLAN and LAB tabs
- Manages tab state + verified pace state
- Delegates to hooks for business logic
- Minimal—mostly JSX composition

**`types.ts`**
```typescript
interface UserProfile {
  age, height, weight, experience, commitment
  isRecovering, isMedicatedOrInjured, isMedicalClearanceConfirmed
  previousMonthPace, lastLongRunDuration/HR/Feeling
  isProbation, probationStartDate
}

interface MafResult {
  mafHeartRate, lowerZone, upperZone
  schedule: ScheduleItem[], notes, mindset
  explanation, volumeAdjustmentMessage, longRunAdjustmentMessage
}

interface ScheduleItem {
  day, activity, duration, type: RUN|LONG_RUN|REST|WALK|CROSS_TRAIN|RECOVERY
}

enum CommitmentLevel { HEALTH, BASE, PERFORMANCE }
enum ExperienceLevel { NONE, INCONSISTENT, REGULAR_NEW, ADVANCED }
```

**`constants.ts`**
- `EXPERIENCE_OPTIONS`: Score adjustments per experience level
- `COMMITMENT_CARDS`: UI config for 3 commitment levels
- `SCHEDULES`: Base weekly schedules (3 commitment levels × 7 days)

### Hooks (State Management)

**`use-user-profile.ts`**
- Manages runner profile (age, weight, commitment, etc.)
- localStorage persistence
- Input validation (age range, BMI calculation)
- Computed values (isSenior, isChild, isNewbie, getBMI)
- Handles all input change events

**`use-maf-calculator.ts`**
- Core calculation logic
- `calculateRawMaf`: Base formula (180 - age) + adjustments
- `calculateMAF`: Full pipeline including schedule generation, adjustments, formatting
- Scrolls result into view on completion
- Returns `MafResult` state + helper functions

**`use-probation.ts`**
- Monitors injury recovery probation status
- Auto-unlocks after 14 days
- Updates user profile when timer expires

### Components (UI)

**Data Input Layer:**
- `user-input-form.tsx`: Collects all inputs (age, weight, health status, etc.)
- `commitment-selector.tsx`: 3 card selector (HEALTH, BASE, PERFORMANCE)
- `maf-lab.tsx`: Verification lab in 3 steps

**Display Layer:**
- `result-display.tsx`: Container combining all result cards
- `result-heart-rate-card.tsx`: Shows MAF zones + BMI category
- `result-schedule-table.tsx`: Renders 7-day plan with session details
- `result-alerts-section.tsx`: Displays all notes + warnings
- `result-mindset-card.tsx`: Motivational quote customized to experience level
- `volume-adjustment-card.tsx`: Progress/regression indicator

**Modals:**
- `welcome-modal.tsx`: First-visit info (localStorage-gated)
- `recovery-modal.tsx`: Injury guidance modal

### Utilities (Calculation)

**`maf-logic.ts`**
- Barrel re-export for backward compatibility
- Imports all submodules

**`maf-schedule-generator.ts`**
- `getWeeklySchedule(commitment)`: Returns base schedule from constants

**`maf-safety-adjustments.ts`**
- `adjustScheduleForSafety(schedule, userProfile, bmi)`:
  - Swap Run → Walk if BMI ≥ 30
  - Swap Wed intensity if age ≥ 60
  - Add senior-specific messaging

**`maf-session-formatter.ts`**
- `formatSessionDetails(duration, mafHR, type)`:
  - Generate "Warm Xmin | Main Ymin | Cool Zmin"
  - Applies 15/15 rule (warm/cool = duration/3 up to 10min)

**`maf-smart-long-run.ts`**
- `calculateSmartLongRun(lastDuration, lastHR, maf, commitment, age, experience, feeling)`:
  - Check if last long-run was hard (HR > MAF + 5)
  - Suggest ±10% adjustment
  - Age/experience caps

**`maf-volume-cap.ts`**
- `enforceWeeklyVolumeCap(schedule, commitment)`:
  - Calculate total weekly minutes
  - Compare to VOLUME_CAPS[commitment]
  - Reduce if exceeds (preserve rest days)

**`maf-types.ts`**
- `VOLUME_CAPS`: Max weekly minutes + max long-run minutes per level

---

## Data Flow Example

```
User enters age=40, weight=70kg, height=175cm, commits to BASE
  ↓
[Calculate] clicked
  ↓
use-maf-calculator.calculateMAF() starts:
  ├─ calculateRawMaf({...}) → 140 (180-40)
  ├─ getBMI() → 22.9 (normal)
  ├─ getWeeklySchedule(BASE) → 7 default items
  ├─ adjustScheduleForSafety(...) → no change (BMI normal, age <60)
  ├─ parsePaceToSeconds(verifiedMafPace) → if compared
  ├─ calculateSmartLongRun(...) → if history exists
  ├─ enforceWeeklyVolumeCap(...) → cap at 360min max
  ├─ formatSessionDetails(...) for each run
  └─ setResult({...}) → re-render
  ↓
ResultDisplay renders:
  ├─ "YOUR MAF HEART RATE: 140"
  ├─ "7-DAY TRAINING SCHEDULE"
  └─ Alerts: "Your schedule is capped at 360 min/week"
```

---

## Technology Dependencies

```json
{
  "react": "19.2.0",           // UI framework
  "react-dom": "19.2.0",       // DOM rendering
  "lucide-react": "0.554.0",   // Icons (tree-shaken)
  "vite": "6.2.0",             // Build tool
  "tailwindcss": "3.4.15",     // Styling
  "typescript": "5.8.2",       // Type checking
  "eslint": "9.39.4",          // Linting
  "vitest": "3.0.0"            // Testing
}
```

No external state management (Redux, Zustand) — hooks only.
No API client (axios, fetch wrapper) — client-side only.

---

## Testing Coverage

Vitest configured for `src/utils/**/*.test.ts`

```typescript
// Example: src/utils/maf-volume-cap.test.ts
import { describe, it, expect } from 'vitest';
import { enforceWeeklyVolumeCap } from './maf-volume-cap';

describe('enforceWeeklyVolumeCap', () => {
  it('should reduce schedule if exceeds BASE commitment (360min)', () => {
    // Test implementation
  });
});
```

Excluded from coverage: `maf-logic.ts`, `maf-types.ts` (too complex for automated tests).

---

## Build & Deployment

**Development:**
```bash
npm run dev → http://localhost:5173 (Vite dev server)
```

**Production:**
```bash
npm run build → dist/ (optimized, chunked, source maps removed)
```

**Docker:**
- Multi-stage: build in Node Alpine, serve with Nginx Alpine
- Image size: ~50-60MB
- Non-root user security

**Server:**
- Nginx serves SPA from `/dist`
- CSP + security headers active
- Cloudflare Tunnel frontend (token-based, no exposed ports)

---

## Configuration Files

| File | Purpose |
|---|---|
| `vite.config.ts` | Build config, test setup, sourcemap removal |
| `tsconfig.json` | ES2022 target, module resolution |
| `tailwind.config.js` | Custom colors (maf-purple, maf-pink, maf-orange) |
| `Dockerfile` | Multi-stage build (deps → builder → nginx runtime) |
| `docker-compose.yml` | Production services (maf-app, postgres, n8n, cloudflared) |
| `nginx.conf` | SPA routing, CSP headers, gzip compression |
| `.eslintrc.cjs` | ESLint 9 rules (hooks, no console in prod) |

---

**Last Updated:** March 30, 2026 | **Version:** 1.0.0
