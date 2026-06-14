/**
 * WebSocket server setup with Socket.io
 */

import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import QRCode from 'qrcode';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { sessionManager } from '../core/SessionManager.js';
import { messageStorage, StoredMessage } from '../storage/MessageStorage.js';
import type { SubscribePayload, UnsubscribePayload } from './types.js';
import type { IWhatsAppProvider, WahuyMessage } from '../providers/types.js';

let io: Server | null = null;

/**
 * Convert QR string to data URL
 */
async function qrToDataURL(qr: string): Promise<string> {
  try {
    return await QRCode.toDataURL(qr, { width: 256, margin: 2 });
  } catch {
    return qr; // Return raw string if conversion fails
  }
}

/**
 * Initialize WebSocket server
 */
export function initWebSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      credentials: true
    },
    path: '/socket.io'
  });

  // Authentication middleware
  io.use((socket, next) => {
    const apiKey = socket.handshake.auth.apiKey as string;

    if (!apiKey) {
      return next(new Error('Missing API key'));
    }

    const validKeys = config.apiKeys.length > 0 ? config.apiKeys : [config.apiKey];

    if (!validKeys.includes(apiKey)) {
      return next(new Error('Invalid API key'));
    }

    next();
  });

  // Connection handler
  io.on('connection', (socket) => {
    logger.info({ socketId: socket.id }, 'Client connected');

    // Track subscribed sessions for this socket
    const subscribedSessions = new Set<string>();

    // Subscribe to session events
    socket.on('subscribe', (payload: SubscribePayload) => {
      const { sessions, events } = payload;

      for (const sessionId of sessions) {
        subscribedSessions.add(sessionId);
        socket.join(`session:${sessionId}`);
      }

      logger.debug({
        socketId: socket.id,
        sessions,
        events
      }, 'Client subscribed');

      socket.emit('subscribed', { sessions: Array.from(subscribedSessions) });
    });

    // Unsubscribe from session events
    socket.on('unsubscribe', (payload: UnsubscribePayload) => {
      const { sessions } = payload;

      for (const sessionId of sessions) {
        subscribedSessions.delete(sessionId);
        socket.leave(`session:${sessionId}`);
      }

      logger.debug({
        socketId: socket.id,
        sessions
      }, 'Client unsubscribed');
    });

    // Get current session list
    socket.on('getSessions', () => {
      const sessions = sessionManager.listSessions();
      socket.emit('sessions', sessions);
    });

    // Disconnect handler
    socket.on('disconnect', (reason) => {
      logger.info({ socketId: socket.id, reason }, 'Client disconnected');
    });
  });

  // Wire session manager events to socket
  wireSessionEvents();

  logger.info('WebSocket server initialized');
  return io;
}

/**
 * Wire SessionManager events to Socket.io
 */
function wireSessionEvents(): void {
  if (!io) return;

  sessionManager.on('session:qr', async (data) => {
    const qrDataURL = await qrToDataURL(data.qr);
    io?.to(`session:${data.sessionId}`).emit('session:qr', {
      sessionId: data.sessionId,
      qr: qrDataURL
    });
    // Also emit to wildcard subscribers
    io?.to('session:*').emit('session:qr', {
      sessionId: data.sessionId,
      qr: qrDataURL
    });
  });

  sessionManager.on('session:status', (data) => {
    const payload = {
      sessionId: data.sessionId,
      status: data.status,
      ...(data.lastError ? { lastError: data.lastError } : {}),
      ...(data.reconnect ? { reconnect: data.reconnect } : {})
    };

    io?.to(`session:${data.sessionId}`).emit('session:status', payload);
    io?.to('session:*').emit('session:status', payload);
  });

  sessionManager.on('session:authenticated', (data) => {
    io?.to(`session:${data.sessionId}`).emit('session:status', {
      sessionId: data.sessionId,
      status: 'connecting'
    });
    io?.to('session:*').emit('session:status', {
      sessionId: data.sessionId,
      status: 'connecting'
    });
  });

  sessionManager.on('session:auth_failure', (data) => {
    const payload = {
      sessionId: data.sessionId,
      status: 'failed',
      reason: data.reason
    };

    io?.to(`session:${data.sessionId}`).emit('session:status', payload);
    io?.to('session:*').emit('session:status', payload);
  });

  sessionManager.on('session:failed', (data) => {
    const payload = {
      sessionId: data.sessionId,
      status: 'failed',
      reason: data.reason,
      lastError: data.lastError
    };

    io?.to(`session:${data.sessionId}`).emit('session:status', payload);
    io?.to('session:*').emit('session:status', payload);
  });

  sessionManager.on('session:ready', (data) => {
    io?.to(`session:${data.sessionId}`).emit('session:status', {
      sessionId: data.sessionId,
      status: 'ready',
      phone: data.phone,
      pushName: data.pushName
    });
    io?.to('session:*').emit('session:status', {
      sessionId: data.sessionId,
      status: 'ready',
      phone: data.phone,
      pushName: data.pushName
    });
  });

  sessionManager.on('session:disconnected', (data) => {
    io?.to(`session:${data.sessionId}`).emit('session:status', {
      sessionId: data.sessionId,
      status: 'disconnected',
      reason: data.reason
    });
    io?.to('session:*').emit('session:status', {
      sessionId: data.sessionId,
      status: 'disconnected',
      reason: data.reason
    });
  });

  sessionManager.on('message:received', (data) => {
    // Save to persistent storage
    const storedMessage: StoredMessage = {
      id: data.message.id,
      sessionId: data.sessionId,
      from: data.message.from,
      to: data.message.to || '',
      body: data.message.body || '',
      type: data.message.type || 'chat',
      timestamp: data.message.timestamp,
      fromMe: data.message.fromMe || false,
      hasMedia: data.message.hasMedia || false,
      mediaType: data.message.media?.mimeType || data.message.media?.mimetype || data.message.mediaType,
      mediaPath: data.message.mediaPath,
      quotedMessageId: data.message.quotedMessage?.id,
      receivedAt: new Date().toISOString(),
      contacts: data.message.contacts,
      media: data.message.media,
    };
    messageStorage.saveMessage(storedMessage, data.message);

    io?.to(`session:${data.sessionId}`).emit('message:received', {
      sessionId: data.sessionId,
      message: data.message
    });
    io?.to('session:*').emit('message:received', {
      sessionId: data.sessionId,
      message: data.message
    });
  });

  sessionManager.on('message:sent', (data) => {
    // Save to persistent storage
    const storedMessage: StoredMessage = {
      id: data.message.id,
      sessionId: data.sessionId,
      from: data.message.from || '',
      to: data.message.to,
      body: data.message.body || '',
      type: data.message.type || 'chat',
      timestamp: data.message.timestamp,
      fromMe: true,
      hasMedia: data.message.hasMedia || false,
      mediaType: data.message.media?.mimeType || data.message.media?.mimetype || data.message.mediaType,
      mediaPath: data.message.mediaPath,
      quotedMessageId: data.message.quotedMessage?.id,
      receivedAt: new Date().toISOString(),
      contacts: data.message.contacts,
      media: data.message.media,
    };
    messageStorage.saveMessage(storedMessage, data.message);

    io?.to(`session:${data.sessionId}`).emit('message:sent', {
      sessionId: data.sessionId,
      message: data.message
    });
    io?.to('session:*').emit('message:sent', {
      sessionId: data.sessionId,
      message: data.message
    });
  });
}

