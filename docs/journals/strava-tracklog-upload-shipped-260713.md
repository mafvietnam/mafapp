# Journal — Strava GPX/TCX Tracklog Upload shipped (2026-07-13)

**Commit:** 66182ef (feature) + cb72001 (docs) | **Deployed:** app.maf.run, DEPLOYED_SHA=66182ef | **Version:** 1.9.0

## What & why
Strava's OAuth app is capped at **10 authorized athletes** (unapproved app). User #11+ couldn't get data
in → no MAF analysis. Added a **manual GPX/TCX upload** path that bypasses OAuth entirely: user exports a
tracklog from Strava ("Export GPX") → uploads → same full pipeline (dashboard, detail HR chart, MAF zone,
Maffetone coaching, cardiac drift, aerobic efficiency).

## Process (full combo)
brainstorm → plan (7 phases) → red-team (3 hostile reviewers) → validate → cook (implement) → deploy → prod E2E.

## Key decisions
- **Reuse `StravaActivity` + `source` enum** (not a new table) → every existing read path (dashboard, detail,
  analysis, coaching, journal) works unchanged. DRY win.
- **GPX + TCX only** (FIT/zip deferred) — "Export GPX" is on every activity and carries HR; TCX rescues
  GPS-less treadmill runs via explicit `DistanceMeters`.
- **Server-side parse** (fast-xml-parser) → streams written to `StravaActivityDetail` in the same
  `DownsampledStreams` shape the detail chart already consumes (reused `downsampleStreams`).

## What red-team + code-review caught (fixed before prod)
- **Cross-tenant upsert**: `stravaActivityId` is globally `@unique`, not userId-scoped → a bare upsert could
  overwrite another user's row. Fixed with userId-scoped `updateMany`+guarded `create` (P2002→409).
- **One-directional dedup double-count**: sync only checked Garmin, never UPLOAD. Made dedup symmetric
  across {STRAVA,UPLOAD,Garmin}, order-independent.
- **avgSpeed never written** → aerobic-efficiency silently null. Now computed.
- **FE multipart broken**: api-client forced `application/json` + used cookie auth, not Authorization. Added
  `postForm` that lets the browser set the boundary and keeps `credentials:'include'`.
- **HR stream not range-clamped** (only summary was) → 0/glitch HR would poison time-in-zone. Clamped.
- **Post-txn dedup could orphan** a row while reporting error → wrapped so a dedup failure keeps the row.

## Deploy notes (drift-safe)
Prod Prisma history is drifted, so NO blind `migrate deploy`. Applied `0004` SQL directly via psql
(transactional), then `migrate resolve --applied` **inside the freshly-built container** (RT-H5 ordering —
the old container lacks the migration dir). Staged `up -d maf-api` → verify → `up -d maf-app`. Rollback
tags `:pre-upload`. `docker exec` node + `fetch`/`FormData` for backend E2E (alpine image has no curl).

## Verification
106 api + 284 web tests. **Prod E2E 24/24** (upload, source=UPLOAD, detail hydrated with all streams,
idempotent re-upload, TCX treadmill=1800m, invalid/malformed graceful) **+ full browser flow** (dashboard
card renders, real file upload via postForm+cookie, detail page HR chart + MAF + coaching + "Tệp tải lên"
badge). Test rows cleaned from owner account.

## Follow-up (not blocking)
`garmin-sync.service` has no dedup → upload-then-Garmin-sync would double-count. Add the upload-dedup
mirror BEFORE Garmin OAuth goes live (currently pending approval, so latent).
