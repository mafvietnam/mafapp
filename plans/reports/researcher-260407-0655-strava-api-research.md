# Strava API Integration Research Report

**Date:** 2026-04-07  
**Status:** Complete  
**Target Audience:** Web application developers implementing Strava OAuth integration

---

## 1. Strava API Overview

**Core Offering:** Strava V3 API is a free, stable REST interface with 300+ endpoints covering athlete data, activities, segments, routes, clubs, and equipment.

**Key Data Access:**
- Activity details (GPS traces, splits, performance metrics, kudos)
- Athlete profiles and stats (yearly totals, recent activity summaries)
- Segments (leaderboards, personal efforts/PRs)
- Routes, clubs, gear, streams (altitude, speed, cadence, power)

**API Stability:** V3 is production-ready and actively used by Strava's official mobile apps. Endpoint additions tracked in official changelog.

---

## 2. OAuth 2.0 Flow (Step-by-Step)

**Authorization Endpoint:** `GET https://www.strava.com/oauth/authorize` (or `/oauth/mobile/authorize` for native apps)

**5-Step Process:**

1. **User Authorization**: Application redirects athlete to Strava login with `client_id`, `redirect_uri`, `scope`, `state` parameters.
2. **User Consent**: User authenticates and grants scope permissions (displayed as checkboxes; athletes can opt out).
3. **Authorization Code**: Strava redirects to callback URI with short-lived `code` parameter (single-use only).
4. **Token Exchange**: Application backend POSTs code to `https://www.strava.com/oauth/token` with `client_id`, `client_secret`, `code`, `grant_type=authorization_code`.
5. **Token Receipt**: Strava returns access token (6hr expiry), refresh token, and athlete object with name/ID/profile image.

**Critical:** Always use `state` parameter to prevent CSRF attacks. Store and validate it during redirect callback.

---

## 3. App Registration (Developer Portal)

**Registration Steps:**

1. Create Strava account at https://www.strava.com/register
2. Navigate to https://www.strava.com/settings/api
3. Click "Create an Application"
4. Fill application details (name, description, website, category)
5. Set **Authorization Callback Domain** (localhost:3000 for dev, production domain for live)

**Credentials Issued:**
- **Client ID**: Application identifier
- **Client Secret**: Must be kept confidential (use environment variables, never commit to repo)
- **Authorization Token**: Changes every 6 hours; used for personal testing only
- **Refresh Token**: For testing; always rotate with new tokens

**Enforcement:** Callback domain is validated during OAuth redirect; mismatches are rejected.

---

## 4. Scopes & Permissions Matrix

| Scope | Grants Access To | Use Case |
|-------|------------------|----------|
| `read` | Public data (segments, routes, profiles, posts, events) | Basic read-only access |
| `read_all` | Private routes, private segments | Extended data exploration |
| `profile:read_all` | All profile info (even if visibility = Followers Only or Private) | Full athlete profiles |
| `profile:write` | Update activity name, segment stars | Profile modifications |
| `activity:read` | Public/follower activities only | Limited activity access |
| `activity:read_all` | All activities (including private) | Complete activity history |
| `activity:write` | Create, edit activities, uploads | Activity creation/sync tools |

**Best Practice:** Request only required scopes; athletes see exact permissions requested. Excessive scope requests reduce authorization conversion rates and trigger stricter app review.

**Selective Opt-Out:** Strava UI allows athletes to uncheck certain scopes during consent. Always verify which scopes were approved in the returned token response.

---

## 5. Token Management & Lifecycle

**Access Token:**
- **Expiration:** 6 hours (unix timestamp provided in response)
- **Validation:** Check expiration before API requests; handle 401 responses gracefully
- **Usage:** Include in request header: `Authorization: Bearer {access_token}`

**Refresh Token:**
- **Lifecycle:** Never expires but must be rotated with every refresh
- **Critical Behavior:** When `/oauth/token` issues a new access token, it returns a NEW refresh token. Old token becomes invalid immediately.
- **Storage Strategy:** Store both tokens in secure database per athlete; always persist the latest refresh token
- **Rotation Pattern:** Before expiry check, POST refresh request; immediately store returned refresh token

**Deauthorization:**
- **Method:** POST `/oauth/deauthorize` with refresh token
- **Effect:** Invalidates ALL tokens for that athlete; requires re-authorization
- **Use Case:** User revokes app access from Strava settings (also triggers webhook)

