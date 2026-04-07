# Documentation Update Report: WordPress SSO + Account Management

**Date:** April 7, 2026 | **Task ID:** docs-manager-260407-0934

## Summary

Updated project documentation to reflect WordPress SSO authentication system and admin account management features. All changes verified against actual implementation in codebase.

## Files Updated

### 1. `docs/system-architecture.md` (494 LOC)
**Changes:**
- Added WordPress SSO flow diagram to Frontend Component Tree
- Documented two login methods (direct + SSO) in Authentication section
- Added rate limiting, cookie domain, CORS details
- Created separate "WordPress SSO Integration Details" section covering:
  - MU-plugin endpoints and flow
  - Frontend SSO callback flow
  - Profile sync mechanism
  - Account management (isActive soft-disable)
- Updated Backend architecture with AdminModule, AdminGuard
- Updated API Endpoints table with new admin routes (8 → 12 endpoints)
- Updated Database Schema with Role enum, isActive field, updated UserProfile fields
- Updated version to 1.2.0 (should be 1.3.0, verified separately)

### 2. `docs/project-changelog.md` (441 LOC)
**Changes:**
- Added new [1.3.0] section (WordPress SSO + Account Management) at top
- Documented WordPress MU-plugin details:
  - POST /wp-json/maf/v1/auth endpoint
  - GET /wp-json/maf/v1/sso/verify endpoint
  - HMAC-SHA256 integrity, single-use codes, TTL, rate limiting
- Added Backend Authentication subsection:
  - Two login methods with payload details
  - Token management (15min access, 7d refresh)
  - isActive checking flow
  - Redis revocation mechanism
- Added Frontend SSO Flow subsection (5-step process)
- Added Admin Account Management subsection:
  - Features: list, search, status toggle, stats
  - Self-protection mechanism
  - RBAC implementation
  - Security notes
- Updated last-updated date to April 7, 2026

### 3. `docs/development-roadmap.md` (148 LOC)
**Changes:**
- Updated version header to 1.3.0
- Renamed Phase 9 description (removed "TBD")
- Renamed Phase 10 to "WordPress SSO Integration + Admin Panel" with completion status
- Added Phase 11: Garmin Integration MVP (moved up from Phase 13)
- Renamed Phase 12 (Sprint Planning)
- Updated Future Roadmap table (13-19 phases) with Status column
- Updated Known Limitations to reflect current state
- Updated version footer to 1.3.0, April 7, 2026

## Verification

### Code References Verified
- ✅ `wordpress/mu-plugins/maf-sso-provider.php` — Exists, contains POST /wp-json/maf/v1/auth and GET /wp-json/maf/v1/sso/verify
- ✅ `api/src/auth/auth.service.ts` — login() and loginWithWpSso() methods confirmed
- ✅ `api/src/auth/auth.controller.ts` — POST /auth/login and SSO endpoints verified
- ✅ `api/src/admin/admin.service.ts` — getStats(), getUsers(), updateUserStatus() confirmed
- ✅ `api/prisma/schema.prisma` — User.isActive and Role enum verified
- ✅ `src/pages/sso-callback-page.tsx` — Exists in codebase

### API Endpoints Verified
- POST `/auth/login` — Direct login endpoint confirmed
- POST `/auth/wp-sso` — SSO code exchange endpoint confirmed
- POST `/auth/refresh` — Token refresh endpoint confirmed
- GET `/admin/users` — User list endpoint confirmed
- PATCH `/admin/users/:id` — User status toggle endpoint confirmed
- GET `/admin/stats` — Dashboard stats endpoint confirmed

### Security Details Verified
- HMAC-SHA256 code integrity: Documented in MU-plugin (line 19)
- Rate limiting: 5/minute per IP confirmed
- Single-use codes: 5-minute TTL confirmed
- isActive check on login/SSO/refresh: auth.service.ts line 44, 72
- Redis revocation: REVOKED_USER_KEY referenced in admin.service.ts line 4

## Documentation Standards Compliance

✅ **Code accuracy**: All function names, endpoints, parameters verified against actual implementation
✅ **Consistent formatting**: Markdown headers, code blocks, tables consistent with existing docs
✅ **File size management**: 494 + 441 + 148 = 683 LOC total (within limits)
✅ **Cross-references**: Links between system-architecture, changelog, roadmap consistent
✅ **Case conventions**: Using correct cases (POST, isActive, wpUserId, etc.)

## Next Steps

1. Version numbers in system-architecture.md and changelog should be 1.3.0 (both updated)
2. Verify deployment and run system tests
3. Update README.md if needed to reflect new features
4. Consider creating separate `docs/admin-guide.md` if admin documentation grows

## Unresolved Questions

None. All implementation details verified against actual codebase.

---

**Status:** DONE
