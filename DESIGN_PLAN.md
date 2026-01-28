# WASimple - WhatsApp Multi-Session Service

**Status:** Design Document
**Version:** 1.0
**Created:** 2025-01-28
**Tech Stack:** Node.js + TypeScript + whatsapp-web.js

---

## 1. Overview

WASimple adalah service WhatsApp independen yang mendukung multiple sessions/nomor. Service ini menyediakan REST API, WebSocket untuk realtime events, dan dashboard sederhana untuk management.

### Goals

- **Multi-Session:** Handle unlimited WhatsApp numbers
- **Independent:** Tidak terikat dengan project lain
- **Simple:** Easy to deploy dan maintain
- **Extensible:** Webhook system untuk integrasi dengan service lain

### Non-Goals

- Tidak handle business logic (itu tugas consumer service)
- Tidak store message history long-term (optional, configurable)
- Tidak handle media processing (hanya forward)

---

## 2. Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              WASimple                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐                   │
│   │  REST API   │   │  WebSocket  │   │  Dashboard  │                   │
│   │  (Fastify)  │   │ (Socket.io) │   │   (React)   │                   │
│   │  Port 3000  │   │  Port 3000  │   │  Port 3000  │                   │
│   └──────┬──────┘   └──────┬──────┘   └─────────────┘                   │
│          │                 │                                             │
│          ▼                 ▼                                             │
│   ┌─────────────────────────────────────────────────────────────┐       │
│   │                    Session Manager                           │       │
│   │                                                              │       │
│   │  • Session lifecycle (create, start, stop, delete)          │       │
│   │  • Connection state management                               │       │
│   │  • Auto-reconnect with exponential backoff                  │       │
│   │  • QR code generation & caching                             │       │
│   └──────────────────────────┬──────────────────────────────────┘       │
│                              │                                           │
│              ┌───────────────┼───────────────┐                          │
│              ▼               ▼               ▼                          │
│         ┌────────┐      ┌────────┐      ┌────────┐                      │
│         │ Client │      │ Client │      │ Client │    ...               │
│         │   #1   │      │   #2   │      │   #3   │                      │
│         └────────┘      └────────┘      └────────┘                      │
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────┐       │
│   │                   Webhook Dispatcher                         │       │
│   │                                                              │       │
│   │  Events:                                                     │       │
│   │  • message.received    • session.authenticated              │       │
│   │  • message.sent        • session.disconnected               │       │
│   │  • message.ack         • session.qr_updated                 │       │
│   └──────────────────────────┬──────────────────────────────────┘       │
│                              │                                           │
└──────────────────────────────┼───────────────────────────────────────────┘
                               │
                               │ HTTP POST (webhooks)
                               ▼
                    ┌──────────────────────┐
                    │   External Services  │
                    │                      │
                    │  • core-gateway      │
                    │  • n8n               │
                    │  • custom backends   │
                    └──────────────────────┘
