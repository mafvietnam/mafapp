# Security Adversary Review: WordPress SSO + Server-Side Storage Plan

**Reviewer:** code-reviewer (security adversary perspective)
**Date:** 2026-04-06
**Plan:** `plans/260406-1511-wp-sso-server-storage/`
**Scope:** All 6 phases, attacker mindset

---

## Finding 1: Refresh Token Endpoint Lacks Rate Limiting — Brute-Force Token Rotation Abuse

- **Severity:** Critical
- **Location:** Phase 2, section "Implementation Steps" step 6-7; Phase 1, entire scope (no rate limiting infra)
- **Flaw:** No rate limiting on `POST /auth/refresh`. Opaque refresh tokens stored in Redis are vulnerable to brute-force guessing. The plan specifies token rotation (old dies, new issued) but no throttling on the endpoint. The entire Phase 1 backend foundation has zero mention of rate limiting middleware (e.g., `@nestjs/throttler`).
- **Failure scenario:** Attacker scripts rapid `POST /auth/refresh` with random opaque tokens. Even if collision probability is low, the endpoint burns Redis CPU validating lookups. Worse: if the token format is short or predictable (plan does not specify token length or entropy source), brute-force becomes feasible. The "30-60s grace period" for old tokens (Phase 2 Risk Assessment) doubles the valid-token window, making timing attacks easier.
- **Evidence:** Phase 2 says "30-60s grace period: old refresh token still returns already-issued new pair" but specifies no rate limit. Phase 1 lists no `@nestjs/throttler` or equivalent.
- **Suggested fix:** Add `@nestjs/throttler` in Phase 1. Apply strict rate limits on `/auth/refresh` (e.g., 5 requests/minute per IP) and `/auth/login` (e.g., 10/minute per IP). Specify minimum 256-bit cryptographically random opaque tokens.

---

## Finding 2: Open Redirect on OAuth Callback — Attacker Steals Authorization Code

- **Severity:** Critical
- **Location:** Phase 2, section "Architecture" (callback flow) and "Implementation Steps" step 7
- **Flaw:** `GET /auth/callback?code=X&state=Y` exchanges the code then redirects to `app.maf.run/dashboard`. The plan does not specify validating or hardcoding the redirect destination. If the redirect target is parameterized (e.g., a `redirect_uri` query param or stored in session), an attacker can inject an arbitrary URL to steal the authorization code or the resulting JWT cookie via a crafted OAuth initiation.
- **Failure scenario:** Attacker crafts `GET /auth/login?redirect=https://evil.com`. Backend stores this redirect in Redis alongside the state/PKCE verifier. After WordPress approval, callback redirects the user's browser (with freshly-set JWT cookie on `.maf.run`) to `evil.com`. Even though the cookie won't be sent to evil.com (wrong domain), the attacker may capture the authorization code from the URL if the redirect happens before code exchange. If redirect happens after code exchange but before cookie set, the user lands on a phishing page that mimics the login success.
- **Evidence:** Phase 2 Architecture shows "Redirect -> app.maf.run/dashboard" but Implementation Steps step 7 says only "sets httpOnly cookie, redirects to app.maf.run/dashboard" — no mention of validating or hardcoding the redirect.
- **Suggested fix:** Hardcode the post-callback redirect to `https://app.maf.run/dashboard`. If a dynamic redirect is needed, validate against an allowlist of paths (never full URLs) and reject any absolute URLs or different domains.

---

## Finding 3: Frontend-Backend Type Mismatch — Validation Bypass via String Injection

- **Severity:** High
- **Location:** Phase 3, section "Implementation Steps" step 4 (DTO); Phase 4, section "useUserProfile Migration"
- **Flaw:** The frontend `UserProfile` interface defines `age`, `height`, `weight` as `string` (verified in `src/types.ts`: `age: string; height: string; weight: string`). The backend `UpdateProfileDto` defines them as `@IsInt()` / `@IsNumber()` with `@Min`/`@Max` validators. Phase 3 Risk Assessment mentions "DTO transforms string->number" but `class-validator` decorators like `@IsInt()` and `@IsNumber()` do NOT perform type coercion by default — they reject strings. The plan does not specify enabling `class-transformer`'s `enableImplicitConversion` or using `@Transform()` decorators.
- **Failure scenario:** Frontend sends `{ "age": "25", "height": "170", "weight": "70" }` (strings, per current types). Backend DTO validation rejects ALL requests with 400 errors because `"25"` is not an integer. Every profile save fails in production. If the team fixes this by enabling implicit conversion globally, they may inadvertently allow type coercion on other fields (e.g., booleans from strings like `"false"` which coerces to `true`).
- **Evidence:** `src/types.ts` line 15-17: `age: string; height: string; weight: string;`. Phase 3 DTO: `@IsInt() @Min(1) @Max(120) age: number;`
- **Suggested fix:** Add explicit `@Transform(({ value }) => parseInt(value, 10))` before numeric validators in DTO. Or change frontend types to `number` and fix all call sites. Document the contract in a shared types package. Do NOT use global `enableImplicitConversion`.

