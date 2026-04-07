# Phase 4: MAF Lab Integration & Dashboard

## Context Links
- [Plan Overview](plan.md)
- [Phase 3 — Data Sync Engine](phase-03-data-sync-engine.md) (blocker)
- MAF Lab data entry: `src/components/maf-lab-step-data-entry.tsx`
- MAF Lab parent: `src/components/maf-lab.tsx`
- Dashboard page: `src/pages/dashboard-page.tsx`
- Dashboard widgets: `src/components/dashboard/desktop-stats-row.tsx`, `activity-section.tsx`
- Garmin frontend service: `src/services/garmin-service.ts` (Phase 2)

## Overview
- **Priority:** P1
- **Status:** Pending (blocked by Phase 3)
- **Effort:** 2 days
- **Description:** Wire synced Garmin data into MAF Lab auto-fill + connect card on Profile. Dashboard widgets and activity list deferred to future iteration.
<!-- Validation: Simplified scope — MAF Lab auto-fill + connect card only. Dashboard widgets + activity list deferred. -->

## Key Insights
- MAF Lab Step 2 (`maf-lab-step-data-entry.tsx`) accepts: `distance`, `hours/minutes/seconds`, `avgHr` — all as string state lifted from parent `maf-lab.tsx`
- Dashboard uses separate widget components in `src/components/dashboard/` — follow same pattern
- `desktop-stats-row.tsx` renders stat cards in a row — add Garmin stats to this row or create sibling widget
- Activity list already has a placeholder in `activity-section.tsx` — can extend or replace
- Frontend fetches data on mount via `useEffect` + service functions — consistent pattern
- All UI in Vietnamese — continue using Vietnamese labels

## Requirements

### Functional

**MAF Lab Auto-fill:**
- If user has Garmin connected AND has a running activity in last 7 days → auto-populate MAF Lab fields
- Auto-fill: `avgHr` from activity `avgHeartRate`, time fields from `duration`, distance from `distance`
- Show source label: "Tu Garmin: Chay ngay [date], avg HR [X]" above the HR input
- User can override any auto-filled value manually (fields remain editable)
- "Use in MAF Lab" button on each activity in the activity list → navigates to Lab tab with pre-filled data

**Dashboard Widgets:** DEFERRED to future iteration
**Activity List:** DEFERRED to future iteration

### Non-Functional
- Dashboard widgets load asynchronously — show skeleton while fetching
- Activity list uses pagination — don't load all at once
- No new API endpoints needed — all data available from Phase 3 endpoints
- Keep each new component under 200 lines

## Architecture

### Data Flow: MAF Lab Auto-fill

```
MafLab component mounts
  |
  v
useGarminAutoFill() custom hook
  |-- garminService.getGarminStatus()
  |     if not connected → return null
  |
  |-- garminService.getActivities(page=1, limit=1, type=RUNNING)
  |     get latest running activity
  |
  |-- if activity exists && startTime within 7 days:
  |     return { avgHr, duration, distance, activityDate }
  |
  v
MafLab receives autoFillData
  |-- pre-populate form fields
  |-- show "Tu Garmin" label
  |-- user can override
```

### Data Flow: Dashboard Widgets

```
DashboardPage mounts
  |
  v
useGarminDashboard() custom hook
  |-- garminService.getGarminStatus()
  |     if not connected → return null
  |
  |-- garminService.getDailySummary(from=today, to=today)
  |     get today's health data
  |
  |-- garminService.getDailySummary(from=7daysAgo, to=today)
  |     get weekly trend data
  |
  v
Render GarminHealthWidget + GarminWeeklyTrendWidget
```

### Component Tree (New)

```
src/components/
  garmin/
    garmin-health-widget.tsx       -- Dashboard: today's HR, steps, sleep
    garmin-weekly-trend.tsx         -- Dashboard: 7-day resting HR trend
    garmin-activity-list.tsx        -- Paginated activity list
    garmin-activity-row.tsx         -- Single activity row in list
    garmin-activity-detail.tsx      -- Full activity detail modal/view
    garmin-auto-fill-banner.tsx     -- "From Garmin" label in MAF Lab

src/hooks/
    use-garmin-auto-fill.ts        -- Hook: fetch latest run for MAF Lab
    use-garmin-dashboard.ts        -- Hook: fetch today's health data
```

## Related Code Files

### Files to Modify
| File | Change |
|------|--------|
| `src/components/maf-lab.tsx` | Integrate `useGarminAutoFill` hook, pass auto-fill data to Step 2 |
| `src/components/maf-lab-step-data-entry.tsx` | Add optional "From Garmin" banner above HR input |
| `src/pages/dashboard-page.tsx` | Add Garmin health widgets section |
| `src/services/garmin-service.ts` | Add `getActivities()`, `getDailySummary()` methods |
| `src/app.tsx` | Add `/activities` route if creating dedicated page |