```

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           src/                                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐             │
│  │    index.ts  │────▶│   Server     │────▶│   Routes     │             │
│  │  (entrypoint)│     │  (Fastify)   │     │              │             │
│  └──────────────┘     └──────────────┘     │ • sessions   │             │
│                              │              │ • messages   │             │
│                              │              │ • webhooks   │             │
│                              │              │ • health     │             │
│                              ▼              └──────────────┘             │
│                       ┌──────────────┐                                   │
│                       │  WebSocket   │                                   │
│                       │  (Socket.io) │                                   │
│                       └──────────────┘                                   │
│                              │                                           │
│                              ▼                                           │
│  ┌───────────────────────────────────────────────────────────────┐      │
│  │                     core/                                      │      │
│  │                                                                │      │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌───────────────┐  │      │
│  │  │ SessionManager  │  │ WhatsAppClient  │  │ WebhookDispatch│ │      │
│  │  │                 │  │                 │  │               │  │      │
│  │  │ • sessions Map  │  │ • Client wrapper│  │ • Queue       │  │      │
│  │  │ • CRUD ops      │  │ • Event handler │  │ • Retry logic │  │      │
│  │  │ • State machine │  │ • Message send  │  │ • HTTP POST   │  │      │
│  │  └─────────────────┘  └─────────────────┘  └───────────────┘  │      │
│  └───────────────────────────────────────────────────────────────┘      │
│                              │                                           │
│                              ▼                                           │
│  ┌───────────────────────────────────────────────────────────────┐      │
│  │                     storage/                                   │      │
│  │                                                                │      │
│  │  ┌─────────────────┐  ┌─────────────────┐                     │      │
│  │  │  SessionStore   │  │  WebhookStore   │                     │      │
│  │  │  (sessions.json)│  │ (webhooks.json) │                     │      │
│  │  └─────────────────┘  └─────────────────┘                     │      │
│  └───────────────────────────────────────────────────────────────┘      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Directory Structure

```
wasimple/
├── .github/
│   └── workflows/
│       └── ci.yml                    # GitHub Actions CI
├── docker/
│   ├── Dockerfile                    # Production Dockerfile
│   └── docker-compose.yml            # Local development
├── src/
│   ├── index.ts                      # Application entry point
│   ├── config.ts                     # Environment configuration
│   ├── server.ts                     # Fastify server setup
│   │
│   ├── api/
│   │   ├── index.ts                  # Route registration
│   │   ├── routes/
│   │   │   ├── sessions.ts           # Session CRUD endpoints
│   │   │   ├── messages.ts           # Message sending endpoints
│   │   │   ├── webhooks.ts           # Webhook management endpoints
│   │   │   └── health.ts             # Health check endpoints
│   │   ├── middleware/
│   │   │   ├── auth.ts               # API key authentication
│   │   │   └── validation.ts         # Request validation
│   │   └── schemas/
│   │       ├── session.schema.ts     # Session request/response schemas
│   │       ├── message.schema.ts     # Message schemas
│   │       └── webhook.schema.ts     # Webhook schemas
│   │
│   ├── core/
│   │   ├── SessionManager.ts         # Multi-session orchestrator
│   │   ├── WhatsAppClient.ts         # Single client wrapper
│   │   ├── WebhookDispatcher.ts      # Event to HTTP dispatcher
│   │   ├── QRCodeManager.ts          # QR generation & caching
│   │   └── types.ts                  # Core type definitions
│   │
│   ├── storage/
│   │   ├── index.ts                  # Storage factory
│   │   ├── FileStorage.ts            # JSON file storage
│   │   ├── SqliteStorage.ts          # SQLite storage (optional)
│   │   └── types.ts                  # Storage interfaces
│   │
│   ├── websocket/
│   │   ├── index.ts                  # Socket.io setup
│   │   ├── handlers.ts               # WebSocket event handlers
│   │   └── types.ts                  # WebSocket types
│   │
│   ├── utils/
│   │   ├── logger.ts                 # Pino logger setup
│   │   ├── retry.ts                  # Retry utilities
│   │   └── phone.ts                  # Phone number utilities
│   │
│   └── types/
│       ├── index.ts                  # Global type exports
│       ├── session.ts                # Session types
│       ├── message.ts                # Message types
│       └── webhook.ts                # Webhook types
│
├── dashboard/
│   ├── index.html                    # Dashboard entry
│   ├── src/
│   │   ├── main.tsx                  # React entry
│   │   ├── App.tsx                   # Main app component
│   │   ├── components/
│   │   │   ├── SessionList.tsx       # Session list view
│   │   │   ├── SessionCard.tsx       # Single session card
│   │   │   ├── QRCodeView.tsx        # QR code display
│   │   │   ├── WebhookConfig.tsx     # Webhook management
│   │   │   └── MessageLog.tsx        # Recent messages
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts       # WebSocket hook
│   │   │   └── useApi.ts             # API hook
│   │   └── styles/
│   │       └── globals.css           # Tailwind styles
│   ├── package.json                  # Dashboard dependencies
│   └── vite.config.ts                # Vite config
│
├── data/                             # Runtime data (gitignored)
│   ├── sessions/                     # WhatsApp session auth data
│   ├── sessions.json                 # Session metadata
│   └── webhooks.json                 # Webhook configurations
│
├── tests/
│   ├── unit/
│   │   ├── SessionManager.test.ts
│   │   ├── WebhookDispatcher.test.ts
│   │   └── WhatsAppClient.test.ts
│   ├── integration/
│   │   ├── api.test.ts
│   │   └── websocket.test.ts
│   └── fixtures/
│       └── messages.json
│
├── scripts/
│   ├── build.sh                      # Build script
│   └── dev.sh                        # Development script
│
├── .env.example                      # Environment template
├── .gitignore
├── .eslintrc.js
├── .prettierrc
├── tsconfig.json
├── package.json
├── DESIGN_PLAN.md                    # This file
└── README.md                         # User documentation
```

---

## 4. API Specification

### Authentication

All API endpoints require API key authentication via header:

```
X-API-Key: your-api-key-here
```

### Base URL

```
http://localhost:3000/api
```

---

### 4.1 Sessions API

#### Create Session

```http
POST /api/sessions
Content-Type: application/json
X-API-Key: {api_key}

