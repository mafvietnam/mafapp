# Deployment Guide

## Quick Start

### Development (Local)
```bash
# Clone & setup
git clone https://github.com/tonytechlabvn/full-maf-coaching-tool.git
cd full-maf-coaching-tool
npm install

# Run dev server
npm run dev
# Open http://localhost:5173
```

### Production (Docker Compose)
```bash
# Copy environment template
cp .env.example .env

# Edit .env with production secrets
nano .env
# POSTGRES_PASSWORD=<strong_password>
# N8N_ENCRYPTION_KEY=<encryption_key>
# TUNNEL_TOKEN=<cloudflare_token>

# Start all services
docker-compose up -d

# Verify health
docker-compose ps
# All should show "healthy" or "running"
```

---

## Environment Variables

**Required for Production:**

```bash
# Database
POSTGRES_DB=n8n
POSTGRES_USER=n8n
POSTGRES_PASSWORD=<your_secure_password_min_16_chars>

# N8N Automation
N8N_ENCRYPTION_KEY=<32_char_encryption_key>
N8N_HOST=api.maf.run
N8N_PROTOCOL=https

# Cloudflare Tunnel
TUNNEL_TOKEN=<token_from_cloudflare_dashboard>

# System
TZ=Asia/Ho_Chi_Minh
NODE_ENV=production
```

**Generate Secure Keys:**
```bash
# Encryption key (32 characters)
openssl rand -base64 24 | head -c 32

# PostgreSQL password (16+ characters, alphanumeric + special)
openssl rand -base64 16
```

---

## Docker Build

### Build Locally
```bash
# Build image
docker build -t maf-app:latest .

# Verify
docker images | grep maf-app
# Should show ~50-60MB size

# Run locally
docker run -p 80:80 maf-app:latest
# Access http://localhost
```

### Build without Cache
```bash
docker build --no-cache -t maf-app:latest .
```

### Multi-stage Optimization

**Stage 1: Dependencies**
- Install only prod deps (no dev packages)
- Reduces layer size

**Stage 2: Builder**
- Install all deps (including dev)
- Build application with optimizations
- Remove source maps

**Stage 3: Production**
- Nginx Alpine base
- Copy only dist/ from builder
- Non-root user for security
- Health checks enabled

---

## Docker Compose Services

### Service: maf-app (Frontend)
```yaml
image: maf-app:latest
expose:
  - 80              # Internal only, no external port
networks:
  maf_network:
    ipv4_address: 172.28.0.10
healthcheck:        # Monitors every 30s
  test: curl http://localhost/health
```

