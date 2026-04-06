# WordPress SSO + Server-Side Storage Implementation Complete

**Date**: 2026-04-06 11:24
**Severity**: Medium
**Component**: Authentication, User Profile, Dashboard
**Status**: Production-Ready

## What Happened

Executed full 6-phase WordPress SSO plan in auto mode. Delivered NestJS API with OAuth2 PKCE, JWT RS256, dual httpOnly cookies, refresh token rotation, rate limiting, user profile management, and responsive dashboard UI. All 177 tests pass. Two separate builds verified clean.

## The Brutal Truth

We built a full auth system with implicit confidence — then code review exposed four critical security/logic flaws. CORS backdoor (localhost in production allowlist) was the most damning. The parallel Phase 2+3 strategy worked but masked early integration bugs until review caught them. Bundle size crept from 352KB to 369KB (+5%) with dashboard UI — acceptable but we're approaching the 400KB ceiling.

## Technical Details

**Critical fixes post-review:**
- CORS: localhost hardcoded in production env → fixed to env-based allowlist (dev-only)
- Type mismatch: frontend strings sent as profile data, API numbers expected → fixed explicit parseInt in profile-service
- Auth bypass: missing user returned 200 → fixed NotFoundException
- Token replay: grace period token reusable → fixed single-use deletion

**Architecture decisions:**
- Two httpOnly cookies (15min access + 7day refresh) per validation feedback
- Refresh token rotation with single-use grace period (prevents storms, blocks replay)
- Explicit profile save button (not auto-save) per stakeholder feedback
- MVP dashboard: only MAF zone card functional, rest UI placeholders

## What We Tried

Auto-mode execution of 6 sequential phases. Parallel Phase 2+3 development after Phase 1. This accelerated delivery but shifted testing burden rightward — code review became gate instead of checkpoint.

## Root Cause Analysis

**Deployment confidence trap:** Passing tests ≠ passing security review. Our test suite didn't catch CORS or type mismatches because they're environmental/integration concerns, not unit-testable. Parallel phases saved days but reduced cross-phase validation until too late.

**Token logic complexity:** Refresh token rotation + grace period easy to implement wrong. We got it right but only because validation reviewed it — catch this earlier with explicit security tests, not hoping reviewers find it.

## Lessons Learned

1. **Security gates before auto-mode:** Don't run 6 phases auto then discover CORS backdoor at the end. Insert security checkpoint after Phase 1 (API foundation).
2. **Type contracts in schemas:** Frontend and backend number/string mismatch is preventable with explicit DTO validation tests, not just runtime parsing.
3. **Token logic deserves test isolation:** Grace period behavior, single-use enforcement — these need explicit unit tests, not just auth flow e2e tests.
4. **Bundle creep visibility:** Going 352→369KB was fine but invisible. Automate bundle size tracking in CI.

## Next Steps

- **Blocker:** Install WP OAuth Server plugin on maf.run WordPress (external, not our code)
- **Generate RSA key pair** for JWT signing (Phase 6 day 2)
- **Deploy to production** after WordPress plugin live
- **Strava integration** handed to separate developer (out of scope here)
- **Future:** Add bundle size CI check at 380KB threshold