### Files to Create
| File | Purpose |
|------|---------|
| `src/hooks/use-garmin-auto-fill.ts` | Fetch latest Garmin run for MAF Lab |
| `src/hooks/use-garmin-dashboard.ts` | Fetch today's health + weekly trend |
| `src/components/garmin/garmin-health-widget.tsx` | Dashboard health metrics card |
| `src/components/garmin/garmin-weekly-trend.tsx` | 7-day resting HR sparkline |
| `src/components/garmin/garmin-activity-list.tsx` | Paginated activity list with filters |
| `src/components/garmin/garmin-activity-row.tsx` | Single activity row component |
| `src/components/garmin/garmin-activity-detail.tsx` | Activity detail modal |
| `src/components/garmin/garmin-auto-fill-banner.tsx` | "From Garmin" label component |

## Implementation Steps

### Step 1: Extend garmin-service.ts with data methods

In `src/services/garmin-service.ts`, add:

```typescript
export interface GarminActivity {
  id: string;
  garminActivityId: string;
  activityType: string;
  startTime: string;
  duration: number;      // seconds
  distance: number | null; // meters
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  minHeartRate: number | null;
  avgPace: number | null;
  calories: number | null;
  vo2Max: number | null;
  trainingEffect: number | null;
  rawData: unknown;
}

export interface GarminDailySummary {
  id: string;
  date: string;
  steps: number | null;
  restingHeartRate: number | null;
  avgHeartRate: number | null;
  sleepDuration: number | null; // minutes
  sleepScore: number | null;
  stressAvg: number | null;
  calories: number | null;
  activeMinutes: number | null;
}

export interface PaginatedActivities {
  items: GarminActivity[];
  total: number;
  page: number;
  limit: number;
}

export async function getGarminActivities(
  page = 1, limit = 20, type?: string,
): Promise<PaginatedActivities | null> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (type) params.set('type', type);
  const res = await api.get(`/garmin/activities?${params}`);
  if (!res.ok) return null;
  return res.json();
}

export async function getGarminActivity(id: string): Promise<GarminActivity | null> {
  const res = await api.get(`/garmin/activities/${id}`);
  if (!res.ok) return null;
  return res.json();
}

export async function getGarminDailySummary(
  from: string, to: string,
): Promise<GarminDailySummary[]> {
  const res = await api.get(`/garmin/daily-summary?from=${from}&to=${to}`);
  if (!res.ok) return [];
  return res.json();
}

export async function triggerGarminSync(): Promise<boolean> {
  const res = await api.post('/garmin/sync');
  return res.ok;
}
```

### Step 2: Create use-garmin-auto-fill.ts hook

Create `src/hooks/use-garmin-auto-fill.ts`:

```typescript
import { useState, useEffect } from 'react';
import { getGarminStatus, getGarminActivities } from '../services/garmin-service';

interface AutoFillData {
  avgHr: string;
  hours: string;
  minutes: string;
  seconds: string;
  distance: string;
  activityDate: string;
  activityType: string;
}

export function useGarminAutoFill() {
  const [autoFill, setAutoFill] = useState<AutoFillData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const status = await getGarminStatus();
      if (!status?.connected) { setLoading(false); return; }

      const data = await getGarminActivities(1, 1, 'running');
      if (!data?.items.length) { setLoading(false); return; }

      const activity = data.items[0];
      const activityDate = new Date(activity.startTime);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      if (activityDate < sevenDaysAgo) { setLoading(false); return; }

      const totalSec = activity.duration;
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      const distKm = activity.distance ? (activity.distance / 1000).toFixed(2) : '';

      setAutoFill({
        avgHr: activity.avgHeartRate?.toString() ?? '',
        hours: h.toString(),
        minutes: m.toString(),
        seconds: s.toString(),
        distance: distKm,
        activityDate: activityDate.toLocaleDateString('vi-VN'),
        activityType: activity.activityType,
      });
      setLoading(false);
    }
    fetch();
  }, []);

  return { autoFill, loading };
}
```

### Step 3: Create garmin-auto-fill-banner.tsx

Create `src/components/garmin/garmin-auto-fill-banner.tsx`:

Small banner component displayed above MAF Lab form when auto-fill data is available:
- Green background with Garmin icon
- Text: "Tu Garmin: Chay ngay {date}, avg HR {hr} BPM"
- Small "X" button to dismiss and clear auto-fill
- Props: `activityDate: string`, `avgHr: string`, `onDismiss: () => void`

### Step 4: Integrate auto-fill into maf-lab.tsx

In `src/components/maf-lab.tsx`:

4.1. Import `useGarminAutoFill` hook
4.2. Call hook at component top level
4.3. When `autoFill` is available and user hasn't manually entered data yet:
- Set form state: `setAvgHr(autoFill.avgHr)`, `setHours(autoFill.hours)`, etc.
- Use a `useEffect` that runs once when autoFill arrives, respecting existing manual input
4.4. Pass `autoFill` data to `MafLabStepDataEntry` as optional prop for the banner display
4.5. Track `isAutoFilled: boolean` state — set false when user manually changes any field

### Step 5: Update maf-lab-step-data-entry.tsx

In `src/components/maf-lab-step-data-entry.tsx`:

5.1. Add optional props:
```typescript
garminSource?: { activityDate: string; avgHr: string } | null;
onDismissGarmin?: () => void;
```

5.2. Render `GarminAutoFillBanner` above the HR input field (item 3 in the form) when `garminSource` is provided:
```tsx
{garminSource && (
  <GarminAutoFillBanner
    activityDate={garminSource.activityDate}
    avgHr={garminSource.avgHr}
    onDismiss={onDismissGarmin!}
  />
)}
```

### Step 6: Create use-garmin-dashboard.ts hook

Create `src/hooks/use-garmin-dashboard.ts`:

```typescript
import { useState, useEffect } from 'react';
import { getGarminStatus, getGarminDailySummary, GarminDailySummary } from '../services/garmin-service';

interface GarminDashboardData {
  today: GarminDailySummary | null;
  weeklyTrend: GarminDailySummary[];
}

export function useGarminDashboard() {
  const [data, setData] = useState<GarminDashboardData | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const status = await getGarminStatus();
      if (!status?.connected) { setLoading(false); return; }
      setConnected(true);

      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const from = weekAgo.toISOString().split('T')[0];

      const summaries = await getGarminDailySummary(from, today);
      const todaySummary = summaries.find((s) => s.date.startsWith(today)) ?? null;

      setData({ today: todaySummary, weeklyTrend: summaries });
      setLoading(false);
    }
    fetch();
  }, []);

  return { data, connected, loading };
}
```

### Step 7: Create garmin-health-widget.tsx

Create `src/components/garmin/garmin-health-widget.tsx`:

Dashboard card showing today's Garmin health data. Follow existing `desktop-card` pattern:
- Three stat items in a row: Resting HR, Steps, Sleep
- Each with icon (Heart, Footprints, Moon from lucide-react), value, label
- If data is null/unavailable: show "--" placeholder
- Skeleton loading state matching existing dashboard cards

```
┌─────────────────────────────────────────────┐
│  Garmin Health - Hom nay                    │
│                                             │
│  ♥ 58 BPM       🦶 8,543      🌙 7h 23m    │
│  Nhip tim nghi  Buoc chan    Giac ngu       │
└─────────────────────────────────────────────┘
```

### Step 8: Create garmin-weekly-trend.tsx

Create `src/components/garmin/garmin-weekly-trend.tsx`:

Simple visual of last 7 days resting HR. Options (pick simplest):
- **Text row**: `Mon 58 | Tue 56 | Wed 59 | ...` with color coding (green if within MAF zone)
- **Bar chart**: 7 small vertical bars, height proportional to resting HR value
- Use inline SVG or simple div-based bars — no chart library (YAGNI)

Props: `weeklyData: GarminDailySummary[]`

### Step 9: Create garmin-activity-list.tsx + garmin-activity-row.tsx

Create `src/components/garmin/garmin-activity-list.tsx`:
- State: `activities`, `page`, `total`, `loading`, `typeFilter`
- Fetch on mount and on page/filter change via `getGarminActivities(page, 20, typeFilter)`
- Filter tabs: Tat ca | Chay | Di bo | Dap xe
- Pagination controls: Previous / Page X of Y / Next
- Each row rendered by `GarminActivityRow`

Create `src/components/garmin/garmin-activity-row.tsx`:
- Props: `activity: GarminActivity`, `onUseInLab?: (activity: GarminActivity) => void`
- Display: type icon, date (Vietnamese format), duration (hh:mm:ss), distance (km), avg HR (BPM)
- "Dung cho MAF Lab" button (only for running activities)
- Click row → expand detail or open modal

### Step 10: Create garmin-activity-detail.tsx

Create `src/components/garmin/garmin-activity-detail.tsx`:

Modal or expanded view showing full activity metrics:
- Activity type + date header
- Duration, distance, pace
- HR: avg, max, min
- Calories, VO2 max, training effect (if available)
- "Dung cho MAF Lab" button

### Step 11: Add widgets to dashboard-page.tsx

In `src/pages/dashboard-page.tsx`:

11.1. Import `useGarminDashboard`, `GarminHealthWidget`, `GarminWeeklyTrend`

11.2. Call `useGarminDashboard()` hook

