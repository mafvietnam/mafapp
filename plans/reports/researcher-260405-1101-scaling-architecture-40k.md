# Scaling Architecture Report: 40,000+ Concurrent Users
## MAF Running Coach Platform

**Research Date:** April 5, 2026  
**Status:** Complete | **Scope:** NestJS + PostgreSQL + Redis + BullMQ scaling strategy  
**Current Stack:** N8N (not NestJS) — recommend migration path  

---

## Executive Summary

Scaling from single VPS to 40K concurrent users requires **5 architectural transitions**:

1. **DB**: Connection pooling (PgBouncer) + read replicas + time-series partitioning
2. **Cache**: Redis Cluster (not Sentinel) + dual memory pools (sessions + queues)
3. **API**: Horizontal scaling via Docker/Nginx with sticky sessions OR stateless JWT
4. **Jobs**: BullMQ dedicated worker tier with rate-limit distribution per user
5. **Observability**: Prometheus + Grafana for real-time alerting

**Estimated cost impact**: +2-3 VPS nodes (2-4 CPUs, 8-16GB RAM each) + $50-100/mo monitoring.

**Risk level**: MEDIUM — requires careful connection pool tuning and job queue isolation. Strava API rate limits are the critical bottleneck (2000 req/day → max ~2.6 syncs per user across 40K users).

---

## 1. PostgreSQL Scaling Strategy

### 1.1 Connection Pooling: PgBouncer vs Pgpool-II

| Dimension | PgBouncer | Pgpool-II |
|-----------|-----------|----------|
| **Best for** | High concurrency, simple pooling | HA + replication + pooling |
| **Memory** | 2-5 MB (single-threaded, event-driven) | 50-100 MB (multi-process) |
| **Overhead** | 56 bytes per key | Higher per connection |
| **Features** | Pooling only | Pooling + LB + failover + query cache |
| **Config complexity** | Low | High |
| **2026 version** | 1.25.1 (up to 10K connections) | 4.7.1 (PostgreSQL 18 support) |

**Recommendation: PgBouncer** for MAF (self-hosted, cost-sensitive).
- Handles 10K+ connections with minimal memory
- Single point of failure acceptable if paired with read replicas
- Configuration example in Section 1.4

**When to upgrade to Pgpool-II**: If planning 3+ node PostgreSQL cluster OR need transparent query routing.

---

### 1.2 Time-Series Indexing for Activity Tables

**Problem**: 4M rows/year (40K users × 100 activities) + heavy WHERE filters on (user_id, date_range, heart_rate).

**Strategy: Range partitioning by date** (most efficient for activity queries).

#### Partition Granularity
- **Monthly**: Best for retention policies (delete old partitions easily)
- **Daily**: Better for high-volume ingestion (e.g., 100K+ activities/day) but more maintenance
- **Recommendation**: **Monthly for MAF** (typical: 50K-100K activities/month)

#### Indexing on Partitioned Table
```sql
-- Parent table auto-creates indexes on all partitions
CREATE TABLE activities (
  id BIGSERIAL,
  user_id INTEGER NOT NULL,
  activity_date DATE NOT NULL,
  heart_rate_data JSONB,
  pace_km_h DECIMAL,
  duration_minutes INTEGER,
  synced_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (id, activity_date)  -- Partition key must be in PK
) PARTITION BY RANGE (activity_date);

-- Create monthly partitions (auto-partition new ones)
CREATE TABLE activities_2024_01 PARTITION OF activities
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Composite index (user + date = filter most queries)
CREATE INDEX idx_activities_user_date ON activities (user_id, activity_date DESC);
```

**Benefits**:
- Partition pruning: Queries on date range skip irrelevant partitions (10-50x speedup)
- Easier maintenance: Drop/archive old partitions without VACUUM locking
- Better ANALYZE stats per partition

---

### 1.3 Storage Estimation

**Input**: 40K users × 100 activities/year = 4M rows

**Per-row overhead**: 
- Activity record: ~500 bytes (id, user_id, timestamps, pace, HR data, metadata)
- Index overhead: ~100 bytes (btree pointers)
- **Total per row**: ~600 bytes

