# Phase 2: WordPress SSO (OAuth2 PKCE)

## Context
- [WP OAuth Research](../reports/researcher-260405-1101-wp-oauth-job-systems.md) — Section 1: WordPress OAuth2 at Scale
- [SP2 Backend Phase](../260331-0121-maf-platform-sp2-sp7/phase-01-sp2-backend.md) — Week 2: WordPress SSO

## Overview
- **Priority:** P1 (Critical Path)
- **Status:** Complete
- **Effort:** 3 days
- **Blocked by:** Phase 1

Implement WordPress SSO using OAuth2 Authorization Code + PKCE flow. Backend-initiated (NestJS handles PKCE, not browser). JWT access tokens (RS256, 15min) + opaque refresh tokens (Redis, 7 days).

## Key Insights
- **WP OAuth Server** plugin (v4.3.2) — free, supports PKCE, good performance
- Backend-initiated PKCE: NestJS generates code_verifier/challenge, stores in Redis, redirects user to WordPress
- JWT signed with RS256 (asymmetric) — public key can be shared for future services
- Refresh tokens stored in Redis with rotation (each use returns new token, old dies)
- WordPress user data cached in PostgreSQL User table (no WP round-trip for /users/me)
- If WordPress goes down: existing sessions valid for 7 days (refresh token TTL), only new logins fail

## Requirements

### Functional
- `GET /auth/login` — initiate OAuth flow, redirect to WordPress
- `GET /auth/callback` — exchange code for tokens, create/update local user, issue JWT
- `POST /auth/refresh` — refresh JWT using refresh token
- `POST /auth/logout` — invalidate refresh token, clear cookie
- `GET /users/me` — return current user from local cache (not WordPress)

### Non-Functional
- JWT access token: RS256, 15min TTL
- Refresh token: opaque, 7-day TTL, stored in Redis, rotated on use
- CSRF protection: `state` param (random, Redis 5min TTL)
- Two separate httpOnly cookies:
  - `maf_access`: JWT access token, 15min maxAge, secure, sameSite=lax, domain=.maf.run
  - `maf_refresh`: opaque refresh token, 7-day maxAge, secure, sameSite=lax, domain=.maf.run, path=/auth/refresh
<!-- Validation Session 2: Two separate cookies — JWT dies after 15min but refresh token survives for 7 days -->

## Architecture

```
Browser → app.maf.run/login → click "Login with WordPress"
  ↓
GET api.maf.run/auth/login
  ├── Generate code_verifier + code_challenge (S256)
  ├── Generate state param → store in Redis (5min TTL)
  └── Redirect → maf.run/oauth/authorize?client_id=X&code_challenge=Y&state=Z
  ↓
User approves on WordPress → redirect to api.maf.run/auth/callback?code=ABC&state=Z
  ├── Validate state param (CSRF check)
  ├── Exchange code + code_verifier → WordPress token endpoint
  ├── Fetch user info from WP REST API (/wp-json/wp/v2/users/me)
  ├── Create/update User in PostgreSQL (cache WP data locally)
  ├── Generate JWT (RS256, 15min) + refresh token (opaque, Redis 7d)
  ├── Set JWT in httpOnly cookie
  └── Redirect → app.maf.run/dashboard
```

### NestJS Module Structure

```
api/src/auth/
├── auth.module.ts           — imports, exports
├── auth.controller.ts       — /auth/login, /auth/callback, /auth/refresh, /auth/logout
├── auth.service.ts          — OAuth flow logic, JWT generation, token management
├── jwt.strategy.ts          — Passport JWT strategy (validates access token from cookie)
├── auth.guard.ts            — JwtAuthGuard for protecting routes
└── auth.types.ts            — WpUserInfo, TokenPayload interfaces
```

## Related Code Files

### Files to Create
- `api/src/auth/auth.module.ts`
- `api/src/auth/auth.controller.ts`
- `api/src/auth/auth.service.ts`
- `api/src/auth/jwt.strategy.ts`
- `api/src/auth/auth.guard.ts`
- `api/src/auth/auth.types.ts`
- `api/src/user/user.module.ts`
- `api/src/user/user.service.ts`
- `api/src/user/user.controller.ts` — GET /users/me

### Files to Modify
- `api/src/app.module.ts` — import AuthModule, UserModule
- `api/prisma/schema.prisma` — User model already exists from Phase 1
- `api/.env.example` — add WP OAuth + JWT env vars

## Implementation Steps

### Step 0: PKCE Validation Spike (BEFORE writing NestJS code)
0. Install WP OAuth Server plugin on a local/staging WordPress instance
1. Create test OAuth2 client with PKCE enabled
2. Verify end-to-end: generate code_challenge → authorize → exchange code with code_verifier → receive token
3. If PKCE fails on free tier: evaluate WP OAuth Server Pro, or switch to "OAuth2 Server" by BShaffer
4. **Only proceed to NestJS implementation after PKCE is confirmed working**
<!-- Red Team: Unvalidated PKCE assumption could waste entire Phase 2 if plugin doesn't support it -->

