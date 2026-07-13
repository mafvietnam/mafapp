# Brainstorm Report: Trang Nhật ký chạy (Running Journal)

**Date:** 2026-07-13 | **Status:** Approved by user | **Next:** ck:plan

## Problem Statement

Nav "Nhật ký chạy" là placeholder `#` (desktop-top-nav.tsx:7, mobile-bottom-tabs.tsx:6). Dashboard chỉ show 10 run gần nhất. Chưa có nơi xem toàn bộ lịch sử + theo dõi tiến bộ MAF dài hạn — tính năng cốt lõi của app MAF (aerobic progress = pace@MAF cải thiện theo thời gian).

## Requirements (user-confirmed via AskUserQuestion)

1. **Scope v1: Full journal** — list nhóm theo tuần + stats header tháng + MAF trend chart
2. **Ghi chú chủ quan / manual entry: defer v2** — v1 read-only từ Strava sync
3. **Data source: Strava only** — Garmin chờ OAuth approval, thiết kế nguồn-trung-lập
4. **Điều hướng: load-more theo tuần** (cửa sổ thời gian, không month picker)

## Evaluated Approaches — analytics computation

| Approach | Verdict |
|---|---|
| **A. Client-side từ summary rows** (fetch cửa sổ 6 tháng qua `since`/`until` mới trên endpoint sẵn có; group/stats/trend bằng pure TS utils) | ✅ CHỌN. MAF formula giữ 1 chỗ ở FE (`calculateRawMaf`) — DRY. ~180 rows/6mo ≈ 75KB. Unit-testable theo pattern `maf-activity-analysis.ts`. |
| B. Server-side stats endpoint (Prisma groupBy) | ❌ Nhân đôi MAF zone logic sang NestJS, thêm backend surface. YAGNI. |
| C. Reuse pagination page/limit | ❌ Page boundary cắt ngang tuần → weekly totals sai. |

## Final Solution

### Backend (minimal)
- `StravaActivityQueryDto`: thêm `since`/`until` (ISO date, optional) + validate
- `strava.service.getActivities`: where `startDate >= since AND < until`
- Nới `limit` max (100 → 365) cho date-window query. Không model mới, không endpoint mới.

### Frontend (file mới <200 LOC/file)
- `src/pages/journal-page.tsx` — lazy route `/journal` (recharts chunk chung detail page)
- `src/hooks/use-journal-activities.ts` — fetch cửa sổ 6 tháng; "Tải thêm" = cửa sổ 6 tháng trước → tuần luôn trọn vẹn
- `src/utils/journal-analytics.ts` + tests — pure: `groupByWeek`, `monthlySummary` (km/buổi/%buổi in-zone), `mafTrendSeries`:
  - Primary: pace@MAF từ runs verdict `in` (reuse `verdict()` 3-state, zone [mafHr-10, mafHr])
  - Secondary: aerobic efficiency m/beat (reuse `aerobicEfficiency()`) mọi run có HR — chống thưa data
- `src/components/journal/`: `journal-stats-header.tsx`, `maf-trend-chart.tsx` (recharts LineChart), `week-group.tsx`, `journal-activity-row.tsx` (click → `/activities/:id`)
- Nav: 2 link `#` → `/journal`; dashboard ActivitySection "Xem tất cả" `#` → `/journal`

### Edge cases
- Chưa connect Strava → empty state + CTA (reuse pattern dashboard EmptyState)
- Run không HR → "—", loại khỏi %MAF denominator
- mafHr chưa có (profile thiếu) → banner nhắc cập nhật hồ sơ, ẩn chart + verdict
- Trend chart cần ≥3 điểm mới render, ngược lại empty message
- Duplicate activities: fetch với `excludeDuplicates=true` (đã có)

### Boundary với dashboard
Dashboard = snapshot (10 gần nhất + widgets). Journal = full history + long-term MAF analysis. `DesktopStatsRow` số giả hardcode ("7:15", "42.5km") có thể ăn số thật từ `journal-analytics` — **v2, ngoài scope**.

## Risks
- User chạy dày đặc >365 runs/6mo: limit cap chặn — chấp nhận, hiếm
- Pace@MAF thưa nếu user hay vượt zone → efficiency series là fallback signal
- Tuần bắt đầu thứ 2 (VN convention) — phải nhất quán trong groupByWeek + label

## Success Metrics
- `/journal` live cả mobile + desktop, nav không còn `#`
- Weekly totals khớp tay tính từ list
- Trend chart render đúng với data thật user Tony (Strava LIVE prod)
- Tests pass: journal-analytics unit tests + build + tsc clean

## Unresolved Questions
- None blocking. V2 backlog: notes/feeling model, manual entry (nút "+" dashboard), merge Garmin, feed DesktopStatsRow số thật.
