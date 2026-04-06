# Code Review: WordPress SSO + Server-Side Storage Implementation

**Reviewer:** code-reviewer  
**Date:** 2026-04-06  
**Scope:** 6-phase implementation — NestJS API, WP OAuth2 PKCE, User Profile, Frontend Auth, Dashboard UI  
**Files reviewed:** 30+ files across `api/src/`, `src/services/`, `src/contexts/`, `src/components/`, `src/pages/`, Docker configs

---

## Overall Assessment

Solid MVP-level implementation with good fundamentals: PKCE flow, httpOnly cookies, RS256 JWT, refresh token rotation with grace period, rate limiting, validation pipe. The architecture is clean and follows NestJS conventions well. However, several **production-blocking** issues exist — primarily around CORS misconfiguration, missing input validation on security-critical paths, and a type mismatch between frontend and backend that will cause silent data corruption.

---

## Critical Issues (Blocking)

### C1. CORS Origin Hardcoded — Ignores `CORS_ORIGIN` env var

**File:** `api/src/main.ts:12-16`

```typescript
app.enableCors({
  origin: [
    'https://app.maf.run',
    'http://localhost:5173',
  ],
  credentials: true,
});
```

**Problem:** CORS origin is hardcoded. The `CORS_ORIGIN` env var is validated in `app.module.ts` and used in `auth.service.ts` for redirect URLs, but `main.ts` ignores it entirely. In production, `http://localhost:5173` is an open CORS backdoor — any attacker on the same network or browser extension can make credentialed cross-origin requests.

**Fix:** Inject `ConfigService` and build the origin list from env:

```typescript
const configService = app.get(ConfigService);
const corsOrigin = configService.get<string>('CORS_ORIGIN');
app.enableCors({
  origin: process.env.NODE_ENV === 'production' ? [corsOrigin] : [corsOrigin, 'http://localhost:5173'],
  credentials: true,
});
```

### C2. Frontend-Backend Type Mismatch — `age`, `height`, `weight` are strings in frontend, numbers in backend

**Frontend `UserProfile` (types.ts):** `age: string`, `height: string`, `weight: string`  
**Backend `UpdateProfileDto`:** `@IsInt() age: number`, `@IsNumber() height: number`, `@IsNumber() weight: number`  
**Frontend `profile-service.ts:38-40`:** Sends raw `profile.age` (string), `profile.height` (string), `profile.weight` (string)

**Problem:** The ValidationPipe has `enableImplicitConversion: true`, so `"25"` becomes `25` — this works for valid numeric strings. But if a user enters `""` (empty string) or leaves a field blank, the string `""` gets sent, implicit conversion produces `NaN`, and `@IsInt()` rejects it with a 400. The user sees "save failed" with no clear reason.

More critically, `profile-service.ts` passes `profile.age` directly without `parseInt()`. The contract assumption is fragile — it works only because of `enableImplicitConversion`, which is an implementation detail that should not be relied on at the API boundary.

**Fix:** Convert explicitly in `profile-service.ts`:

```typescript
age: parseInt(profile.age) || 0,
height: parseFloat(profile.height) || 0,
weight: parseFloat(profile.weight) || 0,
```

### C3. UserController Returns 200 with Error Body Instead of 404

**File:** `api/src/user/user.controller.ts:16`

```typescript
if (!user) return { error: 'User not found' };
```

**Problem:** When user not found, returns HTTP 200 with `{ error: 'User not found' }`. Frontend `auth-service.ts:16` checks `res.ok` (which is `true` for 200), then parses the body as `AuthUser`. The result: `user.id` is `undefined`, `user.name` is `undefined`, and `isAuthenticated` becomes `true` with a broken user object. This bypasses the auth check entirely.

**Fix:**

```typescript
if (!user) throw new NotFoundException('User not found');
```

### C4. Refresh Token Race Condition — Grace Period Leaks Tokens

**File:** `api/src/auth/auth.service.ts:126-151`

The grace period stores `{ accessToken, refreshToken }` for 60 seconds, keyed by the OLD refresh token. If an attacker obtains the old refresh token (e.g., from a leaked cookie), they can repeatedly hit the refresh endpoint during the 60s grace window and receive valid tokens — even after the legitimate user has already rotated.

**Problem:** The grace period defeats token rotation security. Rotation is supposed to ensure that a stolen refresh token becomes invalid after one use. The grace period re-validates it for 60 seconds.

**Mitigation options:**
1. **Remove grace period** and handle concurrent requests client-side only (the frontend mutex already does this).
2. **Use a counter** — allow grace only once (set + delete on first grace-hit).
3. **Return the same tokens but mark the grace key for one-time use:** `del` the grace key after returning.

Recommended: Option 3 — delete the grace key on first use:

```typescript
if (graceData) {
  await this.redis.del(graceKey); // One-time use
  const { accessToken, refreshToken } = JSON.parse(graceData);
  return { accessToken, refreshToken };
}
```

---

## High Priority

### H1. No `forbidNonWhitelisted` in ValidationPipe — Extra Fields Pass Through

