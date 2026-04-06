# Code Review: Phase 8 Red Team Remediation

**Reviewer:** code-reviewer | **Date:** 2026-04-06  
**Scope:** 7 modified files, 6 new files (~860 LOC changed/added)  
**Focus:** Correctness of calculateMAF extraction, render loop fix, test coverage, file organization

---

## Overall Assessment

**PASS with informational notes.** The refactoring is well-executed. The extraction of `calculateMAF` to a pure function preserves the original computation order exactly. The render loop fix is correct and actually more robust than the original useEffect approach. All 177 tests pass, TypeScript compiles clean, lint has 0 errors.

---

## Critical Issues

None.

---

## High Priority

### H1: Duplicate `calculateSmartLongRun` call (Performance + Divergence Risk)

**Files:** `maf-calculator-schedule-builder.ts` lines 83 and 150

`calculateSmartLongRun` is called twice with identical arguments:
1. In `buildAndAdjustSchedule()` (line 83) -- applies duration to schedule
2. In `computeAdjustmentMessages()` (line 150) -- extracts message/adjustmentType for display

Currently safe because the function is pure. However:
- Wastes CPU on identical computation
- If the function is ever modified to be non-deterministic (e.g., time-based caps), the duration applied to the schedule could diverge from the message shown to the user

**Fix:** Return `smartResult` from `buildAndAdjustSchedule` or compute it once in `calculateMAF` and pass it to both.

```typescript
// In calculateMAF orchestrator, compute once:
const smartResult = hasExperience && longRunIndex !== -1 && !userProfile.isProbation
  ? calculateSmartLongRun(...args)
  : null;

// Pass to buildAndAdjustSchedule and use for message
```

**Severity:** High (correctness risk if function changes) | **Blocking:** No (currently safe)

---

## Medium Priority

### M1: `handleRecoveryConfirm` does not call `adjustCommitmentForSenior`

**File:** `use-user-profile.ts` line 155

When a senior user (age >= 60) confirms recovery:
- `isRecovering` and `isMedicatedOrInjured` become false
- `isProbation` becomes true
- Commitment is NOT re-evaluated

In the old code, the `useEffect` would fire (watching `isRecovering`) and re-evaluate commitment for seniors. In the new code, commitment stays at whatever it was.

**Impact:** Low in practice -- the user was on HEALTH (forced by recovering state) and will remain on HEALTH, which is safe. They can manually upgrade via `handleCommitmentSelect` which has proper guards. This fails-safe rather than fails-open.

**Fix (optional):**
```typescript
const handleRecoveryConfirm = () => {
  setUserProfile((prev) => {
    const updated = {
      ...prev,
      isProbation: true,
      probationStartDate: new Date().toISOString(),
      isRecovering: false,
      isMedicatedOrInjured: false,
    };
    updated.commitment = adjustCommitmentForSenior(updated);
    return updated;
  });
  setShowRecoveryModal(false);
};
```

### M2: `addPaceWarnings` mutates `finalSchedule` array in-place

**File:** `maf-calculator-schedule-builder.ts` line 186

The function signature accepts `ScheduleItem[]` and mutates it directly (replacing `finalSchedule[swapIndex]`). This is inconsistent with `buildAndAdjustSchedule` which returns a new array. The caller in `maf-calculator-orchestrator.ts` (line 79) passes `finalSchedule` which was already transformed by the 15/15 rule `.map()`.

**Impact:** Currently works because the caller doesn't use the array after `addPaceWarnings` modifies it (it goes straight to the result object). But the mutation is invisible from the call site -- a future reader might assume `addPaceWarnings` only pushes to `notes`.

**Fix:** Either document the mutation clearly, or return a new array.

### M3: Missing test coverage for pace comparison / volume adjustment path

**File:** `maf-calculator-orchestrator.test.ts`

The tests cover children, adults, BMI fallback, probation, volume cap, and seniors. Missing:
- **Pace progress path** (delta < -10): long run duration increases 10%, capped for seniors/newbies
- **Pace regression path** (delta > 10): 30% volume reduction across all sessions
- **Pace stable path** (|delta| <= 10)
- **Cross-train swap** for fast pace (< 270s)

