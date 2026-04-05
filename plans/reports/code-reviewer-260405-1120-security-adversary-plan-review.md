# Security Adversary Review: MAF Platform SP2-SP7 Plan

**Reviewer:** code-reviewer (Security Adversary perspective)
**Date:** 2026-04-05
**Scope:** plan.md, phase-01 (backend), phase-02 (frontend), phase-03 (integration)
**Verdict:** 7 findings, 2 Critical, 3 High, 2 Medium

---

## Finding 1: Strava OAuth tokens stored plaintext — "encrypted at rest" has no implementation plan

- **Severity:** Critical
- **Location:** Phase 1, section "Database Schema" (lines 138-147) + "Security Considerations" (line 400)
- **Flaw:** The Prisma schema defines `accessToken String` and `refreshToken String` as plain text columns. The plan mentions "Strava tokens encrypted at rest (Prisma middleware or DB-level)" as a bullet point in security considerations, but there is zero implementation detail: no encryption algorithm specified, no key management strategy, no key rotation plan, no mention of where the encryption key lives, no Prisma middleware in any implementation step.
- **Failure scenario:** Developer implements the schema as written. Tokens land in PostgreSQL as plaintext. A SQL injection via a future module, a DB backup leak, a PgBouncer misconfiguration exposing the connection, or an admin panel with read access to the DB all yield every user's Strava OAuth refresh tokens. Attacker uses refresh tokens to impersonate users on Strava, access private activity data (GPS coordinates of their home), or modify/delete their activities.
- **Evidence:** Schema has `accessToken String` / `refreshToken String` with no `@db.Bytea` or encryption annotation. Implementation steps 22-23 say "store tokens in DB (encrypted)" but Week 3 steps never mention implementing encryption. No implementation step creates Prisma middleware for field-level encryption. No key management step exists.
- **Suggested fix:** Add an explicit implementation step: "Implement Prisma field-level encryption middleware using `aes-256-gcm` with encryption key from env var `STRAVA_TOKEN_ENCRYPTION_KEY`. Document key rotation procedure. Add integration test that verifies tokens are not readable as plaintext in raw DB query."

---

## Finding 2: No OAuth `state` parameter — CSRF on OAuth authorization flows

- **Severity:** Critical
- **Location:** Phase 1, section "Week 2: WordPress SSO" (step 16) + "Week 3: Strava Integration" (step 23)
- **Flaw:** The WordPress OAuth flow (step 16) generates PKCE `code_verifier` + `code_challenge` but never mentions the `state` parameter. The Strava OAuth flow (step 23) also omits `state`. PKCE protects the code exchange from interception, but it does not protect against CSRF. Without `state`, an attacker can initiate an OAuth flow with their own account and trick a victim into completing the callback, binding the attacker's WordPress/Strava account to the victim's session.
- **Failure scenario:** Attacker starts a Strava OAuth flow, obtains authorization code, crafts a URL like `api.maf.run/strava/callback?code=ATTACKER_CODE`, and gets the victim to click it (phishing email, forum post). Victim's MAF account is now linked to attacker's Strava account. Attacker can push fabricated activity data, or the victim unknowingly syncs the attacker's activities. For WordPress SSO, the same attack binds the victim's browser session to the attacker's WordPress identity — the attacker now has a session cookie that maps to their own WP account on the victim's browser, enabling session fixation.
- **Evidence:** Step 16: "generate PKCE code_verifier + code_challenge -> redirect to maf.run/oauth/authorize" — no `state` mentioned. Step 23: "GET /strava/connect -> redirect to Strava OAuth" — no `state` mentioned. The research report also omits `state` from the PKCE flow code sample (lines 141-146 of wp-oauth research).
- **Suggested fix:** Both OAuth flows must generate a cryptographically random `state` parameter, store it in the user's session (Redis or signed cookie), send it in the authorization request, and verify it matches on callback. Add this as an explicit sub-step under steps 16 and 23.

---

## Finding 3: PKCE code_verifier generated server-side defeats the purpose for a public SPA client

