# Garmin Connect API Research Report

**Date:** 2026-04-07 | **Scope:** Official APIs, OAuth flow, developer registration, data access, integration patterns

---

## Executive Summary

Garmin offers **Health API** and **Activity API** through their Garmin Connect Developer Program. Primary auth is **OAuth 2.0 with PKCE** (OAuth 1.0a retired 12/31/2026). Data access requires **business entity registration** (not personal use) with typical approval in 2 business days + 1-4 week integration timeline. Push/Pull architecture available for health data. Heart rate and activity data accessible; live HR has latency (up to hours). Most production integrations use either official APIs (requires business approval) or third-party wrappers.
Garmin Connect Developer Program
---

## 1. Garmin APIs Available

### Official APIs (Garmin Connect Developer Program)

| API | Purpose | Auth | Data Format |
|-----|---------|------|-------------|
| **Health API** | All-day metrics: steps, HR, sleep, stress, respiration, body composition | OAuth 2.0 | JSON summaries + epoch-level detail |
| **Activity API** | Discrete activities (runs, swims, bikes) with detailed fitness data | OAuth 2.0 | JSON + FIT/GPX/TCX files |
| **Training API** | Training plans and workouts | OAuth 2.0 | JSON |
| **Women's Health API** | Menstrual cycle tracking (if applicable) | OAuth 2.0 | JSON |
| **Courses API** | Golf courses and navigation | OAuth 2.0 | JSON |

**Key Distinction:**
- **Health API** = summary health data (daily aggregates)
- **Activity API** = detailed activity-level data (single run, bike session, etc.)
- Both push/pull capable; both require business registration

---

## 2. Authentication: OAuth Flow

### Current Standard: OAuth 2.0 with PKCE

**Flow (Standard OIDC):**

1. **Authorization Request**
   - Redirect user to: `https://apis.garmin.com/oauth-service/oauth/authorize`
   - Include: `client_id`, `state`, `code_challenge`, `code_challenge_method=S256`, `scope`, `redirect_uri`
   - User logs into Garmin + grants consent

2. **Authorization Code**
   - Garmin redirects to your `redirect_uri` with `code` + `state`
   - Verify `state` matches (CSRF protection)

3. **Token Exchange**
   - POST to `https://apis.garmin.com/oauth-service/oauth/token`
   - Body: `grant_type=authorization_code`, `code`, `client_id`, `client_secret`, `code_verifier`
   - Response: `access_token` (expires in ~3 hours), `refresh_token`, `token_type=Bearer`

4. **API Calls**
   - Header: `Authorization: Bearer {access_token}`
   - Endpoint: `https://apis.garmin.com/wellness-api/rest/...` or `/activity-api/...`

5. **Token Refresh**
   - POST to `/oauth-service/oauth/token` with `grant_type=refresh_token`, `refresh_token`
   - Receive new `access_token`

### OAuth 1.0a (Deprecated)

- Used historically for Health API
- **Retirement deadline: 12/31/2026**
- Migration: POST to `https://apis.garmin.com/partner-gateway/rest/user/token-exchange` with OAuth 1 token → get OAuth 2 token/refresh_token

