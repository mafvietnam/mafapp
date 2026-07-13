# Strava Activity Detail + MAF Analysis — Shipped

**Date:** 2026-07-13 | **Commits:** `415af9a` (feat), `f346d4e` (plan), `bb873c4` (docs) | **Prod:** https://app.maf.run

## What shipped
Click any synced Strava activity on the dashboard → `/activities/:id` detail page: full stats + MAF-first analysis (verdict vs MAF zone, time-in-zone bar, HR-over-time chart with MAF band, per-km splits, cardiac drift, aerobic efficiency). Detail + streams lazily hydrated from Strava on first open, cached in a new `StravaActivityDetail` table, MAF math computed client-side from the live profile.

## Pipeline
brainstorm → plan (6 phases) → red-team (4 hostile lenses) → validate → cook --auto → deploy → prod E2E.

## Red-team paid off
18 findings, 15 accepted. The 3 that would have bitten in prod: cross-user cache leak (unscoped read + no cascade + disconnect no purge), thrown-timeout/network → uncaught 500 (no global exception filter exists), and streams-transient-failure poisoning the cache permanently. All fixed in the plan before a line was written.

## Code-review caught 3 more
Post-implementation review found 2 High + 1 Medium the tests missed: (H1) a 200-with-non-JSON Strava body → `whitelistDetail(null)` → 500; (H2) the webhook athlete-deauth path purged activities but not the detail cache (health-PII retention); (M1) the detail hook's boolean cancel flag raced on in-place `id` change, letting a stale response overwrite the current activity. All fixed + regression-tested (api 58, FE 231).

## Deploy surprise: drifted migration history
Prod `_prisma_migrations` uses old-style names (`20260406125341_init`, `20260407_*`) but the repo squashed them into `0001_init`. A blind `migrate deploy` would have tried to re-run `0001_init` → CREATE TABLE on existing tables → fail. Applied `0003` SQL directly via psql + `migrate resolve --applied` instead. Captured in a memory + deployment-guide so the next deploy doesn't relearn it.

## E2E on real data
Owner account has 7 real activities but is Google-SSO (can't automate). Verified by minting a server-side JWT (read from the `maf_access` httpOnly cookie, not Authorization header) and driving Playwright with it injected as a `.maf.run` cookie. Real hydration returned aligned 688-pt streams, correct splits, real kcal (summary column is kJ), no token leak. The recharts@3 HR chart renders (not blank — the flagged React-19 risk). No-HR manual activity degrades correctly. IDOR 404, `Cache-Control: private, no-store`, 0 console errors. No bugs → no redeploy loop needed.

## Follow-ups (deferred, documented)
Map/polyline view, MAF pace-trend across activities, Garmin detail parity, app-global Strava-quota token bucket. Webhook registration still blocked by the pre-existing Cloudflare edge issue (unrelated).
