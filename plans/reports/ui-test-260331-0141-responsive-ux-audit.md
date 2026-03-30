# UI/UX Responsive Test Report — app.maf.run

**Date:** 2026-03-31 | **Tested by:** Automated (Playwright) | **Branch:** dev

---

## Test Matrix

| Viewport | Device | Resolution | Status |
|----------|--------|------------|--------|
| PC | Desktop | 1440x900 | PASS |
| Tablet | iPad | 768x1024 | PASS (minor) |
| Mobile | iPhone 13 | 375x812 | ISSUES FOUND |

---

## Overall Assessment: **PASS with 6 issues**

| Severity | Count |
|----------|-------|
| Critical | 0 |
| Major | 2 |
| Minor | 3 |
| Info | 1 |

---

## Issues Found

### MAJOR-1: Welcome Modal Not Blocking Background Content (Mobile)
- **Viewport:** 375x812 (mobile)
- **Description:** Welcome modal does not fully overlay the page. Underlying content (commitment cards, form sections) is visible and scrollable behind/below the modal.
- **Expected:** Modal should overlay entire viewport with a semi-transparent backdrop, preventing background interaction/scrolling.
- **Impact:** Users may interact with form elements behind the modal. Confusing UX on first visit.
- **Fix:** Add `position: fixed; inset: 0; z-index: 50; overflow-y: auto` to modal container. Add backdrop with `bg-black/50` and `body { overflow: hidden }` when modal is open.

### MAJOR-2: Checkbox Touch Targets Too Small (Mobile)
- **Viewport:** 375x812 (mobile)
- **Details:** 4 checkbox inputs measured at **13x24px** — far below the 44x44px minimum recommended by Apple/Google for touch targets.
- **Affected:** MAF Lab checklist (4 checkboxes), Health section checkboxes (2 checkboxes)
- **Impact:** Difficult to tap on mobile devices. Users may miss or accidentally toggle wrong checkbox.
- **Fix:** Increase clickable area via padding or use a larger custom checkbox component. The label `<div>` wrapping each checkbox should have `min-h-[44px]` and the checkbox itself should have at least a 44px hit area.

### MINOR-1: favicon.svg Returns 404
- **All viewports**
- **Console error:** `Failed to load resource: the server responded with a status of 404 () @ https://app.maf.run/favicon.svg`
- **Fix:** Add `favicon.svg` to `public/` directory, or update `index.html` to reference existing favicon.

### MINOR-2: `/guide` Route Falls Back to Calculator
- **All viewports**
- **Description:** Navigating to `https://app.maf.run/guide` shows the main calculator page instead of the guide content. The route seems to exist (commit `8b3d077` added it) but Nginx SPA fallback serves `index.html` and the route may not be registered in current React Router or the component doesn't render.
- **Fix:** Verify guide route is registered in React Router. Check if component renders conditionally.

### MINOR-3: Header Image Responsive Sizing (Tablet)
- **Viewport:** 768x1024
- **Description:** Header banner image at tablet width creates slightly awkward proportions — text overlay ("MAF Running Coach" + subtitle) gets compressed.
- **Impact:** Cosmetic, text still readable.
- **Fix:** Consider `object-cover` with fixed `h-[150px]` for tablet breakpoint, or hide subtitle on smaller tablets.

### INFO-1: `<link rel=preload>` Warning on /guide
- **Console warning:** `<link rel=preload> uses an unsupported 'as' value`
- **Impact:** None visible, but indicates unused preload directive.

---

## Viewport-Specific Findings

### PC (1440x900) — PASS
- Layout is clean and well-spaced
- Commitment cards display in 3-column row — good
- Schedule table has proper column widths
- Results section readable with adequate whitespace
- Footer positioned correctly
- No horizontal overflow
- No console errors (except favicon 404)

### Tablet (768x1024) — PASS (minor)
- Layout adapts: input form goes to 2-column, commitment cards stack to 2+1
- Schedule table readable but text wraps more
- "Quy Tắc Vàng" (Golden Rules) section slightly cramped
- Tab navigation ("Kế Hoạch" / "Phòng MAF Test") fits well
- Overall: functional, minor cosmetic issues only

### Mobile (375x812) — ISSUES FOUND
- **Welcome modal:** Background content visible (MAJOR-1)
- **Checkbox hit areas:** 13x24px, far too small (MAJOR-2)
- **No horizontal overflow:** Good, no horizontal scrolling
- **Form inputs:** Age/Height/Weight fields adequate size
- **Commitment cards:** Stack vertically, readable
- **Schedule table:** Text wraps but remains legible
- **MAF Lab:** Clean layout, 3-step wizard works well on mobile
- **Calculate button:** Good size, prominent
- **Results section:** Heart rate card, golden rules, schedule all render correctly
- **Footer:** Proper positioning

---

## Accessibility Notes

| Check | Result |
|-------|--------|
| Touch targets (44px min) | FAIL — checkboxes 13x24px |
| Horizontal scroll | PASS — no overflow at any viewport |
| Text readability | PASS — font sizes adequate |
| Color contrast | PASS — dark text on light backgrounds |
| Form labels | PARTIAL — inputs use placeholder-style labels, not `<label>` elements |
| ARIA roles | PARTIAL — checkboxes have labels, but generic divs used instead of semantic elements |

---

## Recommendations (Priority Order)

1. **Fix modal overlay** on mobile — add fixed positioning + backdrop
2. **Increase checkbox touch targets** to 44x44px minimum
3. **Add favicon.svg** to resolve 404
4. **Verify /guide route** registration
5. **Consider** using `<label>` elements with `htmlFor` for better form accessibility
6. **Consider** adding `role="dialog"` and `aria-modal="true"` to welcome modal

---

## Test Evidence

Screenshots captured:
- `pc-full-page.png` — Desktop 1440x900 full page with results
- `tablet-full-page.png` — Tablet 768x1024 full page with results
- `mobile-full-page.png` — Mobile 375x812 full page with results
- `mobile-maf-lab.png` — Mobile MAF Lab tab
- `mobile-welcome-modal.png` — Mobile welcome modal (shows background bleed)

---

**Verdict:** App works well across all viewports. 2 major issues on mobile (modal + touch targets) should be fixed before SP2 launch. No critical/blocking issues.
