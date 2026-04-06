# Phase 5: Dashboard UI

## Context
- [Mobile Mockup](../../home_mobile.html) — glass-card design, bottom tabs
- [Desktop Mockup](../../home_pc.html) — solid-card design, top nav, 12-col grid
- [Design Guidelines](../../docs/design-guidelines.md)
- [SP2 Frontend Phase](../260331-0121-maf-platform-sp2-sp7/phase-02-sp2-frontend.md) — full dashboard spec (reference)

## Overview
- **Priority:** P1
- **Status:** Complete
- **Effort:** 3 days
<!-- Updated: Validation Session 1 - reduced scope to essential widgets only -->
- **Blocked by:** Phase 4

Build authenticated dashboard with essential widgets only. Dark theme for all authenticated pages. Responsive: mobile (glass-card stack with bottom tabs) and desktop (top nav with 12-col grid). Non-essential widgets (ecosystem icons, assistant card, stats row) deferred — show simple placeholders. Strava-dependent sections show empty states.
<!-- Updated: Validation Session 1 - MVP scope: MAF zone + profile + nav only, other widgets as empty placeholders -->

## Key Insights
- **Two design systems:** Mobile uses glassmorphism (backdrop-blur, transparent cards), desktop uses solid cards (gray-900)
- **Brand gradient:** `from-[#F42A68] to-[#9130F8]` used for accent elements
- **Dark background:** Mobile `bg-slate-950` with banner image overlay; Desktop `bg-[#0B1121]`
- **MAF zone card** — renders from user profile (calculated client-side, no API needed)
- **Activity history, trend chart, MAF test** — require Strava data → show empty states with "Connect Strava" CTA
- Existing calculator at `/` stays light theme — dark theme only for authenticated routes

## Requirements

### Functional (MVP — Validated)
- App layout shell (dark theme, responsive nav)
- Desktop top navigation bar (from home_pc.html)
- Mobile bottom tab bar (from home_mobile.html)
- Dashboard page with MAF zone card (calculated from user profile)
- Simple placeholders for future widgets (ecosystem, assistant, stats, chart)
- Empty states for Strava-dependent widgets
<!-- Updated: Validation Session 1 - MAF formula widget, ecosystem icons, assistant card deferred -->

### Non-Functional
- Mobile: matches `home_mobile.html` layout
- Desktop: matches `home_pc.html` layout (12-col grid, 8:4 split)
- WCAG AA contrast on dark backgrounds
- Smooth animations (hover, tab transitions)
- No console errors in production build

## Architecture

### Design Tokens

| Token | Mobile (glass) | Desktop (solid) |
|-------|---------------|-----------------|
| Background | `bg-slate-950` + banner overlay | `bg-[#0B1121]` |
| Card bg | `rgba(255,255,255,0.05)` + `backdrop-blur(28px)` | `#111827` (gray-900) |
| Card border | `rgba(255,255,255,0.15)` | `rgba(255,255,255,0.05)` |
| Card radius | `rounded-[20px]` | `rounded-[16px]` |
| Brand gradient | `from-[#F42A68] to-[#9130F8]` | Same |
| Primary text | `text-white` | `text-white` |
| Secondary text | `text-white/60` to `text-white/80` | `text-slate-400` to `text-slate-500` |
| Label text | `text-[10px] uppercase tracking-wider font-bold` | `text-xs uppercase tracking-widest font-bold` |
| Value text | `text-2xl font-black` | `text-3xl font-black` |

### File Structure (MVP — Red Team reduced)

