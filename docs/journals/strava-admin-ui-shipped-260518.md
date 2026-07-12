# Strava Admin UI: Red-Team Validation Prevented Silent Shipping Bugs

**Date**: 2026-05-18 03:47
**Severity**: High
**Component**: Strava OAuth admin settings (backend + frontend)
**Status**: Resolved (with follow-up patches)

## What Happened

Shipped Strava admin UI across 5 commits on dev branch (c96de40, 7a8fb9a, 22b4ca2, 37797eb, f0e108b). Implementation emerged from a plan that conducted pre-implementation security red-team validation — 15 findings total. Code review post-implementation revealed the red-team caught a class of critical bugs that would have reached users undetected without that validation phase.

## The Brutal Truth

Without the red-team review, we would have shipped broken OAuth in a way that *looked* like it worked. Strava connections would silently fail at the crypto stage with confusing error messages. The feature flag hide-card fix would be dead code — users would see the Strava card on profile even when `FEATURE_STRAVA=false`. Webhook rotation would randomly deactivate subscriptions because we'd miss the auto-resubscribe logic requirement. And the OAuth state would be vulnerable to account hijacking on a fresh production deploy.

This is the exhausting reality of security work: the bugs weren't obvious from reading the code. A conventional code review alone would have missed them. We only caught them because someone explicitly asked "what if an attacker does X?"

## Technical Details

**Four critical vulnerabilities caught by red-team, all validated in code:**

1. **Empty-key HMAC forgery (RT #2)**: Fresh-deploy OAuth state used uninitialised HMAC key, letting attackers forge state tokens and link victims' accounts to attacker-controlled Strava. Fixed by: reuse `GARMIN_ENCRYPTION_KEY` as HMAC key, validate ≥32 bytes at boot (StravaAuthService.onModuleInit throws if missing).

2. **Confused-deputy state hijack (RT #3)**: OAuth state not bound to session—state token could be reused across browsers/users. Fixed by: Redis-backed single-use nonce store (`redis.getex(stateHash)` with delete) + HMAC verification.

3. **Sync→async cascade incomplete (RT #4)**: `getConnectUrl()` would return Promise wrapped in response object post-deploy, breaking 100% of new Strava connections. Impact: `{ authUrl: {} }` serialized. Fixed by: all OAuth callers marked `async`, all invocations `await`ed, Prisma return types validated.

4. **Webhook silent-fail on credential rotation (RT #8)**: Strava deactivates subscriptions when verify token mismatches. Ops would rotate tokens but never know the webhook died. Fixed by: synchronous `stravaWebhook.refreshSubscription()` on admin save, result (`webhookResubscribed` / `webhookResubscribeError`) surfaced in UI.

**Additional bugs found in code review (post-implementation):**

- **RT #6 hide-card fix broken**: `/strava/status` doesn't return `featureEnabled` field despite frontend depending on it. Frontend check `!s.featureEnabled` evaluates to `true` (undefined) → card always hidden when disconnected, regardless of admin toggle. Required backend patch: inject AppSettingsService, add `featureEnabled: cfg.enabled` to both return paths.

- **File size creep**: Phase 2 frontend violated 200-LOC cap (admin-strava-page 219, strava-settings-card 240). Plan explicitly flagged this—"if approaching, extract shared utils"—but we built it anyway. Required refactor: extracted `connection-status-utils.ts` (statusConfig, timeAgo, truncate) to make both files reusable AND under cap.

## What We Tried

1. **Standard code review** — caught style/linting/type issues but not the crypto vulnerabilities.
2. **Red-team security review before implementation** — caught all 4 critical class of bugs above. This was the lever.
3. **Post-implementation code review** — caught RT #6 backend gap and H2 file-size violation (both known risks that slipped through).

## Root Cause Analysis

**Why the red-team caught what code review missed:**

Red-team asked adversarial questions: "What if HMAC key is missing? What if state is reused? What if Strava subscription dies?" These aren't questions a normal code review asks—we assume happy paths. The red-team forced threat modeling before we wrote a line of code.

**Why RT #6 and H2 slipped through despite being in the plan:**

- **RT #6 (`featureEnabled` field)**: Wired on frontend but implementation split across two repos (API + frontend). Frontend dev verified their code worked; backend dev assumed the field was already returned. Classic distributed ownership gap. Caught in code review because the reviewer traced the DTO through both sides.

- **H2 (file size)**: The plan flagged "evaluate after Strava ships"—meaning we built above cap first, then refactored. We did refactor (extracted helpers), but the code-reviewer's "DONE_WITH_CONCERNS" score (7/10) was the forcing function. Without that signal, we might have shipped it.

## Lessons Learned

1. **Red-team validation belongs before code, not after.** The 15 pre-implementation findings prevented 4+ shipping bugs. This is our forcing function for security-critical features going forward.

2. **Distributed ownership requires explicit contract tests.** When API and frontend share a DTO, write a test that validates the contract in both directions (backend returns all fields, frontend can deserialize them). Code review can't trace this reliably across repos.

3. **File size targets need enforcement, not aspiration.** Saying "keep it under 200 LOC" in comments gets ignored. Require post-PR refactoring as a gate. We hit this on H2 and fixed it, but it was rework.

4. **Crypto defaults must throw, not warn.** GarminEncryptionService.onModuleInit() warned instead of throwing—left boot vulnerable if the key was somehow missing at runtime. Changed to throw to match StravaAuthService.onModuleInit(). Defense in depth: validate at module load AND at config schema.

## Next Steps

1. **Post-merge monitoring** (completed): Verify RT #6 patch deploys successfully—`/strava/status` now returns `featureEnabled: true/false` as expected.
2. **Docs alignment** (pending): H1 finding—deployment-guide still says "webhook rotation is manual" but code auto-resubscribes. Docs fixed in follow-up (37797eb) but verify ops teams read the updated version.
3. **Security checklist for future features** (process): Require red-team review for any OAuth/crypto/webhook work. Formalize the threat model deliverable.
4. **Contract testing library** (follow-up): Build a shared schema validator so frontend/backend can catch DTO mismatches in CI without manual review.

## Emotional Reality

Shipping without the red-team validation would have meant 2-3 days of angry customers, frantic hotfixes, and security incident reports. The red-team work upfront cost ~2 hours of planning but saved days of firefighting. That's the math that makes security work feel like it's paying for itself, even when it slows down the sprint.

What makes this painful: the bugs weren't subtle. They were *obvious* once someone said "what if someone attacks this?" That's humbling. It means we need adversarial thinking baked into our definition of done, not bolted on as an afterthought.
