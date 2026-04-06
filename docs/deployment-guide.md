# Deployment Guide

## Development Setup

### Prerequisites
- Node.js 18+, npm 9+
- Docker & Docker Compose (for containerized dev/prod)

### Frontend Development

```bash
git clone https://github.com/mafvietnam/mafapp.git
cd mafapp

# Install frontend dependencies
npm install

# Start frontend dev server (port 5173)
npm run dev
# Open http://localhost:5173

# Lint + type check + test
npm run lint
npm run test
npm run test:coverage
```

### Backend Development

```bash
cd api

# Install API dependencies
npm install

# Setup database
npx prisma migrate dev  # Create/apply migrations

# Start API dev server (port 3001)
npm run dev

# Or use Docker for full stack:
cd ..
docker-compose -f docker-compose.dev.yml up
# Frontend: http://localhost:5173
# API: http://localhost:3001
# PostgreSQL: localhost:5432
# Redis: localhost:6379
```

### Build for Production

```bash
# Frontend
npm run build       # Creates dist/
npm run preview     # Test production build locally

# API (built by Docker)
cd api
npm run build       # Creates dist/
```

---

## Docker Images

### Frontend (`Dockerfile`)
**Multi-Stage Build:** 3 stages
1. **deps:** Install Node 20 Alpine, npm dependencies
2. **builder:** Build React app with Vite, remove source maps
3. **production:** Nginx 1.25 Alpine, serve SPA, ~50-60MB final size

### Backend API (`api/Dockerfile`)
**Multi-Stage Build:** 2 stages
1. **builder:** Install Node dependencies, build NestJS with TypeScript
2. **production:** Node 20 Alpine, pm2 process manager, ~200MB final size

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
# PostgreSQL
POSTGRES_DB=maf
POSTGRES_USER=maf_user
POSTGRES_PASSWORD=<strong_password_16+_chars>

# NestJS API
MAF_DB_USER=maf_user
MAF_DB_PASSWORD=<same_as_POSTGRES_PASSWORD>
JWT_PRIVATE_KEY=<base64_encoded_private_key>
JWT_PUBLIC_KEY=<base64_encoded_public_key>

# WordPress OAuth2 (get from WordPress app settings)
WP_OAUTH_CLIENT_ID=<from_wordpress>
WP_OAUTH_REDIRECT_URI=https://api.maf.run/auth/callback
WP_OAUTH_URL=https://maf.run

# Frontend CORS
CORS_ORIGIN=https://app.maf.run

# Redis
REDIS_URL=redis://redis:6379

# Cloudflare Tunnel
TUNNEL_TOKEN=<token_from_dashboard>

# System
NODE_ENV=production
TZ=Asia/Ho_Chi_Minh
```

### Generate Secure Keys

```bash
# PostgreSQL password (16+ chars)
openssl rand -base64 16

# JWT RS256 keys (asymmetric, more secure than symmetric)
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem

# Base64 encode for .env
base64 -w 0 private.pem > jwt_private.txt
base64 -w 0 public.pem > jwt_public.txt

# Copy contents to JWT_PRIVATE_KEY and JWT_PUBLIC_KEY in .env
cat jwt_private.txt
cat jwt_public.txt
```

### Deploy

```bash
# Production deployment
docker-compose up -d

# Verify all services
docker-compose ps
# Expected output:
# maf-app      nginx:latest           "healthy"
# maf-api      nestjs:latest          "healthy"
# postgres     postgres:15-alpine     "healthy"
# redis        redis:7-alpine         "healthy"

# View logs
docker-compose logs -f maf-api    # API logs
docker-compose logs -f postgres   # Database logs
docker-compose logs -f redis      # Cache logs

# Stop services
docker-compose down

# Backup database
docker exec maf-postgres pg_dump -U maf_user maf > backup.sql

# Restore database
docker exec -i maf-postgres psql -U maf_user maf < backup.sql
```

---

## Docker Architecture

### Services Overview

| Service | Port | Technology | Purpose |
|---------|------|-----------|---------|
| maf-app | 80 | Nginx Alpine | Frontend SPA |
| maf-api | 3001 | NestJS + Node Alpine | REST API backend |
| postgres | 5432 | PostgreSQL 15 Alpine | User data storage |
| redis | 6379 | Redis 7 Alpine | Sessions + cache |

### Frontend Multi-Stage Build

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
