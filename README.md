# WASimple

A self-hosted WhatsApp Multi-Session API service. Manage multiple WhatsApp numbers simultaneously through REST API and WebSocket interface.

[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Features

- **Multi-Session Support**: Manage multiple WhatsApp numbers from a single server
- **REST API**: Full HTTP API for session and message management
- **WebSocket Real-time**: Live events for QR codes, messages, and status changes
- **Webhook Integration**: Forward events to your endpoints with HMAC signatures
- **Dashboard UI**: Built-in React dashboard for easy management
- **File-based Storage**: No database required, simple JSON file storage
- **TypeScript**: Fully typed for better developer experience

## Table of Contents

- [Quick Start](#quick-start)
- [Installation](#installation)
- [Configuration](#configuration)
- [API Documentation](#api-documentation)
- [WebSocket Events](#websocket-events)
- [Webhooks](#webhooks)
- [Dashboard](#dashboard)
- [Docker Deployment](#docker-deployment)
- [Troubleshooting](#troubleshooting)

## Quick Start

### Option 1: Docker (Recommended)

```bash
# Clone and run
git clone <repository-url>
cd wasimple
docker-compose up -d

# Access dashboard
open http://localhost:7834
# Default API Key: wasimple-default-api-key-change-me
```

### Option 2: Local Development

```bash
# Clone and install
git clone <repository-url>
cd wasimple
npm install

# Configure
cp .env.example .env
# Edit .env with your API key

# Build and run
npm run build
npm start

# Access dashboard
open http://localhost:3000
```

## Installation

### Requirements

- Node.js 20 or higher
- Chrome/Chromium (for Puppeteer)
- 2GB RAM minimum (4GB recommended)

### Step-by-Step

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build the project:**
   ```bash
   npm run build
   cd dashboard && npm install && npm run build && cd ..
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   ```

4. **Start the server:**
   ```bash
   npm start
   ```

## Configuration

Create `.env` file in project root:

```env
# Server
PORT=3000
NODE_ENV=development

# Security
API_KEY=your-secret-api-key-here
# Optional: multiple API keys separated by comma
API_KEYS=key1,key2,key3

# Dashboard
DASHBOARD_ENABLED=true

# Webhook Settings
WEBHOOK_TIMEOUT=30000
WEBHOOK_MAX_RETRIES=3
WEBHOOK_RETRY_DELAY=5000

# Storage
STORAGE_PATH=./data

# Logging
LOG_LEVEL=info
```

## API Documentation

All endpoints require `X-API-Key` header.

### Sessions

#### Create Session
```http
POST /api/sessions
Content-Type: application/json
X-API-Key: your-api-key

{
  "id": "my-session",
  "name": "Main WhatsApp"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "my-session",
    "name": "Main WhatsApp",
    "status": "created",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

#### Start Session
Starts the session and generates QR code for pairing.

```http
POST /api/sessions/:sessionId/start
X-API-Key: your-api-key
```

#### Get QR Code
Get QR code as base64 or PNG image.

```http
GET /api/sessions/:sessionId/qr
X-API-Key: your-api-key
Accept: application/json  # or image/png
```

**Response (JSON):**
```json
{
  "success": true,
  "data": {
    "qr": "data:image/png;base64,iVBORw0KGgo...",
    "expiresAt": "2024-01-15T10:31:00.000Z"
  }
}
```

#### List Sessions
```http
GET /api/sessions
X-API-Key: your-api-key
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "my-session",
      "name": "Main WhatsApp",
      "status": "ready",
      "phone": "628123456789",
      "pushName": "John Doe",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "lastActivity": "2024-01-15T10:35:00.000Z"
    }
  ]
}
```

#### Stop Session
```http
POST /api/sessions/:sessionId/stop
X-API-Key: your-api-key
```

#### Logout Session
```http
POST /api/sessions/:sessionId/logout
X-API-Key: your-api-key
```

#### Delete Session
```http
DELETE /api/sessions/:sessionId
X-API-Key: your-api-key
```

### Messages

#### Send Text Message
```http
POST /api/messages/send
Content-Type: application/json
X-API-Key: your-api-key

{
  "sessionId": "my-session",
  "to": "6281234567890",
  "text": "Hello from WASimple!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "true_6281234567890@c.us_3EB0...",
    "from": "6289876543210@c.us",
    "to": "6281234567890@c.us",
    "body": "Hello from WASimple!",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### Webhooks

#### Create Webhook
```http
POST /api/webhooks
Content-Type: application/json
X-API-Key: your-api-key

{
  "url": "https://your-server.com/webhook",
  "events": ["message:received", "message:sent", "session:ready"],
  "secret": "your-webhook-secret"
}
```

**Events Available:**
- `message:received` - Incoming message
- `message:sent` - Outgoing message
- `message:ack` - Message delivery status
- `session:qr` - QR code generated
- `session:ready` - Session connected
- `session:disconnected` - Session disconnected

#### List Webhooks
```http
GET /api/webhooks
X-API-Key: your-api-key
```

#### Update Webhook
```http
PUT /api/webhooks/:webhookId
Content-Type: application/json
X-API-Key: your-api-key

{
  "url": "https://new-url.com/webhook",
  "events": ["message:received"]
}
```

#### Delete Webhook
```http
DELETE /api/webhooks/:webhookId
X-API-Key: your-api-key
```

#### Test Webhook
```http
POST /api/webhooks/:webhookId/test
X-API-Key: your-api-key
```

### Health Check
```http
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 3600,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "sessions": {
    "total": 2,
    "connected": 1,
    "disconnected": 1
  }
}
```

## WebSocket Events

Connect to WebSocket for real-time updates:

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: { apiKey: 'your-api-key' }
});

// Subscribe to sessions
socket.emit('subscribe', { sessions: ['*'] }); // all sessions
// or
socket.emit('subscribe', { sessions: ['my-session'] }); // specific session

// Listen for events
socket.on('session:qr', (data) => {
  console.log('Scan QR:', data.qr); // base64 image
});

socket.on('session:status', (data) => {
  console.log('Status:', data.status, 'for', data.sessionId);
});

socket.on('message:received', (data) => {
  console.log('New message:', data.message);
});

socket.on('message:sent', (data) => {
  console.log('Message sent:', data.message);
});
```

### Session Statuses

| Status | Description |
|--------|-------------|
| `created` | Session created but not started |
| `starting` | Initializing WhatsApp client |
| `scan_qr` | Waiting for QR scan |
| `connecting` | QR scanned, connecting to WhatsApp |
| `ready` | Connected and ready to send/receive |
| `disconnected` | Disconnected from WhatsApp |
| `stopped` | Manually stopped |
| `failed` | Authentication failed |

## Webhooks

Webhook payloads are sent as POST requests with HMAC-SHA256 signature (if secret is configured).

### Payload Format

```json
{
  "event": "message:received",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "sessionId": "my-session",
  "data": {
    "message": {
      "id": "true_6281234567890@c.us_3EB0...",
      "from": "6281234567890@c.us",
      "body": "Hello!",
      "timestamp": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

### Signature Verification

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const hmac = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  return hmac === signature;
}

// In your webhook handler
const signature = req.headers['x-webhook-signature'];
const isValid = verifyWebhook(req.body, signature, WEBHOOK_SECRET);
```

## Dashboard

Access the built-in dashboard at `http://localhost:3000`

Features:
- Session management (create, start, stop, delete)
- Real-time QR code display
- Message viewer
- Webhook configuration
- Connection status

### Dashboard Login

Enter your API key on the login screen to access the dashboard.

## Docker Deployment

### Using Docker Compose

The included `docker-compose.yml` runs WASimple on port **7834**.

```yaml
services:
  wasimple:
    build:
      context: .
      dockerfile: docker/Dockerfile
    container_name: wasimple
    restart: unless-stopped
    ports:
      - "7834:7834"
    environment:
      - NODE_ENV=production
      - PORT=7834
      - API_KEY=${API_KEY:-wasimple-default-api-key-change-me}
      - DASHBOARD_ENABLED=true
      - LOG_LEVEL=info
      - STORAGE_PATH=/app/data
    volumes:
      - wasimple_data:/app/data
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:7834/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

volumes:
  wasimple_data:
    driver: local
```

Run:
```bash
# Set your API key (optional)
export API_KEY=your-secret-key

# Start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

Access:
- Dashboard: http://localhost:7834
- API: http://localhost:7834/api
- Health: http://localhost:7834/api/health

### Using Docker

```bash
# Build
docker build -t wasimple -f docker/Dockerfile .

# Run
docker run -d \
  --name wasimple \
  -p 7834:7834 \
  -e API_KEY=your-secret-key \
  -e DASHBOARD_ENABLED=true \
  -v wasimple_data:/app/data \
  wasimple
```

## Troubleshooting

### Session stuck at "connecting"

1. **Clear session data:**
   ```bash
   rm -rf data/sessions/<session-id>
   ```

2. **Clear WhatsApp cache:**
   ```bash
   rm -rf .wwebjs_cache
   ```

3. **Restart the server and create new session**

### QR code not appearing

1. Check browser console for WebSocket errors
2. Verify API key is correct
3. Check server logs: `tail -f logs/app.log`

### Webhook not receiving events

1. Test webhook URL:
   ```bash
   curl -X POST https://your-webhook-url.com \
     -H "Content-Type: application/json" \
     -d '{"test": true}'
   ```

2. Check webhook status in dashboard
3. Verify webhook events are configured correctly

### Puppeteer errors

Install Chrome/Chromium dependencies:

**Ubuntu/Debian:**
```bash
sudo apt-get install -y chromium-browser
```

**Mac:**
```bash
brew install chromium
```

### Docker "Failed to launch browser" error

If you see Chrome/Puppeteer errors in Docker:

1. **Ensure you're using the provided Dockerfile** which includes Chromium
2. **Clear and rebuild:**
   ```bash
   docker-compose down
   docker-compose build --no-cache
   docker-compose up -d
   ```
3. **Check Chrome is installed in container:**
   ```bash
   docker exec wasimple which chromium
   ```

### Outdated WhatsApp Web version

The server automatically fetches compatible WhatsApp Web versions. If you encounter issues:

1. Clear cache: `rm -rf .wwebjs_cache`
2. Restart server
3. Check for library updates: `npm update whatsapp-web.js`

## Development

```bash
# Run in development mode with hot reload
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

## Project Structure

```
wasimple/
├── src/
│   ├── api/           # REST API routes
│   ├── core/          # Core business logic
│   ├── storage/       # File storage implementation
│   ├── websocket/     # WebSocket server
│   ├── types/         # TypeScript types
│   └── utils/         # Utilities
├── dashboard/         # React dashboard
├── data/             # Storage directory
├── logs/             # Log files
├── dist/             # Compiled output
└── tests/            # Test files
```

## Security Considerations

1. **Use strong API keys** in production
2. **Enable HTTPS** when exposing to internet
3. **Restrict webhook URLs** to trusted domains
4. **Use webhook secrets** to verify payload authenticity
5. **Regular backups** of `data/` directory

## License

MIT License - see [LICENSE](LICENSE) file

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Submit pull request

## Support

- GitHub Issues: [Report bugs](https://github.com/yourusername/wasimple/issues)
- Documentation: [Full docs](https://docs.wasimple.dev)

---

**Note:** This project is not affiliated with WhatsApp Inc. Use at your own risk. WhatsApp may ban accounts for unofficial usage.