---

## Finding 4: No CSRF Protection on State-Changing Endpoints

- **Severity:** High
- **Location:** Phase 2, section "Security Considerations"; Phase 3, section "Implementation Steps" step 6
- **Flaw:** The plan uses `sameSite=lax` cookies. With `lax`, the browser sends cookies on top-level GET navigations from cross-origin sites but NOT on POST. However, the plan uses `PUT /users/me/profile` for profile updates and `POST /auth/refresh` / `POST /auth/logout` — all state-changing POST/PUT requests. While `sameSite=lax` blocks cross-origin POST cookies in modern browsers, there is no defense-in-depth: no CSRF token, no `Origin` header check, no double-submit cookie. Older browsers or misconfigured proxies may not enforce `sameSite`.
- **Failure scenario:** User visits `evil.com` which renders `<form method="POST" action="https://api.maf.run/auth/logout">`. On an older browser or one that doesn't enforce `sameSite=lax`, the httpOnly cookie is sent, and the attacker logs the user out. For profile updates, a similar form or `fetch()` with `credentials: 'include'` from a subdomain (if any subdomain is compromised) could modify user data.
- **Evidence:** Phase 2 Security Considerations lists "httpOnly cookies prevent XSS token theft" and "State param prevents CSRF on OAuth callback" — but no CSRF protection is mentioned for `/users/me/profile`, `/auth/refresh`, or `/auth/logout`.
- **Suggested fix:** Validate `Origin` or `Referer` header on all state-changing endpoints. Reject requests where `Origin` is not `https://app.maf.run`. This is a simple defense-in-depth layer alongside `sameSite=lax`.

---

## Finding 5: JWT Cookie Shared Across All Subdomains — Subdomain Takeover = Full Account Compromise

- **Severity:** High
- **Location:** Phase 2, section "Implementation Steps" step 12; Phase 4, section "Architecture" (Auth Flow)
- **Flaw:** JWT cookie is set with `domain=.maf.run`. This means ANY subdomain of `maf.run` can read and send this cookie. If an attacker achieves subdomain takeover (e.g., `staging.maf.run`, `old.maf.run`, any dangling DNS CNAME), they receive the JWT cookie on every request and can impersonate any authenticated user.
- **Failure scenario:** `test.maf.run` has a dangling CNAME pointing to an old Heroku app. Attacker claims the Heroku app, now controls `test.maf.run`. User visits `test.maf.run` — browser sends the `.maf.run` JWT cookie. Attacker captures it and replays to `api.maf.run/users/me` to steal user data, or to `PUT /users/me/profile` to modify it.
- **Evidence:** Phase 2 step 12: `{ httpOnly: true, secure: true, sameSite: 'lax', domain: '.maf.run', maxAge: 15*60*1000 }`
- **Suggested fix:** Audit all `*.maf.run` DNS records for dangling CNAMEs. Consider setting cookie domain to `api.maf.run` only (not `.maf.run`) and using a different mechanism (e.g., `Authorization` header from frontend) or a proxy pass. If `.maf.run` is required, document a subdomain hygiene policy and set up monitoring for unauthorized subdomains.

---

## Finding 6: No Authorization Layer — Any Authenticated User Can Access Any Future Admin Endpoint