{
  "id": "my-session",           // Optional, auto-generated if not provided
  "name": "Main WhatsApp",      // Display name
  "webhooks": [                 // Optional, session-specific webhooks
    {
      "url": "http://localhost:3001/webhook",
      "events": ["message.received"]
    }
  ]
}
```

**Response: 201 Created**
```json
{
  "success": true,
  "data": {
    "id": "my-session",
    "name": "Main WhatsApp",
    "status": "created",
    "createdAt": "2025-01-28T12:00:00Z"
  }
}
```

#### List Sessions

```http
GET /api/sessions
X-API-Key: {api_key}
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": [
    {
      "id": "session-1",
      "name": "Main WhatsApp",
      "status": "connected",
      "phone": "628123456789",
      "lastActivity": "2025-01-28T12:00:00Z"
    },
    {
      "id": "session-2",
      "name": "Support Line",
      "status": "scan_qr",
      "phone": null,
      "lastActivity": null
    }
  ]
}
```

#### Get Session

```http
GET /api/sessions/{session_id}
X-API-Key: {api_key}
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "id": "session-1",
    "name": "Main WhatsApp",
    "status": "connected",
    "phone": "628123456789",
    "pushName": "John Doe",
    "platform": "android",
    "lastActivity": "2025-01-28T12:00:00Z",
    "createdAt": "2025-01-20T08:00:00Z",
    "statistics": {
      "messagesSent": 150,
      "messagesReceived": 320,
      "uptime": 604800
    }
  }
}
```

#### Start Session

```http
POST /api/sessions/{session_id}/start
X-API-Key: {api_key}
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "id": "session-1",
    "status": "starting"
  }
}
```

#### Stop Session

```http
POST /api/sessions/{session_id}/stop
X-API-Key: {api_key}
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "id": "session-1",
    "status": "stopped"
  }
}
```

#### Delete Session

```http
DELETE /api/sessions/{session_id}
X-API-Key: {api_key}
```

**Response: 200 OK**
```json
{
  "success": true,
  "message": "Session deleted"
}
```

#### Get QR Code

```http
GET /api/sessions/{session_id}/qr
X-API-Key: {api_key}
Accept: image/png | application/json
```

**Response (image/png): 200 OK**
```
[PNG binary data]
```

**Response (application/json): 200 OK**
```json
{
  "success": true,
  "data": {
    "qr": "data:image/png;base64,iVBORw0KGgo...",
    "expiresAt": "2025-01-28T12:01:00Z"
  }
}
```

#### Logout Session

```http
POST /api/sessions/{session_id}/logout
X-API-Key: {api_key}
```

**Response: 200 OK**
```json
{
  "success": true,
  "message": "Session logged out"
}
```

---

### 4.2 Messages API

#### Send Text Message

```http
POST /api/sessions/{session_id}/messages/send
Content-Type: application/json
X-API-Key: {api_key}

{
  "to": "628123456789",         // Phone number (with country code)
  "text": "Hello, World!"
}
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "messageId": "3EB0A9C8B2F4",
    "to": "628123456789@c.us",
    "status": "sent",
    "timestamp": "2025-01-28T12:00:00Z"
  }
}
```

#### Send Image

```http
POST /api/sessions/{session_id}/messages/send-image
Content-Type: application/json
X-API-Key: {api_key}

{
  "to": "628123456789",
  "image": "https://example.com/image.jpg",  // URL or base64
  "caption": "Check this out!"               // Optional
}
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "messageId": "3EB0A9C8B2F5",
    "to": "628123456789@c.us",
    "type": "image",
    "status": "sent"
  }
}
```

#### Send Document

```http
POST /api/sessions/{session_id}/messages/send-document
Content-Type: application/json
X-API-Key: {api_key}

{
  "to": "628123456789",
  "document": "https://example.com/file.pdf",  // URL or base64
  "filename": "report.pdf",
  "caption": "Monthly report"                   // Optional
}
```

#### Send Location

```http
POST /api/sessions/{session_id}/messages/send-location
Content-Type: application/json
X-API-Key: {api_key}

{
  "to": "628123456789",
  "latitude": -6.2088,
  "longitude": 106.8456,
  "description": "Jakarta, Indonesia"          // Optional
}
```

#### Send Contact

```http
POST /api/sessions/{session_id}/messages/send-contact
Content-Type: application/json
X-API-Key: {api_key}