- **Severity:** High
- **Location:** Phase 1, step 16 vs Phase 2, step 3
- **Flaw:** Phase 1 (backend) says `GET /auth/login` generates the PKCE code_verifier and code_challenge on the server, then redirects to WordPress. But Phase 2 (frontend) says `login()` redirects to `api.maf.run/auth/login`. This means the SPA is a public client making a server-side redirect to initiate OAuth. The PKCE flow is designed so the client that initiates the request also proves it on the callback. If the backend generates and holds the code_verifier, the flow is effectively confidential-client OAuth2, not PKCE for a public client. The plan also says "PKCE enabled (no client_secret needed for public clients)" — but the backend IS the client in this flow, so either (a) the backend is a confidential client and should use a client_secret instead of PKCE, or (b) the SPA should generate the PKCE parameters and the plan's architecture is inconsistent.
- **Failure scenario:** Confusion during implementation leads to an insecure hybrid: backend generates code_verifier but stores it in a way that doesn't bind it to the specific user session (e.g., global state, shared Redis key without session binding). Multiple concurrent logins overwrite each other's verifiers. Or the code_verifier is stored in a cookie sent to the client, defeating PKCE's security model.
- **Evidence:** Phase 1 step 16: "GET /auth/login -> generate PKCE code_verifier + code_challenge -> redirect to maf.run/oauth/authorize". Phase 2 step 3: "login() -> redirect to api.maf.run/auth/login". Research report line 132: "Current Issue: React SPA is a public client (no secure secret storage)".
- **Suggested fix:** Decide one model and document it explicitly: (A) Backend is confidential client: use client_secret, drop PKCE. (B) SPA is public client: SPA generates code_verifier, stores in sessionStorage, sends code_challenge to WP directly, handles callback itself, then exchanges code+verifier via backend proxy. The plan must not leave this ambiguous.

---

## Finding 4: JWT signing with RS256 but no key management or rotation plan

- **Severity:** High
- **Location:** Phase 1, step 17
- **Flaw:** The plan specifies "Access token: 15min TTL, signed with RS256" but never mentions: where the RSA key pair is generated, how the private key is stored (env var? file mount? vault?), whether there is a public key endpoint (JWKS) for token validation, or how key rotation works. RS256 requires managing an RSA key pair, which is significantly more complex than HS256. A leaked private key allows forging any JWT indefinitely.
- **Failure scenario:** Developer generates an RSA key, pastes it into `.env`, commits `.env.example` with a placeholder that looks like a real key, or the key ends up in a Docker image layer. No rotation mechanism means a compromised key requires redeploying with a new key and invalidating all existing tokens simultaneously, causing a full user logout storm. Without a JWKS endpoint, the frontend or any service that needs to verify tokens must have the public key baked in, making rotation a coordinated multi-deploy operation.
- **Evidence:** Step 17: "Access token: 15min TTL, signed with RS256". No step covers RSA key generation, storage, JWKS endpoint, or rotation. Security considerations (line 399): "JWT secrets in env vars" — RS256 uses key pairs, not "secrets," suggesting the implementer may default to HS256 anyway.
- **Suggested fix:** Add implementation steps for: (1) RSA key pair generation script, (2) private key stored as Docker secret or mounted file (not env var — multiline RSA keys in env vars are error-prone), (3) JWKS endpoint at `/.well-known/jwks.json` for public key distribution, (4) key rotation procedure (support multiple active public keys during rotation window).

---

## Finding 5: Refresh token stored "one per user" in Redis enables session fixation and lacks device binding

- **Severity:** High
- **Location:** Phase 1, step 17 + research report "Token Management Strategy"
- **Flaw:** The plan says "Refresh token: 7-day TTL, stored in Redis (one per user, rotation on use)." One refresh token per user means logging in on a second device invalidates the first device's refresh token silently. More critically, it means there is no device/session binding. If an attacker obtains a refresh token (XSS on a subdomain, cookie leak from a .maf.run sibling), they can use it from any device and the legitimate user's next refresh will fail — but the attacker now holds the rotated token.
- **Failure scenario:** User logs in on phone and laptop. Laptop login overwrites the phone's refresh token. Phone session silently dies on next refresh. User thinks it is a bug, re-logs in, which now kills the laptop session. Perpetual session instability. In the attack scenario: attacker steals refresh token cookie (e.g., via subdomain XSS on blog.maf.run or any .maf.run subdomain if cookie domain is `.maf.run`), uses it once to get a new token pair, and the legitimate user is now logged out with no indication of compromise.
- **Evidence:** Step 17: "Refresh token: 7-day TTL, stored in Redis (one per user, rotation on use)". Research report line 76: "Store refresh tokens in Redis with key: `refresh_token:{token_hash}`" — but the plan says "one per user," contradicting per-token-hash storage.
- **Suggested fix:** Store refresh tokens keyed by `refresh_token:{userId}:{deviceFingerprint}` or `refresh_token:{userId}:{sessionId}`, allowing multiple concurrent sessions. On rotation, invalidate only the specific session's old token. Add a "list active sessions" endpoint so users can review and revoke sessions. Set cookie domain to `app.maf.run` (exact), NOT `.maf.run`.

---

