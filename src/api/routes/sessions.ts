/**
 * Session management routes
 */

import { FastifyInstance } from 'fastify';
import QRCode from 'qrcode';
import { nanoid } from 'nanoid';
import { sessionManager } from '../../core/SessionManager.js';

export async function sessionRoutes(server: FastifyInstance): Promise<void> {
  // List all sessions
  server.get('/', async () => {
    const sessions = sessionManager.listSessions();
    return {
      success: true,
      data: sessions
    };
  });

  // Create session
  server.post('/', async (request, reply) => {
    const body = request.body as { id?: string; name?: string };
    const id = body.id ?? nanoid(10);

    try {
      const session = await sessionManager.createSession(id, body.name);
      reply.status(201);
      return {
        success: true,
        data: session
      };
    } catch (error) {
      const err = error as Error;
      if (err.message.includes('already exists')) {
        reply.status(409);
        return {
          success: false,
          error: {
            code: 'SESSION_ALREADY_EXISTS',
            message: err.message
          }
        };
      }
      throw error;
    }
  });

  // Get session
  server.get('/:sessionId', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const client = sessionManager.getSession(sessionId);

    if (!client) {
      reply.status(404);
      return {
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: `Session '${sessionId}' not found`
        }
      };
    }

    return {
      success: true,
      data: client.getInfo()
    };
  });

  // Delete session
  server.delete('/:sessionId', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };

    try {
      await sessionManager.deleteSession(sessionId);
      return {
        success: true,
        message: `Session ${sessionId} deleted`
      };
    } catch (error) {
      const err = error as Error;
      if (err.message.includes('not found')) {
        reply.status(404);
        return {
          success: false,
          error: {
            code: 'SESSION_NOT_FOUND',
            message: err.message
          }
        };
      }
      throw error;
    }
  });

  // Start session
  server.post('/:sessionId/start', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };

    try {
      await sessionManager.startSession(sessionId);
      const client = sessionManager.getSession(sessionId);
      return {
        success: true,
        data: {
          id: sessionId,
          status: client?.getStatus() ?? 'starting'
        }
      };
    } catch (error) {
      const err = error as Error;
      if (err.message.includes('not found')) {
        reply.status(404);
        return {
          success: false,
          error: {
            code: 'SESSION_NOT_FOUND',
            message: err.message
          }
        };
      }
      throw error;
    }
  });

  // Stop session
  server.post('/:sessionId/stop', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };

    try {
      await sessionManager.stopSession(sessionId);
      return {
        success: true,
        data: {
          id: sessionId,
          status: 'stopped'
        }
      };
    } catch (error) {
      const err = error as Error;
      if (err.message.includes('not found')) {
        reply.status(404);
        return {
          success: false,
          error: {
            code: 'SESSION_NOT_FOUND',
            message: err.message
          }
        };
      }
      throw error;
    }
  });

  // Get QR code
  server.get('/:sessionId/qr', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const accept = request.headers.accept ?? 'application/json';

    try {
      const qr = sessionManager.getQRCode(sessionId);

      if (!qr) {
        reply.status(404);
        return {
          success: false,
          error: {
            code: 'QR_NOT_AVAILABLE',
            message: 'QR code not available. Session may already be authenticated or not started.'
          }
        };
      }

      // Return PNG image if requested
      if (accept.includes('image/png')) {
        const buffer = await QRCode.toBuffer(qr, { width: 300, margin: 2 });
        reply.type('image/png').send(buffer);
        return;
      }

      // Return JSON with base64 QR
      const dataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
      return {
        success: true,
        data: {
          qr: dataUrl,
          expiresAt: new Date(Date.now() + 60000).toISOString()
        }
      };
    } catch (error) {
      const err = error as Error;
      if (err.message.includes('not found')) {
        reply.status(404);
        return {
          success: false,
          error: {
            code: 'SESSION_NOT_FOUND',
            message: err.message
          }
        };
      }
      throw error;
    }
  });

  // Logout session
  server.post('/:sessionId/logout', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };

    try {
      await sessionManager.logoutSession(sessionId);
      return {
        success: true,
        message: `Session ${sessionId} logged out`
      };
    } catch (error) {
      const err = error as Error;
      if (err.message.includes('not found')) {
        reply.status(404);
        return {
          success: false,
          error: {
            code: 'SESSION_NOT_FOUND',
            message: err.message
          }
        };
      }
      throw error;
    }
  });

  // Get detailed session status with error info and reconnect state
  server.get('/:sessionId/status', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const client = sessionManager.getSession(sessionId);

    if (!client) {
      reply.status(404);
      return {
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: `Session '${sessionId}' not found`
        }
      };
    }

    const info = client.getInfo();
    return {
      success: true,
      data: {
        id: info.id,
        name: info.name,
        status: info.status,
        phone: info.phone,
        pushName: info.pushName,
        isConnected: info.status === 'ready',
        lastError: info.lastError ?? null,
        reconnect: info.reconnect ?? {
          enabled: true,
          attempts: 0,
          maxAttempts: 5,
          nextAttemptAt: null,
          lastAttemptAt: null
        },
        createdAt: info.createdAt,
        lastActivity: info.lastActivity ?? null
      }
    };
  });

  // Enable/disable auto-reconnect for a session
  server.post('/:sessionId/reconnect', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const body = request.body as { enabled?: boolean };
    const client = sessionManager.getSession(sessionId);

    if (!client) {
      reply.status(404);
      return {
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: `Session '${sessionId}' not found`
        }
      };
    }

    if (body.enabled !== undefined) {
      client.setAutoReconnect(body.enabled);
    }

    return {
      success: true,
      data: {
        id: sessionId,
        autoReconnectEnabled: client.isAutoReconnectEnabled()
      }
    };
  });

  // Get all chats (personal + groups)
  server.get('/:sessionId/chats', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const client = sessionManager.getSession(sessionId);

    if (!client) {
      reply.status(404);
      return {
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: `Session '${sessionId}' not found`
        }
      };
    }

    if (client.getStatus() !== 'ready') {
      reply.status(400);
      return {
        success: false,
        error: {
          code: 'SESSION_NOT_READY',
          message: 'Session is not ready'
        }
      };
    }

    try {
      const chats = await client.getChats();
      return {
        success: true,
        data: {
          chats,
          count: chats.length
        }
      };
    } catch (error) {
      const err = error as Error;
      reply.status(500);
      return {
        success: false,
        error: {
          code: 'CHATS_FETCH_FAILED',
          message: err.message
        }
      };
    }
  });

  // Get groups only
  server.get('/:sessionId/groups', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const client = sessionManager.getSession(sessionId);

    if (!client) {
      reply.status(404);
      return {
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: `Session '${sessionId}' not found`
        }
      };
    }

    if (client.getStatus() !== 'ready') {
      reply.status(400);
      return {
        success: false,
        error: {
          code: 'SESSION_NOT_READY',
          message: 'Session is not ready'
        }
      };
    }

    try {
      const groups = await client.getGroups();
      return {
        success: true,
        data: {
          groups,
          count: groups.length
        }
      };
    } catch (error) {
      const err = error as Error;
      reply.status(500);
      return {
        success: false,
        error: {
          code: 'GROUPS_FETCH_FAILED',
          message: err.message
        }
      };
    }
  });
}
