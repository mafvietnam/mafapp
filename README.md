# 🏃 MAF Running Coach

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/docker-ready-brightgreen.svg)](https://www.docker.com/)
[![Production](https://img.shields.io/badge/production-live-success.svg)](https://app.maf.run)

Ứng dụng huấn luyện chạy bộ dựa trên phương pháp MAF (Maximum Aerobic Function) của Dr. Phil Maffetone. Giúp runners xác định nhịp tim tối ưu và theo dõi tiến độ training hiệu quả.

**🌐 Live Demo:** [https://app.maf.run](https://app.maf.run)

---

## ✨ Tính năng

- 🎯 **MAF Calculator**: Tính toán nhịp tim MAF dựa trên tuổi và các yếu tố sức khỏe
- 📊 **Commitment Selector**: Chọn mức độ cam kết training phù hợp
- 🏃 **Pace Calculator**: Chuyển đổi giữa các đơn vị tốc độ (km/h, mph, pace)
- 💪 **Health Assessment**: Đánh giá các yếu tố ảnh hưởng đến training
- 🎨 **Responsive UI**: Tối ưu cho mọi thiết bị (mobile, tablet, desktop)
- ⚡ **Offline-first**: Không cần kết nối internet sau khi tải trang

---

## 🛠 Tech Stack

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **UI Components**: Custom components với Tailwind

### Backend (Optional - for automation)
- **Workflow Engine**: N8N
- **Database**: PostgreSQL 15

### Infrastructure
- **Container**: Docker + Docker Compose
- **Web Server**: Nginx (Alpine)
- **Reverse Proxy**: Cloudflare Tunnel
- **OS**: Ubuntu 24.04 LTS

---

## 🚀 Quick Start

### Option 1: Docker Compose (Recommended)

```bash
# Clone repository
git clone https://github.com/tonytechlabvn/full-maf-coaching-tool.git
cd full-maf-coaching-tool

# Start with Docker Compose
docker-compose up -d

# Access app
open http://localhost:3000
```

### Option 2: Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

---

## 📦 Deployment

### Development Environment

Sử dụng `docker-compose.dev.yml` cho local development:

```bash
docker-compose -f docker-compose.dev.yml up -d
```

**Access:**
- Frontend: http://localhost:3000

### Production Environment

Sử dụng `docker-compose.yml` cho production với Cloudflare Tunnel:

```bash
# Setup environment
cp .env.example .env
# Edit .env with your secrets

# Deploy to production
docker-compose up -d
```

**Access:**
- Frontend: https://app.maf.run
- Backend (N8N): https://api.maf.run

📖 **Chi tiết:** Xem [PRODUCTION_DEPLOY.md](PRODUCTION_DEPLOY.md) để có hướng dẫn đầy đủ

---

## 🏗️ Architecture

### Development Architecture
```
Browser → localhost:3000 → MAF App (Vite Dev Server)
```

### Production Architecture
```
Internet Users
    ↓
Cloudflare CDN + DDoS Protection
    ↓
Cloudflare Tunnel
    ↓
    ├─→ app.maf.run → MAF App (Nginx + React SPA)
    └─→ api.maf.run → N8N Backend → PostgreSQL
```

---

## 📂 Project Structure

```
full-maf-coaching-tool/
├── components/              # React components
│   ├── CommitmentSelector.tsx
│   └── MafLab.tsx
├── utils/                   # Utility functions
│   └── mafLogic.ts         # MAF calculation logic
├── config/                  # Configuration files
│   └── tunnel-config.yml   # Cloudflare tunnel config
├── App.tsx                  # Main app component
├── index.tsx               # Entry point
├── index.html              # HTML template
├── index.css               # Global styles
├── Dockerfile              # Multi-stage Docker build
├── docker-compose.yml      # Production compose file
├── docker-compose.dev.yml  # Development compose file
├── nginx.conf              # Nginx configuration
├── .env.example            # Environment variables template
└── README.md               # This file
```

---

## 🔧 Configuration

### Environment Variables

Tạo file `.env` từ template:

```bash
cp .env.example .env
```

**Development:**
```bash
NODE_ENV=development
```

**Production:**
```bash
# Database
POSTGRES_PASSWORD=your_secure_password

# N8N
N8N_ENCRYPTION_KEY=your_encryption_key

# Cloudflare Tunnel
TUNNEL_TOKEN=your_tunnel_token

# System
NODE_ENV=production
TZ=Asia/Ho_Chi_Minh
```

### Docker Build Options

**Development build:**
```bash
docker-compose -f docker-compose.dev.yml build
```

**Production build:**
```bash
docker-compose build
```

**Build without cache:**
```bash
docker-compose build --no-cache
```

---

## 📊 Performance

### Docker Image Size
- **Development**: ~200MB (với dev dependencies)
- **Production**: ~50-60MB (optimized Alpine + multi-stage)

### Resource Usage (Production)
- **MAF App**: ~50-100MB RAM
- **PostgreSQL**: ~100-200MB RAM  
- **N8N**: ~300-500MB RAM
- **Cloudflare**: ~30-50MB RAM
- **Total**: ~3.8GB allocated (out of 16GB)

### Loading Performance
- **First Load**: ~500ms
- **Time to Interactive**: ~1s
- **Lighthouse Score**: 95+

---

## 🧪 Testing

```bash
# Run tests (if available)
npm test

# Lint code
npm run lint

# Type check
npx tsc --noEmit
```

---

## 📝 Development

### Prerequisites
- Node.js 18+
- npm 9+ or yarn
- Docker & Docker Compose (for containerized development)

### Setup Development Environment

```bash
# Install dependencies
npm install

# Start dev server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Code Style
- TypeScript for type safety
- ESLint for code quality
- Prettier for formatting (optional)

---

## 🐳 Docker

### Dockerfile Features
✅ **Multi-stage build** - Separate build and runtime stages  
✅ **Alpine Linux** - Minimal image size  
✅ **Non-root user** - Security best practice  
✅ **Health checks** - Auto-restart on failure  
✅ **Optimized caching** - Faster builds  
✅ **Source map removal** - Smaller production bundle  

### Docker Compose Services

**Development (`docker-compose.dev.yml`):**
- `maf-app` - Frontend only

**Production (`docker-compose.yml`):**
- `maf-app` - Frontend (Nginx + React)
- `postgres` - PostgreSQL database
- `n8n` - Workflow automation
- `cloudflared` - Cloudflare tunnel

---

## 🔐 Security

### Production Security Features
✅ No exposed ports (all traffic via Cloudflare Tunnel)  
✅ Non-root container users  
✅ Resource limits to prevent DoS  
✅ Encrypted secrets management  
✅ Security headers (CSP, X-Frame-Options, etc.)  
✅ HTTPS only (via Cloudflare)  
✅ Network isolation  

### Best Practices
- Rotate encryption keys regularly
- Use strong passwords (min 16 characters)
- Keep Cloudflare tunnel token secure
- Never commit `.env` file to git
- Regular security updates

---

## 📚 Documentation

- [PRODUCTION_DEPLOY.md](PRODUCTION_DEPLOY.md) - Complete production deployment guide
- [DOCKER_BUILD_GUIDE.md](DOCKER_BUILD_GUIDE.md) - Docker build & optimization guide
- [BUILD_GUIDE.md](BUILD_GUIDE.md) - General build instructions
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment strategies
- [DOCKER_REVIEW.md](DOCKER_REVIEW.md) - Docker configuration review

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Dr. Phil Maffetone** - For the MAF training method
- **React Team** - For the amazing framework
- **Vite Team** - For the blazing fast build tool
- **Tailwind CSS** - For the utility-first CSS framework
- **N8N** - For workflow automation capabilities
- **Cloudflare** - For tunnel and CDN services

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/tonytechlabvn/full-maf-coaching-tool/issues)
- **Email**: support@maf.run
- **Website**: https://app.maf.run

---

## 🗺️ Roadmap

- [ ] User authentication & profiles
- [ ] Training history tracking
- [ ] Progress visualization charts
- [ ] Mobile app (React Native)
- [ ] Integration with fitness devices
- [ ] Multi-language support
- [ ] Social features (share progress)
- [ ] Advanced analytics

---

## 📈 Status

- **Status**: ✅ Production Ready
- **Version**: 1.0.0
- **Last Updated**: November 27, 2025
- **Uptime**: 99.9% (monitored via Cloudflare)

---

**Made with ❤️ by Tony Tech Lab**

🌟 **Star us on GitHub!** If you find this project helpful, please give it a star ⭐
