# Code Standards & Conventions

## File Organization

```
src/
├── index.tsx              # React 19 entry point
├── index.css              # Tailwind imports + minimal globals
├── app.tsx                # Root component, tab/modal orchestration
├── types.ts               # TypeScript interfaces + enums
├── constants.ts           # Schedules, commitment cards, experience options
│
├── pages/
│   └── guide-page.tsx     # /guide route with 5 guide sections
│
├── components/ (24 files)
│   ├── app-header.tsx, app-footer.tsx
│   ├── tab-navigation.tsx
│   ├── welcome-modal.tsx, recovery-modal.tsx
│   ├── user-input-form.tsx
│   ├── commitment-selector.tsx
│   ├── result-display.tsx
│   ├── result-*.tsx (5 cards + sections)
│   ├── maf-lab.tsx + maf-lab-step-*.tsx (3 step components)
│   └── guide/ (5 guide section components)
│
├── hooks/ (3 files)
│   ├── use-user-profile.ts
│   ├── use-maf-calculator.ts
│   └── use-probation.ts
│
└── utils/ (7 modules + 5 tests)
    ├── maf-logic.ts (barrel)
    ├── maf-schedule-generator.ts
    ├── maf-safety-adjustments.ts
    ├── maf-smart-long-run.ts
    ├── maf-volume-cap.ts
    ├── maf-session-formatter.ts
    ├── maf-types.ts
    └── __tests__/ (5 test files)
```

**Naming:** `kebab-case` with descriptive names (e.g., `maf-smart-long-run.ts`)
**File Size:** All source files <200 LOC (avg 100-150)

---

## Component Patterns

### Functional Components Only
```typescript
interface ComponentProps {
  // Props go here
}

const MyComponent: React.FC<ComponentProps> = ({ prop1, prop2 }) => {
  // Hook declarations at top
  const [state, setState] = useState(initialValue);
  const { data } = useCustomHook();

  // Event handlers
  const handleClick = () => { /* ... */ };

  // Render
  return <div>Content</div>;
};

export default MyComponent;
```

### Hooks for State Management
- No external state library (Redux, Zustand)
- Custom hooks encapsulate domain logic (`use-maf-calculator`, `use-user-profile`)
- Hooks named with `use-` prefix in `src/hooks/`

### Prop Drilling Pattern
- Props passed explicitly through component tree
- Hooks used when crossing 3+ component levels

---

## Import Convention

```typescript
// 1. React & external libraries
import React, { useState } from 'react';
import { Heart, Zap } from 'lucide-react';

// 2. Types
import { UserProfile, MafResult } from '../types';

// 3. Hooks
import { useUserProfile } from '../hooks/use-user-profile';

// 4. Utils & constants
import { calculateMAF } from '../utils/maf-logic';
import { COMMITMENT_CARDS } from '../constants';

// 5. Components
import TabNavigation from './tab-navigation';

// 6. Styles (if component-scoped)
// None (using Tailwind utility classes)
```

---

## TypeScript Standards

### Interfaces Over Types
```typescript
// Preferred
export interface UserProfile {
  age: string;
  height: string;
  weight: string;
}

// Avoid for public APIs
export type UserProfile = { ... }
```

### Enums for Fixed Sets
```typescript
export enum CommitmentLevel {
  HEALTH = 'HEALTH',
  BASE = 'BASE',
  PERFORMANCE = 'PERFORMANCE',
}

export enum ExperienceLevel {
  NONE = 'NONE',
  INCONSISTENT = 'INCONSISTENT',
  REGULAR_NEW = 'REGULAR_NEW',
  ADVANCED = 'ADVANCED',
}
```

### Return Types on Public Functions
```typescript
export function calculateMaf(userProfile: UserProfile): number | null {
  // Implementation
}

// NOT: let users infer types
function calculateMaf(userProfile: UserProfile) {
  // ...
}
```

---

## State Management Pattern

### Custom Hooks
Encapsulate related state + logic:

```typescript
export function useMafCalculator() {
  const [result, setResult] = useState<MafResult | null>(null);

  const calculateMAF = (profile: UserProfile) => {
    // Calculation logic
    setResult(newResult);
  };

  return { result, calculateMAF };
}
```

### UserProfile Hook
Manages single source of truth for runner data (age, weight, commitment, etc.)

### Calculator Hook
Manages MAF result state + calculation logic. Called from App when "Calculate" clicked.

---

## Styling

### Tailwind CSS 3
- Utility-first approach (no custom CSS classes)
- Custom colors defined in `tailwind.config.js`:
  - `maf-purple: #7e22ce`
  - `maf-pink: #db2777`
  - `maf-orange: #f97316`
- Global styles in `src/index.css` (minimal)

### Responsive Design
```typescript
<div className="flex flex-col md:flex-row gap-4">
  {/* Stack on mobile, row on desktop */}
</div>
```

### No Inline Styles
Always use Tailwind utilities, not `style={{}}`.

---

## Error Handling

### Validation in Hooks
```typescript
const calculateMAF = (profile: UserProfile) => {
  const ageNum = parseInt(profile.age);
  if (isNaN(ageNum) || ageNum < 1) return null;
  // Proceed
};
```

### User Feedback
- Alert for critical errors (invalid BMI, missing values)
- UI messages for warnings (pace too fast, age 60+)
- Notes array in `MafResult` for transparency

---

## Testing (Vitest)

### Unit Tests
Location: `src/utils/*.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { calculateMaf } from './maf-volume-cap';

describe('calculateMaf', () => {
  it('should return correct MAF for age 40', () => {
    expect(calculateMaf({ age: '40' })).toBe(140);
  });
});
```

### Coverage Target
- **Util functions:** 70%+ (excludes `maf-logic.ts`, `maf-types.ts`)
- **Components:** Manual testing (Vitest not configured for React)

---

## Performance Optimization

### Code Splitting
- Vite handles automatic chunk splitting
- React.lazy not used (SPA small enough)

### Bundle Size
- Target: <200KB gzipped
- Lucide icons: tree-shake unused icons
- Tailwind: purge unused classes (config active)

### Rendering
- No unnecessary re-renders (custom hooks memoize results)
- Schedule table uses plain arrays (no virtual scrolling needed for 7 items)

---

## Git & Commits

### Commit Message Format
```
feat: add smart long-run calculation
fix: resolve BMI validation edge case
docs: update README with new features
refactor: split App.tsx into hooks
test: add tests for volume cap logic
chore: update dependencies
```

### Branch Strategy
- `main`: Production releases
- `dev`: Integration branch
- Feature branches: `feature/auth`, `fix/bmi-validation`

---

## ESLint Rules

**Version:** ESLint 9.39.4 + typescript-eslint 8.57.2

**Enforced Rules:**
- No `console.log` in production (dev OK)
- No unused variables
- No unreachable code
- Prefer `const` over `let`
- React hooks dependency arrays checked
- No restricted syntax (e.g., `any` types)

**Fix Issues:**
```bash
npm run lint        # Check
npm run lint:fix    # Auto-fix
```

---

## Documentation Standards

### Code Comments
```typescript
// Use for WHY, not WHAT
// MAF calculation subtracts 10 for recovery per Maffetone method (Chapter 4)
maf -= 10;

// NOT: maf is reduced by 10
// (this is obvious from the code)
```

### JSDoc for Public APIs
```typescript
/**
 * Calculates MAF heart rate from user profile.
 * @param userProfile - Runner's age, health status, experience
 * @returns MAF heart rate (bpm) or null if invalid
 */
export function calculateRawMaf(userProfile: UserProfile): number | null {
```

---

## Constants

All magic numbers → `src/constants.ts`:
- Training schedule items
- Commitment level configs
- Experience score adjustments
- Volume caps per level
- Pace thresholds

---

**Last Updated:** April 6, 2026 | **Version:** 1.0.0