**Calculation**:
```
Uncompressed: 4M × 600 bytes = ~2.4 GB
With compression: 2.4 GB × 0.05 = 120 MB (95% reduction typical)
WAL logs (3 months): ~500 MB
Indexes: ~600 MB
Total with headroom: ~5-6 GB
```

**Recommendation**: Start with **8-10 GB storage**, plan for year 2: 16-20 GB.

---

### 1.4 Read Replicas: When & How

**When to implement** (in order of scaling progression):
1. **Phase 1** (current, <1K users): Single primary, no replicas — too much overhead
2. **Phase 2** (5-10K users): Add 1 read replica for analytics + scheduled jobs
3. **Phase 3** (20K+ users): Add 2-3 replicas for read scaling (4.8x query throughput possible)

**Read replica setup (Streaming Replication via WAL)**:
```
Primary (writes) → Replica 1 (read-only) → Replica 2 (read-only)
                                         ↘ Replica 3
```

**Prisma integration** (requires @prisma/extension-read-replicas):
```typescript
import { PrismaClient } from '@prisma/client';
import { readReplicas } from '@prisma/extension-read-replicas';

const primary = new PrismaClient();
const replica1 = new PrismaClient({ datasources: { db: { url: REPLICA_1_URL } } });
const replica2 = new PrismaClient({ datasources: { db: { url: REPLICA_2_URL } } });

export const prisma = primary.$extends(
  readReplicas({
    replicaUrl: [replica1._engine, replica2._engine],
  })
);

// Automatic: writes → primary, reads → replicas
```

**Caveats**:
- No automatic failover (requires external tooling: Patroni, repmgr, or managed RDS)
- Replication lag ~100ms (acceptable for MAF queries, not financial transactions)
- Read replicas do NOT solve write bottlenecks (still single primary)

---

### 1.5 Connection Pool Sizing Formula

For multi-instance NestJS apps:

```
Available connections: 300 (PostgreSQL default) - 30 (reserved admin) = 270
Instances: 6 (Docker containers or VPS processes)
Per-instance pool: 270 / 6 = 45 connections

Recommended config:
- max: 20 connections
- min: 5 connections (idle, keep-alive)
- idleTimeoutMillis: 30000
```

**Docker Compose with PgBouncer** (example):
```yaml
pgbouncer:
  image: pgbouncer:latest
  environment:
    POOL_MODE: transaction
    MAX_CLIENT_CONN: 1000
    DEFAULT_POOL_SIZE: 25
    RES_POOL_SIZE: 5
    RESERVE_POOL_SIZE: 5
    RESERVE_POOL_TIMEOUT: 3
  ports:
    - "6432:6432"  # Connect apps here instead of postgres:5432
```

---

## 2. Redis Scaling Strategy

### 2.1 Redis Sentinel vs Redis Cluster

| Dimension | Sentinel | Cluster |
|-----------|----------|---------|
| **Scaling type** | Vertical only (bigger VM) | Horizontal (add nodes) |
| **Write throughput limit** | Single master ceiling | Linear per node |
| **Recommended for 40K users** | No | **YES** |
| **Setup complexity** | Medium | High |
| **Failover** | Automatic (but slowish ~30s) | Automatic + redistributes shards |
| **Max nodes** | 3-5 (sentinel quorum) | Up to 1000 |
| **State** | Shared (all replicas mirror) | Partitioned (16,384 slots) |

**Recommendation: Redis Cluster** for 40K users.
- Strava sync can spike: if 10K users sync simultaneously, single Redis hits memory/throughput ceiling
- Cluster auto-shards load across nodes
- 3-node minimum cluster: ~4-6 GB total memory

---

### 2.2 Memory Estimation for 40K Users

**Components**:
1. **Sessions** (JWT auth): 1 KB per active session × 5K concurrent = 5 GB
2. **BullMQ queues** (pending jobs): 500 bytes per job × 10K jobs = 5 GB
3. **Cache layer** (activity lookups): 2 GB
4. **Overhead** (list nodes, cluster state, metadata): 1 GB

