# Phase 02 — Tracklog Parsers (GPX/TCX, pure utils)

**Priority:** P0 | **Status:** pending | **Depends:** none (pure)

## Overview
Parser thuần (no HTTP/Prisma) chuyển GPX/TCX → normalized summary + streams. Testable độc lập.

## Related files (all new, `api/src/strava/tracklog/`)
- `tracklog-types.ts` — shared interfaces
- `haversine.ts` — distance từ lat/lon
- `gpx-parser.ts` — parse GPX
- `tcx-parser.ts` — parse TCX
- `tracklog-parser.ts` — dispatcher (detect format từ nội dung) + summary builder
- Modify: `api/package.json` — thêm `fast-xml-parser` (+ đảm bảo `@types/multer` devDep cho phase 03)

## Data contracts
```ts
// tracklog-types.ts
export interface TrackPoint { t: number; lat?: number; lon?: number; ele?: number; hr?: number; distM?: number; }
export interface ParsedTracklog {
  name: string; type: string;           // 'Run' default
  startDate: Date;
  distance: number;                     // meters
  movingTime: number; elapsedTime: number; // seconds
  avgHeartRate: number | null; maxHeartRate: number | null;
  totalElevationGain: number | null;
  calories: number | null;              // TCX only
  points: TrackPoint[];                 // ordered
}
```

## Implementation
1. `haversine.ts`: `distanceMeters(lat1,lon1,lat2,lon2)` (R=6371000). Cumulative distance helper.
2. `gpx-parser.ts` (fast-xml-parser, `ignoreAttributes:false`, entities off → XXE-safe):
   - đọc `trk>trkseg>trkpt[@lat,@lon]`, con `time`, `ele`, `extensions>gpxtpx:TrackPointExtension>gpxtpx:hr` (fallback `ns3:hr`, `hr`).
   - distance = cumulative haversine; ele gain = tổng Δele dương (threshold 1m chống nhiễu).
   - name từ `trk>name` fallback `metadata>name` fallback "Uploaded run".
   - type: `trk>type` nếu là số Strava (9=run) hoặc string; default 'Run'.
3. `tcx-parser.ts`:
   - `Activities>Activity[@Sport]`, `Lap>Track>Trackpoint`: `Time`, `HeartRateBpm>Value`, `DistanceMeters`, `AltitudeMeters`, `Position>LatitudeDegrees/LongitudeDegrees`.
   - distance ưu tiên `DistanceMeters` (cứu treadmill); fallback haversine nếu thiếu.
   - calories = tổng `Lap>Calories`. elapsedTime = last-first Time. movingTime = tổng `Lap>TotalTimeSeconds` nếu có, else elapsed.
4. `tracklog-parser.ts`:
   - `detectFormat(xml)`: chứa `<TrainingCenterDatabase` → tcx; `<gpx` → gpx; else throw `UnsupportedTracklogError`.
   - `parseTracklog(buffer, filename)`: decode utf-8, detect, gọi parser, build summary:
     - avgHR = mean HR các point có hr (round); maxHR = max.
     - movingTime: nếu parser không cấp → elapsed - (khoảng dừng >... ) → v1 KISS: movingTime = elapsedTime khi thiếu.
     - avgPace = distance>0 ? movingTime/60/(distance/1000) : null.
     - reject nếu `points.length<2` hoặc `distance<=0 && no hr` → `EmptyTracklogError`.

## Todo
- [ ] `fast-xml-parser` cài vào api/package.json
- [ ] haversine + cumulative
- [ ] gpx-parser (HR extension đủ namespace variants)
- [ ] tcx-parser (DistanceMeters ưu tiên, calories)
- [ ] dispatcher + detect + validation errors
- [ ] mỗi file <200 LOC, kebab-case

## Success criteria
- Parse GPX Strava thật (có HR) → distance/avgHR/points đúng. TCX treadmill (no GPS) → distance từ DistanceMeters. Malformed → throw error rõ, không crash.