These are important behavioral branches in `buildAndAdjustSchedule` and `addPaceWarnings`.

---

## Low Priority

### L1: Unused `import { EXPERIENCE_OPTIONS }` could resurface

The original `use-user-profile.ts` imported `EXPERIENCE_OPTIONS` but never used it. Correctly removed in this change. No action needed, just noting the cleanup.

### L2: `form-pace-and-long-run.tsx` at 168 lines

Close to the 200-line limit. If more long-run inputs are added (as planned in SP2-SP7), this file will need splitting. Not blocking now.

### L3: Dockerfile still creates `nextjs` user but runs nginx

**File:** `Dockerfile` line 7

Stage 1 (deps) creates a `nodejs` group and `nextjs` user, but this is a Vite/nginx app. These users are only in the deps stage and don't leak to production, so it's cosmetic waste only.

---

## Edge Cases Found by Scouting

1. **`calculateRawMaf` vs `calculateMAF` parity** -- `calculateRawMaf` (used for MafLab target HR) doesn't include probation `-10` adjustment. Pre-existing gap, not a regression. The Lab target HR intentionally shows the "healthy" MAF baseline, not the probation-adjusted value.

2. **Welcome modal lazy initializer + SSR** -- `useState(() => !localStorage.getItem(...))` would throw on server rendering. Verified this is CSR-only (`createRoot`), so safe.

3. **`adjustCommitmentForSenior` short-circuits for recovering/injured** -- If a senior user is both recovering AND has medical clearance, commitment is not auto-adjusted. This matches the original useEffect behavior exactly (same early return).

---

## Positive Observations

1. **Clean extraction**: The `calculateMAF` pure function preserves the exact computation order from the original. Every branch was verified against the original 367-line hook.

2. **Render loop fix is correct and superior**: Moving commitment adjustment from `useEffect` (with `commitment` in deps = potential infinite loop) to handlers eliminates the re-render cycle. The guards in `handleCommitmentSelect` already prevent invalid selections.

3. **Good file organization**: All code files under 200 lines. Form splitting follows logical boundaries (personal info / health / pace+long-run). The orchestrator/schedule-builder separation is clean.

4. **Test coverage**: 15 new tests for the orchestrator cover the main branches. Combined with existing 162 tests, total is 177 passing.

5. **Dockerfile fix is essential**: The old COPY paths referenced `App.tsx`, `components/`, `utils/` at root level, which would fail after the `src/` migration.

---

## Recommended Actions

1. **Consider (not blocking):** Deduplicate `calculateSmartLongRun` call to prevent future divergence risk
2. **Consider (not blocking):** Add `adjustCommitmentForSenior` call in `handleRecoveryConfirm` for completeness
3. **Future sprint:** Add pace comparison test coverage (progress/regression/stable paths)

---

## Metrics

| Metric | Value |
|--------|-------|
| TypeScript | Clean (0 errors) |
| Lint | 0 errors, 22 pre-existing warnings |
| Tests | 177/177 passing |
| Build | Succeeds |
| Files > 200 lines | 0 |
| New test coverage | 15 tests for orchestrator |

---

## Checklist Verification

- [x] Concurrency: No shared mutable state. Pure function extraction eliminates React state coupling.
- [x] Error boundaries: `calculateMAF` returns null for invalid inputs; hook handles null gracefully.
- [x] API contracts: Hook interface unchanged (`UseMafCalculatorReturn`). Callers unaffected.
- [x] Backwards compatibility: No breaking changes to exports or behavior.
- [x] Input validation: BMI=0 check, NaN age check preserved from original.
- [x] Auth/authz: N/A (client-side calculator, no auth).
- [x] N+1 / query efficiency: N/A (no DB). Duplicate `calculateSmartLongRun` noted.
- [x] Data leaks: No PII/secrets. localStorage usage is local-only.

**Status:** DONE
**Summary:** Phase 8 remediation is well-executed. All 8 red team findings resolved correctly. Two informational items noted (duplicate smart long run call, missing adjustCommitmentForSenior in recovery handler) -- neither is blocking.
