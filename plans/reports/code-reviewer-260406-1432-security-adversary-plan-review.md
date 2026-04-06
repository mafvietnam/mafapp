# Security Adversary Review: Full Modernization Refactor Plan

**Reviewer:** code-reviewer (Security Adversary perspective)
**Date:** 2026-04-06
**Plan:** `plans/260330-1924-full-modernization-refactor/`
**Scope:** 7 phases covering structure migration, monolith split, testing, linting, docs

---

## Finding 1: Dockerfile is broken -- production builds fail after migration

- **Severity:** Critical
- **Location:** Phase 1, section "Related Code Files > Files to Modify"
- **Flaw:** The plan lists files to modify (`index.html`, `tsconfig.json`, `tailwind.config.js`, `package.json`) but completely omits `Dockerfile`. The Dockerfile uses explicit `COPY` statements referencing the old root-level paths: `COPY App.tsx constants.ts types.ts ./`, `COPY components/ ./components/`, `COPY utils/ ./utils/`, `COPY index.tsx ./`. After migration to `src/`, none of these paths exist. The refactor has been executed (commit `f72af00`) but the Dockerfile was never updated.
- **Failure scenario:** `docker build` fails in CI/CD or production deployment. The builder stage cannot find source files, build aborts, no new container image is created. If the previous image is still running, it continues serving stale code indefinitely. If the cluster is configured to pull fresh images on deploy, the service goes down.
- **Evidence:** Dockerfile lines 39-47: `COPY index.html index.tsx ./`, `COPY App.tsx constants.ts types.ts ./`, `COPY components/ ./components/`, `COPY utils/ ./utils/`. Zero references to `src/` in the Dockerfile. Meanwhile `ls src/` confirms all source now lives there.
- **Suggested fix:** Add Dockerfile to Phase 1's "Files to Modify" list. Replace builder COPY statements with `COPY src/ ./src/`. Also add `COPY src/pages/ ./src/pages/` or simply `COPY src/ ./src/` to capture the `pages/` directory the plan never accounted for.

---

## Finding 2: Plan is stale and all statuses are wrong -- creates false sense of pending work

- **Severity:** High
- **Location:** `plan.md`, all phase files, Status fields
- **Flaw:** Every phase shows `Status: Pending` but git history shows all 7 phases were executed between commits `f72af00` (Phase 1), `e941fc4` (Phases 2-4, 6), `83d57ca` (Phase 5), and `5d68f06` (Phase 7). The plan is a lie about current project state.
- **Failure scenario:** A developer or orchestrating agent reads the plan, believes phases are pending, and re-executes them -- destroying existing work or creating file conflicts. The SP2-SP7 plan (`260331-0121`) lists this plan as a blocker (`blocks: [260331-0121-maf-platform-sp2-sp7]`), so a stale "Pending" status could gate downstream work.
- **Evidence:** `plan.md` line 4: `status: pending`. All phase files: `Status: Pending`. Git log: `f72af00 refactor: migrate source files to src/ directory`, `e941fc4 refactor: split monoliths into modular components and add ESLint`, etc.
- **Suggested fix:** Update all statuses to `Completed` and mark the plan as done. This is not a style issue -- it directly blocks the SP2-SP7 dependency chain.

---

## Finding 3: CSP allows `unsafe-inline` and `unsafe-eval` for scripts -- XSS sink

- **Severity:** High
- **Location:** Phase 7, section "deployment-guide.md" (should have documented and flagged this) and implicitly Phase 1 (nginx.conf not reviewed)
- **Flaw:** The nginx.conf CSP header permits `script-src 'self' 'unsafe-inline' 'unsafe-eval'`. For a Vite-built SPA with hashed bundles, `unsafe-inline` and `unsafe-eval` are unnecessary. These directives negate the entire purpose of CSP for script injection protection. Any DOM-based XSS or injected inline script executes without restriction.
- **Failure scenario:** If any future feature introduces user-generated content (comments, profile names, shared plans -- all on the SP2-SP7 roadmap), an attacker can inject `<script>` tags or event handlers that execute because CSP permits inline scripts. Even without user content, a compromised CDN or dependency can inject arbitrary code.
- **Evidence:** `nginx.conf` line 37: `script-src 'self' 'unsafe-inline' 'unsafe-eval'`
- **Suggested fix:** Remove `unsafe-inline` and `unsafe-eval`. Vite produces hashed JS bundles that work with `script-src 'self'` alone. If inline styles are needed, use `style-src 'self' 'unsafe-inline'` only for styles, not scripts. The plan's deployment guide phase should have audited this.

