# Assumption Destroyer Review: WordPress SSO + Server-Side Storage Plan

**Reviewer:** code-reviewer (adversarial perspective)
**Date:** 2026-04-06
**Plan:** `260406-1511-wp-sso-server-storage`
**Verdict:** 3 Critical, 3 High, 2 Medium findings. Plan has structural gaps that will cause integration failures.

---

## Finding 1: Frontend-Backend Type Mismatch Will Break Profile Save/Load

- **Severity:** Critical
- **Location:** Phase 3, section "Database Schema" & Phase 4, section "useUserProfile Migration"
- **Flaw:** The frontend `UserProfile` interface defines `age`, `height`, and `weight` as `string` types (confirmed in `src/types.ts` lines 15-17). The backend Prisma schema and DTO define them as `Int`/`Float` with numeric validation (`@IsInt()`, `@IsNumber()`). The plan says "Profile fields match frontend UserProfile interface exactly" (Phase 3) — this is false. Neither phase addresses the type coercion boundary.
- **Failure scenario:** User fills out calculator form (strings like `"35"`, `"170"`, `"65"`). Frontend sends JSON with string values to `PUT /users/me/profile`. Backend DTO validation rejects them as non-numeric → 400 error. Or if `class-transformer` coerces them, the reverse path breaks: backend returns `{ age: 35 }` as number, frontend `useState<UserProfile>` expects string, `parseInt(userProfile.age)` in `useUserProfile.ts` line 36 receives a number, works by accident, but `handleInputChange` does `{ ...prev, [name]: value }` where `value` from form `<input>` is always string — save cycle corrupts types.
- **Evidence:** `src/types.ts:15-17`: `age: string; height: string; weight: string;`. Phase 3 DTO: `@IsInt() age: number;`. Phase 3 Risk Assessment mentions "DTO transforms string→number, validates range" but no implementation detail on how this bidirectional coercion works, and the frontend hook is never updated to handle numeric types from the API.
- **Suggested fix:** Add explicit transformation layer. Either: (a) update frontend `UserProfile` to use `number` types and fix all form handlers, or (b) add a serialization adapter in `profile-service.ts` that converts string↔number at the boundary. Document which side owns the canonical type.

---

## Finding 2: PostgreSQL "New Database" Creation Has No Plan for Credentials or Isolation

- **Severity:** Critical
- **Location:** Phase 1, section "Key Insights" & "Implementation Steps" step 10
- **Flaw:** Plan says "create new `maf` database alongside existing `n8n` DB." Current `docker-compose.yml` provisions PostgreSQL with `POSTGRES_DB=n8n`, `POSTGRES_USER=n8n`. Creating a second database (`maf`) requires either: (a) using the same `n8n` superuser (security violation — NestJS API can read/write N8N data), or (b) creating a separate PostgreSQL user with grants on only the `maf` database. The plan specifies neither. The `DATABASE_URL` env var in Phase 1 step 3 just lists `DATABASE_URL` with no discussion of which user, what connection string, or how the `maf` database gets created in the first place.
- **Failure scenario:** Implementer runs `npx prisma migrate dev` against `DATABASE_URL=postgresql://n8n:password@postgres:5432/maf`. Prisma connects as `n8n` user but the `maf` database doesn't exist → connection refused. Or they create it manually but forget to document the init step, so production deploy (Phase 6 step 7) fails because `prisma migrate deploy` connects to a nonexistent database.
- **Evidence:** Phase 1 Key Insights: "Create new `maf` database alongside existing `n8n` DB." No implementation step creates this database. No init SQL script. No `POSTGRES_MULTIPLE_DATABASES` pattern in docker-compose.
- **Suggested fix:** Add explicit step: create `maf` database + dedicated `maf_user` via init SQL script mounted as `/docker-entrypoint-initdb.d/init-maf-db.sql`. Document the `DATABASE_URL` with the new user. Note that init scripts only run on first container start — for existing deployments, provide a manual `CREATE DATABASE` / `CREATE USER` command.

---

## Finding 3: Refresh Token Retry Creates Infinite Loop and Race Condition

- **Severity:** Critical
- **Location:** Phase 4, section "Implementation Steps" step 1 (api-client.ts)
- **Flaw:** The `apiFetch` wrapper intercepts 401, calls `/auth/refresh`, and retries the original request. But: (a) the retry call also goes through `apiFetch`, so if the refreshed token immediately expires or the retry also returns 401, it loops: 401 → refresh → retry → 401 → refresh → retry → ... until the browser hangs. (b) If two concurrent requests both hit 401 simultaneously (e.g., dashboard page mounts and fires `getMe()` + `getProfile()` in parallel), both trigger `/auth/refresh` simultaneously. With refresh token rotation (Phase 2: "each use returns new token, old dies"), the first refresh succeeds and invalidates the token. The second refresh uses the now-dead old token → fails → redirects to `/login`, even though the user has a valid session.
- **Failure scenario:** User's JWT expires while on the dashboard. Dashboard mounts `AuthProvider` (calls `/users/me`) and `useUserProfile` (calls `/users/me/profile`) in parallel. Both get 401. Both race to `/auth/refresh`. First one rotates the refresh token. Second one's refresh token is now invalid → user gets kicked to login page despite having a valid session.
- **Evidence:** Phase 4 api-client.ts code block shows no retry guard, no mutex/queue for refresh, no max-retry limit. Phase 2 Risk Assessment mentions "30-60s grace period: old refresh token still returns already-issued new pair" — but this mitigation is described only in the backend risk table, not in the actual implementation steps. No implementation step in Phase 2 actually implements this grace period.
- **Suggested fix:** (a) Add a refresh mutex/promise queue in `api-client.ts`: if a refresh is in-flight, subsequent 401s should await the same promise instead of firing a new refresh. (b) Add a `retried` flag to prevent infinite loops. (c) In Phase 2 implementation steps, explicitly add the grace period logic for rotated refresh tokens (store previous token hash with a 60s TTL).