{
  "to": "628123456789",
  "contact": {
    "name": "John Doe",
    "phone": "628987654321"
  }
}
```

#### Send Buttons (Interactive)

```http
POST /api/sessions/{session_id}/messages/send-buttons
Content-Type: application/json
X-API-Key: {api_key}

{
  "to": "628123456789",
  "text": "Please choose an option:",
  "buttons": [
    { "id": "btn1", "text": "Option 1" },
    { "id": "btn2", "text": "Option 2" },
    { "id": "btn3", "text": "Option 3" }
  ],
  "footer": "Powered by WASimple"              // Optional
}
```

#### Reply to Message

```http
POST /api/sessions/{session_id}/messages/reply
Content-Type: application/json
X-API-Key: {api_key}

{
  "to": "628123456789",
  "text": "This is a reply",
  "quotedMessageId": "3EB0A9C8B2F4"
}
```

#### Get Chat Messages

```http
GET /api/sessions/{session_id}/chats/{phone}/messages?limit=50
X-API-Key: {api_key}
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "3EB0A9C8B2F4",
        "from": "628123456789@c.us",
        "to": "628987654321@c.us",
        "body": "Hello!",
        "type": "chat",
        "timestamp": "2025-01-28T12:00:00Z",
        "fromMe": false,
        "ack": 2
      }
    ],
    "hasMore": true
  }
}
```

---

### 4.3 Webhooks API

#### Register Webhook

```http
POST /api/webhooks
Content-Type: application/json
X-API-Key: {api_key}

{
  "url": "https://your-server.com/webhook",
  "events": ["message.received", "session.authenticated"],
  "sessions": ["session-1", "session-2"],     // Optional, empty = all sessions
  "secret": "your-webhook-secret",            // Optional, for signature verification
  "active": true
}
```

**Response: 201 Created**
```json
{
  "success": true,
  "data": {
    "id": "wh_abc123",
    "url": "https://your-server.com/webhook",
    "events": ["message.received", "session.authenticated"],
    "sessions": ["session-1", "session-2"],
    "active": true,
    "createdAt": "2025-01-28T12:00:00Z"
  }
}
```

#### List Webhooks

```http
GET /api/webhooks
X-API-Key: {api_key}
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": [
    {
      "id": "wh_abc123",
      "url": "https://your-server.com/webhook",
      "events": ["message.received"],
      "active": true,
      "lastTriggered": "2025-01-28T12:00:00Z",
      "stats": {
        "totalSent": 150,
        "totalFailed": 2
      }
    }
  ]
}
```

#### Update Webhook

```http
PUT /api/webhooks/{webhook_id}
Content-Type: application/json
X-API-Key: {api_key}

{
  "active": false
}
```

#### Delete Webhook

```http
DELETE /api/webhooks/{webhook_id}
X-API-Key: {api_key}
```

#### Test Webhook

```http
POST /api/webhooks/{webhook_id}/test
X-API-Key: {api_key}
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "statusCode": 200,
    "responseTime": 150,
    "body": "OK"
  }
}
```

---

### 4.4 Health API

#### Health Check

```http
GET /api/health
```

**Response: 200 OK**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 86400,
  "sessions": {
    "total": 5,
    "connected": 3,
    "disconnected": 2
  }
}
```

#### Readiness Check

```http
GET /api/health/ready
```

**Response: 200 OK**
```json
{
  "ready": true
}
```

---

## 5. Webhook Events

### Event Format

All webhook payloads follow this structure:

```json
{
  "event": "event.name",
  "timestamp": "2025-01-28T12:00:00.000Z",
  "session": {
    "id": "session-1",
    "phone": "628123456789"
  },
  "payload": {
    // Event-specific data
  }
}
```

### Event Types

#### message.received

Triggered when a message is received.

```json
{
  "event": "message.received",
  "timestamp": "2025-01-28T12:00:00.000Z",
  "session": {
    "id": "session-1",
    "phone": "628123456789"
  },
  "payload": {
    "id": "3EB0A9C8B2F4",
    "from": "628987654321@c.us",
    "fromName": "John Doe",
    "to": "628123456789@c.us",
    "body": "Hello, how are you?",
    "type": "chat",
    "hasMedia": false,
    "isGroup": false,
    "isForwarded": false,
    "quotedMessage": null
  }
}
```

#### message.received (with media)