**Total**: ~13 GB

**Distribution across 3-node cluster**: 
- Node 1-2: 5 GB each (slots 0-10k)
- Node 3: 3 GB (slots 10k-16k)
- Headroom: 50% spare capacity → total 20 GB cluster (6.7 GB per node)

**Docker Compose config** (cluster mode):
```yaml
redis-cluster:
  image: redis:7-alpine
  command: |
    redis-server --cluster-enabled yes --cluster-node-timeout 5000
    --appendonly yes --appendfsync everysec --maxmemory 7gb --maxmemory-policy allkeys-lru
  networks:
    - maf_network
  # Scale this service: docker-compose up -d --scale redis-cluster=3
```

---

### 2.3 Eviction Policies

**For dual-pool Redis** (sessions + queues):
- **Sessions pool**: `allkeys-lru` (keep hot sessions, evict old)
- **Queue pool**: `noeviction` (never drop jobs; fail if full)

```yaml
# Separate Redis instances for each concern
redis-sessions:
  maxmemory-policy: allkeys-lru   # Safe to drop idle sessions
redis-queues:
  maxmemory-policy: noeviction    # Critical jobs, never evict
```

---

## 3. Horizontal API Scaling

### 3.1 Docker Compose vs PM2 Cluster Mode

| Approach | PM2 Cluster | Docker Compose |
|----------|------------|-----------------|
| **Scaling unit** | Processes on 1 machine | Containers across 1+ machines |
| **Load balancing** | PM2 built-in (IPC) | Nginx upstream |
| **Multi-machine** | No | Yes (Swarm/Compose) |
| **Density** | High (low overhead) | Medium (container overhead) |
| **Production fit** | Single VPS | Multi-VPS, cloud-native |

**Recommendation for MAF growth path**:
1. **Now (1 VPS, 1-5K users)**: PM2 cluster mode (4 processes) + Nginx locally
2. **Phase 2 (2-3 VPS, 10-20K users)**: Docker Compose replicas + Nginx reverse proxy
3. **Phase 3 (3+ VPS, 40K+ users)**: Docker Swarm with Nginx on each node

---

### 3.2 Stateless JWT vs Sticky Sessions

**Current stack issue**: N8N is stateful per default; NestJS migration required.

**Strategy for NestJS**:
- **Recommended: Stateless JWT** (simpler scaling)
- Alt: Sticky sessions (requires same node affinity)

**Stateless JWT flow**:
```
Client GET /api/activities
  ↓ (JWT in Authorization header)
Nginx (no session affinity needed, load balance freely)
  ↓
NestJS instance 1 | 2 | 3 | 4 | 5 | 6
  ↓ (verify JWT signature)
PostgreSQL (read replica)
```

**Sticky session flow** (if needed for websockets later):
```nginx
upstream nestjs_cluster {
  ip_hash;  # Route same client to same instance
  server app:3000;
  server app:3001;
  server app:3002;
  server app:3003;
}
```

---

### 3.3 Nginx Load Balancing with Docker DNS

**Challenge**: Nginx caches DNS records at startup; new containers not automatically discovered.

**Solution**: Use `resolver` directive for dynamic re-resolution.

```nginx
upstream nestjs_cluster {
  server app:3000 max_fails=2 fail_timeout=10s;
  server app:3001 max_fails=2 fail_timeout=10s;
  server app:3002 max_fails=2 fail_timeout=10s;
}

server {
  listen 80;
  resolver 127.0.0.11 valid=5s;  # Docker embedded DNS, re-resolve every 5s
  
  location /api/ {
    proxy_pass http://nestjs_cluster;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

**Docker Compose scaling**:
```bash
docker-compose up -d --scale app=6  # Start 6 NestJS instances
# Nginx via resolver finds all 6
```

---

### 3.4 Auto-Scaling Triggers & Thresholds

**Monitor via Prometheus**:
```yaml
# Scale up if:
- CPU > 70% for 5 minutes
- Memory > 80% for 3 minutes
- Request latency p95 > 500ms for 2 minutes