/**
 * Get Socket.io server instance
 */
export function getIO(): Server | null {
  return io;
}

/**
 * Broadcast to all connected clients
 */
export function broadcast(event: string, data: unknown): void {
  io?.emit(event, data);
}

/**
 * Emit to specific session room
 */
export function emitToSession(sessionId: string, event: string, data: unknown): void {
  io?.to(`session:${sessionId}`).emit(event, data);
}

/**
 * Wire Official Provider events to Socket.io and MessageStorage
 */
export function wireProviderEvents(provider: IWhatsAppProvider): void {
  if (!io) {
    logger.warn('WebSocket not initialized, skipping provider event wiring');
    return;
  }

  const officialProvider = provider as import('../providers/official/OfficialProvider.js').OfficialProvider;

  // Handle incoming messages from Official Provider
  officialProvider.on('message:received', (data: { sessionId: string; message: WahuyMessage }) => {
    // Save to persistent storage
    const storedMessage: StoredMessage = {
      id: data.message.id,
      sessionId: data.sessionId,
      from: data.message.from,
      to: data.message.to || '',
      body: data.message.body || '',
      type: data.message.type || 'chat',
      timestamp: data.message.timestamp,
      fromMe: false,
      hasMedia: data.message.hasMedia || false,
      mediaType: data.message.media?.mimeType,
      quotedMessageId: data.message.quotedMessage?.id,
      receivedAt: new Date().toISOString(),
      contacts: data.message.contacts,
    };
    messageStorage.saveMessage(storedMessage, data.message);

    // Broadcast to WebSocket clients
    io?.to(`session:${data.sessionId}`).emit('message:received', {
      sessionId: data.sessionId,
      message: data.message
    });
    io?.to('session:*').emit('message:received', {
      sessionId: data.sessionId,
      message: data.message
    });
  });

  // Handle sent messages from Official Provider
  officialProvider.on('message:sent', (data: { sessionId: string; message: WahuyMessage }) => {
    // Save to persistent storage
    const storedMessage: StoredMessage = {
      id: data.message.id,
      sessionId: data.sessionId,
      from: data.message.from || '',
      to: data.message.to,
      body: data.message.body || '',
      type: data.message.type || 'chat',
      timestamp: data.message.timestamp,
      fromMe: true,
      hasMedia: data.message.hasMedia || false,
      mediaType: data.message.media?.mimeType,
      quotedMessageId: data.message.quotedMessage?.id,
      receivedAt: new Date().toISOString(),
      contacts: data.message.contacts,
    };
    messageStorage.saveMessage(storedMessage, data.message);

    // Broadcast to WebSocket clients
    io?.to(`session:${data.sessionId}`).emit('message:sent', {
      sessionId: data.sessionId,
      message: data.message
    });
    io?.to('session:*').emit('message:sent', {
      sessionId: data.sessionId,
      message: data.message
    });
  });

  // Handle message status updates (ack)
  officialProvider.on('message:ack', (data: { sessionId: string; id: string; ack: number; ackName: string }) => {
    io?.to(`session:${data.sessionId}`).emit('message:ack', {
      sessionId: data.sessionId,
      id: data.id,
      ack: data.ack,
      ackName: data.ackName
    });
    io?.to('session:*').emit('message:ack', {
      sessionId: data.sessionId,
      id: data.id,
      ack: data.ack,
      ackName: data.ackName
    });
  });

  logger.info('Official Provider events wired to WebSocket and MessageStorage');
}