**Access:** Via Cloudflare Tunnel (https://app.maf.run)

### Service: postgres (Database)
```yaml
image: postgres:15-alpine
expose:
  - 5432            # Internal only
volumes:
  - postgres_data:/var/lib/postgresql/data
```

**Purpose:** N8N backend data storage

### Service: n8n (Automation)
```yaml
image: docker.n8n.io/n8nio/n8n:latest
expose:
  - 5678
depends_on:
  postgres:
    condition: service_healthy
```

**Access:** Via Cloudflare Tunnel (https://api.maf.run)

### Service: cloudflared (Tunnel)
```yaml
image: cloudflare/cloudflared:latest
command: tunnel --no-autoupdate run --token ${TUNNEL_TOKEN}
```

**Setup:**
1. Login to Cloudflare Dashboard
2. Create tunnel "maf-tunnel"
3. Copy token to .env
4. Configure routes in dashboard:
   - app.maf.run → maf-app:80
   - api.maf.run → n8n:5678

---

## Network Architecture

```
External Users
      ↓
Internet (Port 443 HTTPS)
      ↓
Cloudflare CDN + Tunnel (DDoS protection)
      ↓
Cloudflare Tunnel Gateway (cloudflared container)
      ↓
Internal Network (172.28.0.0/16)
      ├─ maf-app (172.28.0.10:80)
      ├─ postgres (172.28.0.11:5432)
      ├─ n8n (172.28.0.12:5678)
      └─ cloudflared (172.28.0.13)
```

**Security:**
- ✅ No exposed ports to internet (all via Cloudflare)
- ✅ Internal network isolated
- ✅ Non-root users in containers
- ✅ Encrypted secrets in .env (not committed)

---

## Health Checks

### Frontend Health
```bash
# Manual check
curl http://localhost/health
# Response: "healthy\n"

# Docker health
docker-compose exec maf-app curl -f http://localhost/health
```

### Database Health
```bash
docker-compose exec postgres \
  pg_isready -U n8n -d n8n
# Response: "accepting connections"
```

### N8N Health
```bash
curl http://localhost:5678/healthz
# Response: 200 OK
```

### Full Stack Check
```bash
docker-compose ps
# STATUS column should show "healthy" or "running"
```

---

## Monitoring

### View Logs

**All services:**
```bash
docker-compose logs -f
```

**Specific service:**
```bash
docker-compose logs -f maf-app
docker-compose logs -f n8n
docker-compose logs -f postgres
```

**Last N lines:**
```bash
docker-compose logs -f --tail=50 maf-app
```

### Resource Usage

```bash
docker stats
# Shows CPU, memory, network usage per container

# Expected production:
# maf-app:   ~50-100MB RAM, 0.1% CPU idle
# postgres:  ~100-200MB RAM, 0.05% CPU idle
# n8n:       ~300-500MB RAM, varies on workflows
# cloudflared: ~30-50MB RAM, minimal CPU
```

### Cloudflare Dashboard

Monitor tunnel status:
1. Go to Cloudflare Dashboard
2. Navigate to Tunnels
3. Click "maf-tunnel"
4. See connection status, traffic stats

---

## Database Backup

### PostgreSQL Dump
```bash
# Backup
docker-compose exec postgres \
  pg_dump -U n8n n8n > backup_$(date +%Y%m%d).sql

# Restore (careful!)
docker-compose exec -T postgres \
  psql -U n8n n8n < backup_20260330.sql
```

### Volume Backup
```bash
# Copy volume to host
docker run --rm -v maf_postgres_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/postgres_data.tar.gz /data

# Restore
docker run --rm -v maf_postgres_data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/postgres_data.tar.gz -C /
```

---

## Updating Services

### Update Frontend Code

```bash
# Pull latest code
git pull origin main

# Rebuild image
docker-compose build maf-app

# Restart service
docker-compose up -d maf-app

# Verify
docker-compose ps maf-app
docker-compose logs maf-app | tail -20
```

### Update Dependencies

```bash
# Update package.json
npm update

# Rebuild
npm run build
docker-compose build --no-cache maf-app

# Test locally first
docker run -p 80:80 maf-app:latest
```

### Update N8N

```bash
# Pull latest N8N image
docker pull docker.n8n.io/n8nio/n8n:latest

# Restart
docker-compose up -d n8n

# Check logs
docker-compose logs n8n | tail -50
```

---

## Scaling (Optional)

### Load Balancer

If expecting high traffic, add Nginx reverse proxy:

```yaml
# Add to docker-compose.yml
load-balancer:
  image: nginx:alpine
  ports:
    - "443:443"
  volumes:
    - ./nginx-lb.conf:/etc/nginx/nginx.conf
  depends_on:
    - maf-app
```

### Database Replicas

For PostgreSQL high-availability:
- Primary: read/write
- Replica: read-only, automatic failover

(Setup requires pgpool or patroni—beyond scope)

---

## Troubleshooting

### Service Won't Start

```bash
# Check error logs
docker-compose logs maf-app

# Common issues:
# 1. Port already in use (conflicts with local services)
docker ps | grep 80
# Kill conflicting container or change port in docker-compose.yml

# 2. Out of disk space
docker system prune -a --volumes

# 3. Permission denied (Docker daemon)
sudo usermod -aG docker $USER
newgrp docker
```

### Health Check Failing

```bash
# Manually test health
docker-compose exec maf-app curl -v http://localhost/health

# Check Nginx logs
docker-compose exec maf-app cat /var/log/nginx/access.log

# Restart service
docker-compose restart maf-app
```

### Database Connection Error

```bash
# Test connectivity
docker-compose exec maf-app \
  nc -zv postgres 5432

# Check credentials in .env
cat .env | grep POSTGRES

# Verify N8N can connect
docker-compose logs n8n | grep "database"
```

### Cloudflare Tunnel Issues

```bash
# Check tunnel status
docker-compose logs cloudflared | grep "registered"

# Re-authenticate
docker-compose restart cloudflared

# Verify routes in Cloudflare Dashboard
# Should show 2 routes:
# - app.maf.run → maf-app:80
# - api.maf.run → n8n:5678
```

---

## Performance Tuning

### Nginx Compression
Already enabled in nginx.conf:
- gzip compression on (level 6)
- 1KB minimum file size

### PostgreSQL Optimization
```bash
# Tune shared buffers (in docker-compose.yml)
environment:
  - POSTGRES_INITDB_ARGS=-c shared_buffers=256MB -c max_connections=200
```

### N8N Cleanup
```yaml
environment:
  - EXECUTIONS_DATA_PRUNE=true
  - EXECUTIONS_DATA_MAX_AGE=336  # 14 days
```

---

## Security Checklist

- [ ] `.env` file NOT committed to git
- [ ] Passwords 16+ characters, alphanumeric + special
- [ ] HTTPS only (via Cloudflare)
- [ ] Non-root users in containers
- [ ] Resource limits set in docker-compose.yml
- [ ] Security headers in nginx.conf active
- [ ] Regular security updates (docker images)
- [ ] Firewall rules: no direct port access

---

**Last Updated:** March 30, 2026 | **Version:** 1.0.0
