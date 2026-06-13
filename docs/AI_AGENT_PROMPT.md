# Wahuy — AI Agent Guide

Wahuy is a self-hosted WhatsApp API gateway. It wraps either **Internal mode** (Baileys — WebSocket-based, QR login, multi-session, no browser needed) or **Official mode** (Meta WhatsApp Cloud API/WABA) behind a simple HTTP API with webhooks, WebSocket events, dashboard UI, and persistent message history.

Use this guide when an AI agent needs to install Wahuy, understand its API surface, or build an integration on top of it.

**Docker image:** ~350MB (no Chromium/Puppeteer).

---

## 0. Raw Context Files (fetch these first)

Before you start, fetch the raw source of truth files directly from the repository to build full context:

```text
https://raw.githubusercontent.com/utsmannn/wahuy/main/README.md
https://raw.githubusercontent.com/utsmannn/wahuy/main/docs/AI_AGENT_PROMPT.md
https://raw.githubusercontent.com/utsmannn/wahuy/main/.env.example
https://raw.githubusercontent.com/utsmannn/wahuy/main/package.json
https://raw.githubusercontent.com/utsmannn/wahuy/main/src/config.ts
https://raw.githubusercontent.com/utsmannn/wahuy/main/src/api/index.ts
https://raw.githubusercontent.com/utsmannn/wahuy/main/src/api/middleware/auth.ts
https://raw.githubusercontent.com/utsmannn/wahuy/main/src/api/routes/health.ts
https://raw.githubusercontent.com/utsmannn/wahuy/main/src/api/routes/provider.ts
https://raw.githubusercontent.com/utsmannn/wahuy/main/src/api/routes/sessions.ts
https://raw.githubusercontent.com/utsmannn/wahuy/main/src/api/routes/messages.ts
https://raw.githubusercontent.com/utsmannn/wahuy/main/src/api/routes/webhooks.ts
https://raw.githubusercontent.com/utsmannn/wahuy/main/src/api/routes/whatsapp-official/index.ts
https://raw.githubusercontent.com/utsmannn/wahuy/main/src/api/routes/whatsapp-official/messages.ts
https://raw.githubusercontent.com/utsmannn/wahuy/main/src/api/routes/whatsapp-official/media.ts
https://raw.githubusercontent.com/utsmannn/wahuy/main/src/api/routes/whatsapp-official/groups.ts
https://raw.githubusercontent.com/utsmannn/wahuy/main/src/api/routes/whatsapp-official/webhooks.ts
https://raw.githubusercontent.com/utsmannn/wahuy/main/src/providers/types.ts
https://raw.githubusercontent.com/utsmannn/wahuy/main/docker-compose.yml
https://raw.githubusercontent.com/utsmannn/wahuy/main/docker/Dockerfile
```

Repo: `https://github.com/utsmannn/wahuy`

---

## 1. Installation

### Option A: Docker (recommended, ~350MB image)

Wahuy needs a persistent `data/` volume because WhatsApp sessions and message history are stored there.

```bash
docker run -d \
  --name wahuy \
  -p 7834:7834 \
  -e NODE_ENV=production \
  -e PORT=7834 \
  -e API_KEY=your-secure-api-key-change-me \
  -e DASHBOARD_ENABLED=true \
  -v wahuy_data:/app/data \
  ghcr.io/utsmannn/wahuy:latest

curl http://localhost:7834/api/health
```

If using the repository's compose file:

```bash
API_KEY=your-secure-api-key-change-me docker compose up -d
curl http://localhost:7835/api/health
```

The included `docker-compose.yml` maps host `7835` to container `7834`.

### Option B: Local development (no Chromium needed)

```bash
git clone https://github.com/utsmannn/wahuy.git
cd wahuy
npm install
cp .env.example .env
npm run build
npm start

# hot reload
npm run dev
```

Dashboard: `http://localhost:7834` when `PORT=7834` and `DASHBOARD_ENABLED=true`.

---

## 2. Configuration

### Required common variables