### WordPress Setup (maf.run admin)
1. Install **WP OAuth Server** plugin on maf.run (confirmed PKCE-compatible from Step 0)
2. Create OAuth2 client app:
   - Name: "MAF Running App"
   - Redirect URI: `https://api.maf.run/auth/callback`
   - Grant type: Authorization Code
   - Enable PKCE (S256)
   - Scope: `openid profile email`
3. Note client_id (no client_secret needed for PKCE public client)

### NestJS Implementation
4. Install auth deps: `@nestjs/passport passport passport-jwt @nestjs/jwt jsonwebtoken`
5. Generate RSA-256 key pair:
   ```bash
   openssl genrsa -out jwt-private.pem 2048
   openssl rsa -in jwt-private.pem -pubout -out jwt-public.pem
   ```
   Store base64-encoded in `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` env vars.

6. Implement `AuthService`:
   - `initiateLogin()` — generate code_verifier (128 chars), code_challenge (SHA256+base64url), state (random 32 chars). Store verifier+state in Redis (`oauth:state:{state}`, TTL 5min). Return WordPress authorize URL.
   - `handleCallback(code, state)` — validate state from Redis (CSRF). Exchange code+code_verifier at WP token endpoint. Fetch WP user info. Upsert User in DB. Generate JWT + refresh token. Return tokens.
   - `refreshToken(token)` — validate refresh token in Redis. Issue new JWT + new refresh token (rotation). Delete old token.
   - `logout(token)` — delete refresh token from Redis.

7. Implement `AuthController` with rate limiting:
   - `GET /auth/login` — calls `initiateLogin()`, returns redirect to WP. **Rate limit: 10/min per IP**
   - `GET /auth/callback?code=X&state=Y` — calls `handleCallback()`, sets httpOnly cookie, **hardcode redirect to `https://app.maf.run/dashboard`** (no dynamic redirect — prevents open redirect attacks)
   - `POST /auth/refresh` — reads refresh token from cookie, calls `refreshToken()`. **Rate limit: 5/min per IP**
   - `POST /auth/logout` — calls `logout()`, clears cookie
   <!-- Red Team: Hardcoded redirect prevents open redirect attack. Rate limits prevent brute-force. -->

8. Implement `JwtStrategy` (Passport):
   - Extract JWT from httpOnly cookie (not Authorization header)
   - Validate with RS256 public key
   - Attach user payload to request

9. Implement `AuthGuard`:
   - Extends `@nestjs/passport` AuthGuard('jwt')
   - Returns 401 if token invalid/expired

10. Implement `UserService`:
    - `findOrCreateFromWp(wpUserInfo)` — upsert by wpUserId
    - `findById(id)` — return user from DB

11. Implement `UserController`:
    - `GET /users/me` — protected by AuthGuard, returns current user from DB (not WP)

12. Install `cookie-parser` package and configure in main.ts:
    ```typescript
    app.use(cookieParser());
    // Two cookies set in auth.service.ts:
    // maf_access: { httpOnly: true, secure: true, sameSite: 'lax', domain: '.maf.run', maxAge: 15*60*1000 }
    // maf_refresh: { httpOnly: true, secure: true, sameSite: 'lax', domain: '.maf.run', path: '/auth/refresh', maxAge: 7*24*60*60*1000 }
    ```
    <!-- Validation Session 2: Refresh token in separate cookie with 7-day maxAge and restricted path -->

## Todo List
- [x] WP OAuth Server plugin installed on maf.run
- [x] OAuth2 client app configured (PKCE, redirect URI)
- [x] RSA key pair generated for JWT
- [x] AuthModule with controller, service, strategy, guard
- [x] Login flow: /auth/login → WP OAuth → /auth/callback → JWT cookie
- [x] Refresh token rotation working (Redis)
- [x] CSRF protection via state param
- [x] /users/me returns cached user data
- [x] httpOnly cookie configured (secure, sameSite, domain)
- [x] Auth tests passing

## Success Criteria
- `GET /auth/login` → redirects to maf.run/oauth/authorize with PKCE params
- WordPress approval → callback → JWT cookie set → redirect to app.maf.run/dashboard
- `GET /users/me` → returns user (name, email, avatar) from DB cache
- `POST /auth/refresh` → new JWT + rotated refresh token
- `POST /auth/logout` → cookie cleared, refresh token deleted from Redis
- Expired JWT (15min) auto-refresh works

## Risk Assessment
| Risk | Mitigation |
|------|------------|
| WP OAuth Server plugin issues | Test with local WP first; fallback: WP REST API + application passwords |
| WordPress downtime | Existing sessions valid 7 days; user data cached in PostgreSQL |
| Refresh token race condition | 30-60s grace period: old refresh token still returns already-issued new pair |
| Cookie domain mismatch | Both sites under .maf.run domain — sameSite=lax works |

## Security Considerations
- JWT signed with RS256 (asymmetric — private key never leaves API)
- Refresh tokens opaque, stored in Redis (not JWT — revocable)
- PKCE prevents authorization code interception
- State param prevents CSRF on OAuth callback
- httpOnly cookies prevent XSS token theft
- No sensitive data in JWT payload (only userId, email)

## Next Steps
- Phase 3: Add UserProfile CRUD on top of auth
- Phase 4: Frontend auth context consumes these endpoints