```json
{
  "event": "message.received",
  "timestamp": "2025-01-28T12:00:00.000Z",
  "session": {
    "id": "session-1",
    "phone": "628123456789"
  },
  "payload": {
    "id": "3EB0A9C8B2F5",
    "from": "628987654321@c.us",
    "fromName": "John Doe",
    "to": "628123456789@c.us",
    "body": "Check this image",
    "type": "image",
    "hasMedia": true,
    "media": {
      "mimetype": "image/jpeg",
      "filename": "photo.jpg",
      "url": "http://localhost:3000/api/media/abc123"
    },
    "isGroup": false
  }
}
```

#### message.sent

Triggered when a message is successfully sent.

```json
{
  "event": "message.sent",
  "timestamp": "2025-01-28T12:00:00.000Z",
  "session": {
    "id": "session-1",
    "phone": "628123456789"
  },
  "payload": {
    "id": "3EB0A9C8B2F6",
    "to": "628987654321@c.us",
    "body": "Hello!",
    "type": "chat",
    "status": "sent"
  }
}
```

#### message.ack

Triggered when message delivery status changes.

```json
{
  "event": "message.ack",
  "timestamp": "2025-01-28T12:00:00.000Z",
  "session": {
    "id": "session-1",
    "phone": "628123456789"
  },
  "payload": {
    "id": "3EB0A9C8B2F6",
    "ack": 3,
    "ackName": "read"
  }
}
```

ACK values:
- `0` = Error
- `1` = Pending
- `2` = Sent (server received)
- `3` = Delivered
- `4` = Read

#### session.qr_updated

Triggered when QR code is generated/updated.

```json
{
  "event": "session.qr_updated",
  "timestamp": "2025-01-28T12:00:00.000Z",
  "session": {
    "id": "session-1",
    "phone": null
  },
  "payload": {
    "qr": "2@ABC123...",
    "qrImage": "data:image/png;base64,..."
  }
}
```

#### session.authenticated

Triggered when session is authenticated (QR scanned).

```json
{
  "event": "session.authenticated",
  "timestamp": "2025-01-28T12:00:00.000Z",
  "session": {
    "id": "session-1",
    "phone": "628123456789"
  },
  "payload": {
    "phone": "628123456789",
    "pushName": "John Doe",
    "platform": "android"
  }
}
```

#### session.ready

Triggered when session is fully ready.

```json
{
  "event": "session.ready",
  "timestamp": "2025-01-28T12:00:00.000Z",
  "session": {
    "id": "session-1",
    "phone": "628123456789"
  },
  "payload": {}
}
```

#### session.disconnected

Triggered when session is disconnected.

```json
{
  "event": "session.disconnected",
  "timestamp": "2025-01-28T12:00:00.000Z",
  "session": {
    "id": "session-1",
    "phone": "628123456789"
  },
  "payload": {
    "reason": "conflict",
    "willReconnect": true
  }
}
```

Disconnect reasons:
- `conflict` - WhatsApp opened on another device
- `logout` - User logged out
- `network` - Network error
- `banned` - Number banned

#### group.join

Triggered when added to a group.

```json
{
  "event": "group.join",
  "timestamp": "2025-01-28T12:00:00.000Z",
  "session": {
    "id": "session-1",
    "phone": "628123456789"
  },
  "payload": {
    "groupId": "123456789@g.us",
    "groupName": "Family Group",
    "invitedBy": "628987654321@c.us"
  }
}
```

---

## 6. WebSocket Events

### Connection

```javascript
const socket = io('http://localhost:3000', {
  auth: {
    apiKey: 'your-api-key'
  }
});
```

### Client → Server Events

#### subscribe

Subscribe to session events.

```javascript
socket.emit('subscribe', {
  sessions: ['session-1', 'session-2'],  // Or ['*'] for all
  events: ['message.received', 'session.qr_updated']
});
```

#### unsubscribe

```javascript
socket.emit('unsubscribe', {
  sessions: ['session-1']
});
```

### Server → Client Events

#### session:qr

Real-time QR code updates.

```javascript
socket.on('session:qr', (data) => {
  console.log(data);
  // {
  //   sessionId: 'session-1',
  //   qr: 'data:image/png;base64,...'
  // }
});
```

#### session:status

Session status changes.

```javascript
socket.on('session:status', (data) => {
  console.log(data);
  // {
  //   sessionId: 'session-1',
  //   status: 'connected',
  //   phone: '628123456789'
  // }
});
```

#### message:received

Real-time incoming messages.

```javascript
socket.on('message:received', (data) => {
  console.log(data);
  // Same format as webhook payload
});
```

---

## 7. Session States

### State Machine