| Variable | Purpose |
|----------|---------|
| `API_KEY` | Primary key for `X-API-Key` auth. Change in production. |
| `PORT` | HTTP port. Use `7834` for default deployment examples. |
| `STORAGE_PATH` | Directory for sessions, SQLite DBs, and runtime data. |
| `PROVIDER` | `internal` or `official`. Defaults to `internal`. |

### Internal mode variables

| Variable | Purpose |
|----------|---------|
| `SESSION_RESTART_ON_AUTH_FAIL` | Restart sessions on auth failure. |
| `SESSION_RECONNECT_INTERVAL` | Reconnect interval in milliseconds. |
| `SESSION_MAX_RECONNECT_ATTEMPTS` | Max reconnect attempts. |

### Official mode variables

Set `PROVIDER=official`, then provide:

| Variable | Purpose |
|----------|---------|
| `OFFICIAL_ACCESS_TOKEN` | Meta Graph API access token. |
| `OFFICIAL_APP_SECRET` | Meta app secret for webhook signature verification. |
| `OFFICIAL_PHONE_NUMBER_ID` | WhatsApp phone number ID. |
| `OFFICIAL_WEBHOOK_VERIFY_TOKEN` | Token used by Meta webhook verification challenge. |
| `OFFICIAL_BASE_URL` | Graph API base URL, default `https://graph.facebook.com/v20.0`. |
| `OFFICIAL_BUSINESS_ACCOUNT_ID` | Optional WABA business account ID. |
| `OFFICIAL_QUEUE_PROVIDER` | `memory` or `redis`. |
| `REDIS_URL` | Redis URL when using Redis queue. |

See `.env.example` and `src/config.ts` for the full list and defaults.

---

## 3. Auth Rules

All application endpoints use:

```http
X-API-Key: <API_KEY>
```

`API_KEYS` can contain additional comma-separated valid keys.

Exception: `/webhooks/whatsapp` is not protected by `X-API-Key` because Meta calls it directly. It uses:

- `hub.verify_token` for GET verification challenge
- `X-Hub-Signature-256` HMAC validation for POST webhook payloads

---

## 4. API Quick Reference

### Base URLs

```text
Internal API: http://<host>:7834/api
Official API: http://<host>:7834/v1
Meta webhook: http://<host>:7834/webhooks/whatsapp
```

### Key endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/health` | Health check; no auth required. |
| `GET` | `/api/provider` | Current provider info. |
| `POST` | `/api/provider/switch` | Switch provider mode at runtime. |
| `POST` | `/api/provider/test` | Test Official credentials without switching. |
| `GET` | `/api/sessions` | List Internal sessions. |
| `POST` | `/api/sessions` | Create Internal session. |
| `POST` | `/api/sessions/{id}/start` | Start session and generate QR. |
| `GET` | `/api/sessions/{id}/qr` | Get QR as JSON base64 or PNG via `Accept: image/png`. |
| `GET` | `/api/sessions/{id}/status` | Session status, last error, reconnect state. |
| `GET` | `/api/sessions/{id}/chats` | List all chats. Requires ready session. |
| `GET` | `/api/sessions/{id}/groups` | List groups only. Requires ready session. |
| `POST` | `/api/sessions/{id}/messages/send` | Send Internal text message. |
| `POST` | `/api/sessions/{id}/messages/send-image` | Send base64 image. |
| `POST` | `/api/sessions/{id}/messages/send-document` | Send base64 document. |
| `POST` | `/api/sessions/{id}/messages/reply` | Reply to a message. |
| `POST` | `/api/sessions/{id}/typing` | Send typing indicator. |
| `POST` | `/api/sessions/{id}/read` | Mark chat/message read. |
| `GET` | `/api/sessions/messages/history` | Query persisted message history. |
| `GET` | `/api/sessions/{id}/conversations/{phone}` | Get stored conversation with a phone. |
| `GET/POST` | `/api/webhooks` | List/create outbound webhooks. **Creating requires `sessions`**. |
| `GET/PUT/DELETE` | `/api/webhooks/{id}` | Manage outbound webhook. |
| `POST` | `/api/webhooks/{id}/test` | Send test payload to webhook. |
| `GET` | `/api/webhooks/logs` | Query webhook delivery logs. |
| `POST` | `/v1/messages` | Official Cloud API-compatible send message. |
| `GET/POST` | `/v1/media` | Official media download/upload. |
| `GET/POST/PATCH/DELETE` | `/v1/groups` | Official group management. |
| `GET/POST` | `/webhooks/whatsapp` | Meta webhook verification and event receiver. |

