---
phase: 2
title: "Frontend Admin UI — Sidebar, Overview Page, Settings Card"
status: completed
effort: 0.5d
priority: P1
depends_on: [phase-01]
completed: 2026-05-18
---

# Phase 2 — Frontend Admin UI

## Context Links

- Plan overview: [plan.md](plan.md)
- Depends on: [phase-01-backend-admin-endpoints.md](phase-01-backend-admin-endpoints.md)
- Reference (Garmin pattern): [src/pages/admin/admin-garmin-page.tsx](../../src/pages/admin/admin-garmin-page.tsx), [src/pages/admin/admin-settings-page.tsx](../../src/pages/admin/admin-settings-page.tsx)

## Overview

Add Strava admin pages mirroring Garmin: sidebar link, overview page with connections table, and a Strava section in settings page. Extend `admin-service.ts` with typed wrappers.

## Key Insights

- Garmin uses **blue** color theme; Strava brand is **orange** — use `text-orange-400`, `bg-orange-500/10` etc. to differentiate at-a-glance
- Settings page currently has one card (Garmin); easy to copy-paste a sibling
- Sidebar `Tích hợp` section already exists — just add a new item
- Status colors map: CONNECTED→emerald, DISCONNECTED→slate, TOKEN_EXPIRED→yellow, ERROR→red (mirror Garmin)
- Avoid harsh DRY refactor of Garmin/Strava pages — they're parallel but each may diverge (KISS). Re-evaluate after Strava ships if real duplication emerges.

## Requirements

- New page at `/admin/strava` showing feature status + stats + connections table
- Strava section added to existing `/admin/settings` (below Garmin)
- Sidebar shows "Strava" under "Tích hợp"
- All wired through new endpoints from Phase 1

## Architecture

```
admin-sidebar.tsx ── adds NavLink → /admin/strava
admin-settings-page.tsx ── adds <StravaSettingsCard />
admin-strava-page.tsx (NEW) ── uses admin-service Strava methods
app.tsx ── registers /admin/strava route

admin-service.ts (extend):
  ├─ getAdminStravaOverview() → GET /admin/strava
  ├─ triggerAdminStravaSync(userId) → POST /admin/strava/:userId/sync
  ├─ getStravaSettings() → GET /admin/settings/strava
  └─ saveStravaSettings(...) → POST /admin/settings/strava
```

## Related Code Files

**Modify:**
- `src/components/admin/admin-sidebar.tsx` — add item
- `src/pages/admin/admin-settings-page.tsx` — add Strava card section
- `src/services/admin-service.ts` — add types + 4 methods
- `src/app.tsx` — register `<Route path="/admin/strava" element={<AdminStravaPage />} />`

**Create:**
- `src/pages/admin/admin-strava-page.tsx` (~200 LOC mirror of admin-garmin-page.tsx)

**Delete:** (none)

## Implementation Steps

### 1. Extend `admin-service.ts`

Append after Garmin section:
```typescript
/* ── Strava Admin ── */

export type StravaConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'TOKEN_EXPIRED' | 'ERROR';

export interface AdminStravaConnection {
  userId: string;
  userName: string;
  userEmail: string;
  userAvatar: string | null;
  stravaAthleteId: string | null;
  status: StravaConnectionStatus;
  lastSyncAt: string | null;
  lastSyncStartedAt: string | null;   // RT #9 — surface in-flight syncs
  lastSyncError: string | null;       // RT #9 — surface last failure to admin
  connectedAt: string;
  activityCount: number;
}

export interface AdminStravaOverview {
  featureEnabled: boolean;
  totalConnections: number;
  connections: AdminStravaConnection[];
}

export async function getAdminStravaOverview(): Promise<AdminStravaOverview | null> {
  try {
    const res = await api.get('/admin/strava');
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

export async function triggerAdminStravaSync(userId: string): Promise<boolean> {
  try {
    const res = await api.post(`/admin/strava/${userId}/sync`);
    return res.ok;
  } catch { return false; }
}

/* ── Strava Settings ── */

export interface StravaSettingsData {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  hasClientSecret: boolean;
  hasWebhookVerifyToken: boolean;
  webhookCallbackUrl: string;
}

export async function getStravaSettings(): Promise<StravaSettingsData | null> {
  try {
    const res = await api.get('/admin/settings/strava');
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

export async function saveStravaSettings(data: {
  clientId?: string;
  clientSecret?: string;
  webhookVerifyToken?: string;
  enabled?: boolean;
}): Promise<boolean> {
  try {
    const res = await api.post('/admin/settings/strava', data);
    return res.ok;
  } catch { return false; }
}
```

### 2. Update `admin-sidebar.tsx`

Add `Activity` to lucide imports. In `sections` array, modify "Tích hợp":
```typescript
{
  title: 'Tích hợp',
  items: [
    { to: '/admin/garmin', icon: Watch, label: 'Garmin Connect' },
    { to: '/admin/strava', icon: Activity, label: 'Strava' },   // NEW
  ],
},
```

### 3. Create `admin-strava-page.tsx`

Copy structure of `admin-garmin-page.tsx`. Substitutions:
- Title icon: `<Activity className="w-6 h-6 text-orange-400" />` (was `<Watch ... text-blue-400 />`)
- Page title: "Strava"
- Subtitle: "Quản lý kết nối Strava của người dùng."
- Replace `garminUserId` → `stravaAthleteId` (athlete ID column)
- **Remove the "Backfill" column entirely** — Strava has no `backfillStatus`. Explicitly delete:
  - `<th>Backfill</th>` header row entry (~ line 128 in garmin page)
  - `<td>{c.backfillStatus}</td>` body cell (~ line 165 in garmin page)
  - Any `<colgroup>` or column-width reference to backfill
