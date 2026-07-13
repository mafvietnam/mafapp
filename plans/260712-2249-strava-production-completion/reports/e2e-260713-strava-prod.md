# E2E Report — Strava Production Completion (prod app.maf.run)

**Date:** 2026-07-13 | **Deployed SHA:** 4418c24 (== local dev HEAD) | **Runner:** Playwright MCP

## Result Summary

14/20 scenarios PASS. 5 blocked by a single EXTERNAL cause (Strava app "Inactive" — user action). 1 low-risk untested.

## Bugs Found & Fixed (fix-redeploy loop)

| # | Bug | Root cause | Fix | Redeployed |
|---|-----|-----------|-----|------------|
| 1 | Login blocked for ALL users | Theme reCAPTCHA v3 site key invalid → JS threw "Invalid site key", form never submitted | Made reCAPTCHA best-effort (client falls back to token-less submit on failure/timeout; server treats missing/misconfigured token as advisory, keeps nonce+honeypot+IP-rate-limit). `wordpress/themes/maf-running/{assets/js/main.js, inc/social-auth.php}` | docker cp → mafweb |
| 2 | Strava sync 403 after connect | `approval_prompt=auto` reused a returning athlete's stale narrow-scope grant → activities API 403 (missing activity:read_all) | `approval_prompt=force` → always show consent so `activity:read_all` is (re)granted. `api/src/strava/strava-auth.service.ts` | git → server pull → rebuild maf-api |

## Scenario Matrix

| # | Scenario | Result | Notes |
|---|----------|--------|-------|
| 1 | SSO login (direct) | ✅ PASS | After Bug #1 fix; madm → dashboard |
| 2 | SSO gateway + no-cache | ✅ PASS | maf.run gateway → app callback; no-cache headers live |
| 3 | Logout | ✅ PASS | Unified logout; /dashboard → SSO gateway; session cleared |
| 4 | Guide page | ⚪ not tested | Low risk; unchanged this cycle |
| 5 | MAF calculator | ✅ PASS | Zone 130–140 BPM computed from profile (age 35) |
| 6 | MAF Lab + auto-fill | 🔴 BLOCKED | Needs Strava activities (app Inactive) |
| 7 | Dashboard real activities | ✅ PASS | **Exactly one** /strava/activities request (M15); graceful empty state |
| 8 | Profile connect | ✅ PASS | OAuth full flow → ?strava_connected=1; card shows Athlete 42629576 |
| 9 | Sync | 🔴 BLOCKED | 202 accepted, but Strava activities API 403 (app Inactive); handled gracefully (logs error, no crash) |
| 10 | Activities visible | 🔴 BLOCKED | No data (app Inactive) |
| 11 | Disconnect | ✅ PASS | Row deleted; deauthorize attempted (403 Inactive, non-blocking as designed) |
| 12 | Reconnect | ✅ PASS | Fresh consent (force) → new row |
| 13 | Slot guard — proactive | ✅ PASS | cap=1 w/ 1 row → status.connectionLimitReached=true → button "Hết slot Strava" disabled |
| 14 | Slot guard — reactive | ✅ PASS | cap=0, no conn → GET /strava/connect → **409** "Đã đạt giới hạn... (hết slot)" |
| 15 | Admin users | ✅ PASS | 17 rows render |
| 16 | Admin settings | ✅ PASS | Strava creds masked "d710••••6a97" (new app 221736), feature enabled |
| 17 | Admin strava overview | ✅ PASS | Feature "Đang bật"; connections table + counts |
| 18 | Admin manual sync | 🔴 BLOCKED | 403 Inactive |
| 19 | Webhook event | 🔴 BLOCKED | Subscription create 403 "Application Status: Inactive" |
| 20 | Console cleanliness | ✅ PASS | Only cosmetic 404s (/favicon.svg, /api/garmin/status — Garmin disabled) |

## Red-Team Fixes Verified Live

- M14 (no numeric slot leak): `/strava/status` returns only `connectionLimitReached` boolean ✅
- M15 (single fetch): dashboard fires exactly one activities request ✅
- H6 (deauthorize on disconnect): attempted on disconnect (Strava 403 non-blocking) ✅
- H6b (count ALL rows): ERROR-status row counted toward cap ✅
- Slot cap 409 + reconnect exemption ✅

## THE Blocker (requires USER action)

**Strava API application 221736 status = "Inactive"** (also 222309). Confirmed via direct API:
`GET /api/v3/push_subscriptions` → `{"message":"Forbidden","errors":[{"resource":"Application","field":"Status","code":"Inactive"}]}`.

OAuth + token exchange work (credentials valid), but ALL data endpoints (activities, webhook, deauthorize) return 403 while Inactive. Nothing app-side can bypass this.

**Root cause (confirmed 2026-07-13 via strava.com/settings/api screenshot):** Strava moved API access to **subscriber-only**. Owner account `mafvietnam2021@gmail.com` is a **Free Account** → app auto-deactivated. Banner: "We're updating API access to be subscriber-only. Start a subscription to maintain your access." Creds 221736 confirmed correct (10 athletes allowed, 6 currently connected Strava-side).

**Required user action:** Start a **paid Strava subscription** on that account to reactivate API. No code/deploy change needed — scenarios 6/9/10/18/19 will pass once Active. Secondary: deauthorize the 6 stale Strava-side athletes to free slots (our DB shows 0 — ledger divergence, expected).

## Prod State (clean)

- 0 StravaConnection rows, `strava.maxAthletes`=10, DEPLOYED_SHA=4418c24 == local HEAD.
- Backups: `/root/maf-backups/` (maf + wp pg/mysql dumps, mu-plugin .pre, compose .pre); rollback images `maf-api:v1-prev`, `maf-app:v6-sso-prev`.

## Unresolved Questions

1. Why is app 221736 "Inactive" despite 10-athlete grant? User to check Strava dashboard (pending review? API Agreement? subscription requirement?).
2. Cloudflare cache purge for maf.run gateway/logout (H10) — not needed in practice; redirect-back worked without stale page. Left for user if a stale gateway page ever appears.
