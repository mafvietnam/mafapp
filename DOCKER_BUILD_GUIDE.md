# 🐳 HƯỚNG DẪN BUILD & DEPLOY DOCKER IMAGE

## ✅ CÁC VẤN ĐỀ ĐÃ FIX

### **Vấn đề gốc:**
```dockerfile
# ❌ SAI - Copy thư mục không tồn tại
COPY public/ ./public/
COPY src/ ./src/
COPY *.tsx *.ts *.css ./
```

### **Đã fix thành:**
```dockerfile
# ✅ ĐÚNG - Copy đúng cấu trúc flat của project
# Config files first (better caching)
COPY tsconfig.json vite.config.ts ./
COPY tailwind.config.js postcss.config.js* ./

# Entry point and styles
COPY index.html index.tsx ./
COPY index.css* ./

# Source files at root
COPY App.tsx constants.ts types.ts ./

# Source directories
COPY components/ ./components/
COPY utils/ ./utils/
```

---

## 📋 YÊU CẦU HỆ THỐNG

### **1. Cài đặt Docker Desktop**

**Windows:**
- Download: https://www.docker.com/products/docker-desktop
- Yêu cầu: Windows 10/11 64-bit, WSL 2
- Sau khi cài, khởi động lại máy

**Verify cài đặt:**
```bash
docker --version
docker-compose --version
```

---

## 🚀 BUILD DOCKER IMAGE

### **Bước 1: Build Image**

```bash
# Build image với tag v1
docker build -t maf-running-coach:v1 .

# Hoặc build với tag latest
docker build -t maf-running-coach:latest .
```

**Output mong đợi:**
```
[+] Building 45.2s (30/30) FINISHED
 => [internal] load build definition from Dockerfile
 => => transferring dockerfile: 3.2kB
 => [internal] load .dockerignore
 => ...
 => [production 9/9] RUN touch /var/run/nginx.pid && chown nginx:nginx /var/run/nginx.pid
 => exporting to image
 => => exporting layers
 => => writing image sha256:...
 => => naming to docker.io/library/maf-running-coach:v1
```

### **Bước 2: Kiểm tra Image**

```bash
# Liệt kê images
docker images maf-running-coach

# Kết quả mong đợi:
# REPOSITORY           TAG    IMAGE ID      CREATED        SIZE
# maf-running-coach    v1     abc123def456  1 minute ago   ~50-60MB
```

---

## 🏃 CHẠY CONTAINER

### **Option 1: Chạy đơn giản**

```bash
# Chạy container, map port 80
docker run -d -p 80:80 --name maf-coach maf-running-coach:v1

# Truy cập: http://localhost
```

### **Option 2: Chạy với custom port**

```bash
# Map port 8080 thay vì 80
docker run -d -p 8080:80 --name maf-coach maf-running-coach:v1

# Truy cập: http://localhost:8080
```

### **Option 3: Sử dụng Docker Compose (Recommended)**

```bash
# Chạy với docker-compose
docker-compose up -d

# Dừng
docker-compose down

# Xem logs
docker-compose logs -f
```

---

## 🔍 KIỂM TRA & VERIFY

### **1. Kiểm tra Container đang chạy**

```bash
# Xem containers đang chạy
docker ps

# Xem logs
docker logs maf-coach

# Xem logs realtime
docker logs -f maf-coach
```

### **2. Health Check**

```bash
# Kiểm tra health status
docker inspect maf-coach | grep -A 10 Health

# Test endpoint
curl http://localhost/health
# Mong đợi: 200 OK
```

### **3. Truy cập Application**

- Mở browser: http://localhost (hoặc http://localhost:8080)
- Kiểm tra UI render đúng
- Test các chức năng: MAF Calculator, Commitment Selector

---

## 🛠️ TROUBLESHOOTING

### **Lỗi: Port đã được sử dụng**

```bash
# Kiểm tra port 80 đang được dùng
netstat -ano | findstr :80

# Chuyển sang port khác
docker run -d -p 8080:80 --name maf-coach maf-running-coach:v1
```

### **Lỗi: Container không start**

```bash
# Xem logs chi tiết
docker logs maf-coach

# Kiểm tra container status
docker inspect maf-coach
```

### **Lỗi: Build failed**

```bash
# Clean build cache
docker builder prune -a

# Build lại với no cache
docker build --no-cache -t maf-running-coach:v1 .
```

