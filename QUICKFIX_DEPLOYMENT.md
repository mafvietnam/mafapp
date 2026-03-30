# 🚀 QUICK FIX DEPLOYMENT GUIDE

## ✅ CÁC VẤN ĐỀ ĐÃ FIX

### 1. ✅ Docker Compose Resources Warning
- **Before**: `deploy.resources` not supported in standalone mode
- **After**: Removed all resource limits (no warnings)
- **Impact**: Compatible với Docker Compose 1.29.2-6

### 2. ✅ Nginx Configuration Error
- **Before**: Custom `log_format` in server context (not allowed)
- **After**: Using default 'combined' format
- **Impact**: Nginx starts successfully

### 3. ✅ Cloudflare Tunnel Complexity
- **Before**: Config file approach (complex, error-prone)
- **After**: Token-based approach (simple, reliable)
- **Impact**: Faster startup, easier troubleshooting

---

## 🚀 DEPLOYMENT STEPS

### Step 1: Stop Current Services

```bash
cd /opt/maf-tool/full-maf-coaching-tool
docker-compose down --remove-orphans
```

### Step 2: Verify Configuration

```bash
# Test docker-compose syntax
docker-compose config

# Should show NO warnings about resources
```

### Step 3: Start Services

```bash
# Start all services
docker-compose up -d

# Expected output:
# ✔ Network maf_network            Created
# ✔ Container maf-postgres         Started
# ✔ Container maf-app              Started  
# ✔ Container maf-n8n              Started
# ✔ Container maf-cloudflare-tunnel Started
```

### Step 4: Monitor Logs

```bash
# Watch all logs
docker-compose logs -f

# Or specific service
docker-compose logs -f maf-app
docker-compose logs -f cloudflared
```

**Expected Cloudflare Log:**
```
INF Registered tunnel connection
INF Serving from Cloudflare
```

### Step 5: Check Service Status

```bash
# Check all containers
docker-compose ps

# Expected: All should be "Up" and "healthy"
```

---

## ✓ VERIFICATION CHECKLIST

### 1. Container Health

```bash
docker-compose ps

# Expected output:
# NAME                       STATUS
# maf-app                    Up (healthy)
# maf-postgres               Up (healthy)
# maf-n8n                    Up (healthy)
# maf-cloudflare-tunnel      Up
```

### 2. Nginx is Running

```bash
# Test nginx from inside container
docker exec maf-app wget -q -O- http://localhost:80/health

# Expected output: "healthy"
```

### 3. Database Connection

```bash
# Check PostgreSQL
docker exec maf-postgres pg_isready -U n8n

# Expected output: "accepting connections"
```

### 4. Cloudflare Tunnel

```bash
# Check tunnel logs
docker logs maf-cloudflare-tunnel | grep -i "connection"

# Expected: "Registered tunnel connection"
```

### 5. Public Access (from local machine)

```bash
# Test frontend
curl -I https://app.maf.run
# Expected: HTTP/2 200

# Test N8N
curl -I https://api.maf.run
# Expected: HTTP/2 200
```

### 6. Browser Test

- ✅ Open: https://app.maf.run
- ✅ Should show: MAF Running Coach app
- ✅ Open: https://api.maf.run  
- ✅ Should show: N8N login page

---

## 🔍 TROUBLESHOOTING

### Issue: Container Exits Immediately

```bash
# Check logs
docker-compose logs <service-name>

# Common fixes:
docker-compose restart <service-name>
```

### Issue: Cloudflare Tunnel Not Connected

```bash
# Check tunnel logs
docker logs maf-cloudflare-tunnel

# Verify token in .env
cat .env | grep TUNNEL_TOKEN

# Restart tunnel
docker-compose restart cloudflared
```

### Issue: Nginx Error

```bash
# Test nginx config
docker exec maf-app nginx -t

# Should output: "syntax is ok"
```

### Issue: Database Connection Failed

```bash
# Check postgres is running
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Restart postgres & n8n
docker-compose restart postgres n8n
```

---

## 📊 RESOURCE USAGE

Check resource consumption:

```bash
docker stats

# Expected (approximate):
# maf-app:     50-80MB RAM,  <5% CPU
# postgres:    100-150MB RAM, <10% CPU
# n8n:         300-400MB RAM, <15% CPU
# cloudflared: 25-35MB RAM,   <5% CPU
# Total:       ~600MB RAM,    ~35% CPU
```

---

## 🎯 SUCCESS CRITERIA

Your deployment is successful when:

✅ No warnings in `docker-compose up`  
✅ All 4 containers running and healthy  
✅ Nginx starts without errors  
✅ Cloudflare tunnel connected  
✅ https://app.maf.run accessible  
✅ https://api.maf.run accessible  
✅ No errors in logs  
✅ Resource usage < 1GB RAM  

---

## 🔧 CLOUDFLARE DASHBOARD ROUTES

**Important**: Verify routes are configured in Cloudflare Dashboard

1. Go to: https://one.dash.cloudflare.com
2. Navigate: Networks → Tunnels → "Hostinger VPS Tunnel"
3. Click: Configure
4. Add Public Hostnames:

| Subdomain | Service |
|-----------|---------|
| app.maf.run | http://172.28.0.10:80 |
| api.maf.run | http://172.28.0.12:5678 |

**Or use hostnames:**
| Subdomain | Service |
|-----------|---------|
| app.maf.run | http://maf-app:80 |
| api.maf.run | http://n8n:5678 |

---

## 📝 WHAT CHANGED?

### docker-compose.yml
- ✅ Removed ALL `deploy.resources` sections
- ✅ Simplified cloudflared to token-based
- ✅ No config file mount needed
- ✅ Compatible with Docker Compose 1.29.2

### nginx.conf
- ✅ Removed custom `log_format` directive
- ✅ Using default 'combined' format
- ✅ All other optimizations retained

### Cloudflare Approach
- ✅ Token-based command (simpler)
- ✅ Routes in Dashboard (easier management)
- ✅ No config file parsing errors

---

## 🎉 DEPLOYMENT COMPLETE

If all checks pass, your MAF Running Coach is now live in production!

**Access URLs:**
- Frontend: https://app.maf.run
- Backend: https://api.maf.run

**Monitor:**
```bash
# Watch logs continuously
docker-compose logs -f

# Check status
docker-compose ps

# Check resources
docker stats
```

---

*Last updated: November 27, 2025*
*Version: 1.0.1 (Quick Fix)*