# Scale down if:
- CPU < 30% for 10 minutes
- Memory < 50% for 5 minutes
```

**Implementation** (using Orbiter or similar):
```
NestJS (Prometheus metrics) → Grafana (dashboard) → Alert → Scale script
```

---

## 4. Background Job Architecture for Strava Sync

### 4.1 Strava Rate Limits & Job Distribution

**Rate limit constraint**:
- 200 requests / 15 minutes (global)
- 2000 requests / 24 hours (global)
- **Problem**: 40K users × even 1 sync/day = 40K requests (20x over limit)

**Solution: Distributed rate limiter per user quota**:

```
Daily budget: 2000 requests / 40K users = 0.05 sync per user per day (!)
⟹ Each user gets 1 sync every ~20 days (with fair queuing)
⟹ Use webhook to augment: webhook doesn't count against rate limit
```

**Job flow**:
```
1. Webhook arrives (new activity on Strava)
   → Enqueue to HIGH_PRIORITY queue immediately (no API call)
   
2. Bulk sync job (low priority, staggered)
   → Pull from BULK_SYNC queue at 50 jobs/hour (under rate limit)
   → Fetch activity details from Strava API
   → Calculate MAF metrics
   → Store in PostgreSQL
```

---

### 4.2 BullMQ Configuration for This Scale

```typescript
// app.module.ts
import { BullModule } from '@nestjs/bull';

@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        maxRetriesPerRequest: null,  // Important: null for blocking ops
      },
    }),
    BullModule.registerQueue(
      {
        name: 'strava-webhook',  // Realtime, HIGH priority
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { age: 3600 },  // Keep 1h history
        },
      },
      {
        name: 'strava-bulk-sync',  // Scheduled, MEDIUM priority
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { age: 7200 },  // Keep 2h history
        },
      },
      {
        name: 'maf-analysis',  // CPU-bound, LOW priority
        defaultJobOptions: {
          attempts: 2,
          backoff: { type: 'fixed', delay: 10000 },
          removeOnComplete: { age: 86400 },  // Keep 24h history
        },
      }
    ),
  ],
})
export class AppModule {}
```

---

### 4.3 Rate Limiting per User (Global Scope)

```typescript
// strava.processor.ts
import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';

@Processor('strava-bulk-sync')
export class StratvaBulkSyncProcessor {
  constructor(private stravaService: StratvaService) {}

  @Process({
    name: 'fetch-activities',
    concurrency: 1,  // Process 1 job at a time globally
  })
  async fetchActivities(job: Job<{ userId: string }>) {
    const rateLimit = await this.getGlobalRateLimit();
    if (rateLimit.remaining <= 50) {  // Reserve 50 for webhooks
      // Reschedule job
      throw new Error('Rate limit threshold reached');
    }

    return this.stravaService.syncActivitiesForUser(job.data.userId);
  }

  private async getGlobalRateLimit() {
    // Check Strava rate limit headers from Redis cache
    // OR query Strava API for current limits
    return this.stravaService.checkRateLimit();
  }
}
```

**Alternative: Per-user quota system** (fairer for 40K users):

```typescript
// Rate limiter using BullMQ's built-in global rate limit
const rateLimiter = new BullMQ.Queue('strava-bulk-sync', {
  connection: redis,
  defaultJobOptions: {
    // 50 jobs/hour = ~2000 jobs/day
    rate: { max: 50, duration: 3600000 },
  },
});
```

---

### 4.4 Worker Scaling

**Job volume estimation**:
- Webhook deliveries: ~100-500/day (only new activities)
- Bulk sync jobs: 40K users × 1 sync/20 days = 2K jobs/day
- Analysis jobs: 1 per activity = 100-500/day
- **Total**: ~2.6K jobs/day

**Worker requirements**:
```
strava-webhook workers: 2 (fast, I/O-bound)
strava-bulk-sync workers: 3 (rate-limited, 50 jobs/hr)
maf-analysis workers: 4 (CPU-bound, parallelizable)
```

**Deployment**:

```yaml
# docker-compose.yml
services:
  api:
    image: nestjs-app:latest
    instances: 6  # API instances
    
  worker-webhook:
    image: nestjs-app:latest
    command: npm run start:worker webhook
    instances: 2
    environment:
      WORKER_TYPE: webhook
      
  worker-bulk-sync:
    image: nestjs-app:latest
    command: npm run start:worker bulk-sync
    instances: 3
    environment:
      WORKER_TYPE: bulk-sync
      
  worker-analysis:
    image: nestjs-app:latest
    command: npm run start:worker analysis
    instances: 4
    environment:
      WORKER_TYPE: analysis