---

## Finding 4: N8N Removal Sequence Risks Downtime and Data Loss

- **Severity:** High
- **Location:** Phase 1, step 10 & Phase 6, step 7
- **Flaw:** Phase 1 says "Remove `n8n` service + `n8n_data` volume" from docker-compose.yml. Phase 6 says "Step 6: Remove N8N container + volume (after verifying api works)." These contradict: Phase 1 removes N8N from the compose file during development, but Phase 6 implies N8N is still running in production until deployment day. If a developer runs `docker-compose up` on the VPS after Phase 1 changes are merged but before Phase 6 deploy, N8N dies immediately. The `n8n_data` volume removal destroys all N8N workflow data permanently.
- **Failure scenario:** Phase 1 PR merges to dev. CI or a manual deploy runs `docker-compose up -d` on the VPS. N8N service is gone from the compose file. Docker stops the N8N container. If anyone ever needs N8N data or workflows, the volume is gone. Validation log says "No, remove N8N — not in use" but doesn't confirm data has been exported/archived.
- **Evidence:** Phase 1 step 10: "Remove `n8n` service + `n8n_data` volume." Phase 6 step 7-6: "Remove N8N container + volume (after verifying api works)." No step in any phase exports N8N data before deletion.
- **Suggested fix:** (a) Phase 1 should comment out N8N service, not delete it. (b) Phase 6 should be the only phase that removes N8N, and only after: export N8N workflows (`n8n export:workflow --all`), backup the volume, and confirm api.maf.run serves traffic. (c) Keep `n8n_data` volume for 30 days post-deploy.

---

## Finding 5: WP OAuth Server Plugin Version Assumption is Unvalidated

- **Severity:** High
- **Location:** Phase 2, section "Key Insights"
- **Flaw:** Plan states "WP OAuth Server plugin (v4.3.2) — free, supports PKCE, good performance." This is a research-report claim, not a validated fact. The free version of WP OAuth Server may not support PKCE (some implementations require the Pro tier for PKCE support). The plan has no validation step — Phase 2 step 1 is simply "Install WP OAuth Server plugin on maf.run" with no verification that PKCE actually works before building the entire auth system around it.
- **Failure scenario:** Team installs the free WP OAuth Server plugin. PKCE is a Pro-only feature or unsupported in v4.3.2. The entire OAuth flow in Phase 2 is built around PKCE (`code_verifier`, `code_challenge`). Without PKCE, the flow requires a `client_secret` (confidential client), which changes the security model and requires redesigning the auth flow to use backend-stored secrets instead of PKCE.
- **Evidence:** Phase 2 step 3: "Note client_id (no client_secret needed for PKCE public client)." Fallback in Risk Assessment: "fallback: WP REST API + application passwords" — this is a fundamentally different auth model (not OAuth at all), not a graceful fallback. No spike/PoC step validates PKCE works with the chosen plugin before Phase 2 begins.
- **Suggested fix:** Add a Phase 0 spike or Phase 2 step 0: install plugin on staging/local WordPress, create a test client, and verify PKCE authorization code flow end-to-end before writing any NestJS code. Identify a concrete fallback plugin (e.g., "OAuth2 Server" by BShaffer, or wp-oauth-server Pro) and document the delta in implementation if PKCE fails.

---

## Finding 6: Cookie-Based Auth Between Subdomains Has Untested CORS Constraints

