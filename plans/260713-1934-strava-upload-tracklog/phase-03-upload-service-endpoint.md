# Phase 03 — Upload Service + Controller Endpoint

**Priority:** P0 | **Status:** pending | **Depends:** 01 (schema), 02 (parsers)

## Overview
Orchestrate: nhận multipart → parse → hash ID → upsert `StravaActivity(UPLOAD)` + ghi `StravaActivityDetail(streamsJson/detailJson)` → dedup cross-source.

## Related files
- Create: `api/src/strava/strava-upload.service.ts`
- Create: `api/src/strava/strava-upload.controller.ts` (tách riêng — strava.controller.ts đã 196 LOC)
- Modify: `api/src/strava/strava.module.ts` (thêm controller + service; import `MulterModule`? — dùng `FilesInterceptor` không cần MulterModule config, memoryStorage mặc định)

## strava-upload.service.ts
```ts
async ingest(userId, buffer, filename): Promise<{ id; stravaActivityId; duplicate }> {
  const parsed = parseTracklog(buffer, filename);           // phase-02
  const contentHash = sha256(userId + '|' + parsed.startDate.toISOString() + '|' + Math.round(parsed.distance));
  const stravaActivityId = 'upload_' + contentHash.slice(0,24);
  const avgPace = parsed.distance>0 ? parsed.movingTime/60/(parsed.distance/1000) : null;
  // build streams -> reuse downsampleStreams (DRY): wrap points arrays as StravaStreamSet
  const streams = downsampleStreams(toStreamSet(parsed.points), 1000);   // {time,heartrate,velocitySmooth?,altitude?,distance?}
  const detail: WhitelistedDetail = { description: parsed.name, deviceName: 'Upload ('+ext+')', gearName: null, calories: parsed.calories, splitsMetric: [] };
  // upsert summary
  const activity = await prisma.stravaActivity.upsert({ where:{stravaActivityId}, update:data, create:{userId,stravaActivityId,source:'UPLOAD',...data}, select:{id,startDate} });
  // upsert detail cache (so detail page serves instantly, hydrated:true)
  await prisma.stravaActivityDetail.upsert({ where:{stravaActivityId}, update:{detailJson,streamsJson,fetchedAt:now}, create:{stravaActivityId,userId,detailJson,streamsJson} });
  const duplicate = await markDuplicateIfOverlap(userId, stravaActivityId, parsed.startDate); // ±5min vs source=STRAVA or Garmin
  return { id: activity.id, stravaActivityId, duplicate };
}
```
- `toStreamSet(points)`: cumulative `time` = t-t0 (s); `heartrate` từ hr (chỉ khi mọi point có hr, else bỏ heartrate → downsample trả null → chart ẩn nhưng summary vẫn có avgHR); `distance` cumulative; `altitude` từ ele; velocitySmooth optional (bỏ v1). **Quan trọng**: `downsampleStreams` cần time+heartrate mới trả streams; nếu file không HR → streamsJson=null (detail page HR chart ẩn, MAF analysis degrade — đúng).
- `markDuplicateIfOverlap`: tìm StravaActivity `source:STRAVA` hoặc GarminActivity trong ±5min; nếu có → set `isDuplicate:true` trên bản upload.
- Reuse `downsampleStreams`, `WhitelistedDetail` từ `strava-detail-transform.js`.

## strava-upload.controller.ts
```ts
@Controller('strava')
export class StravaUploadController {
  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseInterceptors(FilesInterceptor('files', 20, { limits: { fileSize: 5*1024*1024 } }))
  async upload(@Req() req, @UploadedFiles() files: Express.Multer.File[]) {
    // validate: files?.length, ext whitelist .gpx/.tcx (case-insensitive)
    // for each file: try ingest → collect {filename, ok, id?, duplicate?, error?}
    // return { results, imported, failed }
  }
}
```
- Per-file try/catch → 1 file lỗi không hạ cả batch. 400 nếu 0 file hợp lệ.
- ext không hợp lệ → result error 'unsupported_format'. Parser throw → error message an toàn (không leak nội dung file).

## Todo
- [ ] strava-upload.service.ts (<200 LOC; tách helper toStreamSet nếu cần)
- [ ] strava-upload.controller.ts
- [ ] Đăng ký vào strava.module.ts
- [ ] `@types/multer` devDep (nếu thiếu type Express.Multer.File)
- [ ] `npx tsc --noEmit` api/ pass

## Success criteria
- POST /strava/upload (multipart JWT) 1 GPX có HR → 201, StravaActivity(UPLOAD) + StravaActivityDetail tạo. Re-upload → cùng ID, không nhân bản. 0 file → 400. File >5MB → Multer 413/400.