- **Add a "Last Error" column** (RT #9) — render `c.lastSyncError` truncated to 60 chars with tooltip showing full text; render emerald check when null. Helps admin see failures without checking server logs.
- Service call: `getAdminStravaOverview()` instead of `getAdminGarminOverview()`
- Sync action: `triggerAdminStravaSync(userId)` instead of `triggerAdminGarminSync(userId)`
- Empty state icon: `<Activity />`
- Sync button color: `text-orange-400 border-orange-500/30 hover:bg-orange-500/10`
- Stats card "Đang bật" color stays emerald (consistent UX)
- After save in settings page, surface `webhookResubscribed: true` as a toast and `webhookResubscribeError` as a red banner (RT #8)

Pseudo-skeleton:
```typescript
import { useState, useEffect } from 'react';
import { Activity, RefreshCw, CheckCircle, XCircle, AlertTriangle, Loader2, Clock } from 'lucide-react';
import {
  getAdminStravaOverview,
  triggerAdminStravaSync,
  type AdminStravaConnection,
} from '../../services/admin-service';

const statusConfig: Record<string, { bg: string; text: string; label: string; icon: typeof CheckCircle }> = {
  CONNECTED: { /* emerald */ },
  DISCONNECTED: { /* slate */ },
  TOKEN_EXPIRED: { /* yellow */ },
  ERROR: { /* red */ },
};

export default function AdminStravaPage() {
  const [connections, setConnections] = useState<AdminStravaConnection[]>([]);
  // ... same hooks pattern as Garmin
}
```

**File size constraint:** target < 200 LOC. If approaching, extract `statusConfig` + `timeAgo` into `src/components/admin/connection-status-utils.ts` and reuse from both pages (consider only if both pages hit the limit).

### 4. Extend `admin-settings-page.tsx`

After the Garmin OAuth card `</div>` closing, insert a sibling card:

```tsx
{/* Strava OAuth Settings */}
<StravaSettingsCard />
```

Two implementation options:
- **(a)** Inline same as Garmin (~110 LOC) — keeps single-file simplicity but pushes file > 200 LOC.
- **(b)** Extract `StravaSettingsCard` into `src/components/admin/strava-settings-card.tsx` AND refactor Garmin into `garmin-settings-card.tsx` (per CLAUDE.md 200-LOC rule).

**Choose (b)** — file is already at 199 LOC, adding inline pushes over. Extract both into sibling files.

`strava-settings-card.tsx` mirrors Garmin with these fields:
- Client ID (text input)
- Client Secret (password input with eye toggle)
- Webhook Verify Token (text input — also masked treatment, save-on-blur or "regenerate" button optional)
- Webhook Callback URL (read-only display, copy button) — show value from `webhookCallbackUrl`
- Enable toggle (top-right, same pattern)
- Status line bottom: ✅ "Strava OAuth đang hoạt động" when `enabled && hasClientSecret && hasWebhookVerifyToken`
- Color theme: orange (`text-orange-400`, `from-orange-500 to-orange-600` save button)
- Icon: `<Activity className="w-5 h-5 text-orange-400" />`

Form state additions (vs Garmin):
```typescript
const [webhookVerifyToken, setWebhookVerifyToken] = useState('');
const [showVerifyToken, setShowVerifyToken] = useState(false);
```

Save payload only includes `webhookVerifyToken` if user typed a new value (same pattern as `clientSecret`).

### 5. Register route in `app.tsx`

```typescript
import AdminStravaPage from './pages/admin/admin-strava-page';
// ...
<Route path="/admin/strava" element={<AdminStravaPage />} />   // place next to /admin/garmin
```

### 6. Visual sanity check

- Sidebar: Strava appears below Garmin under "Tích hợp"
- Click → loads `/admin/strava` page with empty state (no connections yet)
- Navigate to `/admin/settings` → see two cards stacked (Garmin top, Strava below)
- Enter dummy Client ID + Secret + Verify Token → save → reload → masked values shown, `hasClientSecret: true`

## Todo List

- [ ] Add 4 Strava methods + types to `admin-service.ts`
- [ ] Add Strava sidebar item with Activity icon
- [ ] Create `admin-strava-page.tsx` (< 200 LOC)
- [ ] Extract `garmin-settings-card.tsx` from settings page
- [ ] Create `strava-settings-card.tsx`
- [ ] Refactor `admin-settings-page.tsx` to compose both cards
- [ ] Register `/admin/strava` route in `app.tsx`
- [ ] `npm run build` clean (frontend)
- [ ] Manual smoke test: sidebar nav, empty page render, settings form save

## Success Criteria

- Frontend builds with no TS errors
- Visiting `/admin/strava` as ADMIN role shows feature status + stats + empty connections table
- Saving Strava settings via UI persists to DB (verify with `psql` SELECT on `app_setting`)
- Re-opening settings shows `Đã lưu (nhập mới để thay đổi)` placeholder on secrets
- No regression on `/admin/garmin` or Garmin settings card

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Garmin settings card refactor breaks existing flow | Keep prop names identical; manual test save flow |
| Sidebar layout breaks if "Tích hợp" section gets too tall | Two items only — safe |
| `app.tsx` route order matters (admin routes inside AdminLayout) | Place inside existing `<AdminLayout>` block, mirror Garmin route position |

## Security Considerations

- Admin-only routes — protected by `AdminProtectedRoute`
- Secrets never pre-filled in form inputs (placeholder only)
- Client Secret + Verify Token rendered with toggleable visibility
- Webhook Callback URL is non-sensitive — safe to display

## Next Steps

→ Phase 3 (bundled fixes + E2E test) — can run in parallel with this phase since file scopes don't overlap
