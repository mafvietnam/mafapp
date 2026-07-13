# Phase 06 — Tests (unit + integration)

**Priority:** P1 | **Status:** pending | **Depends:** 02-05

## Overview
Test thật (không mock nội dung), dùng fixture GPX/TCX nhỏ. Đảm bảo parser + upload + detail branch đúng.

## Related files (new)
- `api/src/strava/tracklog/gpx-parser.spec.ts`
- `api/src/strava/tracklog/tcx-parser.spec.ts`
- `api/src/strava/tracklog/tracklog-parser.spec.ts`
- `api/src/strava/strava-upload.service.spec.ts`
- (extend) `api/src/strava/strava-detail.service.spec.ts` — case source=UPLOAD
- Fixtures: inline string trong spec (KISS) hoặc `api/src/strava/tracklog/__fixtures__/*.gpx|.tcx`

## Cases
**GPX parser:**
- GPX Strava có HR (gpxtpx:hr) → points có hr, distance haversine >0, avgHR/maxHR đúng.
- GPX không extension HR → hr undefined, avgHR null, distance vẫn tính.
- Namespace variant (ns3:hr) → vẫn đọc HR.
- Malformed XML → throw.

**TCX parser:**
- TCX có DistanceMeters + HeartRateBpm → distance từ DistanceMeters, calories tổng Lap.
- TCX treadmill (no Position, có DistanceMeters) → distance>0 không cần GPS.

**tracklog-parser dispatcher:**
- detect gpx/tcx đúng; định dạng lạ → UnsupportedTracklogError; <2 point → EmptyTracklogError.

**strava-upload.service:**
- ingest GPX có HR → tạo StravaActivity(source=UPLOAD) + StravaActivityDetail(streamsJson có time+heartrate). Mock Prisma (upsert) — kiểm data shape, ID `upload_` prefix, avgPace đúng.
- re-ingest cùng input → cùng stravaActivityId (idempotent).
- overlap ±5min với StravaActivity source=STRAVA → isDuplicate=true.

**detail branch:**
- getDetail với activity.source=UPLOAD → đọc StravaActivityDetail, hydrated:true, KHÔNG gọi fetch (spy fetch không được gọi).

## Todo
- [ ] Viết fixtures GPX/TCX tối giản (5-10 trackpoint) có HR
- [ ] parser specs
- [ ] upload service spec (mock PrismaService)
- [ ] detail branch spec
- [ ] `cd api && npm test` toàn bộ pass
- [ ] `npm test` (FE) không hồi quy (284+ tests)

## Success criteria
- Toàn bộ suite backend + frontend pass, không mock giả để qua bài. Coverage nhánh upload đủ (parse, dedup, detail branch).
