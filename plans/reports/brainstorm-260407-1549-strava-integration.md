---
type: brainstorm
date: 2026-04-07
slug: strava-integration
---

# Strava Integration — Brainstorm Report

## Problem Statement
Add Strava OAuth2 integration so users can connect their Strava account and have running activities synced into the MAF app for analysis.

## Requirements
- **Data:** Activities (Run/TrailRun/VirtualRun), athlete profile, stats/totals
- **Sync:** Hybrid — webhook (real-time) + manual trigger fallback + daily cron
- **Auth role:** Data sync only (user already logged in via WP SSO; Strava is a separate connection)
- **Pattern:** Mirror existing Garmin integration architecture
- **Deduplication:** Strava wins over Garmin when same run detected (±5 min window, same userId)
- **Activity types:** Running only

## Evaluated Approaches

### Option A: Mirror Garmin (Selected)
Reuse exact same pattern: StravaConnection table, encrypted tokens, sync service, feature flag.
- **Pros:** Low cognitive overhead, consistent codebase, proven pattern, ~80% reuse
- **Cons:** Garmin uses credentials; Strava uses OAuth2 — token management is different

### Option B: Separate OAuth2 library approach
Use a dedicated OAuth2 library (passport-strava-oauth2).
- **Pros:** Less boilerplate for OAuth2 flow
- **Cons:** Adds a dependency, overkill given existing Garmin infra handles encryption already

**Decision:** Option A — mirror Garmin, add OAuth2 token management on top.

## Final Design

### Database
- `StravaConnection`: userId, stravaAthleteId, accessToken (enc), refreshToken (enc), tokenExpiresAt, webhookSubscriptionId, isActive, lastSyncAt
- `StravaActivity`: userId, stravaActivityId (unique), name, type, startDate, distance, movingTime, elapsedTime, averageHeartrate, maxHeartrate, averageSpeed, totalElevationGain, calories

### OAuth2 Flow
1. GET /api/strava/connect → redirect to strava.com/oauth/authorize (scopes: `read,activity:read_all`)
2. Callback /api/strava/callback?code=xxx → exchange → encrypt + store
3. Register webhook subscription (one-time at startup)

### Sync Strategy
| Trigger | Mechanism |
|---------|-----------|
| New activity | Strava webhook → fetch + upsert |
| Manual | User triggers /api/strava/sync |
| Fallback | Daily cron (since lastSyncAt) |

### Token Refresh
- Strava tokens expire every 6 hours
- Auto-refresh before any API call if within 5 min of expiry
- Redis lock to prevent race conditions

### Deduplication
- Both records kept (no data loss)
- MAF analysis prefers Strava; Garmin flagged `isDuplicate=true`

### Module Structure
```
strava/
├── strava.module.ts
├── strava-auth.service.ts
├── strava-token.service.ts
├── strava-sync.service.ts
├── strava-webhook.service.ts
└── strava.controller.ts
```

### Feature Flag: `FEATURE_STRAVA`

## Risks
| Risk | Mitigation |
|------|------------|
| Webhook needs public HTTPS | Cloudflare Tunnel already covers this |
| Webhook subscription is per-app | Route events by `owner_id` field |
| Token refresh race condition | Redis lock (same as Garmin) |
| Rate limits (200/15min, 2000/day) | Paginate, track rate headers |

## Success Metrics
- User can connect/disconnect Strava from profile settings
- New Strava run appears in app within 60s of upload (webhook path)
- Manual sync imports last 30 days of runs
- Duplicate runs (Garmin + Strava) show once in MAF analysis
- Token refresh works silently without user action

## Next Steps
→ Create phase-by-phase implementation plan via /ck:plan
