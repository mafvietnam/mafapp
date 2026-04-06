# Phase 5: Add Vitest + Unit Tests

## Context
- [plan.md](./plan.md) | [Phase 3](./phase-03-split-maf-logic.md)
- Currently zero tests, zero test infrastructure
- MAF calculation logic is pure functions — ideal for unit testing

## Overview
- **Priority:** P1
- **Status:** Pending
- **Effort:** 2h
- **Depends on:** Phase 3 (modules must be split before testing individual units)
- **Description:** Install Vitest, write unit tests for MAF calculation modules

## Key Insights
- All functions in `src/utils/` are pure (input -> output) — no React, no DOM
- Vitest integrates natively with Vite config — zero extra bundler config
- Focus on business logic correctness, not UI rendering
- MAF 180 Formula has well-defined rules from Dr. Maffetone's book — clear expected values

## Requirements

### Functional
- Test runner: Vitest
- Coverage: all exported functions in `src/utils/`
- Minimum scenarios per function: happy path + edge cases + boundary values

### Non-Functional
- `npm test` script added to package.json
- `npm run test:coverage` script for coverage report
- Tests run in <5 seconds

## Architecture

### Target File Structure
```
src/
├── utils/
│   ├── __tests__/
│   │   ├── maf-session-formatter.test.ts
│   │   ├── maf-schedule-generator.test.ts
│   │   ├── maf-safety-adjustments.test.ts
│   │   ├── maf-smart-long-run.test.ts
│   │   └── maf-volume-cap.test.ts
│   ├── maf-types.ts
│   ├── maf-session-formatter.ts
│   ├── maf-schedule-generator.ts
│   ├── maf-safety-adjustments.ts
│   ├── maf-smart-long-run.ts
│   ├── maf-volume-cap.ts
│   └── maf-logic.ts
├── vite.config.ts (add test config)
```

## Related Code Files

### Files to Create
- `src/utils/__tests__/maf-session-formatter.test.ts`
- `src/utils/__tests__/maf-schedule-generator.test.ts`
- `src/utils/__tests__/maf-safety-adjustments.test.ts`
- `src/utils/__tests__/maf-smart-long-run.test.ts`
- `src/utils/__tests__/maf-volume-cap.test.ts`

### Files to Modify
- `package.json` — add vitest devDependency, test scripts
- `vite.config.ts` — add `test` config block

## Implementation Steps

### Step 1: Install Vitest
```bash
npm install -D vitest @vitest/coverage-v8
```

### Step 2: Configure Vitest in vite.config.ts
```ts
/// <reference types="vitest/config" />
export default defineConfig({
  // ...existing config
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/utils/**/*.ts'],
      exclude: ['src/utils/maf-logic.ts', 'src/utils/maf-types.ts'], // barrel + types only
    }
  }
});
```

### Step 3: Add scripts to package.json
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

### Step 4: Write test files

#### `maf-session-formatter.test.ts`
Test `formatSessionDetails()`:
- duration=0 returns ""
- duration<=30 returns walk/light message
- duration>30 returns warmup/main/cooldown structure
- RECOVERY type returns recovery-specific message
- Verify HR thresholds in output strings

#### `maf-schedule-generator.test.ts`
Test `getWeeklySchedule()`:
- HEALTH: 7 items, includes REST days, no LONG_RUN >60min
- BASE: 7 items, has LONG_RUN=90
- PERFORMANCE: 7 items, has LONG_RUN=120, has RECOVERY

#### `maf-safety-adjustments.test.ts`
Test `adjustScheduleForSafety()`:
- BMI>=30: all RUN/LONG_RUN become CROSS_TRAIN
- Beginner: no session >60min
- Senior (60+): no session >90min
- Recovering: all RUN/LONG_RUN become WALK, capped at 45min
- Combined: obese + senior

Test `adjustForProbation()`:
- All durations reduced by 30%
- Minimum 15 minutes enforced
- Rest days unchanged

#### `maf-smart-long-run.test.ts`
Test `calculateSmartLongRun()`:
- No history data: returns safe default based on experience
- HR too high + VERY_TIRED: reduce 20%
- HR too high + TIRED: reduce 10%
- HR too high + GOOD: maintain
- HR in zone + GOOD: increase 10%
- HR in zone + TIRED: increase 5%
- HR in zone + VERY_TIRED: maintain
- HR low + GOOD: increase 15%
- HR low + VERY_TIRED: maintain (overtraining signal)
- Hits age cap (60+): returns cap
- Hits package cap: returns cap
- Invalid data (>300min, <20min, HR>220): returns safe defaults
- Boundary: exactly at MAF +/- 5

#### `maf-volume-cap.test.ts`
Test `enforceWeeklyVolumeCap()`:
- Under cap: no changes
- Over cap: reduces WALK first, then CROSS_TRAIN, then RUN
- Never reduces LONG_RUN
- Minimum 15min per session
- Verify reduction message generated

Test `calculateTotalWeeklyMinutes()`:
- Sum of all durations

Test `formatWeeklyVolumeSummary()`:
- Correct format string with hours/minutes/percentage

### Step 5: Run tests
```bash
npm test
```

### Step 6: Run coverage
```bash
npm run test:coverage
```

## Test Matrix

| Module | Happy Path | Edge Cases | Boundary | Total |
|--------|-----------|------------|----------|-------|
| session-formatter | 3 | 2 (0 dur, recovery) | 1 (30min boundary) | ~6 |
| schedule-generator | 3 | 1 (default case) | - | ~4 |
| safety-adjustments | 4 | 2 (combined rules) | 2 (exact thresholds) | ~8 |
| smart-long-run | 6 | 4 (invalid data) | 3 (caps, ±5 boundary) | ~13 |
| volume-cap | 3 | 2 (nothing to reduce) | 1 (15min minimum) | ~6 |
| **Total** | | | | **~37** |

## Todo List
- [ ] Install vitest + coverage
- [ ] Configure vite.config.ts test block
- [ ] Add test scripts to package.json
- [ ] Write maf-session-formatter.test.ts
- [ ] Write maf-schedule-generator.test.ts
- [ ] Write maf-safety-adjustments.test.ts
- [ ] Write maf-smart-long-run.test.ts
- [ ] Write maf-volume-cap.test.ts
- [ ] All tests pass
- [ ] Coverage report generated

## Success Criteria
- `npm test` runs and passes all ~37 tests
- `npm run test:coverage` shows coverage for utils/ modules
- No test uses mocks/fakes — all pure function testing
- Tests complete in <5 seconds

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Vitest config conflicts with Vite | Low | Medium | Use `/// <reference types="vitest/config" />` |
| Test expectations wrong (misunderstood logic) | Medium | Low | Cross-reference with MAF_RULES_SUMMARY.md |
| Coverage tool compatibility | Low | Low | v8 provider is most stable |

## Rollback
- Remove vitest deps, delete test files, revert package.json + vite.config.ts

<!-- Updated: Validation Session 1 - calculateMAF orchestration (290L) has zero test coverage. Coverage config excludes hooks. Orchestration tests added in Phase 8 after extracting to pure util. -->
