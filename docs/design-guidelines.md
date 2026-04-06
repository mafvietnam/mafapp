# Design Guidelines

## Visual Identity

### Color Palette

**MAF Brand Colors (Tailwind 3):**
- `maf-purple: #7e22ce` — Primary CTA, buttons, emphasis
- `maf-pink: #db2777` — Alerts, warnings, accent
- `maf-orange: #f97316` — Secondary actions, BASE level
- `maf-green: #10b981` — HEALTH level, success
- `maf-blue: #3b82f6` — Info, cross-training

**Commitment Level Colors:**
- HEALTH → green-500 (weight management)
- BASE → orange-500 (aerobic foundation)
- PERFORMANCE → purple-700 (race prep)

**Result Type Colors:**
- REST → gray-500
- LONG_RUN → orange-500
- RUN → purple-600
- WALK → green-600
- CROSS_TRAIN → blue-500
- RECOVERY → yellow-500

**Neutral Scale:**
- White: `#ffffff`
- Light gray: `#f3f4f6` (bg-gray-50)
- Medium gray: `#6b7280` (text-gray-500)
- Dark gray: `#1f2937` (text-gray-900)
- Black: `#000000`

### Typography

**Font Family:** Inter (system fallback: sans-serif)

**Scale:**
- h1: text-4xl, font-bold (page titles)
- h2: text-2xl, font-bold (section headers)
- h3: text-lg, font-semibold (subsection headers)
- Body: text-base, font-normal
- Small: text-sm, font-normal (captions, hints)

**Line Height:**
- Headings: 1.2
- Body: 1.6

---

## Layout Principles

### Responsive Design

**Breakpoints (Tailwind 3):**
- Mobile: 0–640px (default, no prefix)
- Tablet: 640px–1024px (`md:`)
- Desktop: 1024px+ (`lg:`)

**Mobile-first approach:**
```typescript
<div className="block md:hidden">    {/* mobile only */}</div>
<div className="hidden md:block">    {/* desktop only */}</div>
<div className="flex flex-col md:flex-row"> {/* stack → row */}</div>
```

### Container

- Max width: `max-w-7xl` (1280px)
- Centered: `mx-auto`
- Padding: `px-4` (mobile), `px-6` (desktop)

### Spacing

Tailwind scale (4px base):
- `gap-4` → 16px
- `gap-6` → 24px
- `p-4` → 16px padding
- `mt-8` → 32px margin-top

**Rhythm:** Use multiples of 4px (gap-4, gap-8, etc.)

---

## Component Styling

### Cards

```typescript
<div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
  {/* Content */}
</div>
```

**Variants:**
- Elevated: `shadow-md`
- Subtle: `shadow-sm`
- None: `shadow-none`

### Buttons

**Primary (CTA):**
```typescript
<button className="bg-maf-purple hover:bg-purple-700 text-white px-4 py-2 rounded-lg">
  Calculate
</button>
```

**Secondary:**
```typescript
<button className="bg-gray-100 hover:bg-gray-200 text-gray-900 px-4 py-2 rounded-lg">
  Cancel
</button>
```

### Form Inputs

```typescript
<input
  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-maf-purple"
  placeholder="Enter age"
/>
```

**States:**
- Default: `border-gray-300`
- Focus: `ring-2 ring-maf-purple`
- Error: `border-red-500 ring-red-500`
- Disabled: `bg-gray-100 cursor-not-allowed`

### Alerts & Modals

**Warning Card:**
```typescript
<div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
  <p className="text-yellow-800">⚠️ Important notice</p>
</div>
```

**Success Message:**
```typescript
<div className="bg-green-50 border-l-4 border-green-400 p-4 rounded">
  <p className="text-green-800">✅ Action completed</p>
</div>
```

### Tables