**PKCE Specification:** Official doc at [Garmin OAuth2 PKCE Specification PDF](https://developerportal.garmin.com/sites/default/files/OAuth2PKCE_1.pdf)

---

## 3. Developer Registration & Approval

### Step 1: Apply
- Visit: [Garmin Developer Access Form](https://www.garmin.com/en-US/forms/GarminConnectDeveloperAccess/)
- Must be **legal entity** (company, university, hospital, research institution)
- Personal use applications rejected
- Specify business use case, target API(s), expected user base

### Step 2: Garmin Review
- **Timeline:** Garmin confirms within **2 business days**
- Approval contingent on business viability
- May require product/service review before publishing

### Step 3: On Approval
- Access to **Garmin Developer Portal** (`developerportal.garmin.com`)
- **Evaluation consumer key** issued (rate-limited, not production)
- Invited to **integration call** with Garmin team

### Step 4: Integration Phase
- **Typical duration:** 1–4 weeks
- Build against evaluation environment
- Test with own data

### Step 5: Production Release
- Request promotion from evaluation → production consumer key
- Garmin verifies integration quality + compliance
- Production key has higher rate limits

### Licensing
- **Access fee:** Free
- **Commercial use:** May require licensing fee or minimum device order (varies by use case)
- No annual maintenance fees

---

## 4. Available Data: Heart Rate, Activity, MAF Metrics

### Health API Data (Daily Summaries)

**Core metrics per day:**
- Steps, distance, calories, active minutes
- Heart rate: avg, min, max
- Sleep: duration, quality stages
- Stress: avg, max, stress duration
- Respiration rate, blood oxygen (pulse-ox)
- Body composition (if device supports)
- Menstrual cycle tracking (Women's Health API)

**Response format (JSON):**
```json
{
  "summaryId": 12345,
  "calendarDate": "2026-04-07",
  "startTimeInSeconds": 1712440800,
  "durationInSeconds": 86400,
  "steps": 8543,
  "heartRate": {
    "min": 45,
    "max": 120,
    "avg": 72
  },
  "sleep": {...},
  "stress": {...}
}
```

**Query:** GET `/wellness-api/rest/dailySummary/{userId}/{date}` or `/dailySummaryBetween?...` (date ranges)

### Activity API Data (Granular Activity Data)

**High-level summaries:**
- Activity type (run, bike, swim, etc.)
- Duration, distance, pace, elevation
- Heart rate zones breakdown
- VO2 max estimate (if run/cycle)
- Training effect

**Detailed data (via FIT file download):**
- Second-by-second HR, pace, cadence, elevation
- Power (if cycling computer)
- Temperature, calories

**Query:** GET `/activity-api/activities?...`, then download FIT file

### Heart Rate Zones & MAF-Related Data

**Available via Health API:**
- Daily HR ranges (min/max/avg)
- Hour-by-hour HR summaries (if detailed endpoint available)
- Stress metric (proxy for HR elevation)
- VO2 max (from Activity API)

**Not directly exposed:**
- User's configured HR zones
- MAF-specific calculations (you'd compute from HR + activity data)
- Lactate threshold

**Workaround:** Compute zones from max HR (HR - age) or retrieve from Activity API VO2 max if available.

---

## 5. Push vs Pull Architecture

### Push (Webhook Model)
- Garmin pushes notifications when data available
- You provide webhook URL during setup
- Garmin POSTs JSON summary when user syncs
- **Advantages:** Real-time, reduced polling, lower latency
- **Constraints:**
  - Webhook must respond within timeout (typically <30s)
  - Do NOT hold connection open while calling Health API—causes timeout/data loss
  - Call Health API asynchronously after closing webhook response
  - Backfill: ~1 month of data returned initially, each data type backfillable once only

### Pull (Polling Model)
- You periodically query Health API for new data
- Endpoints: `/dailySummaryBetween?startDate=...&endDate=...`
- **Advantages:** Simpler, no webhook infrastructure, stateless
- **Constraints:**
  - Higher API call volume (rate limit pressure)
  - Polling frequency vs latency trade-off
  - Risk of missing data if polling interval > sync interval

### Ping Model (Hybrid)
- Garmin sends lightweight "ping" notification (just acknowledges new data)
- You then PULL from Health API to fetch actual data
- **Balance:** Notification benefits + Pull flexibility

**Recommendation for MAF app:** Push if user base >100s (cost-effective), Poll if <50 users (simpler DevOps).

---

## 6. Rate Limits & Constraints

### Official Documentation Gap
- Garmin does NOT publish specific rate limit numbers in public docs
- Limits differ between **evaluation** and **production** consumer keys
- Evaluation keys heavily rate-limited (typical: a few req/sec)
- Production keys higher limits (Garmin doesn't disclose exact numbers)

### Observed Constraints
- Backfill: ~last 30 days, once per data type per user
- Live HR data latency: up to **hours** (syncs periodically, not real-time)
- Daily summaries: available after user device syncs (usually once/day)
- Access tokens: expire ~3 hours, refresh token renewable

### Common Errors
- "Too many requests: Rate limit quota violation" → hitting evaluation tier limits or polling too fast
- Empty responses → user hasn't synced device yet
- Delayed data → live HR not yet synced to cloud (expect 1-4 hour lag)

**Mitigation:**
- Request production consumer key once approved
- Ask Garmin support for specific limits for your use case
- Cache responses, avoid redundant calls
- Implement exponential backoff for retries

---

## 7. Node.js / TypeScript Libraries

### Official Option
- **None.** Garmin provides SDKs for Java, Swift, Kotlin; not JavaScript.

### Community Libraries (Unofficial, Popular)

#### 1. **garmin-connect** (Most Mature)
- **GitHub:** [Pythe1337N/garmin-connect](https://github.com/Pythe1337N/garmin-connect)
- **npm:** [@flow-js/garmin-connect](https://www.npmjs.com/package/@flow-js/garmin-connect) or [garmin-connect](https://www.npmjs.com/package/garmin-connect)
- **Auth:** OAuth 1 + OAuth 2 support, auto-refresh
- **Key Methods:**
  - `getActivities(page, limit)` → activity summaries
  - `downloadOriginalActivityData(activity, path)` → FIT files
  - `getHeartRate(date)` → daily HR data
  - `getUserProfile()` → user metadata
  - `getSteps(date)` → daily step count
- **TypeScript Support:** Yes (type definitions included)
- **Trade-off:** Accesses Garmin Connect web service (unofficial), not official API; Garmin may change endpoints causing breakage

#### 2. **@gooin/garmin-connect**
- **npm:** [@gooin/garmin-connect](https://www.npmjs.com/package/@gooin/garmin-connect)
- Similar scope to above, smaller community

#### 3. **node-garmin-connect** (Older)
- **GitHub:** [cbetz/node-garmin-connect](https://github.com/cbetz/node-garmin-connect)
- Less actively maintained, OAuth 1-focused

### DIY Official API Approach
- Use standard OAuth 2 library (e.g., `simple-oauth2`, `passport-oauth2`)
- Call Health API directly via `axios` or `fetch`
- No library overhead, official API guarantee, more control

**Recommendation for MAF app:**
- If user base <100: Use `garmin-connect` + Node.js for rapid MVP (accept web-scrape fragility)
- If user base >100 or production: Register for official Health API, DIY OAuth 2 + fetch (sustainable, official support)

---

## 8. Common Pitfalls & Gotchas

### Critical Issues

1. **Webhook Timeout Trap**
   - ❌ Don't: Hold webhook connection open while calling Health API
   - ✅ Do: Return 200 OK immediately, queue async fetch
   - **Impact:** Timeouts, webhook retries, data loss

2. **Access Restrictions**
   - ❌ Personal use applications rejected by Garmin
   - ✓ Only business entities eligible
   - **Impact:** Approval denial; need company or organization structure

3. **OAuth 1 Sunsetting**
   - ❌ Don't: Rely on OAuth 1 after 12/31/2026
   - ✓ Migrate now to OAuth 2; use token-exchange endpoint if needed
   - **Impact:** Apps break in 8 months

4. **Live HR Latency**
   - ❌ Don't: Expect real-time HR via Health API
   - ✓ Expect 1–4 hour delay from device sync
   - **Impact:** Not suitable for live training feedback; OK for post-activity analysis

5. **Backfill Limits**
   - ❌ Don't: Retry backfill repeatedly
   - ✓ Backfill once per data type per user (initial setup only)
   - **Impact:** Wasted API calls, risk of rate-limiting

### Integration Friction Points

- **No VO2 Max or HR Zone APIs:** You must compute from Health API data + Activity API results
- **Unofficial library breakage:** `garmin-connect` node module may break if Garmin changes web endpoints
- **Rate limit opacity:** Production tier limits not published; must ask Garmin directly
- **Data update semantics:** Health API may re-issue same date with updated summaries; latest always wins (idempotent handling required)

### Testing & Development

- Use evaluation consumer key for sandbox work (but expect throttling)
- User own Garmin device for testing (no test fixtures)
- Backfill once per user during dev; subsequent tests must use webhook/polling to avoid exhausting backfill quota

---

## 9. Architectural Recommendation for MAF Training App

### Approach A: Official Health API (Recommended for Production)

**Pros:**
- Guaranteed support, no scraping breakage risk
- OAuth 2.0 is industry standard
- Ping/Push enables real-time notifications
- Higher rate limits on production key

**Cons:**
- Longer approval process (2–4 weeks)
- Requires business entity setup
- Potential licensing fees for commercial use
- Must implement OAuth 2 + webhook server

**Tech Stack:**
- OAuth 2: `simple-oauth2` or `passport`
- HTTP client: `axios` or native `fetch`
- Webhook: Express middleware + request validation
- Storage: Cache daily summaries, index by userId + date

### Approach B: Unofficial garmin-connect Library (Quick MVP)

**Pros:**
- Rapid MVP (hours to first sync)
- No approval wait
- Simple Node.js library
- Works for <100 users

**Cons:**
- Web-scraping fragility (Garmin may change endpoints)
- No official support
- OAuth 1 → 2 migration required by EOY 2026
- Evaluation tier rate limits

**Tech Stack:**
- `garmin-connect` npm package
- Simple cron job for periodic sync
- User provides Garmin username/password or OAuth token

### Approach C: Third-Party Wrapper (Premium)

**Services:** Terra API, ROOK, Spike API, Thryve
- Handle Garmin auth, webhooks, data normalization
- **Cost:** Typically $0.01–0.10 per user/month
- **Benefit:** Abstraction, multi-wearable support, managed webhooks
- **Trade-off:** Vendor lock-in, latency (extra hop)

---

## 10. Implementation Roadmap (MAF App)

### Phase 1: Proof of Concept (Weeks 1–2)
- [ ] Register as business entity with Garmin
- [ ] Apply for developer access
- [ ] Receive evaluation consumer key
- [ ] Test with `garmin-connect` library + own device
- [ ] Sync activities, parse HR data

### Phase 2: OAuth 2 Integration (Weeks 3–4)
- [ ] Implement OAuth 2 PKCE flow
- [ ] Store access/refresh tokens securely
- [ ] Verify token refresh works
- [ ] Handle expired/revoked tokens

### Phase 3: Health API Sync (Weeks 5–6)
- [ ] Choose Push (webhook) or Pull (polling)
- [ ] Implement Health API endpoint calls
- [ ] Parse daily summaries, compute HR zones
- [ ] Store user data in DB

### Phase 4: Activity Ingestion (Weeks 7–8)
- [ ] Fetch Activity API summaries
- [ ] Download FIT files (if detailed analysis needed)
- [ ] Parse VO2 max, training effect
- [ ] Link activities to MAF training zones

### Phase 5: Production Hardening (Weeks 9–10)
- [ ] Request production consumer key
- [ ] Implement rate-limit handling + backoff
- [ ] Add comprehensive error handling
- [ ] Load test with dummy users

### Phase 6: Monitoring & Ops (Weeks 11+)
- [ ] Token refresh failures → alerting
- [ ] Webhook delivery failures → retry queue
- [ ] Data staleness checks (last sync timestamp)
- [ ] OAuth 1 deprecation plan (migrate by EOY 2026)

---

## Comparison: Official Health API vs Unofficial garmin-connect

| Aspect | Official Health API | Unofficial garmin-connect |
|--------|--------------------|-----------------------|
| **Auth** | OAuth 2.0 PKCE | OAuth 1/2 + basic auth |
| **Approval** | 2–4 weeks | None (immediate) |
| **Rate Limits** | Higher (production) | Low (web-scrape throttle) |
| **Support** | Garmin support available | Community-driven |
| **Stability** | Guaranteed (API contract) | Fragile (scraping breakage risk) |
| **Cost** | Free (business-only) | Free (self-hosted) |
| **Data Latency** | Hours (synced) | Hours (synced) |
| **Live HR** | Not available | Not available |
| **Scalability** | 1000s users | 10–100 users |
| **MVP Speed** | 3–4 weeks | 2–3 days |

**Recommendation:** Start with `garmin-connect` for fast MVP; migrate to official API at scale or when approaching 100 users.

---

## Unresolved Questions

1. **Exact production rate limits:** Garmin doesn't publish; requires direct ask during onboarding call
2. **Commercial licensing fees:** Depends on use case; need to clarify with Garmin sales if MAF app is "wellness coaching" vs other category
3. **VO2 Max accuracy & availability:** What % of activity types report VO2 max? (Running ✓, Cycling ✓, Walking ?)
4. **HR zone configuration:** Can app read user's configured HR zones from Garmin device, or must compute from formulas?
5. **Multi-device support:** If user has Fenix + Epix, do Health API summaries merge or separate?
6. **Data retention:** How long does Garmin retain historical summaries? (Assume indefinite, but not documented)
7. **Webhook signing:** Does Garmin sign webhook payloads with HMAC? (Not found in search results)

---

## Sources

- [Garmin Connect Developer Program Overview](https://developer.garmin.com/gc-developer-program/)
- [Garmin Health API Documentation](https://developer.garmin.com/gc-developer-program/health-api/)
- [Garmin Activity API Documentation](https://developer.garmin.com/gc-developer-program/activity-api/)
- [Garmin OAuth2.0 PKCE Specification PDF](https://developerportal.garmin.com/sites/default/files/OAuth2PKCE_1.pdf)
- [Garmin Developer Access Form](https://www.garmin.com/en-US/forms/GarminConnectDeveloperAccess/)
- [Garmin Connect Developer Program Agreement](https://www8.garmin.com/en-US/GARMINCONNECTDEVELOPERPROGRAMAGREEMENT/GARMINCONNECTDEVELOPERPROGRAMAGREEMENT_EN.pdf)
- [garmin-connect npm package](https://www.npmjs.com/package/garmin-connect)
- [Garmin Connect GitHub (Pythe1337N)](https://github.com/Pythe1337N/garmin-connect)
- [Integrating Garmin Health API into Serverless App (Medium, Feb 2026)](https://medium.com/@behnam.nikbakht/integrating-garmin-health-api-into-a-serverless-application-a-complete-guide-f5071a63f554)
- [ROOK Tech Documentation – Garmin Integration](https://docs.tryrook.io/data-sources/garmin/)
- [Terra API – Garmin Integration](https://tryterra.co/integrations/garmin)

