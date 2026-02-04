# Wahuy

A self-hosted WhatsApp Multi-Session API service. Manage multiple WhatsApp numbers simultaneously through REST API and WebSocket interface.

[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-GHCR-blue.svg)](https://ghcr.io)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Features

- **Multi-Session Support**: Manage multiple WhatsApp numbers from a single server
- **REST API**: Full HTTP API for session and message management
- **WebSocket Real-time**: Live events for QR codes, messages, and status changes
- **Webhook Integration**: Forward events to your endpoints with HMAC signatures
- **Dashboard UI**: Built-in React dashboard for easy management
- **Message Persistence**: SQLite-based message history that survives restarts
- **Auto-Reconnect**: Automatic reconnection with exponential backoff on disconnection
- **Typing Indicator**: Show "typing..." status before sending messages
- **Read Receipts**: Mark messages as read (blue checkmarks)
- **Multi-format Support**: Send text, images, documents, and locations
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
cd wahuy
docker-compose up -d

# Access dashboard
open http://localhost:7834
# Default API Key: wahuy-default-api-key-change-me
```

### Option 2: Local Development

```bash
# Clone and install
git clone <repository-url>
cd wahuy
npm install

# Configure
cp .env.example .env
# Edit .env with your API key

# Build and run
npm run build
npm start

# Access dashboard
open http://localhost:7834
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
PORT=7834
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

**Base URL:** `http://localhost:7834/api`

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

#### Get Detailed Status (with Error & Reconnect Info)
```http
GET /api/sessions/:sessionId/status
X-API-Key: your-api-key
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "my-session",
    "name": "My Session",
    "status": "ready",
    "phone": "6281234567890",
    "pushName": "John Doe",
    "isConnected": true,
    "lastError": null,
    "reconnect": {
      "enabled": true,
      "attempts": 0,
      "maxAttempts": 5,
      "nextAttemptAt": null,
      "lastAttemptAt": null
    },
    "createdAt": "2024-01-15T10:00:00.000Z",
    "lastActivity": "2024-01-15T12:30:00.000Z"
  }
}
```

When disconnected with error:
```json
{
  "success": true,
  "data": {
    "status": "reconnecting",
    "isConnected": false,
    "lastError": {
      "code": "DISCONNECTED",
      "message": "Connection closed",
      "timestamp": "2024-01-15T12:35:00.000Z"
    },
    "reconnect": {
      "enabled": true,
      "attempts": 2,
      "maxAttempts": 5,
      "nextAttemptAt": "2024-01-15T12:35:20.000Z",
      "lastAttemptAt": "2024-01-15T12:35:10.000Z"
    }
  }
}
```

#### Enable/Disable Auto-Reconnect
```http
POST /api/sessions/:sessionId/reconnect
X-API-Key: your-api-key
Content-Type: application/json

{
  "enabled": false
}
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "my-session",
    "autoReconnectEnabled": false
  }
}
```

#### Delete Session
```http
DELETE /api/sessions/:sessionId
X-API-Key: your-api-key
```

#### Get All Chats
```http
GET /api/sessions/:sessionId/chats
X-API-Key: your-api-key
```

Response:
```json
{
  "success": true,
  "data": {
    "chats": [
      {
        "id": "6281234567890@c.us",
        "name": "John Doe",
        "isGroup": false,
        "isReadOnly": false,
        "unreadCount": 2,
        "timestamp": "2024-01-15T10:30:00.000Z",
        "lastMessage": {
          "body": "Hello!",
          "timestamp": "2024-01-15T10:30:00.000Z",
          "fromMe": false
        }
      },
      {
        "id": "123456789@g.us",
        "name": "Family Group",
        "isGroup": true,
        "unreadCount": 5,
        "timestamp": "2024-01-15T12:00:00.000Z"
      }
    ],
    "count": 15
  }
}
```

#### Get Groups Only
```http
GET /api/sessions/:sessionId/groups
X-API-Key: your-api-key
```

Response:
```json
{
  "success": true,
  "data": {
    "groups": [
      {
        "id": "123456789@g.us",
        "name": "Family Group",
        "isReadOnly": false,
        "unreadCount": 5,
        "timestamp": "2024-01-15T12:00:00.000Z",
        "participantCount": 12,
        "participants": [
          {
            "id": "6281234567890@c.us",
            "isAdmin": true,
            "isSuperAdmin": false
          }
        ],
        "lastMessage": {
          "body": "Good morning!",
          "timestamp": "2024-01-15T12:00:00.000Z",
          "fromMe": false
        }
      }
    ],
    "count": 3
  }
}
```

### Messages

#### Understanding WhatsApp ID Formats

WhatsApp uses different ID formats for identifying users:

| Format | Example | Description |
|--------|---------|-------------|
| `@c.us` | `6281234567890@c.us` | Classic WhatsApp ID (phone-based) |
| `@lid` | `6281234567890@lid` | Linked ID - newer internal format |
| `@g.us` | `123456789@g.us` | Group chat ID |

**Important:** WhatsApp is transitioning to `@lid` format for some accounts. The `@lid` is an internal identifier and may not directly correspond to a phone number. To get the actual phone number, use the `contacts` field in message objects (see below).

#### Message Object Structure

All received messages include a `contacts` field with resolved contact information and `quotedMessage` for reply messages:

```json
{
  "id": "true_6281234567890@lid_3EB0...",
  "from": "6281234567890@lid",
  "to": "6287654321098@c.us",
  "body": "Hello!",
  "type": "chat",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "fromMe": false,
  "hasMedia": false,
  "isForwarded": false,
  "hasQuotedMsg": true,
  "quotedMessage": {
    "id": "true_6287654321098@c.us_3EB0ABC...",
    "from": "6287654321098@c.us",
    "to": "6281234567890@lid",
    "body": "Original message being replied to",
    "type": "chat",
    "timestamp": "2024-01-15T10:25:00.000Z",
    "fromMe": true,
    "hasMedia": false
  },
  "contacts": {
    "sender": {
      "id": "6281234567890@lid",
      "number": "6281234567890",
      "name": "John Doe",
      "pushname": "Johnny",
      "shortName": "John",
      "isBusiness": false,
      "isEnterprise": false,
      "isMe": false
    },
    "receiver": {
      "id": "6287654321098@c.us",
      "number": "6287654321098",
      "name": null,
      "pushname": "My Business",
      "shortName": null,
      "isBusiness": true,
      "isEnterprise": false,
      "isMe": true
    }
  }
}
```

**Quoted Message Fields:**
| Field | Description |
|-------|-------------|
| `hasQuotedMsg` | Boolean - whether this message is a reply to another message |
| `quotedMessage` | Object containing the original message being replied to (null if not a reply) |
| `quotedMessage.id` | ID of the original message |
| `quotedMessage.from` | Sender of the original message |
| `quotedMessage.body` | Content of the original message |

**Contact Fields:**
| Field | Description |
|-------|-------------|
| `id` | WhatsApp ID (may be `@c.us` or `@lid`) |
| `number` | **Actual phone number** (use this for reliable phone identification) |
| `name` | Contact name as saved in your contacts |
| `pushname` | Name the user has set for themselves |
| `shortName` | Shortened version of name |
| `isBusiness` | Whether this is a WhatsApp Business account |
| `isEnterprise` | Whether this is an enterprise account |
| `isMe` | Whether this contact is the current session |

#### Send Text Message
```http
POST /api/sessions/:sessionId/messages/send
Content-Type: application/json
X-API-Key: your-api-key

{
  "to": "6281234567890",
  "text": "Hello from Wahuy!"
}
```

**Note:** The `to` field supports multiple formats:
- Phone number: `6281234567890` (auto-converts to `6281234567890@c.us`)
- Full JID: `6281234567890@c.us` (preserved as-is)
- LID format: `6281234567890@lid` (preserved as-is)
- Group: `123456789@g.us` (preserved as-is)

**Response:**
```json
{
  "success": true,
  "data": {
    "messageId": "true_6281234567890@c.us_3EB0...",
    "to": "6281234567890@c.us",
    "status": "sent",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

#### Send Image (Base64)
```http
POST /api/sessions/:sessionId/messages/send-image
Content-Type: application/json
X-API-Key: your-api-key

{
  "to": "6281234567890",
  "base64Data": "/9j/4AAQSkZJRgABAQEASABIAAD...",
  "mimeType": "image/jpeg",
  "caption": "My image caption",
  "filename": "photo.jpg"
}
```

#### Send Document (Base64)
```http
POST /api/sessions/:sessionId/messages/send-document
Content-Type: application/json
X-API-Key: your-api-key

{
  "to": "6281234567890",
  "base64Data": "JVBERi0xLjQKJcOkw7zDtsO...",
  "mimeType": "application/pdf",
  "filename": "document.pdf",
  "caption": "My document"
}
```

#### Send Location
```http
POST /api/sessions/:sessionId/messages/send-location
Content-Type: application/json
X-API-Key: your-api-key

{
  "to": "6281234567890",
  "latitude": -6.2088,
  "longitude": 106.8456,
  "description": "Monas, Jakarta"
}
```

#### Reply to Message
```http
POST /api/sessions/:sessionId/messages/reply
Content-Type: application/json
X-API-Key: your-api-key

{
  "to": "6281234567890",
  "messageId": "true_6281234567890@c.us_3EB0...",
  "text": "This is a reply"
}
```

#### Get Chat History (from WhatsApp)
```http
GET /api/sessions/:sessionId/chats/:phone/messages?limit=50
X-API-Key: your-api-key
```

**Response:**
```json
{
  "success": true,
  "data": {
    "phone": "6281234567890",
    "messages": [...],
    "count": 50
  }
}
```

#### Get Conversation (from Persistent Storage)

Get all messages between a session and a phone number (both sent and received) from the SQLite database.

```http
GET /api/sessions/:sessionId/conversations/:phone?limit=100&offset=0
X-API-Key: your-api-key
```

**Parameters:**
- `:sessionId` - The session ID
- `:phone` - Phone number (with or without country code, e.g., `6281234567890` or `081234567890`)
- `limit` (optional) - Max messages to return (default: 100)
- `offset` (optional) - Pagination offset (default: 0)

**Example:**
```http
GET /api/sessions/main/conversations/6281234567890?limit=50
X-API-Key: your-api-key
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "main",
    "phone": "6281234567890",
    "messages": [
      {
        "id": "true_6281234567890@c.us_3EB0...",
        "from": "6281234567890@c.us",
        "to": "6287654321098@c.us",
        "body": "Hello!",
        "type": "chat",
        "timestamp": "2024-01-15T10:30:00.000Z",
        "fromMe": false,
        "hasMedia": false,
        "contacts": {
          "sender": {
            "id": "6281234567890@c.us",
            "number": "6281234567890",
            "name": "John Doe",
            "pushname": "Johnny"
          },
          "receiver": { ... }
        }
      },
      {
        "id": "true_6287654321098@c.us_3EB1...",
        "from": "6287654321098@c.us",
        "to": "6281234567890@c.us",
        "body": "Hi back!",
        "type": "chat",
        "timestamp": "2024-01-15T10:31:00.000Z",
        "fromMe": true,
        "hasMedia": false,
        "contacts": { ... }
      }
    ],
    "count": 2,
    "total": 150,
    "offset": 0,
    "limit": 100
  }
}
```

**Note:** This endpoint queries the persistent SQLite storage, so it returns messages that have been saved since the message persistence feature was enabled. For real-time chat history directly from WhatsApp, use the `/chats/:phone/messages` endpoint instead.

### Typing Indicator

Show "typing..." status in the chat before sending a message.

```http
POST /api/sessions/:sessionId/typing
Content-Type: application/json
X-API-Key: your-api-key