---

## 5. Three Event Channels — You Don't Need Webhooks

Wahuy provides three independent ways to receive events. **You do NOT need outbound webhooks to get events.** Choose what fits your architecture:

| Channel | Protocol | Best for | Requires |
|---------|----------|----------|----------|
| **WebSocket** | Socket.IO persistent | Bots, dashboards, realtime apps | API key + WS client |
| **REST History** | HTTP GET polling | Cron jobs, reports, backups | API key |
| **Outbound Webhooks** | HTTP POST to your URL | Serverless functions, Zapier, external monitoring | API key (to register) |

For 90% of use cases, WebSocket + REST is sufficient. Webhooks are only needed when your receiver cannot maintain a persistent connection.

---

## 6. Internal Mode Canonical Flow

Use this when the user wants WhatsApp WebSocket QR login, multi-session automation, or group access not available through WABA.

### Step 1: Create a session

```bash
curl -X POST http://localhost:7834/api/sessions \
  -H "X-API-Key: <key>" \
  -H "Content-Type: application/json" \
  -d '{"id":"main","name":"Main WhatsApp"}'
```

### Step 2: Start the session

```bash
curl -X POST http://localhost:7834/api/sessions/main/start \
  -H "X-API-Key: <key>"
```

### Step 3: Get QR code

```bash
# JSON data URL (base64 PNG)
curl http://localhost:7834/api/sessions/main/qr \
  -H "X-API-Key: <key>"

# Or watch it via WebSocket in realtime
```

When a QR is generated, realtime clients receive both:

- `session:status` with `status: "scan_qr"`
- `session:qr` with the QR data URL

The built-in dashboard uses these events to show the QR CTA, update an open QR modal when QR rotates, and close the modal when pairing reaches `ready` or another non-QR state. REST QR polling remains a fallback.

### Step 4: Poll until ready

```bash
curl http://localhost:7834/api/sessions/main/status \
  -H "X-API-Key: <key>"
```

Ready status:

```json
{
  "success": true,
  "data": {
    "id": "main",
    "status": "ready",
    "isConnected": true
  }
}
```

### Step 5: Send a text message

```bash
curl -X POST http://localhost:7834/api/sessions/main/messages/send \
  -H "X-API-Key: <key>" \
  -H "Content-Type: application/json" \
  -d '{"to":"6281234567890","text":"Hello from Wahuy"}'
```

Recipient formats for sending:

| Format | Example | Meaning |
|--------|---------|---------|
| Phone number | `6281234567890` | Recommended for 1:1 outbound sends. Pass the human phone number; Wahuy/Baileys handles the internal addressing. |
| WhatsApp identifier | `12345@lid` | Accepted only when the caller already has an identifier from a previous Wahuy/Baileys event. Treat it as an opaque ID. |
| Group identifier | `123456789@g.us` | Group chat target. |

Do not infer phone numbers from inbound identifiers. Incoming IDs such as `@lid` are opaque WhatsApp identities, not phone-number strings.

---

## 7. Official Mode Canonical Flow

Use this when the user has Meta WhatsApp Business credentials and wants production-grade Cloud API behavior.

### Option A: Configure through env

```env
PROVIDER=official
OFFICIAL_ACCESS_TOKEN=...
OFFICIAL_APP_SECRET=...
OFFICIAL_PHONE_NUMBER_ID=...
OFFICIAL_WEBHOOK_VERIFY_TOKEN=...
```

Restart Wahuy and verify:

```bash
curl http://localhost:7834/api/provider -H "X-API-Key: <key>"
```

### Option B: Switch at runtime