### **Lỗi: Permission denied (trên Linux/Mac)**

```bash
# Chạy với sudo
sudo docker build -t maf-running-coach:v1 .
```

---

## 🧹 QUẢN LÝ CONTAINERS & IMAGES

### **Dừng & Xóa Container**

```bash
# Dừng container
docker stop maf-coach

# Xóa container
docker rm maf-coach

# Dừng và xóa luôn
docker rm -f maf-coach
```

### **Xóa Images**

```bash
# Xóa image cụ thể
docker rmi maf-running-coach:v1

# Xóa tất cả images không dùng
docker image prune -a
```

### **Clean up toàn bộ**

```bash
# Xóa tất cả: containers, images, volumes, networks
docker system prune -a --volumes

# Cảnh báo: Lệnh này sẽ xóa mọi thứ Docker!
```

---

## 📦 PUSH LÊN DOCKER HUB (Optional)

### **Bước 1: Login Docker Hub**

```bash
docker login
# Nhập username và password
```

### **Bước 2: Tag Image**

```bash
# Tag với username của bạn
docker tag maf-running-coach:v1 your-username/maf-running-coach:v1
docker tag maf-running-coach:v1 your-username/maf-running-coach:latest
```

### **Bước 3: Push Image**

```bash
# Push lên Docker Hub
docker push your-username/maf-running-coach:v1
docker push your-username/maf-running-coach:latest
```

### **Bước 4: Pull & Run từ Docker Hub**

```bash
# Trên server khác
docker pull your-username/maf-running-coach:latest
docker run -d -p 80:80 your-username/maf-running-coach:latest
```

---

## 🌐 DEPLOY LÊN PRODUCTION

### **Option 1: Deploy lên VPS/Cloud VM**

```bash
# 1. SSH vào server
ssh user@your-server.com

# 2. Cài Docker (nếu chưa có)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 3. Pull image
docker pull your-username/maf-running-coach:latest

# 4. Run container
docker run -d \
  -p 80:80 \
  --name maf-coach \
  --restart unless-stopped \
  your-username/maf-running-coach:latest
```

### **Option 2: Deploy lên AWS ECS/Fargate**

1. Push image lên ECR
2. Tạo ECS Task Definition
3. Tạo ECS Service
4. Configure Load Balancer

### **Option 3: Deploy lên Google Cloud Run**

```bash
# 1. Tag cho GCR
docker tag maf-running-coach:v1 gcr.io/your-project/maf-running-coach:v1

# 2. Push lên GCR
docker push gcr.io/your-project/maf-running-coach:v1

# 3. Deploy
gcloud run deploy maf-coach \
  --image gcr.io/your-project/maf-running-coach:v1 \
  --platform managed \
  --port 80
```

---

## 📊 THÔNG TIN KỸ THUẬT

### **Image Specifications:**
- **Base Images**: 
  - Builder: `node:20-alpine`
  - Runtime: `nginx:1.25-alpine`
- **Size**: ~50-60MB (optimized)
- **Architecture**: Multi-stage build (3 stages)
- **Security**: Non-root user (nginx:nginx, UID 101)
- **Performance**: Gzip compression, optimized caching

### **Port Mapping:**
- Container port: `80`
- Protocol: `HTTP`
- Health check: `http://localhost/health`

### **Environment:**
- Node version: 20 (Alpine)
- Nginx version: 1.25 (Alpine)
- Build tool: Vite
- Framework: React + TypeScript

---

## 🎯 BEST PRACTICES

1. **Always use specific tags** (v1, v2) thay vì chỉ dùng `latest`
2. **Monitor container logs** thường xuyên
3. **Set up health checks** và monitoring
4. **Use secrets management** cho sensitive data
5. **Regular security scans** với `docker scan`
6. **Backup data** trước khi update
7. **Use `.dockerignore`** để giảm build context
8. **Multi-stage builds** để giảm image size

---

## 📞 HỖ TRỢ

Nếu gặp vấn đề:
1. Kiểm tra logs: `docker logs maf-coach`
2. Kiểm tra container status: `docker inspect maf-coach`
3. Test network: `curl http://localhost/health`
4. Rebuild với `--no-cache` nếu cần

---

**🎉 Dockerfile đã được tối ưu và sẵn sàng deploy!**