{
  "to": "6281234567890@c.us",
  "duration": 3000
}
```

**Parameters:**
- `to` (required): Recipient phone number or JID
- `duration` (optional): Duration in milliseconds (default: 3000, max: 25000)

**Response:**
```json
{
  "success": true,
  "data": {
    "to": "6281234567890@c.us",
    "duration": 3000,
    "status": "typing"
  }
}
```

### Recording Indicator

Show "recording..." status (for voice messages).

```http
POST /api/sessions/:sessionId/recording
Content-Type: application/json
X-API-Key: your-api-key

{
  "to": "6281234567890@c.us",
  "duration": 3000
}
```

### Read Receipt (Blue Checkmark)

Mark a chat or specific message as read.

```http
POST /api/sessions/:sessionId/read
Content-Type: application/json
X-API-Key: your-api-key

{
  "chatId": "6281234567890@c.us"
}
```

Or mark by message ID:

```http
POST /api/sessions/:sessionId/read
Content-Type: application/json
X-API-Key: your-api-key

{
  "messageId": "true_6281234567890@c.us_3EB0..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "chatId": "6281234567890@c.us",
    "status": "read"
  }
}
```

### Message History (Persistent Storage)

Messages are automatically saved to SQLite database and persist across restarts.

#### Get Message History
```http
GET /api/sessions/messages/history
X-API-Key: your-api-key
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `sessionId` | string | Filter by session |
| `from` | string | Filter by sender (partial match) |
| `to` | string | Filter by recipient (partial match) |
| `type` | string | Filter by message type (chat, image, etc.) |
| `fromMe` | boolean | Filter sent/received messages |
| `hasMedia` | boolean | Filter messages with media |
| `startDate` | string | Filter from date (ISO 8601) |
| `endDate` | string | Filter to date (ISO 8601) |
| `search` | string | Search in message body |
| `limit` | number | Max results (default: 100) |
| `offset` | number | Pagination offset |

