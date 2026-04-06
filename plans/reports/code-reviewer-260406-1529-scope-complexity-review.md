# Scope & Complexity Critique: WordPress SSO + Server-Side Storage

**Reviewer:** code-reviewer (Scope & Complexity Critic / YAGNI Enforcer)
**Date:** 2026-04-06
**Plan:** `plans/260406-1511-wp-sso-server-storage/`

---

## Finding 1: Type Mismatch Between Frontend and Backend Will Cause Silent Data Corruption

- **Severity:** Critical
- **Location:** Phase 3, "Database Schema (Prisma)" + Phase 4, "useUserProfile Migration"
- **Flaw:** The frontend `UserProfile` interface defines `age`, `height`, and `weight` as **strings** (`age: string; height: string; weight: string`). The backend Prisma schema defines `age` as `Int` and `height`/`weight` as `Float`. The DTO validates with `@IsInt()` and `@IsNumber()`. Phase 3's risk table acknowledges this ("Frontend sends strings for age/height/weight") but the mitigation — "DTO transforms string->number" — is wrong. `class-validator` **validates** types; it does not transform them by default. You need `class-transformer` with `enableImplicitConversion: true` in the `ValidationPipe`, which is never specified anywhere in the plan.
- **Failure scenario:** Authenticated user submits profile from frontend. Body contains `{ "age": "30" }`. Backend DTO expects `number`, `@IsInt()` fails on the string `"30"`, returns 400. Every single profile save fails in production. No one tests this because the plan has no integration test step between Phase 3 and Phase 4.
- **Evidence:** `src/types.ts` line 14-16: `age: string; height: string; weight: string;`. Phase 3 DTO: `@IsInt() age: number;`. Phase 3 risk table: "DTO transforms string->number, validates range" — but no implementation step configures `enableImplicitConversion`.
- **Suggested fix:** Either (a) add an explicit step to configure `ValidationPipe` with `transform: true` and `transformOptions: { enableImplicitConversion: true }` in `main.ts`, or (b) change the frontend to send numbers. The plan must pick one and be explicit. This is not a detail to leave to implementers.

---

## Finding 2: Redis 2GB Memory Limit is Over-Engineered for <100 Users

- **Severity:** High
- **Location:** Phase 1, step 10: `maxmemory 2gb`; plan.md "Key Decisions": `Redis 7 standalone`
- **Flaw:** This is a beta for a single WordPress site's users. Refresh tokens are ~100 bytes. OAuth state params have 5-min TTL. Even with 10,000 concurrent sessions (which this app will never reach), total Redis memory would be under 10MB. Allocating 2GB RAM to Redis on a 16GB VPS (12.5% of total) is pure gold plating.
- **Failure scenario:** No functional failure, but 2GB of server RAM is wasted. When the NestJS API (1GB) + Redis (2GB) + PostgreSQL (existing, ~1GB) + frontend + cloudflared are all running, you've consumed ~5GB for what is essentially a profile CRUD app serving a handful of users.
- **Evidence:** Phase 1 step 10: "redis=2GB". docker-compose.yml resource summary shows server has 16GB total with ~3.8GB currently used.
- **Suggested fix:** Set Redis maxmemory to 128MB or 256MB. Revisit when you have actual load data. YAGNI.

---

## Finding 3: Dashboard Phase 5 Scope Contradicts "Essential Only" Decision

- **Severity:** High
- **Location:** Phase 5, "File Structure" and "Implementation Steps"
- **Flaw:** The validation session explicitly confirmed "Essential only — MAF zone card, profile page, nav shell. Other widgets as empty placeholders." Yet Phase 5 specifies implementing **8 separate dashboard widget components** with distinct mobile/desktop variants: `maf-zone-card`, `maf-assistant-card`, `ecosystem-icons`, `ecosystem-links-widget`, `maf-formula-widget`, `weekly-stats-row`, `activity-empty-state`, `chart-empty-state`. That's 14 new files for a dashboard where most widgets show placeholder/empty content. The "essential only" decision was ignored — this is the full mockup being built with dummy data instead of real data.
- **Failure scenario:** 3 days spent building 8 placeholder components that will be rewritten when Strava integration and AI coaching arrive. Developer time wasted on pixel-perfect empty states that no user benefits from. Scope creep disguised as "reduced scope."
- **Evidence:** plan.md Validation Session 1, Q4: "Essential only — MAF zone card, profile page, nav shell. Other widgets as empty placeholders." Phase 5 files to create: 14 new files across 3 directories.
- **Suggested fix:** Implement exactly 3 things: `app-layout.tsx` (nav shell), `maf-zone-card.tsx` (the one functional widget), and `dashboard-page.tsx` (renders zone card + generic "Coming Soon" div for everything else). Kill `maf-assistant-card`, `ecosystem-icons`, `ecosystem-links-widget`, `maf-formula-widget`, `weekly-stats-row` as separate components. A single `<p className="text-white/40">Coming soon</p>` is the MVP placeholder, not a bespoke component per widget.

