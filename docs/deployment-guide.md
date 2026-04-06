# Deployment Guide

## Development Setup

### Prerequisites
- Node.js 18+, npm 9+
- Docker & Docker Compose (for containerized dev/prod)

### Local Development

```bash
git clone https://github.com/mafvietnam/mafapp.git
cd mafapp

# Install dependencies
npm install

# Start dev server with hot reload
npm run dev
# Open http://localhost:5173

# Lint + type check + test (pre-commit)
npm run lint
npm run test
npm run test:coverage
```

### Build for Production

```bash
npm run build       # Creates dist/
npm run preview     # Test production build locally
```

---

## Docker Image

**Multi-Stage Build:** `Dockerfile` (3 stages)
1. **deps:** Install Node 20 Alpine, npm dependencies
2. **builder:** Build React app with Vite, remove source maps
3. **production:** Nginx 1.25 Alpine, serve SPA, ~50-60MB final size

**Build Options:**
```bash
docker build -t maf-app:latest .              # Build with cache
docker build -t maf-app:latest --no-cache .   # Force rebuild
docker-compose build                          # Build all services
```

---

## Production Deployment (Docker Compose)

### Setup

```bash
cp .env.example .env
# Edit .env with your production secrets
nano .env
```

### Required Environment Variables

```bash
# Database
POSTGRES_DB=n8n
POSTGRES_USER=n8n
POSTGRES_PASSWORD=<strong_password_16+_chars>

# N8N Backend
N8N_ENCRYPTION_KEY=<32_char_key>
N8N_HOST=api.maf.run
N8N_PROTOCOL=https

# Cloudflare Tunnel
TUNNEL_TOKEN=<token_from_dashboard>

# System
TZ=Asia/Ho_Chi_Minh
NODE_ENV=production
```

### Generate Secure Keys

```bash
# 32-char encryption key
openssl rand -base64 24 | head -c 32

# 16-char password
openssl rand -base64 16
```

### Deploy

```bash
docker-compose up -d

# Verify health
docker-compose ps
# All services should show "healthy" or "running"
```

---

## Docker Architecture

### Multi-Stage Build

**Stage 1 (deps):** Install production dependencies only
**Stage 2 (builder):** Build React app with all dev deps, remove source maps
**Stage 3 (production):** Nginx Alpine + non-root user, ~50-60MB size

### Services

| Service | Port | Purpose |
|---------|------|---------|
| maf-app | 80 | React SPA + Nginx |
| postgres | 5432 | N8N database |
| n8n | 5678 | Workflow automation (optional) |
| cloudflared | N/A | Tunnel gateway (Cloudflare) |

All internal network (172.28.0.0/16). No ports exposed to internet—traffic flows through Cloudflare Tunnel.

---

## Network Flow

```
External User
    ↓
Cloudflare Tunnel (HTTPS)
    ↓
    ├─ app.maf.run → maf-app:80 (frontend)
    └─ api.maf.run → n8n:5678 (backend)
```

---

## Health Checks

```bash
# View all service health
docker-compose ps

# Frontend
docker-compose exec maf-app curl -f http://localhost/health

# Database
docker-compose exec postgres pg_isready -U n8n

# N8N
curl http://localhost:5678/healthz

# View logs
docker-compose logs -f maf-app
docker-compose logs -f n8n
```

---

## Cloudflare Tunnel Setup

1. Create tunnel in Cloudflare Dashboard (name: "maf-tunnel")
2. Copy token to `.env` (TUNNEL_TOKEN)
3. Configure routes in dashboard:
   - `app.maf.run` → `maf-app:80`
   - `api.maf.run` → `n8n:5678`
4. Deploy: `docker-compose up -d cloudflared`

---

## Updates

### Update Frontend Code

```bash
git pull origin dev
docker-compose build maf-app
docker-compose up -d maf-app
```

### Update Dependencies

```bash
npm update
npm run build
docker-compose build --no-cache maf-app
docker-compose up -d maf-app
```

---

## Monitoring

### Resource Usage

```bash
docker stats
# Expected:
# maf-app:     50-100MB RAM
# postgres:    100-200MB RAM
# n8n:         300-500MB RAM
# cloudflared: 30-50MB RAM
```

### Logs

```bash
# All
docker-compose logs -f

# Last 50 lines
docker-compose logs -f --tail=50 maf-app
```

---

## Backup

```bash
# PostgreSQL dump
docker-compose exec postgres \
  pg_dump -U n8n n8n > backup_$(date +%Y%m%d).sql

# Restore
docker-compose exec -T postgres \
  psql -U n8n n8n < backup_20260330.sql
```

---

## Troubleshooting

### Service Won't Start
```bash
docker-compose logs maf-app
# Check for: port conflicts, disk space, permissions
```

### Health Check Failing
```bash
docker-compose exec maf-app curl -v http://localhost/health
# Check Nginx logs: /var/log/nginx/access.log
docker-compose restart maf-app
```

### Database Connection Error
```bash
docker-compose exec maf-app nc -zv postgres 5432
docker-compose logs n8n | grep database
```

### Tunnel Not Connecting
```bash
docker-compose logs cloudflared | grep registered
docker-compose restart cloudflared
# Verify routes in Cloudflare Dashboard
```

---

## Security Checklist

- ✅ `.env` NOT committed (in `.gitignore`)
- ✅ All passwords 16+ chars with special characters
- ✅ HTTPS only (via Cloudflare Tunnel)
- ✅ Non-root container user (`nginx` user)
- ✅ No exposed ports (internal network 172.28.0.0/16)
- ✅ CSP headers in Nginx (no inline scripts)
- ✅ Security headers: X-Frame-Options, X-Content-Type-Options
- ✅ Gzip compression enabled
- ✅ Health checks every 30s

---

**Version:** 1.0.0 | **Last Updated:** April 6, 2026
