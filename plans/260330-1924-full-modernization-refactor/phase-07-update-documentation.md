# Phase 7: Update Documentation

## Context
- [plan.md](./plan.md) | Depends on Phases 2, 3, 4
- `docs/` currently has only `MAF_RULES_SUMMARY.md`
- Need standard project docs per documentation-management rules

## Overview
- **Priority:** P2
- **Status:** Pending
- **Effort:** 1.5h
- **Depends on:** Phase 2, 3, 4 (need final structure before documenting)
- **Description:** Create/update project documentation in docs/

## Key Insights
- Keep docs minimal and accurate — reflect actual state, not aspirational
- `MAF_RULES_SUMMARY.md` already exists and is accurate — keep as-is
- Focus on what helps a new developer onboard quickly

## Requirements

### Docs to Create/Update
Per documentation-management rules:

| File | Status | Description |
|------|--------|-------------|
| `docs/project-overview-pdr.md` | Create | What this app does, tech stack, how to run |
| `docs/code-standards.md` | Create | File naming, import conventions, component patterns |
| `docs/codebase-summary.md` | Create | Directory structure, key files, data flow |
| `docs/system-architecture.md` | Create | Component hierarchy, state flow, calc pipeline |
| `docs/design-guidelines.md` | Create | Tailwind usage, color palette, responsive approach |
| `docs/deployment-guide.md` | Create | Docker build, nginx config, production deploy |
| `docs/development-roadmap.md` | Create | Current status, completed phases, next steps |
| `docs/project-changelog.md` | Create | Modernization refactor changes |
| `docs/MAF_RULES_SUMMARY.md` | Keep | Already comprehensive |

## Related Code Files

### Files to Create
- `docs/project-overview-pdr.md`
- `docs/code-standards.md`
- `docs/codebase-summary.md`
- `docs/system-architecture.md`
- `docs/design-guidelines.md`
- `docs/deployment-guide.md`
- `docs/development-roadmap.md`
- `docs/project-changelog.md`

### Files to Keep Unchanged
- `docs/MAF_RULES_SUMMARY.md`

## Implementation Steps

### Step 1: Create `project-overview-pdr.md`
- App name, purpose, tech stack
- How to run: `npm install`, `npm run dev`, `npm run build`
- How to test: `npm test`
- How to lint: `npm run lint`
- Live URL: https://app.maf.run

### Step 2: Create `code-standards.md`
- File naming: kebab-case for all `.ts`/`.tsx`
- Import order: React > external > internal > types > styles
- Component pattern: functional + hooks
- File size limit: 200 lines
- Custom hooks in `src/hooks/`
- Utils in `src/utils/`

### Step 3: Create `codebase-summary.md`
- Full directory tree of `src/`
- Description of each directory
- Key files and their responsibilities
- Data flow: User Input -> Hooks -> Calculator -> Result State -> UI Components

### Step 4: Create `system-architecture.md`
- Component hierarchy diagram (text-based)
- State management: hooks pattern, no external state lib
- Calculation pipeline: MAF formula -> schedule -> safety -> volume cap
- No API calls — fully client-side

### Step 5: Create `design-guidelines.md`
- Tailwind CSS 3 usage
- Custom colors: maf-purple, maf-pink, maf-orange
- Font: Inter
- Responsive: mobile-first, md: breakpoint
- Animation classes: animate-fade-in, animate-fade-in-up
- Vietnamese UI language

### Step 6: Create `deployment-guide.md`
- Docker: Dockerfile multi-stage build
- Nginx: reverse proxy config
- docker-compose for dev and prod
- Build output: `dist/`

### Step 7: Create `development-roadmap.md`
- Phase 1-7 status
- Future considerations (keep brief)

### Step 8: Create `project-changelog.md`
- Entry for modernization refactor with date

## Todo List
- [ ] Create project-overview-pdr.md
- [ ] Create code-standards.md
- [ ] Create codebase-summary.md
- [ ] Create system-architecture.md
- [ ] Create design-guidelines.md
- [ ] Create deployment-guide.md
- [ ] Create development-roadmap.md
- [ ] Create project-changelog.md
- [ ] Verify all docs are accurate to final codebase state

## Success Criteria
- All 8 docs created in `docs/`
- Each doc reflects actual codebase state (not aspirational)
- New developer can onboard by reading docs in order
- No doc exceeds 200 lines

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Docs drift from code immediately | Medium | Low | Keep docs minimal; point to code |
| Over-documenting | Medium | Low | YAGNI — only what helps onboarding |

## Rollback
- Delete new doc files (no code impact)
