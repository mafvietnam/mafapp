# Phase 1: Project Structure Migration

## Context
- [plan.md](./plan.md)
- Current: all source files in root alongside Docker/nginx configs
- Target: standard `src/` directory structure

## Overview
- **Priority:** P1 (all other phases depend on this)
- **Status:** Pending
- **Effort:** 1.5h
- **Description:** Move source code into `src/`, clean duplicates, update configs

## Key Insights
- Vite resolves entry from `index.html` root `<script>` tag
- tsconfig paths alias `@/*` currently maps to `./*` — must update to `./src/*`
- Tailwind content globs must update to scan `src/`
- `index.html` stays in root (Vite requirement)
- package.json name cleanup is zero-risk

## Requirements

### Functional
- All source `.tsx`, `.ts`, `.css` files move to `src/`
- Import paths update accordingly
- Docker/nginx/config files stay in root

### Non-Functional
- `npm run build` passes after migration
- No behavior change

## Architecture

### Target Directory Structure
```
app.maf.run/
├── src/
│   ├── app.tsx                    (renamed from App.tsx)
│   ├── index.tsx
│   ├── index.css
│   ├── types.ts
│   ├── constants.ts
│   ├── components/
│   │   ├── commitment-selector.tsx
│   │   ├── maf-lab.tsx
│   │   ├── recovery-modal.tsx
│   │   └── welcome-modal.tsx
│   └── utils/
│       └── maf-logic.ts
├── index.html                     (stays in root, Vite entry)
├── vite.config.ts                 (stays in root)
├── tsconfig.json                  (stays in root)
├── tailwind.config.js             (stays in root)
├── postcss.config.js              (stays in root)
├── package.json                   (stays in root)
├── Dockerfile                     (stays in root)
├── nginx.conf                     (stays in root)
├── docker-compose.yml             (stays in root)
├── docker-compose.dev.yml         (stays in root)
├── .dockerignore                  (stays in root)
└── docs/
```

## Related Code Files

### Files to Move (root -> src/)
| From | To |
|------|----|
| `App.tsx` | `src/app.tsx` |
| `index.tsx` | `src/index.tsx` |
| `index.css` | `src/index.css` |
| `types.ts` | `src/types.ts` |
| `constants.ts` | `src/constants.ts` |
| `components/CommitmentSelector.tsx` | `src/components/commitment-selector.tsx` |
| `components/MafLab.tsx` | `src/components/maf-lab.tsx` |
| `components/RecoveryModal.tsx` | `src/components/recovery-modal.tsx` |
| `components/WelcomeModal.tsx` | `src/components/welcome-modal.tsx` |
| `utils/mafLogic.ts` | `src/utils/maf-logic.ts` |

### Files to Modify (config updates)
- `index.html` — update `<script>` src to `src/index.tsx`
- `vite.config.ts` — no change needed (Vite auto-resolves from index.html)
- `tsconfig.json` — update paths alias: `@/*` -> `./src/*`
- `tailwind.config.js` — update content globs to `./src/**/*.{ts,tsx}`
- `package.json` — rename to `maf-running-coach`

### Files to Delete
- `Dockerfile.txt` (duplicate of `Dockerfile`)
- `dockerignore.txt` (duplicate of `.dockerignore`)
- `nginx.txt` (duplicate of `nginx.conf`)
- `components/` (empty dir after move)
- `utils/` (empty dir after move)

## Implementation Steps

1. Create `src/`, `src/components/`, `src/utils/` directories
2. Move + rename files per table above (kebab-case)
3. Update all import paths inside moved files:
   - `src/index.tsx`: `'./index.css'` stays, `'./App'` -> `'./app'`
   - `src/app.tsx`: `'./types'`, `'./constants'`, `'./components/commitment-selector'`, `'./components/maf-lab'`, `'./components/welcome-modal'`, `'./components/recovery-modal'`, `'./utils/maf-logic'`
   - `src/constants.ts`: `'./types'` stays relative
   - `src/utils/maf-logic.ts`: `'../types'` stays relative
   - `src/components/*.tsx`: `'../types'` stays relative, `'../constants'` stays relative
4. Update `index.html`: `<script type="module" src="/src/index.tsx">`
5. Update `tsconfig.json` paths: `"@/*": ["./src/*"]`
6. Update `tailwind.config.js` content array:
   ```js
   content: [
     "./index.html",
     "./src/**/*.{js,ts,jsx,tsx}",
   ]
   ```
7. Update `package.json` name to `"maf-running-coach"`
8. Delete duplicate files: `Dockerfile.txt`, `dockerignore.txt`, `nginx.txt`
9. Delete empty root dirs: `components/`, `utils/`
10. Run `npm run build` — verify success
11. Manual smoke test in browser

## Todo List
- [ ] Create src directory structure
- [ ] Move and rename all source files
- [ ] Update all import paths
- [ ] Update index.html script src
- [ ] Update tsconfig.json paths
- [ ] Update tailwind.config.js content
- [ ] Update package.json name
- [ ] Delete duplicate files
- [ ] Delete empty root directories
- [ ] Verify build passes
- [ ] Browser smoke test

## Success Criteria
- `npm run build` exits 0
- No source files remain in root (only configs)
- All files in `src/` use kebab-case naming
- Duplicate `.txt` files removed
- App renders identically in browser

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Broken imports after move | Medium | High | Systematic find-replace; build check |
| Tailwind classes not found | Low | High | Update content globs before build |
| index.html script path wrong | Low | High | Verify `/src/index.tsx` in dev server |

## Rollback
- `git checkout .` restores all files to pre-migration state
- Commit before starting phase
