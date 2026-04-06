# Phase 6: Add ESLint Config

## Context
- [plan.md](./plan.md) | [Phase 1](./phase-01-project-structure-migration.md)
- Currently zero linting — no ESLint config, no lint scripts

## Overview
- **Priority:** P2
- **Status:** Pending
- **Effort:** 1h
- **Depends on:** Phase 1
- **Description:** Add ESLint 9 flat config with TypeScript + React support

## Key Insights
- ESLint 9 uses flat config (`eslint.config.js`) — no `.eslintrc`
- Keep config minimal: catch real bugs, not style nits
- Don't be too harsh on linting per development rules — prioritize compilable code
- No Prettier (YAGNI) — Tailwind classes don't benefit from formatters

## Requirements

### Functional
- Lint all `src/**/*.{ts,tsx}` files
- Rules: TypeScript recommended + React recommended + React Hooks
- `npm run lint` script
- No auto-fix on save (developer choice)

### Non-Functional
- Zero errors on current codebase after refactor phases complete
- Config under 50 lines

## Related Code Files

### Files to Create
- `eslint.config.js`

### Files to Modify
- `package.json` — add eslint devDependencies, lint script

## Implementation Steps

### Step 1: Install dependencies
```bash
npm install -D eslint @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh
```

### Step 2: Create `eslint.config.js`
```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  { ignores: ['dist', 'build', 'node_modules', '.claude', '.opencode'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  }
);
```

### Step 3: Add lint script to package.json
```json
{
  "scripts": {
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix"
  }
}
```

### Step 4: Run lint, fix any blocking errors
```bash
npm run lint
```

### Step 5: Fix only actual errors (not warnings)
- Unused imports -> remove
- Missing deps in useEffect -> add
- Keep warnings as-is for gradual cleanup

## Todo List
- [ ] Install eslint + plugins
- [ ] Create eslint.config.js
- [ ] Add lint scripts to package.json
- [ ] Run lint on codebase
- [ ] Fix blocking errors only
- [ ] Verify npm run lint exits cleanly (warnings OK, errors = 0)

## Success Criteria
- `npm run lint` runs without errors (warnings acceptable)
- Config is flat ESLint 9 format
- Ignores dist/, build/, node_modules/, .claude/, .opencode/
- Config file under 50 lines

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Many lint errors from existing code | Medium | Low | Only fix errors, not warnings |
| Plugin version conflicts | Low | Medium | Pin major versions in package.json |

## Rollback
- Delete eslint.config.js, remove eslint deps from package.json

<!-- Updated: Validation Session 1 - 8 ESLint errors remain (31 problems total). Includes set-state-in-effect (real React bugs), no-useless-assignment, no-misleading-character-class. Fixed in Phase 8. -->