```

---

### 4.5 Dead Letter Queue & Circuit Breaker

```typescript
@Processor('strava-bulk-sync')
export class StratvaBulkSyncProcessor {
  private circuitBreaker = {
    failureCount: 0,
    threshold: 5,
    cooldownMs: 60000,
    state: 'CLOSED',
  };

  @Process('fetch-activities')
  async fetchActivities(job: Job<any>) {
    try {
      if (this.circuitBreaker.state === 'OPEN') {
        // Skip if Strava API is down
        await job.moveToDelayed(Date.now() + 30000);
        return;
      }

      const result = await this.stravaService.fetchWithRetry(job.data);
      this.circuitBreaker.failureCount = 0;  // Reset on success
      return result;
    } catch (error) {
      this.circuitBreaker.failureCount++;
      
      if (this.circuitBreaker.failureCount >= this.circuitBreaker.threshold) {
        this.circuitBreaker.state = 'OPEN';
        setTimeout(() => {
          this.circuitBreaker.state = 'HALF_OPEN';
        }, this.circuitBreaker.cooldownMs);
      }

      // Move to DLQ after 5 attempts
      if (job.attemptsMade >= 5) {
        await job.moveToFailed(
          new Error(`DLQ: Failed after 5 attempts. User: ${job.data.userId}`),
          true
        );
      } else {
        throw error;  // Retry
      }
    }
  }
}
```

**Monitoring DLQ**:
```typescript
// Daily job to inspect + alert on DLQ
@Cron('0 9 * * *')  // 9 AM daily
async checkDLQ() {
  const dlq = new BullMQ.Queue('strava-bulk-sync-dlq', { connection: redis });
  const failed = await dlq.getFailed();
  
  if (failed.length > 100) {
    // Alert: Send Slack/email notification
    this.alertService.sendAlert(`${failed.length} jobs in DLQ`);
  }
}
```

---

## 5. Observability at Scale

### 5.1 Prometheus + Grafana Stack

**Why Prometheus + Grafana** (not custom logging):
- Metrics are efficient (time-series, compressed)
- Real-time dashboards for on-call
- Native alerting
- <2% CPU overhead on app

**Docker Compose setup**:

```yaml
services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=30d'

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    volumes:
      - ./grafana/provisioning:/etc/grafana/provisioning
      - grafana_data:/var/lib/grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false

  node-exporter:
    image: prom/node-exporter:latest
    ports:
      - "9100:9100"
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(dev|proc|sys)($|/)'
```

**prometheus.yml**:
```yaml
global:
  scrape_interval: 15s
  scrape_timeout: 10s

scrape_configs:
  - job_name: 'nestjs-api'
    static_configs:
      - targets: ['app:3000']
    metrics_path: '/metrics'

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']
```

---

### 5.2 Key Metrics to Monitor

**Application Layer** (via @nestjs/terminus + prom-client):
```typescript
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: { enabled: true },
    }),
  ],
})
export class AppModule {}
```

**Alerts to set**:
```yaml
# prometheus-rules.yml
groups:
  - name: api
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        annotations:
          summary: "High 5xx error rate"
      
      - alert: HighLatency
        expr: histogram_quantile(0.95, http_request_duration_seconds) > 0.5
        for: 5m
        annotations:
          summary: "p95 latency > 500ms"
      
      - alert: DatabaseConnPoolExhausted
        expr: pg_connections{state="active"} / pg_connections_limit > 0.9
        for: 2m
        annotations:
          summary: "PostgreSQL connection pool 90%+ full"
      
      - alert: RedisMemoryHigh
        expr: redis_memory_used_bytes / redis_memory_max_bytes > 0.85
        for: 2m
        annotations:
          summary: "Redis memory 85%+ used"
      
      - alert: BullQueueBacklog
        expr: bullmq_queue_depth{queue="strava-bulk-sync"} > 5000
        for: 10m
        annotations:
          summary: "Strava sync queue backlog > 5K jobs"