```
src/components/
├── layout/
│   ├── app-layout.tsx              — Dark theme shell with responsive nav
│   ├── desktop-top-nav.tsx         — Sticky glass-nav, max-w-[1440px]
│   └── mobile-bottom-tabs.tsx      — Glass-card bottom bar, rounded-t-[32px]
├── ui/
│   └── dashboard-card.tsx          — Single responsive card (glass on mobile, solid on desktop via CSS)
├── dashboard/
│   └── maf-zone-card.tsx           — "Vung Nhip Tim MAF 135-145 BPM" (the one functional widget)

src/pages/
└── dashboard-page.tsx              — Authenticated home page (zone card + generic "Coming soon" placeholders)
```
<!-- Red Team: Reduced from 14 files to 6. Ecosystem/assistant/formula/stats/empty-state components
     replaced by inline "Coming soon" text in dashboard-page. Single card component with responsive
     CSS instead of two separate glass-card + desktop-card components. -->

### Mobile Layout (< 768px)

```
┌──────────────────────┐
│ Header: MAF RUNNING  │ ← gradient italic brand + avatar
│ (banner bg overlay)  │
├──────────────────────┤
│ ♥ MAF Zone 135-145   │ ← glass-card, gradient icon
├──────────────────────┤
│ 🤖 MAF Assistant     │ ← glass-card placeholder
├──────────────────────┤
│ ○ ○ ○ ○ Ecosystem    │ ← expandable icons
├──────────────────────┤
│ Empty: Connect Strava│ ← empty state for activities
├──────────────────────┤
│ [Home][History][+][Community][Profile] │
└──────────────────────┘
```

### Desktop Layout (>= 1024px)

```
┌─────────────────────────────────────────────────┐
│ Top Nav: MAF RUNNING | Menu links | 🔔 | Avatar │
├──────────────────────────────────────────────────┤
│ Welcome: "Tong quan hieu suat"  [+ Ghi moi]     │
├────────────────────────────┬─────────────────────┤
│ [HR Zone] [Avg Pace] [Dist]│ 🤖 MAF AI Assistant │
├────────────────────────────┤                     │
│ Chart: Empty state / placeholder │ MAF Formula    │
├────────────────────────────┤                     │
│ Activity: Empty state      │ Ecosystem Links     │
└────────────────────────────┴─────────────────────┘
```

## Related Code Files

### Files to Create (MVP — 6 files)
- `src/components/layout/app-layout.tsx`
- `src/components/layout/desktop-top-nav.tsx`
- `src/components/layout/mobile-bottom-tabs.tsx`
- `src/components/ui/dashboard-card.tsx` — single responsive card
- `src/components/dashboard/maf-zone-card.tsx` — the one functional widget
- `src/pages/dashboard-page.tsx` — zone card + inline "Coming soon" placeholders
<!-- Red Team: Reduced from 14 files to 6. Other widgets deferred. -->

### Files to Modify
- `src/app.tsx` — add /dashboard route with AppLayout
- `tailwind.config.js` — add dark theme colors (maf-dark, maf-red, maf-violet)

### Files Unchanged
- All existing `src/components/*.tsx` — calculator UI untouched
- All existing `src/hooks/*.ts` — calculator hooks untouched
- All existing `src/utils/*.ts` — calculation logic untouched

## Implementation Steps

1. Update `tailwind.config.js` with new design tokens:
   ```js
   colors: {
     'maf-dark': '#0B1121',
     'maf-red': '#F42A68',
     'maf-violet': '#9130F8',
     'dark-card': '#111827',
   }
   ```

2. Create `src/components/ui/glass-card.tsx`:
   - Props: `className`, `children`, `onClick`
   - CSS: `bg-white/5 backdrop-blur-[28px] border border-white/15 rounded-[20px] shadow-[0_8px_32px_rgba(0,0,0,0.3)]`

3. Create `src/components/ui/desktop-card.tsx`:
   - Props: `className`, `children`
   - CSS: `bg-gray-900 border border-white/5 rounded-[16px] shadow-[0_4px_20px_rgba(0,0,0,0.2)]`

4. Create `src/components/layout/desktop-top-nav.tsx` (from home_pc.html):
   - Sticky, glass-nav: `rgba(11,17,33,0.7)` + `backdrop-blur(20px)`
   - Left: MAF RUNNING gradient logo + menu links
   - Right: notification bell + user menu (name, avatar from auth context)
   - Max width: 1440px centered