```bash
curl -X POST http://localhost:7834/api/provider/switch \
  -H "X-API-Key: <key>" \
  -H "Content-Type: application/json" \
  -d '{
    "mode":"official",
    "official":{
      "accessToken":"<meta-token>",
      "appSecret":"<app-secret>",
      "phoneNumberId":"<phone-number-id>",
      "webhookVerifyToken":"<verify-token>",
      "baseUrl":"https://graph.facebook.com/v20.0"
    }
  }'
```

### Send a Cloud API-compatible text message

```bash
curl -X POST http://localhost:7834/v1/messages \
  -H "X-API-Key: <key>" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product":"whatsapp",
    "to":"6281234567890",
    "type":"text",
    "text":{"body":"Hello from Wahuy Official mode"}
  }'
```

### Send a template message

```bash
curl -X POST http://localhost:7834/v1/messages \
  -H "X-API-Key: <key>" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product":"whatsapp",
    "to":"6281234567890",
    "type":"template",
    "template":{"name":"hello_world","language":{"code":"en_US"}}
  }'
```

---

## 8. Webhooks

There are two webhook concepts:

1. **Meta webhook receiver** — `/webhooks/whatsapp`, used only in Official mode.
2. **Outbound webhooks** — configured through `/api/webhooks`, used to forward Wahuy events to your app.

### Outbound webhook security model

⛔ **`sessions` is mandatory.** The API rejects webhook creation without it.

| `sessions` value | Behavior |
|-----------------|----------|
| `["*"]` | Receive events from **all** sessions. |
| `["main"]` | Only receive events from session `main`. |
| `["main", "sec"]` | Only receive events from those two sessions. |
| `[]` or missing | **Rejected (400)** — must be explicit. |

### Register outbound webhook (all sessions)

```bash
curl -X POST http://localhost:7834/api/webhooks \
  -H "X-API-Key: <key>" \
  -H "Content-Type: application/json" \
  -d '{
    "url":"https://your-app.example.com/whatsapp/events",
    "events":["message.received","message.sent","message.ack","session.ready","session.disconnected"],
    "sessions":["*"],
    "secret":"optional-hmac-secret"
  }'
```

### Register for specific sessions only

```bash
curl -X POST http://localhost:7834/api/webhooks \
  -H "X-API-Key: <key>" \
  -H "Content-Type: application/json" \
  -d '{
    "url":"https://your-app.example.com/whatsapp/events",
    "events":["message.received","message.sent"],
    "sessions":["support","sales"],
    "secret":"optional-hmac-secret"
  }'
```

### Webhook payload format

```json
{
  "event": "message.received",
  "timestamp": "2026-01-15T10:30:00.000Z",
  "session": { "id": "main", "phone": null },
  "payload": {
    "id": "BAE5...",
    "from": "12345@lid",
    "body": "Hello!",
    "type": "chat",
    "fromMe": false,
    "hasMedia": false,
    "contacts": {
      "sender": {
        "id": "12345@lid",
        "number": "6281234567890",
        "pushname": "Jane"
      },
      "receiver": {
        "id": "98765@lid",
        "number": "6289876543210"
      }
    }
  }
}
```

Internal mode preserves Baileys identifiers in `from`, `to`, and `contacts.*.id`. Treat those fields as opaque WhatsApp identifiers, not phone-number strings. Use `contacts.*.number` only when you specifically need the phone number; it is populated only when Baileys explicitly provides a trusted mapping. If no mapping exists yet, the number is `null`.

### Verify webhook signatures

If `secret` is set on the webhook, verify `X-Webhook-Signature` in your receiver:

```js
const crypto = require('crypto');
function verify(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
  return 'sha256=' + hmac === signature;
}
```

### Common event names

| Event | Meaning |
|-------|---------|
| `message.received` | Incoming message. |
| `message.sent` | Outgoing message. |
| `message.ack` | Delivery/read acknowledgement. |
| `session.qr_updated` | New QR generated. |
| `session.authenticated` | WhatsApp auth completed. |
| `session.ready` | Session can send/receive. |
| `session.disconnected` | Session disconnected. |
| `session.reconnecting` | Reconnect in progress. |
| `session.failed` | Session failed permanently. |

---

## 9. WebSocket Realtime Flow

Use Socket.IO for QR/status/message updates. **This is the recommended way to receive events for most apps** — no webhook needed.

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:7834', {
  auth: { apiKey: '<key>' }
});

