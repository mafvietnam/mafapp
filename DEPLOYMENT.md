# 📦 MAF Running Coach - Docker Deployment Guide

Hướng dẫn chi tiết để deploy MAF Running Coach lên Docker container.

---

## 📋 Mục Lục

1. [Yêu Cầu Hệ Thống](#yêu-cầu-hệ-thống)
2. [Cấu Trúc Dự Án](#cấu-trúc-dự-án)
3. [Deployment Production](#deployment-production)
4. [Deployment Development](#deployment-development)
5. [Quản Lý Container](#quản-lý-container)
6. [Troubleshooting](#troubleshooting)
7. [Best Practices](#best-practices)

---

## 🔧 Yêu Cầu Hệ Thống

### Minimum Requirements
- **Docker**: v20.10+ 
- **Docker Compose**: v2.0+
- **RAM**: 512MB (recommended: 1GB+)
- **Disk Space**: 500MB

### Kiểm Tra Phiên Bản
```bash
docker --version
docker-compose --version
```

---

## 📁 Cấu Trúc Dự Án

```
maf-coaching-tool/
├── Dockerfile                 # Multi-stage build configuration
├── docker-compose.yml         # Production deployment
├── docker-compose.dev.yml     # Development environment
├── nginx.conf                 # Nginx web server config
├── .dockerignore             # Docker build exclusions
├── .env.example              # Environment variables template
├── package.json              # Node.js dependencies
├── vite.config.ts            # Vite build configuration
└── components/               # React components
```

---

## 🚀 Deployment Production

### Option 1: Docker Compose (Recommended)

#### Bước 1: Chuẩn Bị Environment Variables
```bash
# Copy file template
cp .env.example .env

# Chỉnh sửa các giá trị (nếu cần)
nano .env
```

#### Bước 2: Build và Khởi Động
```bash
# Build và start tất cả services
docker-compose up -d --build

# Chỉ start frontend (không cần N8N/Cloudflare)
docker-compose up -d maf-app
```

#### Bước 3: Kiểm Tra
```bash
# Xem logs
docker-compose logs -f maf-app

# Kiểm tra status
docker-compose ps

# Test ứng dụng
curl http://localhost:3000
```

**Truy cập**: http://localhost:3000

---

### Option 2: Docker CLI (Manual)

```bash
# 1. Build image
docker build -t maf-app:latest .

# 2. Run container
docker run -d \
  --name maf-app \
  -p 3000:80 \
  --restart unless-stopped \
  maf-app:latest

# 3. Kiểm tra logs
docker logs -f maf-app
```

**Truy cập**: http://localhost:3000

---

## 💻 Deployment Development

### Hot Reload Development Mode

```bash
# Start development container với hot reload
docker-compose -f docker-compose.dev.yml up

# Hoặc chạy ở background
docker-compose -f docker-compose.dev.yml up -d
```

**Truy cập**: http://localhost:5173

**Lưu ý**: 
- Mọi thay đổi code sẽ tự động reload
- Source code được mount vào container
- Không cần rebuild khi thay đổi code

---

## 🎛️ Quản Lý Container

### Docker Compose Commands

```bash
# Start services
docker-compose up -d

# Stop services (giữ data)
docker-compose stop

# Stop và remove containers
docker-compose down

# Stop và remove tất cả (bao gồm volumes)
docker-compose down -v

# Rebuild images
docker-compose build --no-cache

# Restart services
docker-compose restart

# Xem logs realtime
docker-compose logs -f

# Xem logs của service cụ thể
docker-compose logs -f maf-app

# Check health status
docker-compose ps
```

### Docker CLI Commands

```bash
# List running containers
docker ps

# List all containers
docker ps -a

# Stop container
docker stop maf-app

# Start container
docker start maf-app

# Restart container
docker restart maf-app

# Remove container
docker rm maf-app

# Remove image
docker rmi maf-app:latest

# View logs
docker logs -f maf-app

# Execute command inside container
docker exec -it maf-app sh

# Inspect container
docker inspect maf-app

# View resource usage
docker stats maf-app
```

---

## 🔍 Troubleshooting

### 0. ⚠️ MÀN HÌNH TRẮNG / WHITE SCREEN (COMMON!)

**Triệu chứng:**
- Giao diện trắng bóc
- Console warning về Tailwind CDN
- Lỗi 404 favicon.ico

**Nguyên nhân:**
- Tailwind CSS chưa được cài đặt đúng
- Missing CSS build files

**Giải pháp:**
```bash
# 1. Xem hướng dẫn chi tiết
cat QUICKFIX.md

# 2. Rebuild với cache clear
docker-compose down -v
docker rmi maf-app:latest
docker-compose up -d --build

# 3. Verify
docker-compose logs -f maf-app
```

**Chi tiết**: Xem file `QUICKFIX.md` để biết thêm thông tin về issue này.

---

### 1. Container Không Khởi Động

**Kiểm tra logs:**
```bash
docker-compose logs maf-app
```

**Các nguyên nhân thường gặp:**
- Port 3000 đã được sử dụng → Đổi port trong `docker-compose.yml`
- Thiếu file cấu hình → Kiểm tra `nginx.conf`
- Lỗi build → Xóa cache và rebuild: `docker-compose build --no-cache`

---

### 2. Lỗi "Port Already in Use"

```bash
# Tìm process đang dùng port 3000
# Windows
netstat -ano | findstr :3000

# Linux/MacOS
lsof -i :3000

# Kill process (Linux/Mac)
kill -9 <PID>

# Hoặc đổi port trong docker-compose.yml
ports:
  - "8080:80"  # Đổi từ 3000 sang 8080
```

---

### 3. Health Check Failed

```bash
# Kiểm tra health status
docker inspect maf-app | grep -A 10 Health

# Restart container
docker restart maf-app

# Kiểm tra Nginx logs
docker exec maf-app cat /var/log/nginx/error.log
```

---

### 4. Build Fails - npm install errors

```bash
# Clear Docker build cache
docker system prune -a

# Rebuild without cache
docker-compose build --no-cache

# Check package.json syntax
cat package.json
```

---

### 5. Không Truy Cập Được Website

**Checklist:**
- [ ] Container đang chạy: `docker ps`
- [ ] Port mapping đúng: `docker port maf-app`
- [ ] Firewall không chặn port 3000
- [ ] Test localhost: `curl http://localhost:3000`

---

### 6. Lỗi CORS hoặc CSP

**Sửa trong `nginx.conf`:**
```nginx
# Thêm vào phần location /
add_header Access-Control-Allow-Origin "*" always;
```

---

## ✅ Best Practices

### 1. **Security**

```bash
# Không commit .env file
echo ".env" >> .gitignore

# Sử dụng secrets cho production
docker secret create tunnel_token ./tunnel_token.txt
```

### 2. **Performance**

```nginx
# Enable Gzip compression trong nginx.conf
gzip on;
gzip_types text/plain text/css application/json;

# Cache static assets
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 1y;
}
```

### 3. **Monitoring**

```bash
# Check container resource usage
docker stats maf-app

# Set memory limits trong docker-compose.yml
deploy:
  resources:
    limits:
      memory: 512M
```

### 4. **Logging**

```yaml
# Trong docker-compose.yml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

### 5. **Backup & Restore**

```bash
# Backup volumes
docker run --rm \
  -v maf_n8n_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/n8n-backup.tar.gz /data

# Restore volumes
docker run --rm \
  -v maf_n8n_data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/n8n-backup.tar.gz -C /
```

---

## 🌐 Production Deployment với Domain

### 1. Sử dụng Cloudflare Tunnel

```bash
# 1. Tạo tunnel trên Cloudflare Dashboard
# 2. Copy token
# 3. Thêm vào .env
TUNNEL_TOKEN=your_token_here

# 4. Start services
docker-compose up -d
```

### 2. Sử dụng Reverse Proxy (Nginx/Traefik)

**Nginx Reverse Proxy Config:**
```nginx
server {
    listen 80;
    server_name maf.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 🔄 CI/CD Integration

### GitHub Actions Example

```yaml
name: Build and Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Build Docker Image
        run: docker build -t maf-app:${{ github.sha }} .
      
      - name: Push to Registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push maf-app:${{ github.sha }}
```

---

## 📞 Support

- **Issues**: https://github.com/tonytechlabvn/full-maf-coaching-tool/issues
- **Documentation**: Xem README.md
- **Docker Docs**: https://docs.docker.com/

---

## 📝 Changelog

### v1.0.0 (2025-11-26)
- ✅ Multi-stage Dockerfile với Node 20 Alpine
- ✅ Nginx configuration tối ưu với security headers
- ✅ Docker Compose cho production và development
- ✅ Health checks và auto-restart
- ✅ Hỗ trợ N8N và Cloudflare Tunnel
- ✅ .dockerignore để tối ưu build time

---

**Made with ❤️ by MAF Running Coach Team**