- **Severity:** High
- **Location:** Phase 2 (AuthGuard), Phase 3 (ProfileController), entire plan scope
- **Flaw:** The plan implements authentication (identity verification) but zero authorization (permission checks). There is no role/permission model. The `User` model has no `role` field. The `AuthGuard` only checks "is the JWT valid?" — not "does this user have permission to do X?" The plan says "Out of scope: Strava integration (separate developer)" meaning other developers will add endpoints to this API. Without an authorization framework, every new endpoint defaults to "any authenticated user can access."
- **Evidence:** Phase 1 User model: `id, wpUserId, email, name, avatar, createdAt, updatedAt` — no `role` field. Phase 2 AuthGuard: "Returns 401 if token invalid/expired" — no 403 path. Phase 3: endpoints check JWT only.
- **Failure scenario:** Separate developer adds `GET /admin/users` or `DELETE /users/:id` endpoint. They copy the existing pattern (`@UseGuards(AuthGuard)`). Any authenticated user can now list all users or delete accounts. There is no guardrail preventing this because no role system exists.
- **Suggested fix:** Add a `role` field to the User model in Phase 1 (`role: 'user' | 'admin'`, default `'user'`). Create a `RolesGuard` in Phase 2 alongside `AuthGuard`. Even if no admin endpoints exist yet, the infrastructure must exist before other developers add endpoints.

---

## Finding 7: 401 Refresh Retry Creates Infinite Loop and Credential Leakage Vector

- **Severity:** High
- **Location:** Phase 4, section "Implementation Steps" step 1 (api-client.ts)
- **Flaw:** The `apiFetch` function retries the original request after a 401 by calling `fetch()` directly (not `apiFetch`), which means the retry bypasses the 401 handler. But if the refresh itself succeeds yet the retried request still returns 401 (e.g., user was banned, token revoked server-side), the code does not handle this — it returns the 401 response to the caller, which may not expect it. More critically: on refresh failure, the code does `window.location.href = '/login'` and then `throw new Error('Unauthorized')`. The throw executes after the redirect is initiated, causing unhandled promise rejections in every caller. Additionally, there is no mutex/lock on the refresh call — if 3 API calls fail with 401 simultaneously, 3 parallel refresh requests fire, and due to token rotation, only the first succeeds; the other 2 invalidate the fresh token.
- **Failure scenario:** User's JWT expires. Dashboard page fires 3 concurrent `apiFetch` calls (getMe, getProfile, getDashboard). All 3 get 401. All 3 call `POST /auth/refresh` simultaneously. First refresh succeeds, rotates token. Second refresh sends the now-dead old token, fails. Third also fails. Refresh failure triggers `window.location.href = '/login'` — user gets logged out despite having a valid session.
- **Evidence:** Phase 4 step 1 code shows no deduplication logic for refresh calls. Phase 2 says "each use returns new token, old dies."
- **Suggested fix:** Implement a refresh mutex/queue: when a 401 is encountered, the first caller starts the refresh and all other callers await the same promise. Only one refresh request hits the server. This is a standard pattern (e.g., `axios-auth-refresh`).

---

## Finding 8: WP OAuth Server Plugin — Unvetted Third-Party Dependency in Auth Chain

- **Severity:** Medium
- **Location:** Phase 2, section "Key Insights" and "WordPress Setup" steps 1-3
- **Flaw:** The entire authentication system depends on the "WP OAuth Server" plugin (v4.3.2), described as "free." The plan specifies no fallback for this critical dependency. If the plugin has vulnerabilities (CVEs), becomes abandoned, or is incompatible with a WordPress update, the entire auth system breaks. The plugin handles authorization code issuance — a compromise here means attacker-controlled auth codes that the NestJS backend will trust.
- **Failure scenario:** WP OAuth Server plugin has an unpatched vulnerability that allows an attacker to issue authorization codes without user consent. Attacker generates a valid code for any WordPress user, exchanges it via `GET /auth/callback`, and receives a JWT for that user's account. The NestJS backend cannot distinguish legitimate from forged codes because it trusts the WordPress token endpoint unconditionally.
- **Evidence:** Phase 2: "WP OAuth Server plugin (v4.3.2) — free, supports PKCE, good performance." Risk Assessment mentions "fallback: WP REST API + application passwords" but this is not a real fallback — application passwords are a completely different auth model that would require rewriting all of Phase 2 and Phase 4.
- **Suggested fix:** Audit the plugin source code before deployment. Pin to exact version, disable auto-updates for this plugin. Subscribe to the plugin's security advisories. Document the actual fallback procedure (not just "application passwords" — spell out what changes). Consider WP Application Passwords as primary if the plugin audit reveals concerns.

---