socket.emit('subscribe', { sessions: ['*'] });

socket.on('session:qr', (event) => console.log('QR ready', event.sessionId));
socket.on('session:status', (event) => console.log('Status', event));
socket.on('message:received', (event) => console.log('Incoming', event.message));
socket.on('message:sent', (event) => console.log('Sent', event.message));
```

The QR is also available via REST fallback (`GET /api/sessions/:id/qr`) — the dashboard polls this automatically if WebSocket hasn't delivered it yet.

### Message identity and contact numbers

Baileys v7 may identify users with LID identifiers like `12345@lid`. Treat these as opaque WhatsApp identities. They are not phone numbers, and their user part must not be parsed as one.

Wahuy's Internal provider follows this rule:

| Field | Meaning |
|-------|---------|
| `from` / `to` | Baileys message identity. Usually an opaque WhatsApp ID such as `@lid`. |
| `contacts.sender.id` / `contacts.receiver.id` | Contact identity matching the message identity. Usually `@lid`. |
| `contacts.sender.number` / `contacts.receiver.number` | Phone number only when Baileys explicitly provides one; otherwise `null`. |

The phone number may come from Baileys metadata such as `remoteJidAlt`, `participantAlt`, `senderPn`, contact sync, history sync, `lid-mapping.update`, or the Baileys LID mapping store. These are trusted metadata sources from Baileys; they are not derived from the visible `@lid` value.

Never derive a phone number from a WhatsApp identifier.

---

## 10. Message History

Wahuy stores message history in SQLite under `STORAGE_PATH`.

### Query global history

```bash
curl "http://localhost:7834/api/sessions/messages/history?sessionId=main&limit=50" \
  -H "X-API-Key: <key>"
```

Supported filters:

| Query | Meaning |
|-------|---------|
| `sessionId` | Filter by session. |
| `from` | Sender partial match. |
| `to` | Recipient partial match. |
| `type` | Message type. |
| `fromMe` | `true` or `false`. |
| `hasMedia` | `true` or `false`. |
| `startDate` / `endDate` | ISO date range. |
| `search` | Search in message body. |
| `limit` / `offset` | Pagination. |

### Query a conversation

```bash
curl "http://localhost:7834/api/sessions/main/conversations/6281234567890?limit=100&offset=0" \
  -H "X-API-Key: <key>"