## Finding 6: Strava webhook endpoint has no rate limiting or abuse protection beyond signature validation

- **Severity:** Medium
- **Location:** Phase 1, step 27 + "RateLimiterModule" (lines 92-94)
- **Flaw:** The RateLimiterModule defines "per-user: 100 req/min, per-IP: 200 req/min" for the API, but the Strava webhook endpoint is unauthenticated (Strava sends events, not users). The plan says "validate signature -> queue to critical queue -> respond 200 within 2s." If an attacker discovers the webhook URL and Strava's subscription verification token (which is sent in plaintext during GET validation), they can forge webhook payloads. Even with signature validation, a compromised Strava subscription secret means unlimited job injection into the critical queue.
- **Failure scenario:** Attacker floods `POST /strava/webhook` with forged payloads containing `object_type: "activity"` events for random user IDs. Each event queues a critical job that calls the Strava API to fetch the activity — burning through the precious 2000 req/day API quota in minutes. Even if signature validation catches most, a timing side-channel on HMAC comparison or a leaked webhook secret enables this. The plan has no mention of webhook-specific rate limiting, payload size limits, or monitoring for anomalous webhook volume.
- **Evidence:** Step 27: only mentions signature validation. RateLimiterModule (line 93): "ApiRateLimiter (per-user: 100 req/min, per-IP: 200 req/min)" — webhook endpoint has no user, so per-user limiting does not apply. No per-IP limit specific to webhook endpoint mentioned.
- **Suggested fix:** Add: (1) IP allowlist for Strava's webhook source IPs (if Strava publishes them), (2) per-IP rate limit on webhook endpoint (e.g., 50 req/min), (3) constant-time HMAC comparison (crypto.timingSafeEqual), (4) payload size limit (reject > 10KB), (5) anomaly alerting if webhook volume exceeds 10x baseline. (6) Validate that the `owner_id` in the webhook payload matches a known StravaConnection before queuing any job.

---

## Finding 7: rawData Json field stores full Strava API response — unbounded PII storage with no access control

- **Severity:** Medium
- **Location:** Phase 1, "Database Schema" — Activity model (line 166)
- **Flaw:** The Activity schema has `rawData Json?` described as "full Strava response." Strava activity responses include detailed GPS tracks (latitude/longitude streams), location data (start_latlng, end_latlng), device info, and potentially private notes. Storing the full raw response means: (1) the database contains precise geolocation data (users' home addresses inferable from start/end coordinates), (2) there is no data minimization — GDPR/privacy risk, (3) the `GET /activities/:id` endpoint will likely serialize this field to the frontend unless explicitly excluded, leaking raw Strava data to the browser. The plan has no mention of field-level access control, data masking, or excluding rawData from API responses.
- **Evidence:** Schema line 166: `rawData Json? // full Strava response`. No implementation step mentions filtering rawData from API responses. No mention of what "full Strava response" includes. No data retention or purging policy for rawData.
- **Suggested fix:** (1) Do not store raw GPS streams in the main Activity table — store only computed/aggregated fields. If raw data is needed for reprocessing, store in a separate table with restricted access. (2) Explicitly exclude `rawData` from all API response DTOs. (3) Add a data retention policy (e.g., delete rawData after analysis is complete). (4) If storing GPS data is required, document it in a privacy policy and add user consent flow.

---

## Summary Table

| # | Finding | Severity | OWASP Category |
|---|---------|----------|----------------|
| 1 | Strava tokens stored plaintext | Critical | A02: Cryptographic Failures |
| 2 | Missing OAuth `state` parameter | Critical | A01: Broken Access Control (CSRF) |
| 3 | PKCE architecture contradiction (server vs client) | High | A07: Identification and Authentication Failures |
| 4 | RS256 JWT with no key management plan | High | A02: Cryptographic Failures |
| 5 | Single refresh token per user, no device binding | High | A07: Identification and Authentication Failures |
| 6 | Webhook endpoint lacks abuse protection | Medium | A04: Insecure Design |
| 7 | Unbounded PII in rawData field | Medium | A01: Broken Access Control / Privacy |

---

**Status:** DONE
**Summary:** Plan has 2 critical auth/crypto flaws (plaintext token storage without real implementation plan, missing OAuth state parameter), 3 high-severity architectural gaps (PKCE model contradiction, JWT key management void, single-session refresh tokens), and 2 medium concerns (webhook abuse surface, PII oversharing). Findings 1 and 2 are exploitable by default if the plan is followed as written.
**Concerns:** The plan reads as if security was added as an afterthought checklist rather than designed into the architecture. The gap between "security considerations" bullet points and actual implementation steps is where real vulnerabilities will ship.
