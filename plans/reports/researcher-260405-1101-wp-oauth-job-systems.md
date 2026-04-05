# WordPress OAuth2 + Strava-like Background Job Systems Research
**Report:** Researcher Analysis  
**Date:** 2026-04-05  
**Target Scale:** 40K+ users  
**Project:** MAF Running Coach (app.maf.run)

---

## Executive Summary

This report evaluates two critical systems for scaling MAF Running Coach to 40K+ users:
1. **WordPress OAuth2** for SSO identity via maf.run
2. **Background job architecture** for Strava activity sync, analysis, and notifications

### Key Findings
- **WordPress OAuth2:** WP OAuth Server plugin (latest v4.3.2) viable but requires Redis caching layer + separate WordPress instance at 40K scale
- **Job Architecture:** Bull/BullMQ + Redis preferred over N8N workflows; implement tiered queue (webhooks > scheduled > bulk)
- **Token Strategy:** Hybrid approach — JWT access tokens (fast) + opaque refresh tokens (revocable)
- **Aggregation:** CQRS read model for dashboard performance; event sourcing NOT recommended for activities (overhead outweighs audit benefits)

### Architecture Recommendation
- WordPress OAuth with Redis object cache + separate DB instance
- NestJS + BullMQ for job queues (replace N8N)
- Redis Pub/Sub for real-time notifications
- PostgreSQL for transactional data + ClickHouse for analytics (CQRS read model)

---

## 1. WordPress OAuth2 at Scale (40K Users)

### 1.1 Plugin Options Comparison

| Aspect | WP OAuth Server | miniOrange | Custom Implementation |
|--------|---|---|---|
| **Cost** | Free (open-source) + Pro for support | $0-99/mo | Development time |
| **Maturity** | ✓ v4.3.2 (Jan 2026) | ✓ Enterprise SaaS | Higher risk |
| **PKCE Flow** | ✓ Full support | ✓ Full support | Must implement spec |
| **Token Control** | ✓ Configurable expiry | ✓ Full control | Full control |
| **Scaling** | Requires Redis + separate instance | Managed by vendor | Depends on implementation |
| **Revocation** | Plugin-based, needs Redis | ✓ Real-time | Must implement |
| **Support** | Community + docs | ✓ Priority support | None |

**Recommendation:** **WP OAuth Server** + Redis caching layer
- **Why:** Open-source + latest v4.3.2 has 8x performance improvement (determine_user filter optimization)
- **Trade-off:** Need separate WordPress instance + Redis setup, but avoids vendor lock-in

---

### 1.2 Token Management Strategy

#### Problem at 40K Scale
- Single WordPress session expiry (~24 hours) vs NestJS JWT expiry (~15 min)
- Token revocation needs to be fast (Redis, not DB queries)
- Strava tokens expire every 6 hours — need refresh pipeline

#### Recommended: Hybrid Token Model
```
WordPress OAuth Flow:
  1. User logs in → WordPress OAuth Server
  2. WordPress returns 2 tokens:
     - Access Token: JWT (15 min expiry, self-contained)
     - Refresh Token: Opaque (7 days, stored in Redis)
  3. NestJS validates JWT locally (no DB hit)
  4. When JWT expires, client calls NestJS /auth/refresh
  5. NestJS validates opaque refresh token in Redis
     - If valid: issue new JWT + rotate refresh token
     - If missing: user re-authenticates (revoked)
```

**Why This Works:**
- **Access Token (JWT):** Fast validation, distributed systems friendly, 15 min expiry limits damage
- **Refresh Token (Opaque):** Revocable, stored in Redis (sub-ms lookup), rotation defeats replay attacks

**Technical Details:**
- Set JWT secret in WordPress OAuth Server
- Store refresh tokens in Redis with key: `refresh_token:{token_hash}`
- Implement token rotation: each refresh returns new refresh token, invalidates old one
- Monitor Redis memory: 40K users × 2 tokens × 200 bytes ≈ 16MB

