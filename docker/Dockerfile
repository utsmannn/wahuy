# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Install build dependencies for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./
COPY dashboard/package*.json ./dashboard/

# Install all dependencies (including dev)
RUN npm ci
RUN cd dashboard && npm ci

# Copy source
COPY tsconfig.json ./
COPY src ./src
COPY dashboard ./dashboard

# Build TypeScript
RUN npm run build

# Build dashboard
RUN cd dashboard && npm run build

# Production stage
FROM node:20-slim

# Install Chromium and dependencies for Puppeteer
RUN apt-get update && apt-get install -y \
    ca-certificates \
    chromium \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    wget \
    xdg-utils \
    python3 \
    make \
    g++ \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use system Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Disable Chrome crashpad
ENV CHROME_DEVEL_SANDBOX=/usr/local/sbin/chrome-devel-sandbox
ENV CHROME_BIN=/usr/bin/chromium

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Copy dashboard static files
COPY --from=builder /app/dashboard/dist ./dashboard/dist

# Create data directory
RUN mkdir -p /app/data/sessions

# Environment defaults
ENV NODE_ENV=production
ENV PORT=7834
ENV STORAGE_PATH=/app/data
ENV LOG_LEVEL=info

# Expose port
EXPOSE 7834

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:7834/api/health || exit 1

# Create writable directories for Chrome
RUN mkdir -p /tmp/chrome-crashpad /app/.cache/puppeteer

# Copy startup script
COPY docker/start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Run as root (required for Chrome sandbox in Docker)
# Note: For production, consider using --cap-add=SYS_ADMIN instead
# Start application with cleanup script
CMD ["/app/start.sh"]
