# Phase 05 — Frontend Upload UI

**Priority:** P1 | **Status:** pending | **Depends:** 03 (endpoint)

## Overview
Card upload file trên dashboard (phương án khi hết slot / bổ sung cho user đã connect). Multi-file picker `.gpx/.tcx` → POST /strava/upload → hiển thị kết quả từng file + refresh activity list.

## Related files
- Modify: `src/services/strava-service.ts` — thêm `source` vào interface `StravaActivity`; thêm `uploadTracklog(files): Promise<UploadResult>`.
- Create: `src/components/tracklog-upload-card.tsx` (<200 LOC)
- Modify: `src/pages/dashboard-page.tsx` — render `<TracklogUploadCard onImported={refetch}/>` cạnh StravaConnectCard.
- (optional) `src/components/strava-connect-card.tsx` — khi capReached, thêm câu gợi ý "Bạn có thể tải lên file tracklog bên dưới."

## Service fn
```ts
export interface UploadResultItem { filename: string; ok: boolean; id?: string; duplicate?: boolean; error?: string; }
export interface UploadResult { results: UploadResultItem[]; imported: number; failed: number; }
export async function uploadTracklog(files: File[]): Promise<UploadResult | null> {
  const fd = new FormData();
  for (const f of files) fd.append('files', f);
  const res = await api.postForm('/strava/upload', fd);   // check api-client hỗ trợ multipart; nếu chưa → dùng fetch trực tiếp giữ Authorization
  if (!res.ok) return null;
  return res.json();
}
```
- **Kiểm tra `api-client.ts`**: nếu chưa có helper multipart (postForm), thêm 1 helper KHÔNG set Content-Type (browser tự set boundary) nhưng giữ Authorization/cookie như các call khác.

## tracklog-upload-card.tsx
- `<input type="file" accept=".gpx,.tcx" multiple>` (ẩn) + nút "Tải lên file GPX/TCX".
- State: idle → uploading (Loader2) → done (list kết quả: ✓ tên file + link detail / ⚠ duplicate / ✗ error).
- Hướng dẫn ngắn: "Vào Strava → hoạt động → ⋯ → Export GPX, rồi tải lên đây."
- Sau done: gọi `onImported()` để dashboard refetch danh sách.
- Style theo `desktop-card`, tiếng Việt, icon lucide (Upload, CheckCircle, AlertCircle).

## Todo
- [ ] `source` field vào StravaActivity interface (FE)
- [ ] uploadTracklog() + multipart helper trong api-client nếu cần
- [ ] tracklog-upload-card.tsx
- [ ] Gắn vào dashboard-page
- [ ] `npm run build` (FE) pass, `npx tsc --noEmit` pass

## Success criteria
- Chọn 1 GPX → upload → thấy "✓ Đã nhập" + link → click mở detail page render HR chart. Chọn file .txt → client chặn (accept) / server trả error hiển thị.