- **Severity:** High
- **Location:** Phase 2 & Phase 4, auth flow architecture
- **Flaw:** The plan assumes `credentials: 'include'` + `sameSite=lax` + `domain=.maf.run` will seamlessly pass cookies between `app.maf.run` (frontend) and `api.maf.run` (backend). This is cross-origin. `sameSite=lax` cookies are only sent on top-level navigations and "safe" methods (GET). `POST /auth/refresh` and `PUT /users/me/profile` are non-safe methods — `sameSite=lax` will NOT send the cookie on these cross-origin POST/PUT requests in modern browsers (Chrome 80+). The plan needs `sameSite=none` (which requires `secure=true`, which they have) or must use a same-origin API proxy.
- **Failure scenario:** User loads dashboard (GET requests with lax cookies work). User clicks "Save Profile" → `PUT /users/me/profile` cross-origin to `api.maf.run`. Browser does not attach the httpOnly cookie because `sameSite=lax` blocks it on cross-origin PUT. Request arrives without JWT → 401 → refresh loop → kicked to login.
- **Evidence:** Phase 2: "httpOnly cookie for JWT (secure, sameSite=lax, domain=.maf.run)." Phase 4: "credentials: 'include'" on all fetch calls. Phase 4 step 9 adds a vite dev proxy for `/api` → localhost:3001, but this is dev-only. Production has no proxy — frontend at `app.maf.run` makes direct cross-origin calls to `api.maf.run`.
- **Suggested fix:** Either (a) change `sameSite` to `none` (works but weakens CSRF protection; mitigate with CSRF tokens), or (b) proxy API requests through the frontend's nginx at `app.maf.run/api/*` → `api.maf.run` so all requests are same-origin (eliminates the cross-origin cookie problem entirely and is the more robust solution), or (c) switch to `Authorization: Bearer` header with token stored in memory (not localStorage) and use the refresh token only via httpOnly cookie.

---

## Finding 7: Phase 4 Success Criteria Contradicts Implementation

- **Severity:** Medium
- **Location:** Phase 4, sections "Implementation Steps" step 11 vs "Success Criteria"
- **Flaw:** Implementation step 11 explicitly says "Add `saveProfile()` function: explicit save (called on button click, NOT auto-save)" with HTML comment "Updated: Validation Session 1 - explicit save button, not auto-save." But the Success Criteria section still says "Profile changes auto-save to server (debounced)." This is a direct contradiction within the same document.
- **Failure scenario:** Implementer reads success criteria and builds auto-save with debounce. Reviewer reads implementation steps and rejects the PR. Time wasted resolving the contradiction during implementation.
- **Evidence:** Phase 4 step 11 comment: `<!-- Updated: Validation Session 1 - explicit save button, not auto-save/debounced -->`. Phase 4 Success Criteria: "Profile changes auto-save to server (debounced)."
- **Suggested fix:** Update Success Criteria to: "Profile changes saved to server on explicit 'Save' button click."

---

## Finding 8: No Rate Limiting on Auth Endpoints

- **Severity:** Medium
- **Location:** Phase 2, "Security Considerations" (by omission)
- **Flaw:** No rate limiting is specified for any auth endpoint. `GET /auth/login` generates a Redis entry (state + code_verifier) with 5-minute TTL on every call. `POST /auth/refresh` validates against Redis on every call. Neither has any rate limiting. The plan mentions no throttling middleware (e.g., `@nestjs/throttler`).
- **Failure scenario:** Attacker scripts rapid-fire `GET /auth/login` calls. Each creates a Redis key with 5-minute TTL. At 1000 req/sec, that's 300K keys in 5 minutes. Redis `maxmemory` is 2GB, each key is small, so it won't OOM — but it will pollute the keyspace and force evictions of legitimate refresh tokens (allkeys-lru policy from Phase 1). Users get randomly logged out because their refresh tokens were evicted to make room for attacker-generated OAuth state keys.
- **Evidence:** Phase 1: "Redis maxmemory 2GB with allkeys-lru policy." Phase 2: "store verifier+state in Redis (`oauth:state:{state}`, TTL 5min)." No mention of `@nestjs/throttler` or any rate limiting in any phase.
- **Suggested fix:** Add `@nestjs/throttler` with strict limits on auth endpoints (e.g., 10 req/min per IP for `/auth/login`, 5 req/min for `/auth/refresh`). Use a separate Redis key prefix or dedicated Redis DB for OAuth state vs refresh tokens, so LRU eviction of one category doesn't affect the other.

---

## Unresolved Questions

1. **Cloudflare tunnel routing update** — Phase 6 step 7-4 says "Update Cloudflare tunnel config (api.maf.run → NestJS port 3001)." Is this done via the Cloudflare Dashboard (manual step, not automatable in CI) or via `cloudflared` CLI config file? Current docker-compose uses token-based tunnel with "routes configured in Cloudflare Dashboard" — meaning this is a manual step that could be forgotten or misconfigured.

2. **RSA key pair lifecycle** — Phase 2 step 5 generates keys and stores them base64-encoded in env vars. What happens when keys need rotation? All existing JWTs become invalid instantly. No JWKS endpoint, no key rotation strategy, no `kid` claim in JWT to support multiple active keys.

3. **PostgreSQL connection limits** — Current PostgreSQL serves N8N. After adding NestJS with Prisma (which uses a connection pool, default 5 connections), the total connection count increases. Phase 1 says "Prisma direct connection (no PgBouncer at this scale)" but doesn't check or set `max_connections` on PostgreSQL. Default PostgreSQL `max_connections` is 100, which is fine, but should be explicitly documented.

**Status:** DONE
**Summary:** Plan has 3 critical integration flaws (type mismatch, refresh race condition, cookie sameSite policy), 3 high-risk gaps (N8N removal sequencing, unvalidated plugin assumption, database credential isolation), and 2 medium issues (doc contradiction, missing rate limiting). The cross-subdomain cookie issue (Finding 6) is the highest-impact risk — it will silently fail in production on all non-GET API calls.
