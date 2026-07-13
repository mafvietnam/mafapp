---
title: Strava Upload Tracklog (GPX/TCX)
status: completed
created: 2026-07-13
completed: 2026-07-13
deployedSha: 66182ef
tags: [strava, upload, gpx, tcx, maf]
blockedBy: []
blocks: []
---

# Strava Upload Tracklog (GPX/TCX)

Bổ sung đường vào dữ liệu **không qua OAuth**: user #11+ (hết 10 slot Strava) tự export file
tracklog từ Strava → upload → app parse → activity lên dashboard + detail + MAF analysis như sync.

**Design source:** `plans/reports/brainstorm-260713-1934-strava-upload-tracklog.md` (APPROVED)

## Chốt kiến trúc
- Format v1: **GPX + TCX** (FIT/zip → v2).
- Storage: **tái dùng `StravaActivity` + enum `ActivitySource{STRAVA,UPLOAD}` + cột `source`**. ID = `upload_<hash>` idempotent.
- Parse **server-side**: Multer(memory) + `fast-xml-parser` (XXE-safe). Ghi `StravaActivity(UPLOAD)` + `StravaActivityDetail(streamsJson)`.
- Streams shape = **`DownsampledStreams`** (tái dùng `downsampleStreams()` → DRY). Detail shape = `WhitelistedDetail`.
- Detail service: nhánh sớm `source===UPLOAD` → trả cache, KHÔNG gọi Strava.
- `disconnect()`: scope `source=STRAVA`; detail purge loại trừ `upload_` prefix → upload sống sót.
- Limits: ≤5MB/file, ≤20 files/batch, throttle 10/min, whitelist `.gpx/.tcx`.

## Phases — ALL COMPLETE ✅
| # | Phase | Status | File |
|---|-------|--------|------|
| 01 | Schema + migration + scope disconnect | ✅ done | phase-01-schema-migration.md |
| 02 | Tracklog parsers (GPX/TCX, pure utils) | ✅ done | phase-02-tracklog-parsers.md |
| 03 | Upload service + controller endpoint | ✅ done | phase-03-upload-service-endpoint.md |
| 04 | Detail service UPLOAD branch | ✅ done | phase-04-detail-service-branch.md |
| 05 | Frontend upload UI | ✅ done | phase-05-frontend-upload-ui.md |
| 06 | Tests (unit + integration) | ✅ done (106 api / 284 web) | phase-06-tests.md |
| 07 | E2E + deploy prod | ✅ done (24/24 backend + FE flow, DEPLOYED_SHA=66182ef) | phase-07-e2e-deploy.md |

**Shipped 2026-07-13** (commit 66182ef): deployed to app.maf.run via staged docker rebuild; 0004 migration
applied drift-safe (SQL + `migrate resolve` in new container). Prod E2E all green: upload GPX/TCX →
dashboard + detail HR chart + MAF zone + Maffetone coaching + cardiac drift + aerobic efficiency; "Tệp
tải lên" badge (no Strava link); idempotent re-upload; TCX treadmill distance; invalid/malformed graceful.
Code-review found H1 (HR stream clamp) + M1 (post-txn dedup) → fixed pre-deploy. Follow-up M2: Garmin-sync
upload dedup (not blocking — Garmin OAuth not live). Rollback tags `:pre-upload`.

## Dependencies
- 01 → 02/03/04 (schema needed by services). 03 depends on 02 (parsers). 04 depends on 01 (source field).
- 05 depends on 03 (endpoint). 06 after 02-05. 07 last.

## Key risks
- Prisma **migration drift trên prod** → KHÔNG blind `migrate deploy`; apply SQL thủ công + `migrate resolve` (memory prod-prisma-migration-drift).
- GPX treadmill no-GPS → distance=0 → dùng TCX `<DistanceMeters>`; GPX thiếu cả coords+distance → reject rõ ràng.
- streamsJson phải đúng camelCase shape (`velocitySmooth`) để FE chart + maf-activity-analysis chạy.

## Red Team Review (3 hostile reviewers → all substantive findings ACCEPTED)
Full list + fixes: **`red-team-fixes.md`** (cook MUST apply). Highlights:
- **CRITICAL:** userId-scope the upsert (global-unique `stravaActivityId` → cross-tenant poisoning); symmetric dedup across {STRAVA,UPLOAD,Garmin} (one-directional dedup double-counts mileage/trends).
- **HIGH:** compute avgSpeed (else aerobic-efficiency silently dead); FE multipart broken (api-client forces JSON + cookie auth, add `postForm`); cap trackpoints + Multer limits (sync-parse DoS); validate/clamp parsed values; migrate deploy order+name; wrap writes in txn.
- **MEDIUM:** HR-partial tolerance, MulterError→413 filter, hide Strava link/attribution for UPLOAD, derive velocity stream, movingTime from moving-samples, calories kcal→detailJson, Prisma.DbNull, TCX multisport.
- **Verify at impl:** ThrottlerGuard global (APP_GUARD)? Dockerfile `prisma generate`?

## Validation Log (session 1)
- **Upload access:** MỌI user (card upload luôn hiện trên dashboard, kể cả đã connect). Dedup đối xứng (RT-C2) lo double-count. → phase-05 không gate theo connection status.
- **Non-run files:** nhận mọi type; lưu type parse được, dashboard hiện, MAF coaching gate tự loại non-run (hành vi hiện tại). → phase-02 default 'Run' khi thiếu type, KHÔNG reject theo type (RT-M11).

## Success (definition of done)
Upload GPX Strava có HR → activity trên dashboard, detail render HR chart + MAF zone + coaching insights, `hydrated:true`, 0 gọi Strava; re-upload không nhân bản; disconnect OAuth upload vẫn còn; toàn bộ test pass; E2E prod pass.