---

## Finding 4: `user-input-form.tsx` is 340 lines -- plan predicted ~180 and accepted it

- **Severity:** Medium
- **Location:** Phase 2, section "Architecture > Target File Structure" and "Risk Assessment"
- **Flaw:** The plan estimated `user-input-form.tsx` at "~180 lines: mostly JSX form fields" and preemptively excused it: "JSX-heavy forms are acceptable at ~180; split further only if needed." The actual file is 340 lines -- nearly double the estimate and 70% over the 200-line project limit. Similarly, `use-maf-calculator.ts` is 367 lines (plan predicted ~120 lines).
- **Failure scenario:** These bloated files become the new monoliths. The refactor's stated goal was modularization with a 200-line cap. Shipping files that immediately violate the constraint means the "invariant" in `plan.md` ("all new files under 200 lines") was never enforced. Future developers inherit the same problem the refactor was supposed to fix.
- **Evidence:** Phase 2: `user-input-form.tsx (~180 lines)`, `use-maf-calculator.ts (~120 lines)`. Actual: `wc -l` shows 340 and 367 respectively. Phase 2 success criteria: "All new files under 200 lines."
- **Suggested fix:** The plan should have identified extraction boundaries for these files: `user-input-form.tsx` can be split into `personal-info-section.tsx`, `health-checkboxes-section.tsx`, and `action-buttons-section.tsx`. The calculator hook needs the `calculateMAF` function (alone ~290 lines) extracted into a pure utility function, leaving the hook as a thin state wrapper.

---

## Finding 5: No input validation at computation boundary -- NaN/Infinity propagation

- **Severity:** High
- **Location:** Phase 3, section "Split Strategy" and Phase 5, section "Test Matrix"
- **Flaw:** The plan splits `mafLogic.ts` into pure function modules but never adds input validation at function boundaries. Functions like `calculateSmartLongRun` accept raw `number | undefined` parameters and the plan's test matrix only tests "invalid data (>300min, <20min, HR>220)" but never tests `NaN`, `Infinity`, `undefined`, or negative numbers flowing through the calculation pipeline. The `parseInt` calls throughout the codebase use no radix parameter and have no NaN guards at the function boundary -- only at the UI layer (`handleBlur`).
- **Failure scenario:** A user types "12e" in the age field. `parseInt("12e")` returns 12, which is valid. But `parseFloat("12e")` returns 12 too. The real problem: a caller passes `undefined` to `calculateSmartLongRun` for `lastLongRunDuration` -- the function must handle this, but the plan never specifies guard behavior for each module's inputs. The tests don't cover it.
- **Evidence:** Phase 5 test matrix for `maf-smart-long-run.test.ts`: "Invalid data (>300min, <20min, HR>220)" -- tests range bounds but not type corruption. `use-maf-calculator.ts` line 35: `parseInt(userProfile.age)` with no radix. `use-user-profile.ts` line 37: same.
- **Suggested fix:** Phase 3 should specify that each module's exported functions validate their own inputs at the boundary (not rely on caller validation). Phase 5 tests should include `NaN`, `undefined`, `null`, negative, and `Infinity` cases for every numeric parameter. Add `parseInt(x, 10)` as a code standard in Phase 6's ESLint config (`radix` rule).

---

## Finding 6: No HSTS in production despite HTTPS via Cloudflare Tunnel

- **Severity:** Medium
- **Location:** Phase 7, "deployment-guide.md" (omission) and implicitly Phase 1 (nginx.conf not in scope)
- **Flaw:** The nginx.conf has HSTS commented out: `# add_header Strict-Transport-Security ...`. The app is served at `https://app.maf.run` via Cloudflare Tunnel, meaning TLS terminates at Cloudflare but the origin serves HTTP. The plan's documentation phase should have flagged this configuration gap. Without HSTS, a user who bookmarks `http://app.maf.run` is vulnerable to downgrade attacks if Cloudflare's redirect is misconfigured or bypassed.
- **Failure scenario:** An attacker on the same network as the user performs an SSL stripping attack. Without HSTS preload, the browser has no memory that this domain requires HTTPS. First visit over HTTP can be intercepted.
- **Evidence:** `nginx.conf` line 39-40: `# add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;` (commented out)
- **Suggested fix:** Phase 7's deployment guide should explicitly document whether HSTS should be enabled at Cloudflare level (preferred) or nginx level. If Cloudflare handles it, document that. If not, uncomment the header.