```
                          ┌─────────────────────────────────────┐
                          │                                     │
                          ▼                                     │
┌─────────┐   start   ┌─────────┐   qr_ready   ┌─────────┐     │
│ CREATED │──────────▶│STARTING │─────────────▶│ SCAN_QR │     │
└─────────┘           └─────────┘              └────┬────┘     │
                          │                         │          │
                          │ error                   │ scanned  │
                          ▼                         ▼          │
                     ┌─────────┐              ┌──────────┐     │
                     │ FAILED  │              │CONNECTING│     │
                     └─────────┘              └────┬─────┘     │
                          ▲                        │           │
                          │ error                  │ connected │
                          │                        ▼           │
┌─────────┐   stop    ┌───┴─────┐            ┌──────────┐     │
│ STOPPED │◀──────────│CONNECTED│◀───────────│  READY   │     │
└─────────┘           └────┬────┘            └──────────┘     │
     │                     │                                   │
     │                     │ disconnect                        │
     │                     ▼                                   │
     │               ┌──────────────┐                          │
     │               │ DISCONNECTED │──────────────────────────┘
     │               └──────────────┘     auto-reconnect
     │                     │
     │                     │ manual stop
     └─────────────────────┘
```

### State Descriptions

| State | Description |
|-------|-------------|
| `created` | Session created but not started |
| `starting` | Client initializing |
| `scan_qr` | Waiting for QR code scan |
| `connecting` | QR scanned, connecting |
| `connected` | Connected and authenticated |
| `ready` | Fully ready to send/receive |
| `disconnected` | Temporarily disconnected |
| `stopped` | Manually stopped |
| `failed` | Failed to connect |

---

## 8. Configuration

### Environment Variables

```bash
# Server
PORT=3000
HOST=0.0.0.0
NODE_ENV=production

# API Security
API_KEY=your-secure-api-key-here
API_KEYS=key1,key2,key3              # Multiple keys (comma-separated)

# Dashboard
DASHBOARD_ENABLED=true
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=admin123

# Storage
STORAGE_TYPE=file                    # file | sqlite
STORAGE_PATH=./data

# Webhook
WEBHOOK_TIMEOUT=30000                # 30 seconds
WEBHOOK_RETRY_COUNT=3
WEBHOOK_RETRY_DELAY=5000             # 5 seconds

# Session
SESSION_RESTART_ON_AUTH_FAIL=true
SESSION_RECONNECT_INTERVAL=5000
SESSION_MAX_RECONNECT_ATTEMPTS=10

# Logging
LOG_LEVEL=info                       # debug | info | warn | error
LOG_FORMAT=json                      # json | pretty

# WhatsApp Web.js
PUPPETEER_EXECUTABLE_PATH=           # Custom chromium path (optional)
PUPPETEER_HEADLESS=true
PUPPETEER_ARGS=--no-sandbox,--disable-setuid-sandbox
```

### Config File (config.json)

Optional config file for complex configurations:

```json
{
  "server": {
    "port": 3000,
    "host": "0.0.0.0"
  },
  "security": {
    "apiKeys": ["key1", "key2"],
    "cors": {
      "origin": ["http://localhost:3000"],
      "credentials": true
    }
  },
  "webhook": {
    "timeout": 30000,
    "retries": {
      "count": 3,
      "delay": 5000,
      "backoff": "exponential"
    }
  },
  "session": {
    "autoReconnect": true,
    "reconnectInterval": 5000,
    "maxReconnectAttempts": 10
  },
  "storage": {
    "type": "file",
    "path": "./data"
  }
}
```

---

## 9. Dashboard

### Features

1. **Session Management**
   - List all sessions with status indicators
   - Create new session
   - Start/Stop/Delete sessions
   - Real-time QR code display
   - Session details & statistics

2. **Webhook Management**
   - List registered webhooks
   - Add/Edit/Delete webhooks
   - Test webhook endpoint
   - View webhook delivery logs

3. **Message Viewer**
   - Recent messages per session
   - Search messages
   - Reply to messages

4. **System Status**
   - Server health
   - Connected sessions count
   - Memory/CPU usage