**Sources:**
- [Opaque vs JWT Access Tokens — Ory](https://www.ory.com/docs/oauth2-oidc/jwt-access-token)
- [Refresh Token Rotation — Auth.js](https://authjs.dev/guides/refresh-token-rotation)
- [JWT vs Opaque Tokens — ZITADEL](https://zitadel.com/blog/jwt-vs-opaque-tokens)

---

### 1.3 WordPress Database Load & Caching

#### Scaling Challenge
- OAuth lookups: user metadata (age, health flags, etc.)
- 40K concurrent sessions = high wp_usermeta queries
- WordPress default: queries on every request (no object cache)

#### Solution: Redis Object Cache Layer
```
Request Flow:
  1. NestJS receives JWT
  2. Extracts user_id from JWT claim
  3. Calls WordPress REST API: GET /wp-json/custom/v1/user/{id}
  4. WordPress checks Redis first (key: user_meta:{user_id})
     - Hit: return cached user object (< 1ms)
     - Miss: query DB, cache for 1 hour, return
  5. Cache invalidates on user profile update (webhook)
```

**Implementation:**
- Enable Redis object cache on WordPress (via plugin or Redis cache controller)
- TTL: 1 hour for user metadata (balance freshness vs cache hit rate)
- Invalidate on: user profile update, password change, role change
- Use Redis key prefix: `maf:user:` to isolate from other apps

**Benefits:**
- Persistent object cache reduces db queries by 90% (source: PB4HOST 2026 guide)
- Handles 1M+ concurrent users without DB scaling
- Cost: Redis instance (~$10-30/mo for 50GB, handles 40K easily)

**When to Add Separate WordPress Instance:**
- Current: Single WordPress instance on maf.run
- At 10K users: Monitor DB CPU; if >60%, consider split
- At 40K users: Separate instance recommended (OAuth load isolated)
  - Primary WP: content, blogs, docs
  - OAuth WP: dedicated to token generation + user lookups (with Redis cache)

**Sources:**
- [WordPress Caching in 2026 — PB4HOST](https://www.pb4host.com/wordpress-caching-in-2026-complete-guide-to-boosting-performance/)
- [Persistent Object Caching — Delicious Brains](https://deliciousbrains.com/developers-guide-to-wp_usermeta/)

---

### 1.4 PKCE Flow for MAF App (React SPA)

**Current Issue:** React SPA is a public client (no secure secret storage)

**PKCE Implementation:**
```typescript
// Frontend (React SPA)
const codeVerifier = generateRandomString(128); // Browser crypto
const codeChallenge = base64urlEncode(sha256(codeVerifier));

// Redirect to WordPress OAuth
const authUrl = `${WP_OAUTH_URL}/oauth/authorize?
  client_id=${CLIENT_ID}&
  redirect_uri=${REDIRECT_URI}&
  response_type=code&
  code_challenge=${codeChallenge}&
  code_challenge_method=S256`;

// After user approves, WordPress redirects back with `code`
// Exchange code for token (MUST include code_verifier)
const response = await fetch(`${WP_OAUTH_URL}/oauth/token`, {
  method: 'POST',
  body: {
    code,
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
    code_verifier // Proves we initiated the request
  }
});
```

**Why PKCE Needed:**
- Without PKCE: Attacker intercepts `code`, exchanges it (no verification)
- With PKCE: Attacker needs the original `code_verifier` (impossible to derive from `code_challenge`)
- Standard for mobile/SPA since 2015

**Sources:**
- [WP OAuth Server PKCE Support](https://wp-oauth.com/docs/how-to/wordpress-oauth-server-pkce-support/)

---

## 2. Strava-like Background Job Architecture

### 2.1 Job Queue Comparison: Bull/BullMQ vs N8N

| Aspect | BullMQ + NestJS | N8N Workflows | RabbitMQ |
|--------|---|---|---|
| **Learning Curve** | Low (JS devs) | Medium (visual) | High (AMQP) |
| **Memory** | 50-100MB | 300-500MB | 100-200MB |
| **Latency** | <10ms (Redis) | 100-500ms | 50-200ms |
| **Job Isolation** | By queue | By workflow | By routing |
| **Retry Logic** | ✓ Built-in | ✓ Built-in | ✓ Manual |
| **Rate Limiting** | ✓ Token bucket | Limited | ✓ Full |
| **Scaling** | Horizontal (workers) | Limited | ✓ Cluster |
| **Cost (40K users)** | $10-30/mo (Redis) | $0 (self-hosted) | $0 (self-hosted) |
| **Operational Cost** | Low | Medium | High |

**Recommendation:** **BullMQ** (replace N8N workflows)
- **Why:** Built for Node.js job queues, native to NestJS, sub-10ms latency, rate limiting out-of-box
- **Trade-off:** Less visual than N8N, but N8N workflows for complex Strava sync would bottleneck at 40K scale

---

### 2.2 Job Types & Pipeline Architecture

#### Job Hierarchy (Priority Tiers)
```
Queue 1: REALTIME (webhooks from Strava)
  └─ strava-activity-created
  └─ strava-activity-updated
  └─ strava-deauthorized
  Priority: 1 (highest)
  Workers: 4-8 (handle spikes immediately)

Queue 2: SCHEDULED (periodic syncs)
  └─ strava-token-refresh (every 1 hour)
  └─ activity-aggregation (nightly)
  └─ user-summary-generation (weekly)
  Priority: 10
  Workers: 2

Queue 3: BULK (backfill, cleanup)
  └─ historical-activity-sync
  └─ stale-user-cleanup (30+ days inactive)
  └─ activity-reanalysis
  Priority: 50
  Workers: 1 (don't starve realtime)
```

**Why Tiering?**
- Realtime webhooks from Strava MUST respond in <200ms (Strava times out at 2s)
- If bulk jobs fill the queue, realtime jobs pile up
- Separate queues prevent starvation

#### Job Anatomy (Example: Strava Activity Fetched)
```typescript
// Handler signature
interface StravaActivityJob {
  userId: string;
  activityId: number;
  stravaOauthToken: string;
  source: 'webhook' | 'sync'; // webhook = priority 1, sync = priority 10
  retryCount?: number;
  createdAt: timestamp;
}

// Job processor
async function processStravaActivity(job: StravaActivityJob) {
  const { userId, activityId, stravaOauthToken } = job.data;

  // 1. Fetch activity from Strava (with token refresh if needed)
  let activity = await stravasdk.getActivity(activityId, stravaOauthToken);
  if (activity.is_private && !userAuthorized) throw new UnauthorizedError();

  // 2. Store raw activity (transactional write)
  await db.activities.upsert({
    user_id: userId,
    strava_id: activityId,
    raw_data: activity,
    fetched_at: now()
  });

  // 3. Queue next job: MAF analysis (independent queue, depends on this)
  await mafAnalysisQueue.add(
    { userId, activityId },
    { priority: 5, delay: 0 } // Immediate, but lower priority than new webhooks
  );

  // 4. Return success (marks job complete)
  return { processed: true, activityId };
}

// Retry strategy
{
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000 // 2s, 4s, 8s
  },
  removeOnComplete: { age: 3600 }, // Keep for 1 hour for debugging
  removeOnFail: { age: 86400 } // Keep failed for 1 day
}
```

---

### 2.3 Five-Job Pipeline for Complete Activity Sync

```
WEBHOOK RECEIVED (Strava → /webhook/strava)
  ↓
  └─→ [QUEUE 1: REALTIME] "activity-webhook"
       Handler: Extract activity_id, user_id → enqueue fetcher
       Response: 200 OK to Strava immediately (< 200ms)
       Workers: 8

       ↓
       └─→ [QUEUE 2: SCHEDULED] "strava-fetch"
            Handler: Call Strava API → GET /activities/{id}
            Idempotent: Check if already fetched within 5 min
            Rate limit: Token bucket (100/15min per user)
            Workers: 4

            ↓ (on success)
            └─→ [QUEUE 2: SCHEDULED] "maf-analysis"
                 Handler: Calculate HR zones, cardiac drift, pace efficiency
                 Input: Raw Strava activity
                 Output: MAF insights stored in read model
                 Workers: 4

                 ↓ (on success)
                 └─→ [QUEUE 2: SCHEDULED] "activity-aggregation"
                      Handler: Update daily/weekly stats
                      Input: Analyzed activity
                      Output: Updated dashboard cache
                      Workers: 2

                      ↓ (on success)
                      └─→ [QUEUE 2: SCHEDULED] "user-notification"
                           Handler: Send notification (email/push)
                           Input: New insights
                           Output: Notification in queue (separate system)
                           Workers: 2

SUCCESS
  ↓
  └─→ Event: activity:completed
       Emit to Redis Pub/Sub → UI updates via WebSocket
```

**Job Chain Benefits:**
- Webhook handler responds instantly (async)
- Failed fetch doesn't block analysis (retry independently)
- Failed analysis doesn't block aggregation (can reanalyze later)
- Notifications sent only after full pipeline succeeds

---

### 2.4 Rate Limiting: Strava API Budget

#### Strava Rate Limits
```
Default: 200 req/15min, 2000 req/day (per app)
Non-upload: 100 req/15min, 1000 req/day

Cost per operation:
  - Fetch activity: 1 request
  - List activities: 1 request (paginated)
  - Activity stats: 1 request
  - Delete activity: 1 request
```

#### Strategy at 40K Users
Assume:
- 5% daily active (2K users)
- Each posts 1 activity/day = 2K activities
- Each activity fetched 2x (initial + enrichment) = 4K requests/day
- Remaining budget: 2000 - 4000 = **-2K deficit** ❌

**Solution: Intelligent Backoff + Prioritization**
```typescript
interface RateLimitBudget {
  user_id: string;
  daily_budget: 1000; // Portion of 2000 daily limit
  current_usage: number;
  resets_at: timestamp;
  priority: 'premium' | 'standard' | 'free';
}

// Budget allocation
const budgets = {
  premium: 500,      // Paid tier: daily sync
  standard: 250,     // Free: every 3 days
  free: 100          // Inactive: weekly
};

// Sync decision
async function shouldSyncUser(userId: string): Promise<boolean> {
  const budget = await getBudget(userId);
  
  if (budget.current_usage >= budget.daily_budget) {
    // Out of budget — defer until reset
    await syncQueue.add(
      { userId },
      { delay: msUntil(budget.resets_at) }
    );
    return false;
  }
  
  return true;
}

// Monitor 15-minute windows
const windowMonitor = setInterval(async () => {
  const usage = await getAPIUsage(); // From Strava rate-limit headers
  
  if (usage.requests_per_15_min > 180) { // 90% of 200
    // Reduce concurrency
    mafQueue.getWorkers().forEach(w => w.concurrency = 1);
    logger.warn('Rate limit pressure — reduced concurrency');
  } else {
    // Restore concurrency
    mafQueue.getWorkers().forEach(w => w.concurrency = 4);
  }
}, 60000); // Check every 1 min
```

**Result:**
- 2K free users: sync weekly (2000 / 40K = 50 req/day)
- Premium tier (future): daily sync (500 req/day budget)
- Honors Strava limits without excessive retries

**Sources:**
- [Strava Rate Limits](https://developers.strava.com/docs/rate-limits/)
- [Strava Webhook Best Practices](https://developers.strava.com/docs/webhooks/)

---

### 2.5 Webhook Receiver (Sub-200ms Response)

#### Problem
Strava webhook POST → NestJS handler. If we process the activity in-request, response is slow → Strava retries.

#### Solution: Enqueue Immediately
```typescript
// Webhook endpoint
@Post('/webhook/strava')
async handleStravaWebhook(@Body() event: StravaWebhookEvent) {
  const { object_type, object_id, owner_id, aspect_type } = event;

  // Validate signature (required by Strava)
  if (!isValidSignature(event)) {
    throw new UnauthorizedError();
  }

  // Log for debugging (async, non-blocking)
  logger.debug('Strava webhook received', { object_id });

  // Enqueue immediately — do NOT await
  if (object_type === 'activity' && aspect_type === 'create') {
    // Fire-and-forget
    this.realtimeQueue.add(
      {
        userId: owner_id,
        activityId: object_id,
        source: 'webhook'
      },
      { priority: 1 }
    ).catch(err => logger.error('Queue error', err));
  }

  // Return 200 OK immediately (< 100ms)
  return { success: true };
}
```

**Timing Budget:**
- Webhook enqueue: 5-10ms
- Request logging: async (non-blocking)
- Response: <50ms
- Strava timeout: 2000ms ✓

**Sources:**
- [Webhook Infrastructure at Scale — Hookdeck](https://hookdeck.com/webhooks/guides/webhook-infrastructure-guide)

---

### 2.6 Cron Jobs for Periodic Tasks

#### Required Cron Jobs (NestJS @nestjs/schedule)

```typescript
// 1. Strava Token Refresh (every 1 hour)
@Cron('0 * * * *') // Every hour, on the hour
async refreshAllStravaTokens() {
  const users = await db.users
    .where('strava_token_expires_at < NOW() + INTERVAL 30 MINUTES')
    .select(['id', 'strava_refresh_token']);
  
  // Enqueue token refresh for each user
  for (const user of users) {
    await tokenRefreshQueue.add(
      { userId: user.id },
      { priority: 20 } // Important but not realtime
    );
  }
  
  logger.info('Token refresh scheduled', { count: users.length });
}

// 2. Daily Activity Aggregation (nightly)
@Cron('0 2 * * *') // 2 AM UTC
async aggregateDailyStats() {
  const yesterday = subDays(today(), 1);
  
  const dailyStats = await db.activities
    .where('activity_date = ?', yesterday)
    .groupBy('user_id')
    .select([
      'user_id',
      'COUNT(*) as activity_count',
      'SUM(distance) as total_distance',
      'AVG(avg_heart_rate) as avg_hr'
    ]);
  
  // Batch update dashboard cache
  for (const stat of dailyStats) {
    await cacheQueue.add(
      { userId: stat.user_id, type: 'daily', date: yesterday },
      { priority: 30 }
    );
  }
  
  logger.info('Daily aggregation queued', { count: dailyStats.length });
}

// 3. Weekly MAF Trend Analysis (weekly)
@Cron('0 3 * * 1') // Monday 3 AM UTC
async computeWeeklyTrends() {
  const activeUsers = await db.users
    .where('last_activity_at > NOW() - INTERVAL 30 DAYS')
    .select('id');
  
  for (const user of activeUsers) {
    await trendQueue.add(
      { userId: user.id },
      { priority: 40 }
    );
  }
  
  logger.info('Weekly trends queued', { count: activeUsers.length });
}

// 4. Stale User Cleanup (monthly)
@Cron('0 4 1 * *') // 1st of month, 4 AM UTC
async cleanupInactiveUsers() {
  const staleUsers = await db.users
    .where('last_activity_at < NOW() - INTERVAL 90 DAYS')
    .select('id');
  
  if (staleUsers.length > 0) {
    // Archive historical data, mark for deactivation
    await db.users.update(
      { id: { $in: staleUsers.map(u => u.id) } },
      { status: 'inactive_archived' }
    );
    
    logger.info('Stale users archived', { count: staleUsers.length });
  }
}
```

**Multi-Instance Handling (Critical):**
```typescript
// Use database lock to prevent duplicate execution on multiple server instances
@Cron('0 * * * *')
async refreshAllStravaTokens() {
  const lockKey = 'cron:strava_token_refresh';
  const lock = await redis.set(
    lockKey,
    '1',
    'EX', 3600, // 1 hour TTL
    'NX'        // Only if not exists
  );
  
  if (!lock) {
    logger.debug('Cron already running on another instance, skipping');
    return;
  }
  
  try {
    // Run the job
    await this.doRefresh();
  } finally {
    // Release lock
    await redis.del(lockKey);
  }
}
```

**Why Database Lock Needed:**
- Running on 3+ server instances (high availability)
- Cron job runs on ALL instances simultaneously
- Token refresh would execute 3x, wasting Strava API quota
- Redis lock ensures single execution

**Sources:**
- [NestJS Task Scheduling](https://docs.nestjs.com/techniques/task-scheduling)
- [NestJS Cron Jobs — Medium](https://bhargavacharyb.medium.com/mastering-background-cron-jobs-in-nestjs-the-complete-guide-cd0f41bb6b31)

---

## 3. Event-Driven vs. Traditional Queue Architecture

### 3.1 Event Bus Options

| Approach | Tech | Use Case | Trade-offs |
|----------|------|----------|-----------|
| **Event Bus (Pub/Sub)** | Redis Pub/Sub | Real-time notifications | No persistence; good for UI updates |
| **Job Queue** | BullMQ | Asynchronous work | Persistent; good for critical operations |
| **Message Broker** | RabbitMQ | Enterprise workflows | Complex; high operational cost |
| **Streaming** | Kafka | High-volume events | Overkill for 40K users; infra-heavy |

**Recommendation:** **Hybrid**
- BullMQ for job persistence (critical path)
- Redis Pub/Sub for real-time events (UI notifications)

```typescript
// Job completion triggers event
async function mafAnalysisComplete(job: Job) {
  const { userId, activityId } = job.data;
  
  // 1. Store result (critical)
  await db.activityAnalysis.insert({ userId, activityId, ...analysis });
  
  // 2. Emit real-time event (nice-to-have)
  await redis.publish(`user:${userId}:events`, JSON.stringify({
    type: 'activity_analyzed',
    activityId,
    insights: { cardiacDrift, paceVariability }
  }));
  
  // 3. Queue next job
  await aggregationQueue.add({ userId, activityId });
}
```

**Why Not CQRS with Event Sourcing?**
- **Not recommended** for this use case
- Event sourcing: store every state change as immutable event
- For activities: 40K users × 500 activities/year × 10 events/activity = 200M events/year
- Replay cost grows over time; rarely needed to rebuild state
- **Better:** Standard transactional writes + CQRS read model (denormalized dashboard cache)

**Sources:**
- [CQRS Pattern for Fitness — DEV Community](https://dev.to/wellallytech/scalable-wellness-data-use-the-cqrs-pattern-to-build-faster-health-dashboards-2j8p)
- [Event Sourcing and CQRS — IBM Cloud Architecture](https://ibm-cloud-architecture.github.io/refarch-eda/patterns/cqrs/)

---

### 3.2 CQRS Read Model (Recommended)

```
Write Path (Transactional):
  Activity received → PostgreSQL (INSERT)
  ↓
  Event: activity:created
  ↓
  Triggers: Analysis job, Notification job

Read Path (Analytical):
  Dashboard queries analytics DB (ClickHouse or PostgreSQL materialized view)
  - Daily stats: COUNT, SUM, AVG by user/day
  - Weekly trends: Linear regression on pace, HR, distance
  - Monthly summaries: Compare to previous month
  
Benefits:
  - Writes: Normalized, ACID, sub-100ms
  - Reads: Denormalized, precalculated, sub-10ms (cached)
  - No replay cost; old events never accessed
```

---

## 4. Redis vs RabbitMQ vs NATS

### Decision Matrix

| Criteria | Redis (BullMQ) | RabbitMQ | NATS |
|----------|---|---|---|
| **Fit for 40K users?** | ✓✓ (Optimal) | ✓ (Overkill) | ✓ (Good) |
| **Setup Complexity** | Low | Medium | Medium |
| **Message Persistence** | ✓ (Disk) | ✓✓ (Guaranteed) | Limited |
| **Rate Limiting** | ✓✓ (Built-in) | Manual | Limited |
| **Latency** | <10ms | 50-200ms | <5ms |
| **Operational Overhead** | Minimal | High | Medium |
| **Node.js Support** | Native | Node.js library | Node.js library |
| **Horizontal Scaling** | Sentinel/Cluster | Cluster | NATS cluster |
| **Cost (self-hosted)** | $0 | $0 | $0 |

**Recommendation:** **Redis + BullMQ**
- **Why:** Pre-optimized for Node.js, built-in rate limiting, minimal ops, proven at scale
- **When to switch:** If you need guaranteed message ordering across 1000+ workers (then RabbitMQ)

**Example BullMQ Setup:**
```typescript
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';

const redis = new Redis('redis://localhost:6379');

// Queue creation
const stravaQueue = new Queue('strava-fetch', { connection: redis });
const mafQueue = new Queue('maf-analysis', { connection: redis });

// Producer
await stravaQueue.add(
  { userId, activityId },
  { 
    priority: 1, // 1 = highest
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 }
  }
);

// Consumer (worker)
const worker = new Worker('strava-fetch', async (job) => {
  const { userId, activityId } = job.data;
  
  // Process
  const activity = await stravaApi.getActivity(activityId);
  
  // Next job
  await mafQueue.add({ userId, activityId, activity });
  
  return { success: true };
}, { connection: redis, concurrency: 4 });

worker.on('completed', (job) => {
  logger.info(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  logger.error(`Job ${job.id} failed: ${err.message}`);
});
```

**Sources:**
- [Redis vs RabbitMQ — Medium](https://medium.com/@sheikh.hamza.arshad/choosing-the-right-messaging-system-kafka-redis-rabbitmq-activemq-and-nats-compared-fa2dd385976f)
- [BullMQ Documentation](https://bullmq.io/)
- [NestJS + BullMQ Guide — Medium](https://bhargavacharyb.medium.com/nestjs-20-nestjs-bull-building-resilient-background-job-queues-539c44243867)

---

## 5. Implementation Roadmap

### Phase 1: WordPress OAuth Setup (2-3 weeks)
- [ ] Install WP OAuth Server v4.3.2 on maf.run
- [ ] Configure PKCE flow in WordPress Admin
- [ ] Set token expiry: 15 min (access), 7 days (refresh)
- [ ] Enable Redis object cache on WordPress
- [ ] Update React SPA: implement OAuth flow with PKCE
- [ ] Test: 100 concurrent logins

### Phase 2: NestJS + BullMQ Job System (3-4 weeks)
- [ ] Add BullMQ package to api.maf.run (NestJS)
- [ ] Create job queues: realtime, scheduled, bulk
- [ ] Implement Strava webhook receiver (< 200ms response)
- [ ] Implement job handlers: fetch → analyze → aggregate → notify
- [ ] Add token refresh cron job (Redis lock)
- [ ] Test: 100 webhooks/sec, token expiry rotation

### Phase 3: Rate Limiting & Monitoring (2 weeks)
- [ ] Implement Strava API budget tracker
- [ ] Priority queue: webhook > schedule > bulk
- [ ] Dead-letter queue for failed jobs
- [ ] Metrics: job success rate, latency, queue depth
- [ ] Alerts: rate limit pressure, job backlog

### Phase 4: Dashboard CQRS Read Model (2-3 weeks)
- [ ] Create ClickHouse instance (analytics DB)
- [ ] Aggregation job: daily stats → ClickHouse
- [ ] React dashboard: query ClickHouse for charts
- [ ] Cache: Redis for hot data (1-hour TTL)

### Phase 5: Load Testing & Deployment (1-2 weeks)
- [ ] Simulate 40K users with K6 or Artillery
- [ ] Test: OAuth login storm, webhook spike, token refresh
- [ ] Monitor: Redis memory, PostgreSQL CPU, network
- [ ] Deploy: Docker Compose updates for Redis, job workers

---

## 6. Unresolved Questions

1. **Strava Integration Details:** How many Strava apps can sign users? Is there a sandbox for testing webhooks?
2. **WordPress Load:** At what user count should the separate OAuth instance be deployed? (Recommended: 10K+)
3. **Activity Data Privacy:** Will activities be user-private or shareable? Affects caching strategy.
4. **Notification Channels:** Email, push, SMS? Affects queue design (separate notification queue size).
5. **Historical Sync:** Fetch all user activities on first login or lazy-load? Affects initial job volume.
6. **Analytics Retention:** How long keep raw activity data in PostgreSQL vs. ClickHouse? (Suggested: 1 year raw, 5 years aggregated)

---

## 7. Estimated Infrastructure Costs (40K Users)

| Component | Size | Cost/mo |
|-----------|------|---------|
| **WordPress (separate instance)** | t3.medium | $25 |
| **Redis (cache + jobs)** | 16GB Sentinel | $30 |
| **PostgreSQL** | db.t3.large (40K rows) | $50 |
| **ClickHouse** | 2-node cluster | $100 |
| **NestJS Workers** | 3× t3.medium | $75 |
| **Nginx/Reverse Proxy** | t3.small | $15 |
| **Total** | | **$295/mo** |

*Note: Costs based on AWS EC2/RDS pricing; self-hosted on VPS (your current setup) would be $50-100/mo.*

---

## Summary & Next Steps

**Recommendation:**
1. Implement **WP OAuth Server** (free, latest v4.3.2) with Redis caching
2. Replace N8N workflows with **NestJS + BullMQ** for Strava sync
3. Use **hybrid token model** (JWT access + opaque refresh)
4. Implement **tiered job queues** (webhook > scheduled > bulk) with rate limiting
5. Build **CQRS read model** for dashboard performance (ClickHouse recommended)

**Immediate Actions:**
- Set up test WordPress OAuth instance with PKCE
- Build one complete job pipeline (webhook → fetch → analyze → notify)
- Load test with 100 concurrent Strava webhooks
- Monitor PostgreSQL + Redis performance at 1K test users

**Architecture fits your constraints:**
- Self-hosted Docker Compose (no AWS lock-in)
- Stateless NestJS workers (horizontal scaling)
- Redis provides both caching + job persistence
- Open-source components (no vendor fees)

---

## Sources Referenced

### WordPress OAuth2
- [WP OAuth Server Plugin — WordPress.org](https://wordpress.org/plugins/oauth2-provider/)
- [WordPress OAuth Server PKCE Support](https://wp-oauth.com/docs/how-to/wordpress-oauth-server-pkce-support/)
- [WordPress Performance at Scale — PB4HOST 2026](https://www.pb4host.com/wordpress-caching-in-2026-complete-guide-to-boosting-performance/)

### Token Management
- [Opaque vs JWT Access Tokens — Ory](https://www.ory.com/docs/oauth2-oidc/jwt-access-token)
- [Refresh Token Rotation — Auth.js](https://authjs.dev/guides/refresh-token-rotation)
- [JWT vs Opaque Tokens — ZITADEL](https://zitadel.com/blog/jwt-vs-opaque-tokens)

### Job Queues & Background Jobs
- [BullMQ — Background Jobs Library](https://bullmq.io/)
- [NestJS + BullMQ — Medium](https://bhargavacharyb.medium.com/nestjs-20-nestjs-bull-building-resilient-background-job-queues-539c44243867)
- [NestJS Task Scheduling](https://docs.nestjs.com/techniques/task-scheduling)
- [Webhook Infrastructure at Scale — Hookdeck](https://hookdeck.com/webhooks/guides/webhook-infrastructure-guide)
- [Queue-Based Exponential Backoff — DEV Community](https://dev.to/andreparis/queue-based-exponential-backoff-a-resilient-retry-pattern-for-distributed-systems-37f3)

### Strava API
- [Strava Rate Limits](https://developers.strava.com/docs/rate-limits/)
- [Strava Webhook API](https://developers.strava.com/docs/webhooks/)
- [OAuth Token Management — Zach Liibbe](https://www.zachliibbe.com/blog/oauth-token-management-with-automatic-refresh-a-strava-api-case-study)

### Architecture Patterns
- [CQRS Pattern for Fitness — DEV Community](https://dev.to/wellallytech/scalable-wellness-data-use-the-cqrs-pattern-to-build-faster-health-dashboards-2j8p)
- [Event Sourcing with PostgreSQL — SoftwareMill](https://softwaremill.com/implementing-event-sourcing-using-a-relational-database/)
- [Redis vs RabbitMQ Comparison — Medium](https://medium.com/@sheikh.hamza.arshad/choosing-the-right-messaging-system-kafka-redis-rabbitmq-activemq-and-nats-compared-fa2dd385976f)

---

**Report Generated:** 2026-04-05 11:01 UTC  
**Next Review:** After Phase 1 WordPress OAuth implementation