---

## Finding 4: 401 Refresh Retry in API Client Has No Concurrency Guard

- **Severity:** High
- **Location:** Phase 4, "Implementation Steps" step 1, `api-client.ts` code
- **Flaw:** The `apiFetch` function retries on 401 by calling `/auth/refresh` then retrying. If multiple API calls are in-flight simultaneously (e.g., `getMe()` + `getProfile()` on mount), each one independently fires a refresh request. With refresh token rotation, the first refresh succeeds and invalidates the old token. The second refresh uses the now-dead old token and fails. The user is redirected to `/login` despite having a valid session.
- **Failure scenario:** User loads dashboard. `AuthProvider` calls `GET /users/me`. `useUserProfile` calls `GET /users/me/profile`. JWT has expired (15-min TTL). Both get 401. Both call `/auth/refresh`. First succeeds (rotates token). Second fails (old refresh token dead). `window.location.href = '/login'` fires. User is logged out on every page load after 15 minutes.
- **Evidence:** Phase 4 step 1 code: `if (res.status === 401) { const refreshRes = await fetch(...'/auth/refresh'...) }`. Phase 2: "Refresh token rotation: each use returns new token, old dies." Phase 2 risk table mentions "30-60s grace period" but this is only on the server side — the client makes no attempt to queue or deduplicate refresh calls.
- **Suggested fix:** Add a refresh token mutex/promise queue in `api-client.ts`. Standard pattern: if refresh is already in-flight, subsequent 401 handlers await the same promise instead of firing a new refresh. This is a well-known pitfall and must be in the plan.

---

## Finding 5: Phase 4 Success Criteria Contradicts Implementation Steps

- **Severity:** Medium
- **Location:** Phase 4, "Success Criteria" vs. "Implementation Steps" step 11
- **Flaw:** Success criteria states: "Profile changes auto-save to server (debounced)". Implementation step 11 states: "explicit save (called on button click, NOT auto-save)". Validation Session 1 confirmed: "Explicit save button — matches current Calculate flow." The success criteria was not updated after the validation session. An implementer who reads success criteria will build auto-save; one who reads implementation steps will build explicit save.
- **Failure scenario:** Implementer reads success criteria first, builds debounced auto-save. Code reviewer reads implementation steps, flags it as wrong. Work is thrown away and redone.
- **Evidence:** Phase 4 success criteria line: "Profile changes auto-save to server (debounced)". Phase 4 step 11 comment: `<!-- Updated: Validation Session 1 - explicit save button, not auto-save/debounced -->`.
- **Suggested fix:** Fix the success criteria to say "Profile changes saved via explicit Save button". Delete the stale auto-save line.

---

## Finding 6: Swagger Setup is YAGNI — No API Consumers Exist

- **Severity:** Medium
- **Location:** Phase 3, step 8: "Add Swagger decorators for API docs"
- **Flaw:** The only consumer of this API is the React frontend in the same monorepo. There are no third-party integrations, no public API, no separate mobile app. Adding Swagger decorators to every DTO and controller endpoint adds boilerplate to every file, creates maintenance burden, and serves no one. The Strava integration is handled by a "separate developer" but they consume the Strava API, not this one.
- **Failure scenario:** No functional failure — just wasted time adding `@ApiProperty()`, `@ApiResponse()`, `@ApiTags()` to every endpoint. When the schema changes (which it will, since this is beta), Swagger decorators rot and become misleading.
- **Evidence:** Phase 3 step 8: "Add Swagger decorators for API docs". plan.md: "Out of scope: Strava integration (separate developer)".
- **Suggested fix:** Remove Swagger from Phase 3. Add it later if/when a second consumer appears. Use TypeScript types as the contract. YAGNI.

---

## Finding 7: No Database Creation Step for PostgreSQL