5. Create `src/components/layout/mobile-bottom-tabs.tsx` (from home_mobile.html):
   - Glass-card bottom bar with `rounded-t-[32px]`
   - 5 tabs: Trang chu, Lich su, (+) gradient center, Cong dong, Ho so
   - Center "+" button: 60px gradient circle, -top-6 offset

6. Create `src/components/layout/app-layout.tsx`:
   - Dark theme shell: `bg-[#0B1121] min-h-screen`
   - Renders desktop-top-nav on lg:, mobile header + bottom-tabs on mobile
   - Content area with `<Outlet />`

7. Create dashboard widget components:
   - `maf-zone-card.tsx` — gradient heart icon, MAF zone from user profile, formula badge
   - `maf-assistant-card.tsx` — bot icon, feature list, placeholder CTA
   - `ecosystem-icons.tsx` — 4 circular icons with hover-expand (mobile)
   - `ecosystem-links-widget.tsx` — list with chevrons (desktop sidebar)
   - `maf-formula-widget.tsx` — age input + adjustment selector (desktop sidebar)
   - `weekly-stats-row.tsx` — 3 stat cards (placeholder values, desktop)
   - `activity-empty-state.tsx` — "Connect Strava to see activities" message
   - `chart-empty-state.tsx` — "No trend data yet" placeholder

8. Create `src/pages/dashboard-page.tsx`:
   - Mobile: single column scroll (glass-card stack, banner bg overlay)
   - Desktop: 12-col grid (8:4 split)
   - Uses auth context for user data, useUserProfile for MAF zone calculation

9. Update `src/app.tsx`:
   - Add dashboard route: `/dashboard` → `<ProtectedRoute>` → `<AppLayout>` → `<DashboardPage>`
   - Profile route: `/profile` → `<ProtectedRoute>` → `<AppLayout>` → `<ProfilePage>`

10. Polish: dark-themed loading skeletons, smooth tab transitions

## Todo List
- [x] Tailwind config updated with dark theme colors
- [x] Glass-card and desktop-card UI components
- [x] Desktop top navigation bar (glass-nav)
- [x] Mobile bottom tab bar (glass-card, rounded-t-[32px])
- [x] App layout shell (dark theme, responsive)
- [x] MAF zone card (calculated from profile)
- [x] MAF assistant card (placeholder)
- [x] Ecosystem icons (mobile) + links widget (desktop)
- [x] MAF formula widget (desktop sidebar)
- [x] Weekly stats row (placeholder values)
- [x] Activity empty state ("Connect Strava" CTA)
- [x] Chart empty state
- [x] Dashboard page: mobile layout (glass-card stack)
- [x] Dashboard page: desktop layout (12-col grid)
- [x] Routes wired: /dashboard, /profile within AppLayout

## Success Criteria
- Dashboard mobile: matches `home_mobile.html` layout (glass-cards, bottom tabs, banner bg)
- Dashboard desktop: matches `home_pc.html` layout (top nav, 12-col grid, sidebar widgets)
- MAF zone card shows correct HR zone from user profile
- Strava-dependent sections show appropriate empty states
- Navigation between tabs works (Home, History, Profile)
- Dark theme contrast meets readability requirements
- Calculator at `/` unaffected (light theme preserved)
- No console errors in production build

## Risk Assessment
| Risk | Mitigation |
|------|------------|
| Glass-card backdrop-blur performance on older mobile | Test on real devices; fallback: semi-transparent solid |
| Too many new components | Each component small (<100 LOC), reusable |
| Dark/light theme conflict | Dark theme only inside AppLayout; `/` route has no AppLayout |

## Security Considerations
- User data (name, avatar) from auth context — no additional API calls
- Navigation links sanitized (no user-generated URLs)
- No sensitive data in dashboard widgets

## Next Steps
- Phase 6: Integration testing + production deploy
- Separate developer: Strava integration fills empty state widgets with real data
