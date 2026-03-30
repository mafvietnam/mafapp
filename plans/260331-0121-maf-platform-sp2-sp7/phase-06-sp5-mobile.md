# Phase 6: SP5 — Mobile Release (Capacitor)

## Overview
- **Priority:** P2
- **Owner:** Both
- **Status:** Pending
- **Effort:** 6-8 weeks
- **Blocked by:** Phase 4 (SP3), Phase 5 (SP4)

Wrap existing React app with Capacitor for iOS App Store + Google Play Store. Single codebase serves web + mobile.

## Parallel Split

### Dev A (Backend + DevOps)
**Responsibilities:**
- Push notification server (Firebase Cloud Messaging integration)
- API adjustments for mobile (device registration, push tokens)
- CI/CD pipeline: GitHub Actions for iOS + Android builds
- App Store Connect + Google Play Console setup
- Privacy policy page, app descriptions, screenshots

### Dev B (Frontend + Mobile)
**Responsibilities:**
- Capacitor project setup (`@capacitor/core`, `@capacitor/cli`)
- Platform configs: `npx cap add ios && npx cap add android`
- Native plugins:
  - `@capacitor/push-notifications` — training reminders, challenge updates
  - `@capacitor-community/health` — Apple Health / Google Fit HR data
  - `@capacitor/camera` — food photo for nutrition log
  - `@capacitor/app` — deep links for maf.run URLs
- Mobile UX adaptations:
  - Bottom tab navigation (replace sidebar on mobile)
  - Touch-optimized inputs (larger tap targets)
  - Safe area + status bar handling
  - Splash screen + app icon
- Offline sync queue: log data offline → sync when online
- Platform-specific styling tweaks

## Key Deliverables
- [ ] Capacitor project configured for iOS + Android
- [ ] Native plugins: push notifications, health data, camera
- [ ] Mobile-optimized navigation (bottom tabs)
- [ ] Offline sync queue
- [ ] Splash screen + app icons designed
- [ ] iOS TestFlight beta release
- [ ] Android Play Store internal testing release
- [ ] CI/CD: auto-build on tag push
- [ ] Privacy policy + app store listings

## Success Criteria
- App installable from TestFlight (iOS) and Play Store internal track (Android)
- Push notifications received for challenge updates
- Health data (HR) readable from Apple Health / Google Fit
- Offline food logging syncs when back online
- Same UX quality as web version