---

## Finding 7: Plan ignores `src/pages/` directory and React Router -- structural blind spot

- **Severity:** Medium
- **Location:** Phase 1, section "Target Directory Structure" and Phase 2, section "Files NOT to Touch"
- **Flaw:** The plan was written before the `/guide` route was added (commit `8b3d077`), but even at the time of Phase 2 execution, the plan's target directory structure does not mention `src/pages/` or any routing setup. The `app.tsx` orchestrator in Phase 2 shows no `Routes`/`Route` components, but the actual `app.tsx` uses `react-router-dom` with `Routes` and `Route`. The plan's Phase 2 success criteria ("app.tsx under 100 lines") and the example orchestrator code are both based on a no-routing assumption.
- **Failure scenario:** A developer following the plan creates the orchestrator exactly as specified in Phase 2 Step 6, omitting the router. The `/guide` route breaks. The plan has no mention of router dependencies, so the implementer doesn't know to preserve them.
- **Evidence:** Phase 1 target structure: no `pages/` directory listed. Phase 2 Step 6 example code: no `Routes`/`Route` imports, no `react-router-dom`. Actual `app.tsx` lines 2, 120-124: `import { Routes, Route } from 'react-router-dom'`, `<Routes><Route path="/" .../>`.
- **Suggested fix:** When features are added between plan creation and execution, the plan must be updated. Phase 1 should include `src/pages/` in the target structure. Phase 2 should show the router setup in the orchestrator example.

---

## Finding 8: Security headers lost on nested nginx location blocks

- **Severity:** Medium
- **Location:** Phase 7 (deployment-guide.md should document this) and implicitly nginx.conf
- **Flaw:** Nginx's `add_header` directive is not inherited by child location blocks when the child block also uses `add_header`. The nginx.conf adds security headers (CSP, X-Frame-Options, etc.) at the `server` level, but the `location ~* \.html$`, `location ~* \.(css|js)$`, `location /`, and other blocks each add their own `Cache-Control` or other headers. When a child location block uses `add_header`, ALL parent-level `add_header` directives are dropped for that request.
- **Failure scenario:** A request for `index.html` matches `location ~* \.html$` which adds `Cache-Control`. At that point, the server-level CSP, X-Frame-Options, X-XSS-Protection, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy headers are all silently dropped. The HTML page -- the most security-sensitive resource -- is served with no security headers.
- **Evidence:** nginx.conf: server-level headers at lines 22-37, `location ~* \.html$` at line 100 with its own `add_header Cache-Control`. Nginx documentation: "There could be several add_header directives. These directives are inherited from the previous configuration level if and only if there are no add_header directives defined on the current level."
- **Suggested fix:** Either duplicate security headers in every location block, or use the `ngx_http_headers_more_module` (`more_set_headers`), or restructure the config to avoid nested `add_header`. The deployment guide should document this as a known nginx footgun.

---

## Summary

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| 1 | Dockerfile broken after src/ migration | Critical | Unresolved -- Docker builds fail |
| 2 | All plan statuses stale (Pending vs executed) | High | Blocks SP2-SP7 dependency chain |
| 3 | CSP allows unsafe-inline/unsafe-eval for scripts | High | Persistent vuln, worsens with SP2-SP7 features |
| 4 | Two files 70-83% over 200-line limit | Medium | Violates plan's own success criteria |
| 5 | No input validation at module boundaries | High | NaN/Infinity can propagate through calc pipeline |
| 6 | HSTS disabled in production | Medium | SSL stripping possible |
| 7 | Plan ignores pages/ directory and React Router | Medium | Plan/reality divergence |
| 8 | Nginx security headers dropped in location blocks | Medium | CSP/XSS headers not served for HTML |

**Blocking findings:** #1 (Dockerfile), #2 (stale status gating SP2-SP7)

**Status:** DONE
**Summary:** 8 findings, 1 critical (Dockerfile broken for production), 3 high (stale plan status, CSP weakness, missing input validation), 4 medium. The plan was reasonably structured for its scope but failed to account for deployment artifacts (Dockerfile, nginx security) and was never updated after execution.
**Concerns:** Finding #1 means the current codebase cannot be deployed via Docker without manual Dockerfile fixes. This may already be causing production issues if a deploy has been attempted since commit `f72af00`.