**Common Pitfall:** Storing only access token causes silent failures when refresh token expires or is rotated.

---

## 6. Webhooks for Real-Time Updates

**Purpose:** Push activity changes to your endpoint instead of polling; critical for staying within rate limits.

**Supported Events:**
- Activity creation (new workout uploaded)
- Activity deletion (athlete removes activity)
- Activity updates (title, type, privacy changes)
- Athlete deauthorization (athlete revokes app access)

**Event Structure:**
```json
{
  "subscription_id": 123456,
  "owner_id": 789,
  "object_type": "activity",
  "object_id": 456789,
  "aspect_type": "create",
  "event_time": 1234567890,
  "updates": { "title": "Morning Run", "type": "Run" }
}
```

**Subscription Setup (2-Step Verification):**

1. **Register Subscription:** POST `/push_subscriptions` with `client_id`, `client_secret`, `callback_url`, `verify_token`
2. **Validate Callback:** Strava sends GET with `hub.challenge` parameter; endpoint must echo challenge within 2 seconds

**Callback Requirements:**
- Must respond with HTTP 200 status within **2 seconds**
- Move heavy processing to async queue (database writes, external API calls)
- Failed responses trigger automatic retries (up to 3 total attempts)

**Scope Requirement:** Need `activity:read_all` for private activities, `activity:read` for public/follower visibility.

**Important Note:** One subscription per application, but covers all connected athletes.

---

## 7. Rate Limits

**Default Limits (Unapproved Apps):**
- **15-minute window:** 200 overall requests, 100 "non-upload" requests
- **Daily window:** 2,000 overall requests, 1,000 "non-upload" requests

**Approved Developer Program Limits:**
- **15-minute window:** 600 overall, 300 "non-upload" requests
- **Daily window:** 6,000 overall, 3,000 "non-upload" requests

**Reset Behavior:**
- 15-minute windows reset at natural intervals (0, 15, 30, 45 min past the hour)
- Daily windows reset at midnight UTC
- **Both windows apply simultaneously**; a single request counts against both

**Rate Limit Headers:** Responses include `X-RateLimit-Limit`, `X-RateLimit-Usage`, `X-RateLimit-ResetTime` headers.

**Mitigation Strategies:**
1. Implement exponential backoff on 429 (Too Many Requests)
2. Use webhooks instead of polling for activity updates
3. Cache results aggressively (athlete stats rarely change hourly)
4. Batch requests where possible (e.g., fetch activities list vs individual activities)
5. Apply for Developer Program approval for higher limits

---

## 8. Key API Endpoints (Common Use Cases)

**Athlete Endpoints:**
- `GET /athlete` — Authenticated user profile (name, ID, stats, zones)
- `GET /athlete/stats` — Yearly/monthly/weekly activity summaries
- `GET /athlete/activities` — Paginated list of athlete's activities
- `PUT /athlete` — Update profile (city, state, summit status)

**Activity Endpoints:**
- `GET /activities/{id}` — Full activity details (laps, photos, kudos count)
- `POST /activities` — Create manual activity (running, cycling, swimming)
- `PUT /activities/{id}` — Update title, description, privacy, activity type
- `GET /activities/{id}/comments` — Comments on activity
- `GET /activities/{id}/kudos` — Athletes who kudos'd this activity
- `GET /activities/{id}/laps` — Split data for activities with laps

**Segment Endpoints:**
- `GET /segments/{id}` — Segment details (distance, elevation, effort count)
- `GET /segments/explore?bounds={sw_lat,sw_lng,ne_lat,ne_lng}` — Nearby segments
- `GET /segments/{id}/all_efforts` — Leaderboard (all efforts on segment)
- `GET /segment_efforts/{id}` — Personal effort data (time, position, power)
- `POST /segments/{id}/starred` — Star/unstar a segment

**Stream Endpoints:**
- `GET /activities/{id}/streams` — Activity GPS, speed, elevation, cadence, power

---

## 9. Common Pitfalls & Solutions