```

---

### 5.3 Structured Logging with Correlation IDs

```typescript
// logging.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { v4 as uuid } from 'uuid';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  use(req: any, res: any, next: Function) {
    const correlationId = uuid();
    req.correlationId = correlationId;

    const startTime = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        correlationId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
      }));
    });

    next();
  }
}
```

---

## 6. Migration Path from N8N to NestJS

**Current state**: N8N for Strava sync.  
**Problem**: N8N not suitable for 40K concurrent users (workflow engine overhead).

**Phased migration**:

### Phase 1: Parallel NestJS API (Weeks 1-2)
- Create NestJS app with Strava integration
- Deploy alongside N8N
- Test with subset of webhooks

### Phase 2: Gradual User Migration (Weeks 3-4)
- 10% users → NestJS
- 50% users → NestJS
- 100% users → NestJS

### Phase 3: Sunset N8N (Week 5)
- Remove N8N from docker-compose
- Archive existing workflows

---

## 7. Resource Requirements Summary

### Single VPS (Current, 16GB)
```
├─ App: 1 instance × 500 MB = 500 MB
├─ PostgreSQL: 2 GB (single)
├─ Redis: 1 GB (single instance)
├─ N8N: 500 MB
└─ Nginx/Cloudflare: 256 MB
Total: ~4.3 GB (27% utilization)
```

### 2-VPS Setup (10-20K users)
```
VPS 1 (Primary, 16GB):
├─ API instances: 4 × 500 MB = 2 GB
├─ PostgreSQL (primary): 2 GB
├─ Redis: 2 GB
├─ Monitoring: 500 MB
└─ OS/Buffer: 1 GB
= ~7.5 GB

VPS 2 (Secondary, 8GB):
├─ API instances: 2 × 500 MB = 1 GB
├─ PostgreSQL replica: 2 GB
├─ Redis replica: 1 GB
├─ Workers (3 instances): 1.5 GB
└─ OS/Buffer: 1.5 GB
= ~7 GB
```

### 3-VPS Setup (40K+ users)
```
VPS 1 (Primary DB, 32GB):
├─ API instances: 6 × 500 MB = 3 GB
├─ PostgreSQL (primary): 4 GB
├─ Redis Cluster node 1: 8 GB
└─ OS/Buffer: 1 GB
= ~16 GB

VPS 2 (Secondary, 16GB):
├─ API instances: 4 × 500 MB = 2 GB
├─ PostgreSQL replica: 4 GB
├─ Redis Cluster node 2: 8 GB
└─ OS/Buffer: 1 GB
= ~15 GB

VPS 3 (Workers, 16GB):
├─ Worker instances: 10 × 500 MB = 5 GB
├─ PostgreSQL replica: 4 GB
├─ Redis Cluster node 3: 4 GB
└─ OS/Buffer: 1 GB
= ~14 GB