```typescript
<table className="w-full border-collapse">
  <thead className="bg-gray-100">
    <tr className="border-b border-gray-300">
      <th className="text-left py-3 px-4">Column</th>
    </tr>
  </thead>
  <tbody>
    <tr className="border-b border-gray-200 hover:bg-gray-50">
      <td className="py-3 px-4">Cell</td>
    </tr>
  </tbody>
</table>
```

---

## Animations & Interactions

### Transitions

```typescript
// Smooth color transition
<button className="transition-colors duration-200 hover:bg-purple-700">
  Hover me
</button>

// Smooth height transition
<div className="transition-all duration-300 ease-in-out">
  Expanding content
</div>
```

### Common Effects

```typescript
// Fade in
className="opacity-0 animate-fadeIn"

// Slide down
className="transform -translate-y-4 animate-slideDown"

// Pulse
className="animate-pulse" // For loading states
```

### Scroll Behavior

```typescript
// Smooth scroll to element
element.scrollIntoView({ behavior: 'smooth' });

// Used after calculation
resultRef.current?.scrollIntoView({ behavior: 'smooth' });
```

---

## Accessibility

### Color Contrast

All text meets WCAG AA standard:
- Normal text: 4.5:1 ratio minimum
- Large text (18pt+): 3:1 ratio minimum

**Test:** Use WebAIM contrast checker

### Semantic HTML

```typescript
<button>        {/* Not <div onClick> */}
<input>         {/* Not custom inputs */}
<nav>           {/* Not <div className="nav"> */}
<form>          {/* Wrap related inputs */}
<label>         {/* Associate with input id */}
```

### ARIA Labels

```typescript
<button aria-label="Open menu">☰</button>
<div role="alert">{errorMessage}</div>
<form aria-labelledby="form-title">
```

---

## Vietnamese Localization

### Language Direction

All text left-to-right (ltr). No RTL support needed.

### Text Sizing

Vietnamese words tend longer than English:
- Leave `overflow-hidden` only if necessary
- Prefer `text-wrap` for multi-line content
- Test phrases: "Chế độ thử thách" (probation mode)

### Date/Time Format

- Dates: `DD/MM/YYYY` (e.g., 30/03/2026)
- Time: 24-hour format (e.g., 14:30)
- Timezone: Asia/Ho_Chi_Minh

### Common UI Phrases

| English | Vietnamese |
|---|---|
| Calculate | Tính toán |
| Plan | Lịch tập |
| Lab | Phòng thí nghiệm |
| Health | Sức khỏe |
| Performance | Hiệu suất |
| Save | Lưu |
| Cancel | Hủy |
| Loading | Đang tải |

---

## Icon Usage

**Lucide React Icons:**
```typescript
import { Heart, Zap, Activity } from 'lucide-react';

<Heart className="w-6 h-6 text-maf-pink" />
```

**Sizes:**
- Small: `w-4 h-4`
- Medium: `w-6 h-6`
- Large: `w-8 h-8`

**Colors:**
- Primary: `text-maf-purple`
- Danger: `text-maf-pink` or `text-red-500`
- Success: `text-green-500`
- Neutral: `text-gray-500`

---

## Performance

### CSS Size

Tailwind production build: ~30KB gzipped (via purge)

### Lazy Loading

Images (if added):
```typescript
<img loading="lazy" src="..." alt="..." />
```

### Animation Performance

Avoid animating:
- ❌ `width`, `height` (causes reflow)
- ✅ `transform`, `opacity` (GPU-accelerated)

---

## Mobile UI Features (Recent Improvements)

**Modal Scroll Lock:** Prevent body scroll when modals open (April 2026 fix)
**Checkbox Touch Targets:** Min 44px for mobile (accessibility)
**Favicon:** MAF logo favicon added
**Safe Area Insets:** Respect iPhone notch/home indicator with `pb-safe` class
**Glass Morphism Cards:** Backdrop blur effect on modals (home_mobile.html prototype)

---

**Version:** 1.0.0 | **Last Updated:** April 6, 2026
