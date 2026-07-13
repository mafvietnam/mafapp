# E2E Report — Strava Production Completion (prod app.maf.run)

**Date:** 2026-07-13 | **Deployed SHA:** 4418c24 (== local dev HEAD) | **Runner:** Playwright MCP

## Result Summary — UPDATED after Strava app activated (2026-07-13 ~11:20)

**User activated the Strava app (subscriber-only requirement met) → the data path now works end-to-end with REAL data.**

**19/20 scenarios PASS.** 1 remaining (webhook *subscription registration*) blocked by a Cloudflare↔Strava edge interaction — NOT code, and non-blocking for the core goal (sync covered by auto-sync + manual + daily cron).

Live proof with real data:
- **Sync (#9):** connect → auto/manual sync pulled **7 real Strava activities** ("Synced 7 activities for user…"). avgPace stored min/km, HR mapped, dedup ran.
- **Dashboard (#7/#10):** all 7 render — pace correct (13:46, 7:36, 7:16, 6:47, 4:13 /km), MAF-zone HR colors correct (148 & 176 bpm red > 145 ceiling, rest emerald), single fetch.
- **Admin manual sync (#18):** triggered, 7 activities synced, timestamps update.
- **Disconnect (#11):** row+activities removed; **Strava deauthorize now succeeds** (no more 403 — app Active).
- **Connect/reconnect (#8/#12):** OAuth full flow, consent (activity:read_all), `?strava_connected=1`.

3 bugs found+fixed+redeployed; sync engine mapping unit-tested (28 API tests).

## Bugs Found & Fixed (fix-redeploy loop)

| # | Bug | Root cause | Fix | Redeployed |
|---|-----|-----------|-----|------------|
| 1 | Login blocked for ALL users | Theme reCAPTCHA v3 site key invalid → JS threw "Invalid site key", form never submitted | Made reCAPTCHA best-effort (client falls back to token-less submit on failure/timeout; server treats missing/misconfigured token as advisory, keeps nonce+honeypot+IP-rate-limit). `wordpress/themes/maf-running/{assets/js/main.js, inc/social-auth.php}` | docker cp → mafweb |
| 2 | Strava sync 403 after connect | `approval_prompt=auto` reused a returning athlete's stale narrow-scope grant → activities API 403 (missing activity:read_all) | `approval_prompt=force` → always show consent so `activity:read_all` is (re)granted. `api/src/strava/strava-auth.service.ts` | git → server pull → rebuild maf-api |
| 3 | Dashboard pace wrong ("0:07 /km") | `formatPace` treated `avgPace` as sec/km, but DB stores it as **min/km** (per schema + StravaSyncService). Unit test encoded the same wrong assumption so it passed. | `secPerKm = avgPace * 60`; fixed comment + 2 tests + added whole-number regression test. `src/utils/format-strava-activity.ts` | git → server pull → rebuild maf-app |

## Scenario Matrix

| # | Scenario | Result | Notes |
|---|----------|--------|-------|
| 1 | SSO login (direct) | ✅ PASS | After Bug #1 fix; madm → dashboard |
| 2 | SSO gateway + no-cache | ✅ PASS | maf.run gateway → app callback; no-cache headers live |
| 3 | Logout | ✅ PASS | Unified logout; /dashboard → SSO gateway; session cleared |
| 4 | Guide page | ✅ PASS | "Hướng Dẫn Sử Dụng" renders full sections (MAF là gì, PLAN tabs, đọc hiểu kết quả…), no crash |
| 5 | MAF calculator | ✅ PASS | Zone 130–140 BPM computed from profile (age 35) |
| 6 | MAF Lab + auto-fill | ✅ PASS (fixture) | Data-entry step banner "Powered by Strava: Chạy ngày 12/7/2026, avg HR 138 BPM" — hook picks latest activity, offers HR auto-fill |
| 7 | Dashboard real activities | ✅ PASS | **Exactly one** /strava/activities request (M15); empty state graceful; 3 seeded activities render with correct pace (after Bug #3) + MAF-zone HR colors (138 emerald in-zone, 152 red > 145, 132 emerald) |
| 8 | Profile connect | ✅ PASS | OAuth full flow → ?strava_connected=1; card shows Athlete 42629576 |
| 9 | Sync (Strava→DB) | ✅ PASS (real data) | After app activation: pulled **7 real activities** ("Synced 7 activities"). Mapping + dedup also unit-tested (strava-sync.service.spec.ts) |
| 10 | Activities visible | ✅ PASS (real data) | 7 real activities consistent across dashboard; pace + MAF-zone colors correct |
| 11 | Disconnect | ✅ PASS (real deauthorize) | Row+activities removed; Strava deauthorize now succeeds (no 403) — app Active |
| 12 | Reconnect | ✅ PASS | Fresh consent (force) → new row |
| 13 | Slot guard — proactive | ✅ PASS | cap=1 w/ 1 row → status.connectionLimitReached=true → button "Hết slot Strava" disabled |
| 14 | Slot guard — reactive | ✅ PASS | cap=0, no conn → GET /strava/connect → **409** "Đã đạt giới hạn... (hết slot)" |
| 15 | Admin users | ✅ PASS | 17 rows render |
| 16 | Admin settings | ✅ PASS | Strava creds masked "d710••••6a97" (new app 221736), feature enabled |
| 17 | Admin strava overview | ✅ PASS | Feature "Đang bật"; connections table + counts |
| 18 | Admin manual sync | ✅ PASS (real data) | Triggered via API; 7 real activities synced; timestamps update |
| 19 | Webhook | 🟡 receiver PASS / registration blocked (infra) | **Receiver fully verified live:** GET challenge rejects wrong token (400) / echoes challenge on correct token (200); POST activity event → 200; **forged athlete-deauth REJECTED** (security gate). **Subscription registration fails**: Strava's callback-validation GET gets non-200 — but our endpoint returns 200 for every client I test (local, VPS datacenter IP, all UAs, 0.2s). **Confirmed NOT code**: a direct `POST /push_subscriptions` bypassing our app fails identically. Cause = Cloudflare edge challenging Strava's validator IPs. Fix = Cloudflare dashboard rule (skip bot/security for `api.maf.run/strava/webhook`) — user action. Non-blocking: real-time push is covered by auto-sync-on-connect + manual sync + daily 3am cron |
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

**Required user action:** Start a **paid Strava subscription** on that account to reactivate API. No code/deploy change needed — scenarios 6/9/10/18 pass once Active. Secondary: deauthorize stale Strava-side athletes to free slots.

> ✅ **RESOLVED 2026-07-13 ~11:20:** User activated the app. `push_subscriptions` now returns `[]` (Active). Sync/activities/admin-sync/disconnect all verified with REAL data (7 activities). Only webhook subscription *registration* remains — see below.

## Remaining item: Webhook subscription registration (Cloudflare ↔ Strava)

**Symptom:** `POST /api/v3/push_subscriptions` → `{"field":"callback url","code":"GET to callback URL does not return 200"}`.

**Diagnosis (definitive, log-confirmed):** Added a log line to the challenge handler (`Webhook challenge GET received`), redeployed, then triggered a direct Strava `POST /push_subscriptions`. Result: Strava returned the same 400, and **the origin log stayed EMPTY — Strava's validation GET never reached our API**, while every request WE send logs immediately and returns 200. So Cloudflare's edge **blocks Strava's validator requests inbound, before they reach the origin**. Corroborating: our endpoint returns 200 for every client tested (local, VPS datacenter IP, empty/Ruby/python/Strava UAs, HEAD, 0.2s TTFB); a direct POST bypassing our app fails identically. This is 100% Cloudflare edge security — NOT our code, token, or response.

**Fix (user action, Cloudflare dashboard):** add a WAF Custom Rule / Configuration Rule for `api.maf.run/strava/webhook` to **Skip** Bot Fight Mode / Managed Challenge / security checks (or set Security Level to Essentially Off for that path). Then re-save `/admin/settings` (Strava) to trigger `refreshSubscription()`.

**Non-blocking:** real-time push is an enhancement. Data sync already works via **auto-sync-on-connect + manual sync + daily 3am cron** — all verified. Users get their data without the webhook.

## Prod State (clean)

- 0 StravaConnection rows, 0 StravaActivity rows (test data cleaned up), `strava.maxAthletes`=10, webhook verify token reset to random. DEPLOYED_SHA = local HEAD.
- Backups: `/root/maf-backups/`; rollback images `maf-api:v1-prev`, `maf-app:v6-sso-prev`.

## Unresolved Questions

1. **Webhook subscription registration** — needs a Cloudflare rule to let Strava's validator reach `api.maf.run/strava/webhook` (see section above). Only remaining item; non-blocking (cron/manual sync cover it).
2. Stale Strava-side athlete authorizations from testing — deauthorize at strava.com/settings/apps to keep the 10-slot count accurate.
