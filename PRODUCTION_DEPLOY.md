# 🚀 MAF RUNNING COACH - PRODUCTION DEPLOYMENT GUIDE

## 📋 MỤC LỤC

- [Tổng quan](#tổng-quan)
- [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
- [Kiến trúc Production](#kiến-trúc-production)
- [Pre-Deployment Checklist](#pre-deployment-checklist)
- [Deployment Steps](#deployment-steps)
- [Post-Deployment Verification](#post-deployment-verification)
- [Cloudflare Configuration](#cloudflare-configuration)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Troubleshooting](#troubleshooting)
- [Rollback Strategy](#rollback-strategy)

---

## 🎯 TỔNG QUAN

**Production Stack:**
- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Backend**: N8N Workflow Automation
- **Database**: PostgreSQL 15
- **Reverse Proxy**: Cloudflare Tunnel
- **Container**: Docker + Docker Compose
- **Server**: Ubuntu 24.04 LTS, 16GB RAM

**Domains:**
- Frontend: https://app.maf.run
- Backend API: https://api.maf.run

**Tunnel ID:** `e20b0b88-6187-4869-9063-eba523eaea2b`

---

## 💻 YÊU CẦU HỆ THỐNG

### Server Requirements

✅ **Minimum:**
- OS: Ubuntu 20.04+ (Recommended: Ubuntu 24.04 LTS)
- RAM: 8GB (Recommended: 16GB)
- CPU: 2 cores (Recommended: 4 cores)
- Disk: 20GB free space (SSD recommended)
- Network: Stable internet connection

✅ **Software:**
- Docker Engine 20.10+
- Docker Compose 2.0+
- Git
- OpenSSL (for generating secrets)

### Local Development Machine

✅ **Required:**
- SSH client
- Git
- Text editor (VS Code recommended)

---

## 🏗️ KIẾN TRÚC PRODUCTION

```
Internet Users
      ↓
Cloudflare CDN + DDoS Protection
      ↓
Cloudflare Tunnel (e20b0b88-6187-4869-9063-eba523eaea2b)
      ↓
      ├─→ app.maf.run ──────→ maf-app (Nginx:80)
      │                         └─→ React SPA
      │
      └─→ api.maf.run ──────→ n8n (Port:5678)
                               └─→ PostgreSQL (Port:5432)

Internal Network: 172.28.0.0/16
├─ maf-app:      172.28.0.10
├─ postgres:     172.28.0.11
├─ n8n:          172.28.0.12
└─ cloudflared:  172.28.0.13
```

### Resource Allocation

| Service | RAM | CPU | Notes |
|---------|-----|-----|-------|
| MAF App | 512MB | 0.5 | Frontend (Nginx) |
| PostgreSQL | 1GB | 1.0 | Database |
| N8N | 2GB | 1.5 | Workflow automation |
| Cloudflare | 256MB | 0.25 | Tunnel proxy |
| **Total** | **~3.8GB** | **3.25** | 24% of 16GB RAM |

---

## ✅ PRE-DEPLOYMENT CHECKLIST

### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Verify installation
docker --version
docker compose version

# Add user to docker group (optional)
sudo usermod -aG docker $USER
newgrp docker

# Enable Docker service
sudo systemctl enable docker
sudo systemctl start docker
```

### 2. Clone Repository

```bash
# Clone project
cd /opt
sudo git clone https://github.com/tonytechlabvn/full-maf-coaching-tool.git
cd full-maf-coaching-tool

# Set permissions
sudo chown -R $USER:$USER .
```

### 3. Generate Secrets

```bash
# Generate PostgreSQL password (32 chars)
openssl rand -base64 32

# Generate N8N encryption key (32 chars hex)
openssl rand -hex 16

# Save these values - you'll need them for .env
```

### 4. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your secrets
nano .env
```

**Required Variables to Update:**
```bash
POSTGRES_PASSWORD=<generated_postgres_password>
N8N_ENCRYPTION_KEY=<generated_encryption_key>
```

**Pre-configured Variables (do NOT change unless needed):**
```bash
TUNNEL_TOKEN=eyJhIjoiOTRkNzcyNjgxNzhlOGVjYWRjMDgzYWVjYzA4YmU3NWEiLCJ0IjoiZTIwYjBiODgtNjE4Ny00ODY5LTkwNjMtZWJhNTIzZWFlYTJiIiwicyI6Ik5HUmpNVGRrTmpZdFlqY3dZeTAwWldKaUxXRTRaVE10TXprellUUTRZMk14T1RVMyJ9
TUNNEL_ID=e20b0b88-6187-4869-9063-eba523eaea2b
N8N_HOST=api.maf.run
APP_DOMAIN=app.maf.run
```

### 5. Verify Configuration

```bash
# Test docker-compose configuration
docker compose config

# Should show no errors
```

---

## 🚀 DEPLOYMENT STEPS

### Step 1: Build Images

```bash
# Build MAF App image
docker compose build maf-app

# Verify image created
docker images | grep maf-app
```

### Step 2: Start Services

```bash
# Start all services in background
docker compose up -d

# Expected output:
# [+] Running 5/5
#  ✔ Network maf_network            Created
#  ✔ Volume maf_postgres_data       Created
#  ✔ Volume maf_n8n_data            Created
#  ✔ Container maf-postgres         Started
#  ✔ Container maf-app              Started
#  ✔ Container maf-n8n              Started
#  ✔ Container maf-cloudflare-tunnel Started
```

### Step 3: Monitor Startup

```bash
# Watch logs (all services)
docker compose logs -f

# Watch specific service
docker compose logs -f maf-app
docker compose logs -f postgres
docker compose logs -f n8n
docker compose logs -f cloudflared

# Press Ctrl+C to exit logs
```

**Expected Startup Time:**
- PostgreSQL: ~5-10 seconds
- MAF App: ~10-15 seconds
- N8N: ~20-30 seconds
- Cloudflare: ~5-10 seconds (after dependencies)

**Total: ~30-45 seconds for all services to be healthy**

---

## ✓ POST-DEPLOYMENT VERIFICATION

### 1. Check Service Status

```bash
# Check all containers are running
docker compose ps

# Expected output (all should be "Up" and "healthy"):
# NAME                       STATUS
# maf-app                    Up (healthy)
# maf-postgres               Up (healthy)
# maf-n8n                    Up (healthy)
# maf-cloudflare-tunnel      Up
```

### 2. Verify Health Checks

```bash
# Check MAF App health
docker exec maf-app wget -q -O- http://localhost:80/health

# Check N8N health
docker exec maf-n8n wget -q -O- http://localhost:5678/healthz

# Check PostgreSQL
docker exec maf-postgres pg_isready -U n8n -d n8n
```

### 3. Test Database Connection

```bash
# Connect to PostgreSQL
docker exec -it maf-postgres psql -U n8n -d n8n

# Inside psql:
\dt          # List tables (should show N8N tables)
\l           # List databases
\q           # Quit
```

### 4. Verify Network

```bash
# Inspect network
docker network inspect maf_network

# Should show all 4 containers with correct IPs:
# - maf-app: 172.28.0.10
# - postgres: 172.28.0.11
# - n8n: 172.28.0.12
# - cloudflared: 172.28.0.13
```

### 5. Check Resource Usage

```bash
# Monitor resource usage
docker stats

# Should show:
# - maf-app: ~50-100MB RAM
# - postgres: ~100-200MB RAM
# - n8n: ~300-500MB RAM
# - cloudflared: ~30-50MB RAM
```

---

## ☁️ CLOUDFLARE CONFIGURATION

### 1. Verify Tunnel Status

```bash
# Check tunnel is connected
docker logs maf-cloudflare-tunnel | grep -i "connection"

# Should see: "Registered tunnel connection"
```

### 2. DNS Records (Auto-created)

Cloudflare Tunnel automatically creates these DNS records:

```
Type    Name           Target
CNAME   app.maf.run    e20b0b88-6187-4869-9063-eba523eaea2b.cfargotunnel.com
CNAME   api.maf.run    e20b0b88-6187-4869-9063-eba523eaea2b.cfargotunnel.com
```

**Verify in Cloudflare Dashboard:**
1. Go to https://dash.cloudflare.com
2. Select domain: `maf.run`
3. Navigate to: DNS > Records
4. Confirm CNAME records exist

### 3. Test Public Access

```bash
# Test from your local machine (NOT server)

# Test frontend
curl -I https://app.maf.run
# Should return: HTTP/2 200

# Test N8N
curl -I https://api.maf.run
# Should return: HTTP/2 200
```

### 4. Browser Testing

Open browsers and test:
- ✅ https://app.maf.run - Should show MAF Running Coach app
- ✅ https://api.maf.run - Should show N8N login page

---

## 📊 MONITORING & MAINTENANCE

### Daily Checks

```bash
# Check service status
docker compose ps

# Check logs for errors
docker compose logs --tail=100 | grep -i error

# Check disk usage
df -h

# Check docker disk usage
docker system df
```

### Weekly Maintenance

```bash
# View resource usage
docker stats --no-stream

# Check for updates
cd /opt/full-maf-coaching-tool
git fetch origin
git status

# Clean unused images/containers
docker system prune -f
```

### Monthly Tasks

```bash
# Backup data (see Backup section below)
./scripts/backup.sh

# Review logs
docker compose logs --since 30d > logs_monthly.txt

# Update system packages
sudo apt update && sudo apt upgrade -y
```

### Log Management

```bash
# View logs by time range
docker compose logs --since 1h     # Last hour
docker compose logs --since 24h    # Last 24 hours
docker compose logs --since 7d     # Last 7 days

# Search for specific errors
docker compose logs | grep -i "error\|exception\|failed"

# Export logs
docker compose logs > debug_logs_$(date +%Y%m%d).txt
```

---

## 🔧 TROUBLESHOOTING

### Issue 1: Service Won't Start

**Symptoms:** Container exits immediately or won't start

```bash
# Check logs
docker compose logs <service-name>

# Check configuration
docker compose config

# Restart specific service
docker compose restart <service-name>

# Recreate service
docker compose up -d --force-recreate <service-name>
```

### Issue 2: Cannot Access App

**Symptoms:** 502/504 errors or timeout

```bash
# 1. Check tunnel status
docker logs maf-cloudflare-tunnel

# 2. Check app is running
docker exec maf-app wget -q -O- http://localhost:80/health

# 3. Check DNS
nslookup app.maf.run

# 4. Test from server
curl -I http://172.28.0.10:80

# 5. Restart tunnel
docker compose restart cloudflared
```

### Issue 3: Database Connection Failed

**Symptoms:** N8N can't connect to PostgreSQL

```bash
# 1. Check postgres is running
docker compose ps postgres

# 2. Check postgres logs
docker compose logs postgres

# 3. Verify connection from n8n container
docker exec maf-n8n ping postgres

# 4. Check credentials in .env
cat .env | grep POSTGRES

# 5. Restart both services
docker compose restart postgres n8n
```

### Issue 4: High Memory Usage

**Symptoms:** System running out of memory

```bash
# Check current usage
docker stats

# If n8n is using too much:
# 1. Check running workflows
docker exec maf-n8n n8n list:workflow

# 2. Reduce resource limits in docker-compose.yml
# Edit limits for n8n service

# 3. Restart with new limits
docker compose up -d
```

### Issue 5: Disk Full

**Symptoms:** No space left on device

```bash
# Check disk usage
df -h
docker system df

# Clean up
docker system prune -a -f --volumes

# Remove old logs
sudo journalctl --vacuum-time=7d

# If still full, move volumes to larger disk
# (consult Docker documentation)
```

---

## 🔄 ROLLBACK STRATEGY

### Quick Rollback (Configuration Changes)

```bash
# 1. Stop services
docker compose down

# 2. Revert changes
git checkout <previous-commit>

# 3. Restart
docker compose up -d
```

### Full Rollback (with Data Restore)

```bash
# 1. Stop all services
docker compose down

# 2. Restore from backup
# (see Backup section)

# 3. Revert code
git checkout <previous-commit>

# 4. Start services
docker compose up -d
```

### Emergency Shutdown

```bash
# Stop all services immediately
docker compose down

# Force stop if needed
docker compose kill

# Remove everything (CAUTION: loses data)
docker compose down -v
```

---

## 💾 BACKUP STRATEGY

### Manual Backup

```bash
# Create backup directory
mkdir -p /opt/backups

# Backup PostgreSQL
docker exec maf-postgres pg_dump -U n8n n8n | gzip > /opt/backups/postgres_$(date +%Y%m%d_%H%M%S).sql.gz

# Backup N8N data
docker run --rm -v maf_n8n_data:/data -v /opt/backups:/backup alpine tar czf /backup/n8n_data_$(date +%Y%m%d_%H%M%S).tar.gz -C /data .

# Backup .env file
cp .env /opt/backups/.env.backup
```

### Automated Backup Script

Create `/opt/scripts/backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup PostgreSQL
docker exec maf-postgres pg_dump -U n8n n8n | gzip > "$BACKUP_DIR/postgres_$DATE.sql.gz"

# Backup N8N data
docker run --rm -v maf_n8n_data:/data -v $BACKUP_DIR:/backup alpine tar czf /backup/n8n_data_$DATE.tar.gz -C /data .

# Keep only last 7 days
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Backup completed: $DATE"
```

```bash
# Make executable
chmod +x /opt/scripts/backup.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /opt/scripts/backup.sh >> /var/log/maf-backup.log 2>&1
```

---

## 📞 SUPPORT & RESOURCES

### Useful Commands

```bash
# Quick status check
docker compose ps && docker stats --no-stream

# View all logs
docker compose logs

# Restart all services
docker compose restart

# Update and restart
git pull && docker compose up -d --build

# Full cleanup and restart
docker compose down && docker system prune -f && docker compose up -d
```

### Important Files

- `docker-compose.yml` - Main configuration
- `.env` - Environment variables (SECRET)
- `config/tunnel-config.yml` - Cloudflare routing
- `Dockerfile` - App build instructions
- `nginx.conf` - Nginx configuration

### Documentation Links

- Docker Compose: https://docs.docker.com/compose/
- N8N Docs: https://docs.n8n.io/
- Cloudflare Tunnel: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/
- PostgreSQL: https://www.postgresql.org/docs/

---

## 🎉 SUCCESS CRITERIA

Your deployment is successful when:

✅ All 4 containers are running and healthy  
✅ https://app.maf.run loads the frontend  
✅ https://api.maf.run shows N8N interface  
✅ Database connections working  
✅ Cloudflare tunnel connected  
✅ Resource usage within limits (<4GB RAM)  
✅ No error logs  
✅ Health checks passing  

**Congratulations! Your MAF Running Coach is now live in production! 🚀**

---

*Last updated: November 27, 2025*
*Version: 1.0.0*