| Pitfall | Problem | Solution |
|---------|---------|----------|
| **No refresh token storage** | App loses access after 6 hours | Store refresh token securely; rotate on every refresh |
| **Ignoring selective scope opt-out** | Assume full scope approval | Verify approved scopes in token response before API calls |
| **Polling instead of webhooks** | Exhausts rate limits quickly | Implement webhooks for activity updates |
| **Exposing client secret** | Security breach in public repos | Use .env files, environment variables, never commit credentials |
| **Missing state parameter** | Vulnerable to CSRF attacks | Always include and validate `state` in OAuth flow |
| **Ignoring rate limit headers** | Unexpected 429 errors | Parse X-RateLimit-* headers; implement exponential backoff |
| **Blocking on webhook validation** | 2-second timeout exceeded | Echo hub.challenge immediately; queue other work asynchronously |
| **Not handling deauthorization** | Stale tokens for revoked users | Listen for webhook events; delete tokens immediately on deauth |
| **Testing with one refresh token** | Token rotation breaks during dev | Use fresh token each session; test refresh flow explicitly |
| **Assuming static data** | Stale activity cache issues | Cache athlete stats (stable daily), not raw activity feeds (volatile) |

---

## 10. Best Practices

**Authentication & Security:**
- Never commit Client Secret; use environment variables
- Store refresh tokens encrypted in database (bcrypt or similar)
- Rotate refresh tokens after every use; delete old tokens immediately
- Use HTTPS for all OAuth callbacks
- Implement CSRF protection with state parameter validation
- Log all deauthorization events for audit trails

**API Design:**
- Cache athlete profile data for 1 hour (rarely changes mid-session)
- Cache activity summaries for 15 minutes; full activity details for 5 minutes
- Implement pagination early; Strava returns 30 items per page by default
- Use `updated_at` timestamps to detect changes between syncs
- Batch related requests (fetch athlete + stats + recent activities in parallel)

**Rate Limit Strategy:**
- Monitor X-RateLimit-Usage header; alert team at 80% daily quota
- Implement token bucket algorithm for request smoothing
- Queue background syncs during low-traffic windows (2am-4am UTC)
- Request Developer Program approval if hitting limits regularly

**Webhook Reliability:**
- Log all webhook events (for replay/debugging)
- Deduplicate events by `subscription_id + object_id + event_time`
- Store subscription verification token securely; rotate if exposed
- Implement circuit breaker; alert on repeated callback failures

**Data Sync Patterns:**
- Initial sync: Fetch paginated activities with `before` parameter for date ranges
- Incremental sync: Store `last_sync` timestamp; use webhooks for new activities
- Failure recovery: Implement exponential backoff on 429; resume from last successful state

---

## Adoption Risk Assessment

**Maturity:** Stable. V3 API has been production-ready for 5+ years; no major breaking changes planned.

**Community:** Large. 500K+ apps integrated; extensive third-party client libraries (Node/Python/Go/PHP/Ruby).

**Rate Limit Ceiling:** Default limits (2K/day) suitable for single-user or small team apps. Scale requires Developer Program approval.

**Data Freshness:** Activity data available within seconds of athlete upload; athlete stats refresh daily. No real-time sync with wearables.

**Deprecation Risk:** Low. Strava maintains backward compatibility; changelog signals deprecations 6+ months in advance.

---

## Unresolved Questions

1. **Developer Program Approval Timeline:** What is typical approval duration for new apps requesting higher rate limits?
2. **Webhook Retry Timing:** What is the backoff strategy (fixed, exponential) for the 3 retry attempts?
3. **Segment Effort Data Freshness:** How quickly do leaderboard changes reflect new efforts (minutes, hours)?
4. **Premium Data Access:** Do certain endpoints (e.g., training plans, power curve data) require paid Strava Summit subscription?
5. **Batch Upload Limits:** Are there per-session limits on activity creation/upload volume?

---

## Sources

- [Strava API v3 Reference](https://developers.strava.com/docs/reference/)
- [Getting Started with the Strava API](https://developers.strava.com/docs/getting-started/)
- [Strava OAuth 2.0 Authentication](https://developers.strava.com/docs/authentication/)
- [Rate Limits Documentation](https://developers.strava.com/docs/rate-limits/)
- [Webhook Events API](https://developers.strava.com/docs/webhooks/)
- [Strava API Changelog](https://developers.strava.com/docs/changelog/)
- [Strava Legal - API Agreement](https://www.strava.com/legal/api)
- [Strava Community Hub - Developers](https://communityhub.strava.com/developers-api-7)