11.3. In mobile layout, add after `MafZoneCard`:
```tsx
{garmin.connected && garmin.data && (
  <>
    <GarminHealthWidget today={garmin.data.today} loading={garmin.loading} />
    <GarminWeeklyTrend weeklyData={garmin.data.weeklyTrend} />
  </>
)}
```

11.4. In desktop layout, add Garmin widgets to the right column (after `MafAssistantCard`):
```tsx
{garmin.connected && garmin.data && (
  <>
    <GarminHealthWidget today={garmin.data.today} loading={garmin.loading} />
    <GarminWeeklyTrend weeklyData={garmin.data.weeklyTrend} />
  </>
)}
```

### Step 12: Add activity list to dashboard or as route

Option A (simpler — tab in dashboard): Add `GarminActivityList` below `ActivitySection` in dashboard.

Option B (dedicated route): Add `/activities` route in `app.tsx`:
```tsx
<Route path="/activities" element={<GarminActivityList />} />
```

**Choose Option A for MVP** — embed in dashboard `ActivitySection`, extend existing component.

### Step 13: Wire "Use in MAF Lab" navigation

<!-- RED TEAM: Finding #10 — Do NOT use URL params for data transfer (injection risk via crafted links). Use React state/context instead. -->
When user clicks "Dung cho MAF Lab" on an activity:
- Use React Router's `navigate('/plan', { state: { tab: 'LAB', garminActivity: { avgHr, duration, distance } } })`
- MAF Lab reads `location.state?.garminActivity` on mount, pre-fills form
- Validate all values: HR must be 30-250, duration > 0, distance >= 0
- Clear location state after consuming
- Do NOT use URL search params — crafted links could inject dangerous values

### Step 14: Build and test

```bash
npm run build
cd api && npm run build
```

Manual test checklist:
- Dashboard shows health widgets when Garmin connected
- Dashboard hides Garmin section when not connected
- MAF Lab auto-fills from latest Garmin run
- Dismissing auto-fill banner clears the data
- Activity list paginates and filters correctly
- "Use in MAF Lab" pre-fills correctly
- All components render correctly on mobile and desktop

## Todo List

- [ ] Extend `garmin-service.ts` with activity + summary fetch methods
- [ ] Create `use-garmin-auto-fill.ts` hook
- [ ] Create `garmin-auto-fill-banner.tsx` component
- [ ] Integrate auto-fill hook into `maf-lab.tsx`
- [ ] Add garmin source banner to `maf-lab-step-data-entry.tsx`
- [ ] Create `use-garmin-dashboard.ts` hook
- [ ] Create `garmin-health-widget.tsx` dashboard card
- [ ] Create `garmin-weekly-trend.tsx` sparkline widget
- [ ] Create `garmin-activity-list.tsx` with pagination + filters
- [ ] Create `garmin-activity-row.tsx` row component
- [ ] Create `garmin-activity-detail.tsx` detail modal
- [ ] Add Garmin widgets to `dashboard-page.tsx` (mobile + desktop)
- [ ] Add activity list to dashboard
- [ ] Wire "Use in MAF Lab" navigation with URL params
- [ ] Test auto-fill on MAF Lab
- [ ] Test dashboard widgets show/hide based on connection status
- [ ] Test activity list pagination and filtering
- [ ] Verify mobile + desktop responsive layouts
- [ ] Build check (frontend + backend)

## Success Criteria

- MAF Lab auto-fills HR, duration, distance from latest Garmin running activity (<7 days old)
- "Tu Garmin" banner shows source activity date and HR
- User can dismiss auto-fill and enter data manually
- Dashboard shows today's resting HR, steps, sleep when connected
- Dashboard hides Garmin section when not connected
- Activity list is paginated and filterable by type
- "Dung cho MAF Lab" button correctly pre-fills Lab form
- All components responsive (mobile + desktop)

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| No running activities in last 7 days | Medium | Low | Auto-fill simply not shown; user enters data manually |
| Daily summary data missing (device not synced) | Medium | Low | Show "--" for missing values; tooltip explaining sync delay |
| Activity type names inconsistent from Garmin | Medium | Medium | Normalize to uppercase in sync service; fallback to "OTHER" |
| Too many dashboard API calls on mount | Low | Medium | Hooks fetch in parallel; add SWR/cache if needed later |

## Security Considerations

- All data endpoints are JWT-protected — no unauthenticated access
- Activity detail with `rawData` may contain extra fields — sanitize before display if needed
- No PII in URL params (garmin_hr/duration/distance are non-identifying metrics)

## Next Steps

Phase 5 migrates from unofficial `garmin-connect` to official Garmin Health/Activity API, replacing credential-based auth with proper OAuth 2 PKCE redirect and polling with webhook push notifications.