## Finding 9: Profile API Has No Idempotency Protection — Replay Attacks on PUT

- **Severity:** Medium
- **Location:** Phase 3, section "Implementation Steps" step 6; Phase 4, section "useUserProfile Migration"
- **Flaw:** `PUT /users/me/profile` is an upsert with no idempotency key or optimistic locking (`updatedAt` / version check). If a user has the profile open on two tabs/devices, the last write wins silently. More importantly for security: a captured request can be replayed indefinitely to overwrite profile data.
- **Failure scenario:** Attacker intercepts a legitimate `PUT /users/me/profile` request (e.g., via compromised WiFi, even though HTTPS — consider a TLS-terminating corporate proxy). The request body contains health data (`isRecovering`, `isMedicatedOrInjured`). Attacker replays this request weeks later to revert the user's profile to stale health data, potentially causing the MAF calculator to produce dangerous training recommendations (e.g., reverting `isRecovering: true` to `false` prematurely).
- **Evidence:** Phase 3 shows a simple upsert with no version/timestamp check. Phase 4 Risk Assessment says "Explicit save button — no concurrent writes" but this only addresses same-browser concurrency, not cross-device or replay.
- **Suggested fix:** Add optimistic locking: include `updatedAt` in the request, reject if it doesn't match the DB value. Return the current `updatedAt` with every GET response. This also protects against last-write-wins on multiple devices.

---

## Finding 10: Health Endpoint Leaks Internal Service Topology

- **Severity:** Medium
- **Location:** Phase 1, section "Requirements" (Functional) and "Success Criteria"
- **Flaw:** `GET /health` returns `{ db: "up", redis: "up" }` and is unauthenticated (no AuthGuard mentioned). This tells attackers exactly which backing services exist. If one reports "down", the attacker knows which component to target or that the system is in a degraded state (useful for timing attacks).
- **Failure scenario:** Attacker polls `https://api.maf.run/health` every minute. When `redis: "down"` appears, they know refresh token validation is offline and may attempt session hijacking or brute-force during the window. The endpoint also confirms the tech stack (PostgreSQL + Redis) for targeted exploitation.
- **Evidence:** Phase 1 Success Criteria: `GET /health returns 200 with { db: "up", redis: "up" }`. No AuthGuard or IP restriction mentioned.
- **Suggested fix:** Return only `{ status: "ok" }` or `{ status: "degraded" }` on the public endpoint. Move detailed component status to a protected `/admin/health` endpoint behind AuthGuard + admin role check. Alternatively, restrict the detailed endpoint to internal network IPs only.

---

## Summary

| # | Finding | Severity | Phase |
|---|---------|----------|-------|
| 1 | No rate limiting on auth endpoints | Critical | 1, 2 |
| 2 | Open redirect risk on OAuth callback | Critical | 2 |
| 3 | Frontend string vs backend number type mismatch | High | 3, 4 |
| 4 | No CSRF defense-in-depth on state-changing endpoints | High | 2, 3 |
| 5 | JWT cookie on wildcard subdomain enables subdomain takeover | High | 2 |
| 6 | No authorization/roles model — only authentication | High | 1, 2, 3 |
| 7 | Concurrent 401 refresh race condition causes logout | High | 4 |
| 8 | Unvetted third-party WP OAuth plugin in critical auth path | Medium | 2 |
| 9 | No idempotency/optimistic locking on profile PUT | Medium | 3, 4 |
| 10 | Health endpoint leaks internal topology | Medium | 1 |

## Unresolved Questions

1. What is the exact entropy/length of opaque refresh tokens? Plan does not specify.
2. Is there a staging/test WordPress instance, or will all OAuth testing happen against production maf.run?
3. Who will audit the WP OAuth Server plugin before install? Is there a security review process?
4. Are there any other `*.maf.run` subdomains that could be targets for subdomain takeover?
5. What happens to the N8N PostgreSQL database (`n8n` DB) — does it stay in the same Postgres instance with the new `maf` DB? If so, are cross-database access controls in place (separate Postgres users)?

**Status:** DONE
**Summary:** 10 findings identified — 2 critical (rate limiting gap, open redirect risk), 5 high (type mismatch, CSRF, subdomain cookie scope, missing authz, refresh race condition), 3 medium (plugin trust, replay attacks, health leak). Plan requires remediation on critical and high items before implementation proceeds safely.
