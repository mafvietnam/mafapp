# Failure Mode Analysis: WordPress SSO + Server-Side Storage Plan

**Reviewer:** code-reviewer (Failure Mode Analyst)
**Date:** 2026-04-06
**Verdict:** 7 findings — 2 Critical, 3 High, 2 Medium

---

## Finding 1: Type Mismatch Between Frontend and Backend Will Corrupt Profile Data on First Save

- **Severity:** Critical
- **Location:** Phase 3, "Database Schema" + Phase 4, "useUserProfile Migration"
- **Flaw:** The frontend `UserProfile` interface defines `age`, `height`, and `weight` as `string` types (see `src/types.ts` lines 14-16: `age: string; height: string; weight: string`). The backend Prisma schema in Phase 3 defines them as `Int` and `Float`. The DTO validation uses `@IsInt()` and `@IsNumber()`. Phase 3's risk table mentions "DTO transforms string->number" but no actual transform decorator (`@Transform`) is specified in the DTO code. `class-validator` decorators validate types — they do not coerce them. The frontend sends `{"age": "35"}`, the DTO rejects it as non-integer, and every profile save returns 400.
- **Failure scenario:** User logs in, fills out calculator, clicks "Save Profile". The PUT request sends `{age: "35", height: "170", weight: "65"}` as strings (matching the existing React state shape). Backend DTO validation rejects all three fields. User sees validation error. No profile is ever saved. Feature is DOA.
- **Evidence:** `src/types.ts` line 14: `age: string;` vs Phase 3 DTO: `@IsInt() @Min(1) @Max(120) age: number;`
- **Suggested fix:** Either (a) add `@Transform(({ value }) => parseInt(value))` before each numeric DTO field, or (b) transform on the frontend in `profile-service.ts` before sending, or (c) change the frontend `UserProfile` interface to use `number` types. Option (c) is cleanest but requires touching every component that reads/writes age/height/weight — plan must account for that cascade.

---

## Finding 2: Refresh Token Race Condition With Concurrent Tabs Will Log Users Out

- **Severity:** Critical
- **Location:** Phase 2, "Key Insights" (refresh token rotation) + Phase 4, "api-client.ts" (401 retry)
- **Flaw:** Refresh token rotation means each use invalidates the old token and issues a new one. The plan acknowledges this risk (Phase 2 risk table: "30-60s grace period") but the grace period is only mentioned in prose — no implementation detail in any step. Meanwhile, Phase 4's `api-client.ts` implementation has no mutex/lock on the refresh call. If a user has two browser tabs open, both tabs hit a 401 simultaneously, both call `POST /auth/refresh` with the same refresh token. Without the grace period implemented, the first call succeeds and rotates the token; the second call fails (old token already deleted from Redis), and that tab redirects to `/login`. Even with the grace period: if the second tab's refresh returns the *already-issued* new token (as described in the risk table), the first tab's cookie has already been overwritten — now both tabs have different cookies, one of which is stale.
- **Failure scenario:** User has dashboard open in two tabs. JWT expires in both tabs at the same time (+/- seconds). Both tabs fire refresh simultaneously. Without grace period: one tab logs out. With grace period: cookie desync between tabs causes intermittent 401s until one tab is closed.
- **Evidence:** Phase 2 risk table: "30-60s grace period: old refresh token still returns already-issued new pair" — no implementation step covers this. Phase 4 `api-client.ts`: no deduplication of concurrent refresh calls.
- **Suggested fix:** (a) Frontend: add a refresh token mutex — queue concurrent 401 retries behind a single in-flight refresh promise. This is standard practice (e.g., `axios-auth-refresh` pattern). (b) Backend: implement the grace period as a concrete step — store previous refresh token in Redis with short TTL, accept either current or previous token. Both are needed.

---

## Finding 3: Cloudflare Tunnel Dependency Creates Zero-Downtime Deploy Impossibility

