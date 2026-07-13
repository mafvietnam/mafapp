# Phase 04 — Detail Service UPLOAD Branch

**Priority:** P0 | **Status:** pending | **Depends:** 01 (source field), 03 (detail cache written)

## Overview
`getDetail()` hiện regex `/^\d+$/` trên stravaActivityId → ID `upload_...` fail → trả error. Thêm nhánh sớm cho `source===UPLOAD`: serve `StravaActivityDetail` đã ghi lúc upload, KHÔNG gọi Strava.

## Related files
- Modify: `api/src/strava/strava-detail.service.ts`

## Implementation
Trong `getDetail(userId, activity)`, TRƯỚC regex check:
```ts
if (activity.source === 'UPLOAD') {
  const cached = await this.prisma.stravaActivityDetail.findFirst({
    where: { stravaActivityId: activity.stravaActivityId, userId },
  });
  if (cached) return this.fromCacheRow(activity, cached);   // hydrated:true
  // fallback (upload thiếu detail — hiếm): trả detail rỗng, hydrated:true, streams:null
  return { activity, detail: null, streams: null, hydrated: true };
}
```
- KHÔNG áp CACHE_TTL cho upload (không self-heal từ Strava được → luôn phục vụ cache).
- `activity.source` có sau phase-01 (Prisma client regenerated). Type `StravaActivity` từ @prisma/client đã gồm `source`.

## Todo
- [ ] Nhánh source===UPLOAD trước regex numeric-id
- [ ] Fallback detail rỗng khi thiếu cache (không 500)
- [ ] `npx tsc --noEmit` pass

## Success criteria
- GET /strava/activities/:id/detail cho activity UPLOAD → trả streams+detail đã lưu, `hydrated:true`, 0 network call Strava. Regex numeric guard không còn chặn upload IDs.
