# WASimple

WhatsApp Multi-Session Service - Simple, self-hosted WhatsApp API with multi-number support.

## Features

- **Multi-Session:** Handle multiple WhatsApp numbers simultaneously
- **REST API:** Full-featured API for session & message management
- **WebSocket:** Real-time events for QR codes and messages
- **Webhooks:** Event-driven integration with external services
- **Dashboard:** Simple web UI for management
- **No External Dependencies:** Self-contained, no cloud services required

## Quick Start

```bash
# Clone repository
git clone https://github.com/your-org/wasimple.git
cd wasimple

# Install dependencies
npm install

# Configure
cp .env.example .env
# Edit .env with your settings

# Run development
npm run dev

# Open dashboard
open http://localhost:3000
```

## Docker

```bash
docker-compose up -d
```

## Documentation

See [DESIGN_PLAN.md](./DESIGN_PLAN.md) for complete technical documentation including:

- Architecture overview
- API specification
- Webhook events
- WebSocket events
- Configuration options
- Implementation phases

## Tech Stack

- **Runtime:** Node.js 20+
- **Language:** TypeScript
- **HTTP Server:** Fastify
- **WebSocket:** Socket.io
- **WhatsApp:** whatsapp-web.js
- **Dashboard:** React + Tailwind CSS

## API Overview

```bash
# Create session
curl -X POST http://localhost:3000/api/sessions \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"id": "my-session", "name": "Main WhatsApp"}'

# Start session (get QR)
curl -X POST http://localhost:3000/api/sessions/my-session/start \
  -H "X-API-Key: your-api-key"

# Get QR code
curl http://localhost:3000/api/sessions/my-session/qr \
  -H "X-API-Key: your-api-key" \
  -o qr.png

# Send message
curl -X POST http://localhost:3000/api/sessions/my-session/messages/send \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"to": "628123456789", "text": "Hello from WASimple!"}'
```

## License

MIT