### Wireframes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  WASimple Dashboard                                    [admin] [Logout]     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Sessions                                        [+ New Session]     │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │                                                                      │    │
│  │  ┌──────────────────────┐  ┌──────────────────────┐                 │    │
│  │  │  session-1           │  │  session-2           │                 │    │
│  │  │  ● Connected         │  │  ○ Scan QR           │                 │    │
│  │  │  +62 812-3456-789    │  │                      │                 │    │
│  │  │                      │  │  ┌────────────────┐  │                 │    │
│  │  │  Messages: 1,234     │  │  │   QR CODE      │  │                 │    │
│  │  │  Last: 2 min ago     │  │  │   [IMAGE]      │  │                 │    │
│  │  │                      │  │  │                │  │                 │    │
│  │  │  [Stop] [Delete]     │  │  └────────────────┘  │                 │    │
│  │  └──────────────────────┘  └──────────────────────┘                 │    │
│  │                                                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Webhooks                                         [+ Add Webhook]    │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │                                                                      │    │
│  │  URL                              Events              Status         │    │
│  │  ─────────────────────────────────────────────────────────────────  │    │
│  │  https://api.example.com/hook     message.received    ● Active      │    │
│  │  https://n8n.local/webhook        session.*           ○ Inactive    │    │
│  │                                                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Tech Stack (Dashboard)

- **Framework:** React 18 with TypeScript
- **Styling:** Tailwind CSS
- **Build:** Vite
- **State:** Zustand or React Query
- **WebSocket:** socket.io-client
- **Icons:** Lucide React

---

## 10. Implementation Phases

### Phase 1: Core Foundation (MVP)

**Goal:** Basic multi-session support with REST API

- [ ] Project setup (TypeScript, ESLint, Prettier)
- [ ] Configuration management
- [ ] Logger setup (Pino)
- [ ] Fastify server with basic routes
- [ ] SessionManager implementation
  - [ ] Create/delete session
  - [ ] Start/stop session
  - [ ] QR code generation
  - [ ] Connection state management
- [ ] WhatsAppClient wrapper
  - [ ] Event handling
  - [ ] Message sending (text only)
- [ ] File-based storage for sessions
- [ ] API endpoints
  - [ ] Sessions CRUD
  - [ ] Send text message
  - [ ] Get QR code
  - [ ] Health check
- [ ] Basic authentication (API key)
- [ ] Unit tests

**Deliverables:**
- Working REST API
- Can create multiple sessions
- Can scan QR and connect
- Can send text messages

### Phase 2: Webhooks & Events

**Goal:** Event system for external integrations

- [ ] WebhookDispatcher implementation
  - [ ] Queue system
  - [ ] Retry logic with exponential backoff
  - [ ] Delivery logging
- [ ] Webhook API endpoints
  - [ ] CRUD webhooks
  - [ ] Test webhook
- [ ] All webhook events
  - [ ] message.received
  - [ ] message.sent
  - [ ] message.ack
  - [ ] session.* events
- [ ] Webhook signature verification
- [ ] Integration tests

**Deliverables:**
- Webhook system working
- External services can receive events

### Phase 3: WebSocket & Realtime

**Goal:** Real-time updates for dashboard

- [ ] Socket.io integration
- [ ] Authentication for WebSocket
- [ ] Real-time events
  - [ ] QR code updates
  - [ ] Session status
  - [ ] Messages
- [ ] Client subscription system
- [ ] Connection management

**Deliverables:**
- Real-time QR display
- Live session status updates

### Phase 4: Dashboard

**Goal:** Web UI for management

- [ ] React project setup with Vite
- [ ] Tailwind CSS configuration
- [ ] Components
  - [ ] SessionList
  - [ ] SessionCard
  - [ ] QRCodeView
  - [ ] CreateSessionModal
  - [ ] WebhookList
  - [ ] WebhookForm
- [ ] WebSocket integration
- [ ] API integration
- [ ] Build & embed in server

**Deliverables:**
- Functional web dashboard
- Session management UI
- Webhook management UI

### Phase 5: Advanced Features

**Goal:** Production-ready features

- [ ] Media messages
  - [ ] Send image
  - [ ] Send document
  - [ ] Send audio
  - [ ] Media download endpoint
- [ ] Group features
  - [ ] Group messages
  - [ ] Group info
- [ ] SQLite storage option
- [ ] Rate limiting
- [ ] Metrics & monitoring
- [ ] Docker support
- [ ] Documentation

**Deliverables:**
- Full feature set
- Docker image
- Complete documentation

---

## 11. Docker

### Dockerfile