**Example:**
```http
GET /api/sessions/messages/history?sessionId=main&fromMe=false&limit=50
X-API-Key: your-api-key
```

**Response:**
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "true_6281234567890@c.us_3EB0...",
        "sessionId": "main",
        "from": "6281234567890@c.us",
        "to": "6287654321098@c.us",
        "body": "Hello!",
        "type": "chat",
        "timestamp": "2024-01-15T10:30:00.000Z",
        "fromMe": false,
        "hasMedia": false,
        "receivedAt": "2024-01-15T10:30:01.000Z"
      }
    ],
    "count": 1,
    "total": 150,
    "offset": 0,
    "limit": 100
  }
}
```

#### Get Message Statistics
```http
GET /api/sessions/messages/stats
X-API-Key: your-api-key
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 1500,
    "bySession": {
      "main": 1000,
      "secondary": 500
    },
    "byType": {
      "chat": 1200,
      "image": 200,
      "document": 100
    },
    "received": 800,
    "sent": 700
  }
}
```

#### Clear Message History
```http
DELETE /api/sessions/messages/history
X-API-Key: your-api-key
```

**Query Parameters:**
- `sessionId`: Clear only messages from this session
- `olderThan`: Clear messages older than this date (ISO 8601)

**Examples:**
```http
# Clear all messages
DELETE /api/sessions/messages/history