```

---

## 11. Error Handling Rules

Wahuy returns either:

### Internal API error shape

```json
{
  "success": false,
  "error": {
    "code": "SESSION_NOT_READY",
    "message": "Session is not ready to send messages"
  }
}
```

### Official API error shape

Official `/v1/*` routes mirror Meta-style errors:

```json
{
  "error": {
    "message": "Missing required parameter: to",
    "type": "InvalidParameterException",
    "code": 100
  }
}
```

### Agent behavioral rules

- Do not send messages until Internal session status is `ready`.
- Treat `SESSION_NOT_FOUND` as setup missing; create/start session first.
- Treat `SESSION_NOT_READY` as QR/auth/connectivity not complete; poll status.
- Treat Official `APIException`/Meta errors as upstream provider issues; check Meta token, phone number ID, template approval, and recipient validity.
- Never silently retry message sends without idempotency considerations; WhatsApp sends may be duplicated.
- **Webhook creation without `sessions` is rejected (400)** — always include `["*"]` or specific session IDs.

---

## 12. Canonical Integration Recipes

### Build a simple notification sender using Internal mode

```text
1. Ensure Wahuy is running with PROVIDER=internal.
2. Create session `main`.
3. Start session, get QR, scan with WhatsApp.
4. Poll `/api/sessions/main/status` until `ready`.
5. Send notifications via `POST /api/sessions/main/messages/send`.
6. Optionally: connect WebSocket for realtime delivery status.
```

### Build a production WABA sender using Official mode

```text
1. Ensure Meta app, WABA, phone number ID, token, and app secret are available.
2. Run Wahuy with PROVIDER=official and official env vars.
3. Configure Meta webhook URL to `https://your-domain.com/webhooks/whatsapp`.
4. Send messages via `/v1/messages` using Meta-compatible payloads.
5. Receive inbound messages/statuses through outbound webhooks or WebSocket.
```

### Build an inbound automation bot (WebSocket approach)

```text
1. Connect WebSocket with API key.
2. Subscribe to `message.received`.
3. Parse sender, body, sessionId.
4. Generate response in your app.
5. Send reply via Internal `/api/sessions/{id}/messages/reply` or Official `/v1/messages`.
6. Store message IDs to avoid duplicate processing.
```

### Add external logging/monitoring (Webhook approach)

```text
1. POST /api/webhooks with sessions: ["*"], events: ["message.received", "message.sent"].
2. Your logging service receives HTTP POST with payload.
3. Optionally verify X-Webhook-Signature with shared secret.
4. No API key exposure — your logging service never sees Wahuy's credentials.
```

---

## 13. Repository Files (for code-level understanding)

All files are under `https://github.com/utsmannn/wahuy`. Fetch them raw via `https://raw.githubusercontent.com/utsmannn/wahuy/main/<path>`.

| # | File | Purpose |
|---|------|---------|
| 1 | `README.md` | Project overview, quick start, endpoints, operations. |
| 2 | `docs/AI_AGENT_PROMPT.md` | This file — AI agent setup and integration guide. |
| 3 | `.env.example` | Starter environment variables. |
| 4 | `package.json` | Scripts, dependencies, Node version. |
| 5 | `src/config.ts` | Canonical config defaults and env parsing. |
| 6 | `src/api/index.ts` | API route prefixes and auth boundaries. |
| 7 | `src/api/middleware/auth.ts` | `X-API-Key` authentication. |
| 8 | `src/api/routes/sessions.ts` | Internal session lifecycle, QR, chats, groups. |
| 9 | `src/api/routes/messages.ts` | Internal message send/history endpoints. |
| 10 | `src/api/routes/provider.ts` | Runtime provider switch/test and Official templates. |
| 11 | `src/api/routes/webhooks.ts` | Outbound webhook CRUD + session validation. |
| 12 | `src/api/routes/whatsapp-official/*` | Official Cloud API-compatible routes. |
| 13 | `src/providers/types.ts` | Shared provider interfaces and message types. |
| 14 | `src/core/SessionManager.ts` | Internal session orchestration (Baileys-based). |
| 15 | `src/core/WhatsAppClient.ts` | Baileys client wrapper — WebSocket connection, QR, messaging. |
| 16 | `src/core/WebhookDispatcher.ts` | Outbound webhook dispatch, retry, HMAC, session filtering. |
| 17 | `src/storage/MessageStorage.ts` | SQLite message persistence. |
| 18 | `docker-compose.yml` | Local/container deployment composition. |
| 19 | `docker/Dockerfile` | Production image build (~350MB, no Chromium). |

---

## 14. Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 20+ |
| Language | TypeScript ESM |
| HTTP Server | Fastify |
| Realtime | Socket.IO |
| Internal Provider | `@whiskeysockets/baileys` (WebSocket, no browser) |
| Official Provider | Meta Graph API / WhatsApp Cloud API |
| Storage | File storage + SQLite (`better-sqlite3`) |
| Dashboard | React + Vite |
| Container | Docker (~350MB) |

---

## 15. Safety and Product Constraints

- Internal mode is unofficial WhatsApp WebSocket automation via Baileys. Warn users about disconnect and ban risk.
- Official mode is preferred for production messaging if WABA is available.
- **Outbound webhook `sessions` is mandatory** — never create a webhook without explicit `["*"]` or session IDs. Empty sessions cause the API to reject the request. This prevents accidental cross-session data leaks.
- Do not expose Wahuy publicly without HTTPS and a strong API key.
- Do not log or reveal Meta tokens, app secrets, API keys, QR strings, or session auth files.
- Do not delete `data/` unless the user explicitly wants to reset sessions/history.
- Message sends can be duplicated on retries; build idempotency in the caller when reliability matters.
- Legacy webhooks with empty sessions are auto-migrated to `["*"]` on startup for backward compatibility.