```dockerfile
FROM node:20-slim

# Install dependencies for Puppeteer (minimal, no chromium)
RUN apt-get update && apt-get install -y \
    ca-certificates \
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
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source
COPY dist ./dist
COPY dashboard/dist ./dashboard/dist

# Create data directory
RUN mkdir -p /app/data/sessions

# Environment
ENV NODE_ENV=production
ENV PORT=3000
ENV STORAGE_PATH=/app/data

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Run
CMD ["node", "dist/index.js"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  wasimple:
    build: .
    container_name: wasimple
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - API_KEY=${API_KEY:-changeme}
      - DASHBOARD_ENABLED=true
      - DASHBOARD_USERNAME=${DASHBOARD_USERNAME:-admin}
      - DASHBOARD_PASSWORD=${DASHBOARD_PASSWORD:-admin123}
      - LOG_LEVEL=info
    volumes:
      - wasimple_data:/app/data
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  wasimple_data:
```

---

## 12. Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "SESSION_NOT_FOUND",
    "message": "Session 'xyz' not found",
    "details": {}
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Invalid or missing API key |
| `FORBIDDEN` | 403 | Access denied |
| `SESSION_NOT_FOUND` | 404 | Session does not exist |
| `SESSION_NOT_READY` | 400 | Session not in ready state |
| `SESSION_ALREADY_EXISTS` | 409 | Session ID already taken |
| `INVALID_PHONE` | 400 | Invalid phone number format |
| `MESSAGE_FAILED` | 500 | Failed to send message |
| `WEBHOOK_NOT_FOUND` | 404 | Webhook does not exist |
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `INTERNAL_ERROR` | 500 | Internal server error |

---

## 13. Security Considerations

### API Key Security

- API keys should be long, random strings (32+ characters)
- Store hashed API keys (bcrypt/argon2) if using database
- Support multiple API keys for key rotation
- Log API key usage (without exposing the key)

### Webhook Security

- Sign webhook payloads with HMAC-SHA256
- Include timestamp to prevent replay attacks
- Verify SSL certificates for HTTPS webhooks
- Timeout webhooks after 30 seconds

### Rate Limiting

- Limit API requests per key (e.g., 100/minute)
- Limit message sending (e.g., 30/minute per session)
- Limit failed auth attempts

### Data Protection

- Don't log message contents in production
- Encrypt session auth data at rest (optional)
- Secure WebSocket connections

---

## 14. Testing

### Unit Tests

```bash
npm run test:unit
```

Test files:
- `SessionManager.test.ts`
- `WhatsAppClient.test.ts`
- `WebhookDispatcher.test.ts`
- `QRCodeManager.test.ts`

### Integration Tests

```bash
npm run test:integration
```

Test files:
- `api/sessions.test.ts`
- `api/messages.test.ts`
- `api/webhooks.test.ts`
- `websocket.test.ts`

### E2E Tests

```bash
npm run test:e2e
```

Requires actual WhatsApp connection (use test number).

---

## 15. Deployment Checklist

- [ ] Set strong API_KEY
- [ ] Set DASHBOARD_PASSWORD
- [ ] Configure webhook URLs
- [ ] Set up reverse proxy (nginx/caddy)
- [ ] Enable HTTPS
- [ ] Configure log rotation
- [ ] Set up monitoring (health checks)
- [ ] Configure backup for `/data` directory
- [ ] Test webhook delivery
- [ ] Test session reconnection

---

## 16. Future Enhancements

- [ ] Multi-device support (when whatsapp-web.js supports)
- [ ] Message templates
- [ ] Scheduled messages
- [ ] Contact management
- [ ] Broadcast lists
- [ ] Analytics dashboard
- [ ] Prometheus metrics
- [ ] Kubernetes helm chart
- [ ] Message queuing (Redis/RabbitMQ)
- [ ] Horizontal scaling

---

## Appendix A: Phone Number Formatting

```typescript
// Input formats accepted:
// 08123456789      → 628123456789@c.us
// 628123456789     → 628123456789@c.us
// +628123456789    → 628123456789@c.us
// 62 812-345-6789  → 628123456789@c.us

function formatPhone(phone: string): string {
  // Remove non-digits
  let cleaned = phone.replace(/\D/g, '');

  // Handle Indonesian numbers
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  }

  return cleaned + '@c.us';
}
```

---

## Appendix B: Message Types

| Type | Description | Fields |
|------|-------------|--------|
| `chat` | Text message | `body` |
| `image` | Image with optional caption | `media`, `caption` |
| `video` | Video with optional caption | `media`, `caption` |
| `audio` | Audio message | `media` |
| `ptt` | Voice note | `media` |
| `document` | Document/file | `media`, `filename` |
| `sticker` | Sticker | `media` |
| `location` | Location | `latitude`, `longitude` |
| `vcard` | Contact card | `vcard` |
| `buttons` | Button message | `buttons`, `body` |
| `list` | List message | `sections`, `body` |

---

*Document End*