**File:** `api/src/main.ts:25-29`

```typescript
new ValidationPipe({
  transform: true,
  transformOptions: { enableImplicitConversion: true },
  whitelist: true,
});
```

`whitelist: true` strips unknown properties but does not reject the request. An attacker can probe for fields and won't get 400 errors. Add `forbidNonWhitelisted: true` to return 400 on unexpected fields — this is defense-in-depth against mass assignment.

### H2. No Helmet — Missing Security Headers on API

The NestJS API has no `helmet` middleware. The frontend nginx has security headers, but the API (served at `api.maf.run`) does not add `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, etc.

**Fix:** `npm install helmet` and add `app.use(helmet())` in `main.ts`.

### H3. `init-db.sql` Uses Hardcoded Password `changeme`

**File:** `api/init-db.sql:3`

```sql
CREATE USER maf_user WITH PASSWORD 'changeme';
```

This runs on first PostgreSQL startup. In production docker-compose, the `DATABASE_URL` references `${MAF_DB_PASSWORD:-changeme}`. If the operator forgets to set `MAF_DB_PASSWORD`, the database password is literally `changeme`.

**Fix:** Remove the hardcoded password from `init-db.sql`. Use environment variable substitution or document that the password MUST be changed before first deployment.

### H4. `allkeys-lru` Redis Eviction Policy Risks Deleting Auth Tokens

**File:** `docker-compose.yml:160`

```yaml
command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
```

With `allkeys-lru`, Redis will evict ANY key (including refresh tokens, OAuth state) when memory is full. A burst of traffic or a memory leak could silently evict valid refresh tokens, logging users out mid-session with no warning.

**Fix:** Use `volatile-lru` (only evict keys with TTL set — which all auth keys have) or increase maxmemory. Or use a dedicated Redis instance for auth tokens.

### H5. Profile Page Uses `useUserProfile()` Hook — Local State, Not Server Data

**File:** `src/pages/profile-page.tsx`

`ProfilePage` calls `useUserProfile()` which initializes with empty default state (age: `''`, height: `''`, etc.). It never calls `getProfile()` from `profile-service.ts` to load existing data from the server. So when a user navigates to `/profile` after login, they see an empty form — not their saved data.

**Fix:** Add a `useEffect` that fetches the server profile on mount and populates the local state:

```typescript
useEffect(() => {
  getProfile().then(serverProfile => {
    if (serverProfile) {
      setUserProfile(prev => ({
        ...prev,
        age: String(serverProfile.age),
        height: String(serverProfile.height),
        weight: String(serverProfile.weight),
        // ... map remaining fields
      }));
    }
  });
}, []);
```

### H6. Logout Does Not Check Auth — Anyone Can Clear Cookies

**File:** `api/src/auth/auth.controller.ts:78-87`

The `logout` endpoint has no `@UseGuards(JwtAuthGuard)`. An unauthenticated request with a valid `maf_refresh` cookie can trigger logout. While not a severe vulnerability (the attacker would need the cookie), it allows cross-site logout if CSRF protections are bypassed.

Also, `clearCookie` options must exactly match the original `Set-Cookie` options (domain, path, httpOnly, secure, sameSite) for the browser to delete them. The current implementation passes `cookieOptions(0)` which sets `maxAge: 0` but should verify domain/path match.

---

## Medium Priority

### M1. No CSRF Protection for State-Changing Endpoints

`POST /auth/refresh` and `POST /auth/logout` rely on `sameSite: 'lax'` cookies for CSRF protection. `SameSite=Lax` allows cookies on top-level GET navigations but blocks them on cross-site POST. This is adequate for most scenarios, but consider adding a CSRF token for the profile PUT endpoint, which modifies user data.

### M2. `WpUserInfo.email` May Be Empty

WordPress does not guarantee email in the `/users/me` endpoint. If the WP user has no email set, `wpUser.email` could be `undefined` or empty string. The Prisma schema has `email String @unique`, so this would either throw a unique constraint violation (if another user also has empty email) or store empty string.

**Fix:** Validate `wpUser.email` before upserting. Reject auth if email is missing.

### M3. Dashboard Page Calls `useAuth()` Without Using Return Value

**File:** `src/pages/dashboard-page.tsx:9`

```typescript
useAuth(); // Ensure authenticated
```

This is redundant — `ProtectedRoute` already handles authentication. The comment is misleading.

### M4. No Error Boundary for Auth Context Fetch Failure

If `getMe()` throws (e.g., network error), the catch in `auth-service.ts` returns `null`, which is fine. But if the API returns a 200 with malformed JSON, `res.json()` will throw inside the `try` block of `getMe()`, also returning `null`. Consider distinguishing "not authenticated" from "API error" for better UX.

### M5. Prisma Schema Missing Index on `UserProfile.userId`

`UserProfile.userId` has `@unique` which implicitly creates an index. This is correct. However, `User.email` uniqueness should be validated at the application level too (before hitting DB), for better error messages.

### M6. Docker Compose `version: '3.8'` Deprecated

Docker Compose V2 ignores the `version` field. While not breaking, it generates warnings. Remove the `version` line.

### M7. API Dockerfile Does Not Run Prisma Migrate

The Dockerfile builds the app but does not run `prisma migrate deploy`. The deployment process must handle migrations separately (e.g., init container or startup script). This should be documented.

---

## Low Priority

### L1. `api/src/auth/auth.types.ts` — `OAuthState` Interface Unused

The `OAuthState` interface is defined but never imported or used anywhere.

### L2. Avatar URL Selection Is Fragile

**File:** `api/src/user/user.service.ts:13-14`

```typescript
const avatar = wpUser.avatar_urls
  ? Object.values(wpUser.avatar_urls).pop() ?? null
  : null;