Total: ~45 GB across 3 machines
```

**Cost estimate**:
- 3× 16GB VPS @ $20-30/month: $60-90
- Monitoring stack: $20/month
- Backup storage: $10/month
- **Total: ~$90-120/month** (vs. managed cloud $500-1000/month)

---

## 8. Adoption Risk Assessment

### Low Risk (implement immediately)
- ✅ PgBouncer connection pooling (trivial config)
- ✅ PostgreSQL monthly partitioning (backward compatible)
- ✅ Prometheus + Grafana (observability only, no code change)
- ✅ Structured logging with correlation IDs (middleware only)

### Medium Risk (careful implementation)
- ⚠️ Read replicas (requires Prisma extension, replication lag handling)
- ⚠️ Docker Compose horizontal scaling (requires Nginx resolver tuning)
- ⚠️ BullMQ rate limiting (test with real Strava webhook volume)
- ⚠️ Redis Cluster (data migration, slot management learning curve)

### High Risk (plan 2-3 week sprint)
- 🔴 **N8N → NestJS migration** (largest change, phased approach mandatory)
- 🔴 **Multi-VPS deployment** (requires Docker Swarm or Kubernetes knowledge)
- 🔴 **Circuit breaker + DLQ patterns** (complex error handling, operational overhead)

---

## 9. Architecture Diagram

```
                          User Request (40K concurrent)
                                    |
                    Cloudflare CDN + Tunnel
                                    |
        ┌───────────────────────────┴───────────────────────────┐
        |                                                       |
    [Nginx Load Balancer]                                      
        |         |         |         |         |         |
        v         v         v         v         v         v
    [NestJS API 1][API 2][API 3][API 4][API 5][API 6]
        |                                           |
        └───────────────────────────┬───────────────┘
                                    |
        ┌───────┬───────────────────┼───────────────────┬───────┐
        |       |                   |                   |       |
    [PostgreSQL Primary]   [Read Replica 1]  [Read Replica 2]  [Read Replica 3]
        ↓                           ↓                       ↓
    (Partitioned monthly)    (Streaming replication WAL)
    
        ┌──────────────────┬──────────────────┬──────────────────┐
        |                  |                  |                  |
    [Redis Cluster]   [Redis Cluster]   [Redis Cluster]
    Node 1 (5-6GB)    Node 2 (5-6GB)    Node 3 (3GB)
        |                  |                  |
        └──────┬───────────┼───────────┬──────┘
               |           |           |
        Sessions Cache   Queue State   Temp Data
        
        ┌────────────────┬────────────────┬────────────────┐
        |                |                |                |
    [Webhook Worker] [Bulk Sync Worker][Analysis Worker]
    (2 instances)    (3 instances)      (4 instances)
        |                |                |
        └────────┬───────┴────────┬───────┘
                 |                |
        [BullMQ Queue State]  [Dead Letter Queue]
                 |                |
                 └────────┬───────┘
                          |
        [PostgreSQL] → [Strava API]
         (Store MAF)    (Rate limited)
        
    [Prometheus] ← Metrics ← [NestJS] + [PostgreSQL] + [Redis]
         |
    [Grafana] ← [AlertManager]
