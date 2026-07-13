# Brainstorm — Strava Upload Tracklog Feature

**Date:** 2026-07-13 19:34 | **Status:** APPROVED → proceed to plan
**Author:** brainstorm session

## Problem
Strava OAuth app capped at **10 athletes** (app chưa được Strava approve). User #11+ không connect OAuth được → không có dữ liệu chạy → không MAF analysis. Cần đường vào dữ liệu **không qua OAuth**: user tự export file tracklog từ Strava → upload → app parse → hiển thị + phân tích MAF như activity sync.

## Requirements
- **Functional:** Upload GPX/TCX file(s) → parse → tạo activity hiển thị trên dashboard + detail page + MAF analysis + coaching insights (cần HR streams).
- **Non-functional:** KISS/YAGNI/DRY; không phá luồng sync OAuth hiện có; an toàn (XXE, file size, throttle); idempotent re-upload.

## Approaches evaluated

### ① File format (DECISION: GPX + TCX; FIT + zip → v2)
| Format | HR? | Parse cost | Nguồn export | Verdict |
|--------|-----|-----------|--------------|---------|
| **GPX** | ✅ `<gpxtpx:hr>` | Nhẹ (XML) | "Export GPX" trên MỌI activity | ✅ v1 |
| **TCX** | ✅ `<HeartRateBpm>` + `<DistanceMeters>` tường minh (tốt cho treadmill) | Nhẹ (XML) | "Export Original" (một số device) | ✅ v1 |
| **FIT** | ✅ | Nặng (binary, cần `fit-file-parser`) | "Export Original" Garmin / bulk-export | ⏸ v2 |
| **Zip bulk** | ✅ | Rất nặng (unzip+gunzip+FIT) | Bulk export | ⏸ v2 |

Rationale: "Export GPX" per-activity có sẵn khắp nơi và kèm HR → đủ core need. TCX cheap add + cứu treadmill. FIT/zip overkill cho nhu cầu "vài buổi chạy chính" của user #11+.

### ② Storage model (DECISION: reuse StravaActivity + `source`)
- Thêm enum `ActivitySource { STRAVA, UPLOAD }`, cột `source StravaActivity.source @default(STRAVA)`.
- Synthetic `stravaActivityId = "upload_" + <contentHash>` → re-upload cùng file = upsert idempotent.
- **Win:** dashboard `/strava/activities`, detail page, `maf-activity-analysis.ts`, `maf-coaching-insights.ts` chạy 0 dòng đổi (DRY). Bảng riêng sẽ phải UNION 2 nguồn + nhân đôi read path.
- `disconnect()` scope lại `where { userId, source: STRAVA }` → upload sống sót khi disconnect OAuth (đúng ý đồ).

### ③ Parse location (DECISION: server-side)
- NestJS + Multer (memory storage) + `fast-xml-parser` (MIT, pure-JS, no external-entity resolution → XXE-safe).
- Flow: multipart POST → parse → tính distance (haversine cho GPX / `<DistanceMeters>` cho TCX), movingTime, avgHR, maxHR, avgPace, elevation → ghi `StravaActivity(source=UPLOAD)` + ghi thẳng `StravaActivityDetail(streamsJson)`.
- Streams client-side analysis chạy nguyên (detail page fetch streamsJson như activity sync).

### ④ Dedup (DECISION: hash-ID + ±5min cross-source)
- Upload-vs-upload: content-hash ID → upsert idempotent.
- Upload-vs-sync/Garmin: tái dùng pattern ±5 phút; nếu trùng buổi đã có `source=STRAVA` → set `isDuplicate=true` trên bản UPLOAD (bản Strava thắng vì có ID thật để hydrate detail).

### ⑤ Detail page cho upload (DECISION: early-branch, no Strava call)
- `strava-detail.service.getDetail()`: nếu `activity.source===UPLOAD` → trả `StravaActivityDetail` đã lưu, KHÔNG gọi Strava API, `hydrated:true`.

### ⑥ Limits / security
- ≤5MB/file, ≤20 files/batch, throttle 10/min, whitelist `.gpx/.tcx`, chỉ import run-like (parse `<type>`/`Sport`, default "Run").

## Risks & mitigations
- **GPX treadmill no-GPS** → distance=0. Mitigation: TCX `<DistanceMeters>`; nếu GPX thiếu cả distance lẫn coords → reject với message rõ.
- **XXE** → fast-xml-parser không parse DTD/entity mặc định.
- **Synthetic ID collision với Strava real ID** → prefix `upload_` không đụng numeric Strava ID.
- **disconnect purge nuốt upload** → scope theo source (đã xử lý).

## Success metrics
- Upload 1 file GPX Strava (có HR) → activity xuất hiện dashboard, detail page render HR chart + MAF zone + coaching insights, `hydrated:true`, không gọi Strava.
- Re-upload cùng file → không nhân bản.
- Disconnect OAuth → upload vẫn còn.

## Next steps
→ `/ck:plan` (phase hoá) → red-team → validate → cook → ship → E2E prod.

## Unresolved questions
- (none — 2 scope decisions confirmed by user: GPX+TCX, reuse-table)
