# Wahuy Dashboard

React + Vite dashboard for managing Wahuy sessions, realtime pairing, messages, provider settings, and outbound webhooks.

## What it does

- Login with the Wahuy API key.
- Create, start, stop, logout, and delete Internal Baileys sessions.
- Show QR pairing state in realtime from Socket.IO events.
- Open/update the QR modal without manual refresh when QR rotates.
- Close stale QR modal/state when a session becomes `ready`, `disconnected`, `stopped`, or `failed`.
- Send messages from ready sessions.
- View recent messages, including resolved `contacts.*.number` when Baileys provides LID→PN mapping.
- Manage provider mode and outbound webhooks.

## Realtime behavior

The dashboard connects to the Wahuy Socket.IO server at the same origin:

```ts
io(window.location.origin, {
  auth: { apiKey },
  path: '/socket.io',
});
```

On connect it subscribes to all sessions:

```ts
socket.emit('subscribe', { sessions: ['*'] });
socket.emit('getSessions');
```

Important events:

| Event | Dashboard behavior |
|-------|--------------------|
| `sessions` | Replace local session list. |
| `session:qr` | Cache QR, mark session as `scan_qr`, update open QR modal. |
| `session:status` | Update session status, clear QR/modal on non-QR terminal states. |
| `message:received` | Prepend live message to message viewer. |

`GET /api/sessions/:id/qr` is still used as a fallback if the session is already `scan_qr` but the WebSocket QR payload has not arrived.

## Message display

Incoming messages can use Baileys v7 LID identifiers (`12345@lid`). The dashboard displays `message.contacts.sender.number` only when Baileys explicitly provides a trusted phone mapping. It does not derive phone numbers from identifiers. If no mapping is available yet, it falls back to showing the opaque identifier.

## Development

```bash
cd dashboard
npm install
npm run dev
npm run build
```

From the repository root:

```bash
npm run dashboard:dev
npm run dashboard:build
```

## Key files

| File | Purpose |
|------|---------|
| `src/App.tsx` | Top-level state, session actions, QR modal, realtime handlers. |
| `src/hooks/useWebSocket.ts` | Socket.IO connection and event subscription. |
| `src/components/SessionCard.tsx` | Session status, QR CTA, session actions. |
| `src/components/MessageViewer.tsx` | Recent message list and contact/phone display. |
| `src/components/SendMessageModal.tsx` | Send text/media/location messages. |
| `src/components/WebhookList.tsx` | Outbound webhook management. |
| `src/components/ProviderSetup.tsx` | Provider mode/config UI. |
| `src/lib/api.ts` | Dashboard HTTP API client. |
| `src/types/index.ts` | Dashboard TypeScript API/message/session types. |