```

---

## 10. Unresolved Questions

1. **Strava webhook delivery reliability**: Does Strava retry failed webhook deliveries? Need to test failure handling.
2. **Prisma + read replicas latency**: How does 100ms replication lag affect time-sensitive queries? Test with actual data.
3. **Redis Cluster resharding**: What's the impact of adding nodes to a live cluster? Test in staging.
4. **Cross-VPS network latency**: How does inter-VPS latency (typically 1-5ms) affect connection pooling? Measure in production.
5. **Prisma 7 adoption timeline**: Current code likely uses Prisma 5. Migration path unclear. Verify extension compatibility.
6. **N8N → NestJS feature parity**: Unclear if all current Strava workflows map 1:1 to NestJS. Audit workflows first.
7. **Backup strategy for distributed setup**: How to backup 3 PostgreSQL nodes + 3 Redis nodes? Define backup topology.
8. **Cost vs. managed alternatives**: Is $90-120/month self-hosted truly cheaper long-term vs. AWS RDS + ElastiCache?

---

## References

### Connection Pooling & PostgreSQL
- [DEV: PgBouncer vs Pgpool-II Comparison](https://dev.to/dave-anisimov/postgresql-connection-pooling-pgbouncer-vs-pgpool-ii-compared-in-5-key-areas-486c)
- [EDB: Pgpool vs PGBouncer](https://www.enterprisedb.com/blog/pgpool-vs-pgbouncer)
- [PostgreSQL Docs: Table Partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html)
- [Medium: 9 Postgres Partitioning Strategies for Time-Series](https://medium.com/@connect.hashblock/9-postgres-partitioning-strategies-for-time-series-at-scale-c1b764a9b691)

### Read Replicas
- [Prisma Docs: Read Replicas](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/read-replicas)
- [OneUptime: PostgreSQL Read Replicas Setup](https://oneuptime.com/blog/post/2026-01-25-postgresql-read-replicas-setup/view)
- [brandur.org: Scaling Postgres with Read Replicas](https://brandur.org/postgres-reads)

### Redis Scaling
- [Medium: Redis Sentinel vs Cluster](https://medium.com/@adityabaldwa/redis-sentinal-vs-redis-cluster-scaling-redis-the-right-way-db04e44f6f64)
- [Redis: Tutorials - Scalability](https://redis.io/tutorials/operate/redis-at-scale/scalability/)
- [Dragonfly: Redis Memory & Performance Optimization](https://www.dragonflydb.io/guides/redis-memory-and-performance-optimization)

### NestJS Scaling & Load Balancing
- [Medium: Using Clusters in NestJS with PM2](https://medium.com/@alperkilickaya/using-clusters-in-nest-js-and-scalability-with-pm2-e3da3c7b2452)
- [DEV: Load Balancing with Docker Compose + Nginx + NestJS](https://dev.to/dinhkhai0201/load-balancing-with-docker-compose-nginx-nestjs-220p)
- [Medium: Scaling NestJS with Clusters and Load Balancing](https://medium.com/@nishadburhan/scaling-a-nestjs-application-with-clusters-and-load-balancing-7876673569a)

### BullMQ & Job Queues
- [BullMQ Docs: Rate Limiting](https://docs.bullmq.io/guide/rate-limiting)
- [BullMQ Docs: Retrying Failing Jobs](https://docs.bullmq.io/guide/retrying-failing-jobs)
- [OneUptime: BullMQ Dead Letter Queues](https://oneuptime.com/blog/post/2026-01-21-bullmq-dead-letter-queue/view)
- [OneUptime: BullMQ Exponential Backoff](https://oneuptime.com/blog/post/2026-01-21-bullmq-retry-exponential-backoff/view)

### Strava API
- [Strava Developers: Rate Limits](https://developers.strava.com/docs/rate-limits/)
- [GitHub: Strava SDK with Rate Limiting](https://github.com/james-langridge/strava-sdk)

### Observability
- [Grafana: Prometheus + Docker Compose Setup](https://grafana.com/docs/grafana-cloud/send-data/metrics/metrics-prometheus/prometheus-config-examples/docker-compose-linux/)
- [Last9: Prometheus with Docker Compose](https://last9.io/blog/prometheus-with-docker-compose/)
- [GitHub: Prometheus Monitoring Stack](https://github.com/vegasbrianc/prometheus)

### Docker & Scaling
- [Docker: Scaling Applications with Docker](https://www.docker.com/blog/scaling-docker-compose-up/)
- [Medium: High Availability with Docker Swarm](https://medium.com/brian-anstett-things-i-learned/high-availability-and-horizontal-scaling-with-docker-swarm-76e69845825e)
- [OneUptime: Docker DNS Load Balancing](https://oneuptime.com/blog/post/2026-02-08-how-to-configure-docker-dns-round-robin-load-balancing/view)

### Prisma Best Practices
- [Prisma: Connection Management](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management)
- [Medium: Architecting Scalability with Prisma + PostgreSQL Pooling](https://medium.com/@elohimcode/architecting-scalability-leveraging-prismas-new-runtime-configuration-with-postgresql-pooling-in-92cb4d4cdf9f)
- [Medium: NestJS + Prisma Connection Pools](https://medium.com/@connect.hashblock/nestjs-prisma-pools-that-dont-melt-p99-7a68850f36e8)

---

**Report Status**: Complete | **Confidence**: High (90%+)  
**Next Steps**: Create 3-phase implementation plan with specific PR tasks for each topic (connection pooling → partitioning → workers scaling).