- **Severity:** High
- **Location:** Phase 6, "Incremental Deploy" steps 4-5
- **Flaw:** The tunnel is token-based with routes configured in Cloudflare Dashboard (see `docker-compose.yml` line 203). The plan says "Step 4: Update Cloudflare tunnel config (api.maf.run -> NestJS port 3001)." This requires changing the route in the Cloudflare Dashboard from the current N8N target (`172.28.0.12:5678`) to the new API target. During this window, `api.maf.run` is either pointing at a stopped N8N or a not-yet-ready NestJS. The plan also has `cloudflared` depending on `n8n: condition: service_healthy`. Removing N8N without updating this dependency means cloudflared will refuse to start.
- **Failure scenario:** Operator runs updated `docker-compose.yml` with N8N removed. Cloudflared container fails to start because its `depends_on` still references the removed N8N service (plan doesn't mention updating this). Even if fixed, the tunnel config change in Cloudflare Dashboard is a manual step with no atomic swap — there is a window where api.maf.run routes to nothing.
- **Evidence:** `docker-compose.yml` lines 205-209: `depends_on: n8n: condition: service_healthy`. Phase 6 step 4 is a manual Cloudflare Dashboard change.
- **Suggested fix:** (a) Phase 1's docker-compose changes must update cloudflared's `depends_on` from `n8n` to `maf-api`. (b) Deploy sequence should be: start maf-api first, verify health, then update tunnel route, then remove N8N. (c) Consider running both N8N and NestJS briefly in parallel during cutover so the tunnel always has a target.

---

## Finding 4: No Database Migration Rollback Tested — Plan Says "psql < backup.sql" Which Doesn't Work

- **Severity:** High
- **Location:** Phase 6, "Rollback Plan" step 8
- **Flaw:** Rollback plan says `psql maf < backup.sql` for DB migration failure. But the `maf` database doesn't exist before Phase 1 — it's created by `prisma migrate dev`. If the migration fails partway through, the database may be in a partial state that `psql < backup.sql` cannot fix (the backup was of a database that didn't exist). Additionally, `pg_dump` in step 5 is for "existing PostgreSQL data" — the N8N database. There is no backup of the `maf` database because it won't have data yet (users haven't signed up). The real risk is a failed migration leaving Prisma's migration table out of sync.
- **Failure scenario:** Prisma migration `add-user-profile` (Phase 3) deploys to production. It partially applies (creates table, fails on index). `prisma migrate deploy` now shows "failed migration." Running `psql maf < backup.sql` either (a) targets a non-existent backup or (b) restores an empty database that doesn't fix the migration state. Operator must now manually edit `_prisma_migrations` table.
- **Evidence:** Phase 6 step 5: "pg_dump existing PostgreSQL data" — this dumps N8N data, not `maf` data. Phase 6 step 8: "If DB migration fails: psql maf < backup.sql" — no `maf` backup exists.
- **Suggested fix:** (a) The rollback plan for Prisma migrations should be `prisma migrate resolve --rolled-back <migration-name>` followed by manual SQL cleanup, not a pg_dump restore. (b) For actual data rollback (after users exist), add explicit `pg_dump maf` step before each migration deployment. (c) Test the rollback procedure once before production deploy.

---

## Finding 5: No CSRF Protection on State-Changing Endpoints (refresh, logout, profile PUT)

- **Severity:** High
- **Location:** Phase 2, "Security Considerations" + Phase 3, "Security Considerations"
- **Flaw:** The plan uses httpOnly cookies for JWT transmission. This means the browser automatically sends credentials on every request to api.maf.run. The plan adds CSRF protection for the OAuth flow (state parameter) but has zero CSRF protection for POST/PUT endpoints (`/auth/refresh`, `/auth/logout`, `PUT /users/me/profile`). SameSite=lax only protects against cross-site POST from top-level navigations — it does NOT prevent CSRF from JavaScript `fetch()` on a malicious page if the user visits it (lax allows GET, blocks POST from cross-site *navigations* but fetch with `credentials: include` from a cross-origin page is blocked by CORS, not SameSite). The protection depends entirely on CORS being configured correctly. If any CORS misconfiguration occurs (e.g., wildcard origin, reflecting Origin header), all state-changing endpoints are vulnerable.
- **Failure scenario:** A CORS misconfiguration (common during development — `CORS_ORIGIN` defaulting to `*` or developer adding `localhost` and forgetting to remove) allows a malicious page to POST to `/auth/logout`, logging the user out. Or worse, PUT to `/users/me/profile` with garbage data.
- **Evidence:** Phase 1 step 12: "Configure CORS: allow https://app.maf.run + http://localhost:5173" — localhost allowed. No CSRF token or double-submit cookie mentioned anywhere.
- **Suggested fix:** (a) Implement CSRF double-submit cookie pattern or custom header check (e.g., require `X-Requested-With: XMLHttpRequest` — simple but effective since custom headers trigger CORS preflight). (b) Ensure CORS origin is strictly `https://app.maf.run` in production with no dynamic origin reflection. (c) Remove localhost from production CORS config — use Vite proxy instead (which the plan already does in Phase 4).

---

## Finding 6: PostgreSQL Credentials Shared With N8N — Single Password Compromise Exposes Both Databases

- **Severity:** Medium
- **Location:** Phase 1, "Key Insights" + `docker-compose.yml`
- **Flaw:** Phase 1 says "Create separate `maf` database alongside existing `n8n` DB." The docker-compose uses a single PostgreSQL container with `POSTGRES_USER=n8n` and one password. The plan creates a new database (`maf`) in the same PostgreSQL instance but never creates a separate database user. Prisma's `DATABASE_URL` will use the N8N superuser credentials to access the `maf` database. If the NestJS API is compromised (e.g., SQL injection through a future feature), the attacker has full access to N8N data too.
- **Failure scenario:** Future developer adds a raw SQL query to the NestJS API (e.g., for reporting). SQL injection vulnerability allows `DROP DATABASE n8n` or data exfiltration from the N8N database — even though N8N is supposedly separate.
- **Evidence:** Phase 1 risk table: "Create separate `maf` database, don't touch `n8n` DB" — but no mention of separate DB user. `docker-compose.yml` line 75-76: `POSTGRES_USER=${POSTGRES_USER:-n8n}`.
- **Suggested fix:** Create a dedicated PostgreSQL user (`maf_api`) with permissions only on the `maf` database. Add an init script to the PostgreSQL container that creates both the database and the restricted user.

---

## Finding 7: Plan Self-Contradicts on Auto-Save vs Explicit Save

- **Severity:** Medium
- **Location:** Phase 4, sections "useUserProfile Migration", "Success Criteria", and "Risk Assessment"
- **Flaw:** The validation session explicitly decided "explicit save button (not auto-save)" and the implementation steps were updated accordingly (step 11: "explicit save", step 12: "Explicit Save Profile button"). However, the Success Criteria section still reads: "Profile changes auto-save to server (debounced)" — directly contradicting the validated decision. The useUserProfile migration section (line 93) also describes "debounced PUT" in the AFTER diagram. Developers implementing from success criteria will build auto-save; developers implementing from steps will build explicit save.
- **Failure scenario:** Developer reads success criteria first (as definition of done), implements debounced auto-save. Code reviewer reads implementation steps, rejects it. Wasted implementation cycle. Or worse: developer implements explicit save per steps, but QA tests against success criteria and files a bug for "auto-save not working."
- **Evidence:** Phase 4 line 91: `On change -> debounced PUT /users/me/profile -> save to server`. Phase 4 line 229: "Profile changes auto-save to server (debounced)". Phase 4 line 201-204: HTML comments say "Updated: Validation Session 1 - explicit save, not auto-save". The comments updated the steps but not the success criteria or the architecture diagram.
- **Suggested fix:** Update Phase 4 success criteria line 229 to: "Profile Save button triggers PUT, data persists on reload." Update the AFTER diagram (line 91-93) to remove "debounced" and reference explicit save button.

---

## Unresolved Questions

1. **WordPress plugin availability:** The plan assumes WP OAuth Server plugin v4.3.2 supports PKCE. Has this been verified against the plugin's actual documentation? Many free WordPress OAuth plugins have incomplete PKCE support or break on WordPress updates.

2. **Redis persistence:** The plan specifies Redis for sessions and refresh tokens (7-day TTL). No Redis persistence configuration (RDB/AOF) is mentioned. A Redis restart loses all active sessions — every user gets logged out. Is this acceptable for beta?

3. **Cookie expiry mismatch:** JWT cookie `maxAge` is set to 15 minutes (matching JWT TTL), but the refresh token lives 7 days. When the JWT cookie expires (browser deletes it after 15min), how does the frontend send the refresh token? The refresh token is presumably in a separate cookie, but this is never specified. If refresh token is in the same cookie as JWT, it dies with the cookie after 15 minutes.