- **Severity:** High
- **Location:** Phase 1, "Key Insights" and "Implementation Steps"
- **Flaw:** Phase 1 says "Create new `maf` database alongside existing `n8n` DB." But the PostgreSQL container is configured with `POSTGRES_DB=n8n` and `POSTGRES_USER=n8n` (docker-compose.yml line 76-77). There is no implementation step that actually creates the `maf` database. Prisma's `DATABASE_URL` will point to a database that doesn't exist. `prisma migrate dev` will fail.
- **Failure scenario:** Developer runs through Phase 1 steps 1-8. Step 8 (`npx prisma migrate dev --name init`) fails with `FATAL: database "maf" does not exist`. Developer wastes time debugging. The fix requires SSH into the VPS, exec into postgres container, and running `CREATE DATABASE maf;` — but no step says to do this.
- **Evidence:** docker-compose.yml: `POSTGRES_DB=${POSTGRES_DB:-n8n}`. Phase 1 step 7: Prisma schema exists but no `CREATE DATABASE` step. Phase 1 key insights: "create new `maf` database alongside existing `n8n` DB" — stated as fact, never implemented.
- **Suggested fix:** Add explicit step between steps 7 and 8: connect to PostgreSQL, `CREATE DATABASE maf;`, create a dedicated user with limited privileges. Or modify docker-compose to use an init script.

---

## Finding 8: Two Design Systems (Glass + Solid Cards) for a Beta With <50 Users

- **Severity:** Medium
- **Location:** Phase 5, "Design Tokens" table and "Architecture"
- **Flaw:** The plan specifies two complete design systems: glassmorphism cards for mobile (transparent, backdrop-blur, 20px radius) and solid cards for desktop (gray-900, no blur, 16px radius). Each has its own component (`glass-card.tsx`, `desktop-card.tsx`), distinct border colors, distinct shadow values, distinct text color scales. This doubles the UI surface area for a beta dashboard that shows mostly placeholder content.
- **Failure scenario:** Every future widget must be implemented twice — once for glass-card mobile, once for desktop-card. When the Strava activity widget ships, the developer must style it for both systems. Design inconsistencies accumulate. Maintenance cost is 2x for every dashboard component, forever.
- **Evidence:** Phase 5 design tokens table: 8 tokens with different mobile vs desktop values. Two card components in file structure. Phase 5 overview: "essential widgets only" — but with dual design systems.
- **Suggested fix:** Pick one card component with responsive props (e.g., glass on mobile via media query, solid on desktop). One component, responsive CSS. Not two components with two APIs.

---

## Finding 9: N8N Removal Creates a Deployment Coupling Risk

- **Severity:** Medium
- **Location:** Phase 1 step 10 (remove N8N from docker-compose) + Phase 6 step 7.6 (remove N8N container)
- **Flaw:** Phase 1 removes N8N from `docker-compose.yml` during development. But the production VPS is currently running N8N. If the updated docker-compose is deployed before Phase 6 (or if someone does a `docker-compose up` mid-development), N8N disappears from production immediately. The cloudflared tunnel currently depends on N8N being healthy (`depends_on: n8n: condition: service_healthy`). Removing N8N without updating the cloudflared dependency will prevent the tunnel from starting, taking down **all** services including the public calculator.
- **Failure scenario:** Developer completes Phase 1, pushes to dev branch. CI/CD or manual deploy runs `docker-compose up`. N8N is gone. Cloudflared's `depends_on` references a missing service. Tunnel fails to start. `app.maf.run` goes down for all users.
- **Evidence:** docker-compose.yml lines 205-209: cloudflared `depends_on: n8n: condition: service_healthy`. Phase 1 step 10: "Remove `n8n` service + `n8n_data` volume." Phase 6 step 7.6: "Remove N8N container + volume (after verifying api works)" — contradicts Phase 1.
- **Suggested fix:** Do NOT remove N8N from docker-compose in Phase 1. Keep it until Phase 6 deploy day. Phase 1 should only ADD the new services (maf-api, redis). N8N removal is a deploy-time operation, not a development-time one.

---

## Unresolved Questions

1. The `probationStartDate` is `DateTime?` in Prisma but `string` (ISO date string) in the frontend type and `@IsOptional() @IsString()` in the DTO — who converts? Prisma will reject a raw string for a DateTime column. This is another type mismatch similar to Finding 1.
2. Phase 2 mentions a "30-60s grace period" for refresh token rotation but provides zero implementation detail. Is this a Redis TTL on the old token? A separate lookup? If not implemented, Finding 4 is even worse.
3. No rate limiting on `/auth/login`, `/auth/callback`, or `/auth/refresh`. An attacker can brute-force refresh tokens or flood the OAuth flow. Phase 2 security section is silent on this.

---

**Status:** DONE
**Summary:** 9 findings: 1 critical (type mismatch will break all profile saves), 4 high (missing DB creation, Redis over-provisioning, refresh race condition, scope contradicts validated decisions), 4 medium (stale success criteria, YAGNI Swagger, dual design systems, N8N removal timing). The plan's biggest systemic issue is that validated scope reduction decisions were not applied — Phase 5 is still the full mockup with "placeholder" labels.