# Clear messages for specific session
DELETE /api/sessions/messages/history?sessionId=main

# Clear messages older than 30 days
DELETE /api/sessions/messages/history?olderThan=2024-01-01T00:00:00.000Z
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
- `message.received` - Incoming message
- `message.sent` - Outgoing message
- `message.ack` - Message delivery status
- `session.qr_updated` - QR code generated
- `session.authenticated` - Session authenticated
- `session.ready` - Session connected and ready
- `session.disconnected` - Session disconnected
- `session.auth_failure` - Authentication failed
- `session.reconnecting` - Session attempting reconnect
- `session.failed` - Session permanently failed (max retries exceeded)

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

const socket = io('http://localhost:7834', {
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

Access the built-in dashboard at `http://localhost:7834`

Features:
- Session management (create, start, stop, delete)
- Real-time QR code display
- Message viewer with persistent history
- Webhook configuration
- Connection status

### Dashboard Login

Enter your API key on the login screen to access the dashboard.

## Docker Deployment

### Using Pre-built Image from GHCR (Recommended)

The easiest way to deploy Wahuy is using the pre-built Docker image from GitHub Container Registry:

```bash
# Pull and run the latest image
docker run -d \
  --name wahuy \
  -p 7834:7834 \
  -e API_KEY=your-secret-key \
  -e DASHBOARD_ENABLED=true \
  -v wahuy_data:/app/data \
  ghcr.io/utsmannn/wahuy:latest
```

Or create a `docker-compose.yml`:

```yaml
services:
  wahuy:
    image: ghcr.io/utsmannn/wahuy:latest
    container_name: wahuy
    restart: unless-stopped
    ports:
      - "7834:7834"
    environment:
      - NODE_ENV=production
      - PORT=7834
      - API_KEY=${API_KEY:-wahuy-default-api-key-change-me}
      - DASHBOARD_ENABLED=true
      - LOG_LEVEL=info
      - STORAGE_PATH=/app/data
    volumes:
      - wahuy_data:/app/data

volumes:
  wahuy_data:
    driver: local
```

Then run:
```bash
docker-compose up -d
```

### Using Docker Compose (Build from Source)

The included `docker-compose.yml` runs Wahuy on port **7834**.

```yaml
services:
  wahuy:
    build:
      context: .
      dockerfile: docker/Dockerfile
    container_name: wahuy
    restart: unless-stopped
    ports:
      - "7834:7834"
    environment:
      - NODE_ENV=production
      - PORT=7834
      - API_KEY=${API_KEY:-wahuy-default-api-key-change-me}
      - DASHBOARD_ENABLED=true
      - LOG_LEVEL=info
      - STORAGE_PATH=/app/data
    volumes:
      - wahuy_data:/app/data
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:7834/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

volumes:
  wahuy_data:
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

### Data Persistence

All data is stored in the Docker volume `wahuy_data`:
- `sessions.json` - Session configurations
- `webhooks.json` - Webhook configurations
- `messages.db` - SQLite database for message history
- `sessions/` - WhatsApp session data (auth, cache)

### Using Docker

```bash
# Build
docker build -t wahuy -f docker/Dockerfile .

# Run
docker run -d \
  --name wahuy \
  -p 7834:7834 \
  -e API_KEY=your-secret-key \
  -e DASHBOARD_ENABLED=true \
  -v wahuy_data:/app/data \
  wahuy
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
3. Check server logs:
   ```bash
   # Docker
   docker-compose logs -f wahuy

   # Local development (logs output to terminal)
   npm run dev
   ```

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
   docker exec wahuy which chromium
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
wahuy/
├── src/
│   ├── api/           # REST API routes
│   ├── core/          # Core business logic
│   ├── storage/       # File & SQLite storage
│   ├── websocket/     # WebSocket server
│   ├── types/         # TypeScript types
│   └── utils/         # Utilities
├── dashboard/         # React dashboard
├── data/              # Storage directory
│   ├── sessions.json  # Session configs
│   ├── webhooks.json  # Webhook configs
│   ├── messages.db    # SQLite message history
│   └── sessions/      # WhatsApp auth data
├── docker/            # Docker configuration
├── dist/              # Compiled output
└── tests/             # Test files
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

- GitHub Issues: [Report bugs](https://github.com/utsmannn/wahuy/issues)

---

**Note:** This project is not affiliated with WhatsApp Inc. Use at your own risk. WhatsApp may ban accounts for unofficial usage.
