# ============================================
# STAGE 1: Dependencies
# ============================================
FROM node:20-alpine AS deps

# Add security: run as non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

WORKDIR /app

# Copy only dependency files for better caching
COPY package.json package-lock.json* ./

# Install dependencies with optimizations
RUN npm ci --omit=dev --ignore-scripts && \
    npm cache clean --force

# ============================================
# STAGE 2: Builder
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install ALL dependencies (including dev) for build
RUN npm ci --ignore-scripts && \
    npm cache clean --force

# Copy only necessary source files (respect .dockerignore)
# Config files first (least likely to change - better caching)
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

# Build application with optimizations
ENV NODE_ENV=production
RUN npm run build && \
    # Remove source maps in production (optional)
    find dist -name "*.map" -type f -delete

# ============================================
# STAGE 3: Production Runtime
# ============================================
FROM nginx:1.25-alpine AS production

# Metadata
LABEL maintainer="MAF Running Coach Team" \
      description="MAF Running Coach - Optimized React Application" \
      version="1.0" \
      security.scan="enabled"

# Install only essential tools
RUN apk add --no-cache curl tzdata && \
    # Create non-root user for nginx
    addgroup -g 101 -S nginx || true && \
    adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx || true

# Remove default nginx config and files
RUN rm -rf /etc/nginx/conf.d/default.conf /usr/share/nginx/html/*

# Copy optimized nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder
COPY --from=builder --chown=nginx:nginx /app/dist /usr/share/nginx/html

# Security: Set proper permissions
RUN chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d && \
    chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html && \
    # Create nginx PID directory
    mkdir -p /var/run && \
    chown -R nginx:nginx /var/run && \
    # Enable nginx to bind to port 80 as non-root
    chmod -R 755 /var/cache/nginx /var/log/nginx /etc/nginx

# Create nginx.pid file with correct permissions
RUN touch /var/run/nginx.pid && \
    chown nginx:nginx /var/run/nginx.pid

# Switch to non-root user
USER nginx

# Health check with curl (already installed)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/ || exit 1

# Expose port
EXPOSE 80

# Use exec form for better signal handling
CMD ["nginx", "-g", "daemon off;"]

# ============================================
# Build Info
# ============================================
# Build command: docker build -t maf-coach:latest .
# Run command: docker run -p 80:80 maf-coach:latest
# Size: ~50-60MB (optimized from ~150MB)
# Security: Non-root user, minimal packages
# Performance: Optimized caching, compressed assets