```

`Object.values()` order depends on key insertion order. WordPress avatar_urls keys are typically `24`, `48`, `96`. `.pop()` gets the last inserted, which happens to be the largest — but this is not guaranteed by spec.

### L3. `profile-service.ts` Sends `undefined` Instead of `null` for Optional Fields

```typescript
previousMonthPace: profile.previousMonthPace || undefined,
```

`undefined` properties are stripped from `JSON.stringify`, so they won't be sent in the request body. This works because the DTO has `@IsOptional()`, but it's semantically different from sending `null` (which means "clear this field"). The current behavior means once a value is set, it can never be cleared from the profile page.

---

## Security Checklist

| Check | Status | Notes |
|-------|--------|-------|
| PKCE flow | PASS | S256, random verifier, state in Redis with TTL |
| JWT algorithm | PASS | RS256 asymmetric |
| Cookie security | PASS | httpOnly, secure (prod), sameSite=lax |
| Refresh token path restriction | PASS | `/auth/refresh` only |
| Rate limiting | PASS | Global + per-endpoint throttling |
| Input validation | PARTIAL | DTO validation present, but type mismatch (C2) |
| CORS | FAIL | Hardcoded localhost in prod (C1) |
| CSRF | PARTIAL | SameSite=Lax covers most vectors, no token |
| SQL injection | PASS | Prisma parameterized queries |
| XSS | PASS | React auto-escaping, httpOnly cookies |
| Secrets in code | PASS | .env gitignored, env vars properly used |
| Auth bypass | FAIL | 200 on user-not-found bypasses auth (C3) |
| Token replay | WARN | Grace period allows 60s replay window (C4) |

---

## Positive Observations

1. **PKCE implementation is textbook correct** — random verifier, S256 challenge, state parameter with Redis TTL, single-use state deletion
2. **Frontend refresh mutex** prevents thundering herd on 401 — good pattern
3. **Clean NestJS module structure** — proper separation of concerns, global SharedModule for cross-cutting services
4. **Prisma schema** is well-designed with appropriate cascading deletes
5. **Docker multi-stage build** for API is efficient (deps → build → slim runtime with non-root user)
6. **Validation pipe with whitelist** strips unexpected fields
7. **Joi validation for env vars** catches missing config at startup, not at runtime

---

## Recommended Actions (Priority Order)

1. **[CRITICAL]** Fix CORS origin to use env var, remove hardcoded localhost in prod (C1)
2. **[CRITICAL]** Fix UserController to return 404 instead of 200 with error body (C3)
3. **[CRITICAL]** Fix type mismatch — convert strings to numbers in profile-service before sending (C2)
4. **[CRITICAL]** Make refresh token grace period single-use (C4)
5. **[HIGH]** Add `forbidNonWhitelisted: true` to ValidationPipe (H1)
6. **[HIGH]** Install and configure helmet middleware (H2)
7. **[HIGH]** Fix ProfilePage to load existing data from server on mount (H5)
8. **[HIGH]** Change Redis eviction policy to `volatile-lru` (H4)
9. **[HIGH]** Remove hardcoded DB password from init-db.sql (H3)
10. **[MEDIUM]** Validate WP user email before upserting (M2)

---

## Unresolved Questions

1. How will Prisma migrations be deployed? No `prisma migrate deploy` in Dockerfile or docker-compose. Is there a separate migration step planned?
2. Is the WordPress OAuth plugin configured to return email? If not, the upsert will fail on the unique constraint.
3. The `CORS_ORIGIN` env var is a single string but CORS may need multiple origins (e.g., `www.app.maf.run` + `app.maf.run`). Should this be comma-separated with parsing logic?
4. Cloudflare Tunnel routes — is `api.maf.run` configured to route to `maf-api:3001`? The docker-compose shows the service but the tunnel config is external.

---

**Status:** DONE_WITH_CONCERNS  
**Summary:** Implementation has strong security foundations (PKCE, RS256, httpOnly cookies) but 4 critical issues must be fixed before deployment: CORS backdoor, auth bypass via 200 status, type mismatch causing silent failures, and refresh token replay window.  
**Concerns:** C1-C4 are production blockers. H5 (profile not loading saved data) will be immediately visible to users. These should be addressed before merging to dev.
