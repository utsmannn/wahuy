# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Install build deps for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y \
    python3 make g++ git openssh-client \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY dashboard/package*.json ./dashboard/

RUN npm ci
RUN cd dashboard && npm ci

COPY tsconfig.json ./
COPY src ./src
COPY dashboard ./dashboard

RUN npm run build
RUN cd dashboard && npm run build

# Production stage — slim, no Chromium
FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dashboard/dist ./dashboard/dist

RUN mkdir -p /app/data/sessions

ENV NODE_ENV=production
ENV PORT=7834
ENV STORAGE_PATH=/app/data
ENV LOG_LEVEL=info

EXPOSE 7834

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:7834/api/health || exit 1

COPY docker/start.sh /app/start.sh
RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]
