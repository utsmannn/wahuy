/**
 * Official API - Group Routes (Cloud API v19.0+)
 *
 * POST   /v1/groups                        - Create group
 * GET    /v1/groups                        - List groups
 * GET    /v1/groups/:groupId               - Get group info
 * PATCH  /v1/groups/:groupId               - Update group
 * DELETE /v1/groups/:groupId               - Delete/leave group
 * POST   /v1/groups/:groupId/participants  - Manage participants
 * GET    /v1/groups/:groupId/invite        - Get invite link
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getProvider } from '../../../providers/index.js';
import { logger } from '../../../utils/logger.js';

export async function officialGroupRoutes(server: FastifyInstance): Promise<void> {

  // POST /v1/groups - Create group
  server.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const provider = getProvider();

      if (!provider.createGroup) {
        reply.status(501);
        return { error: { message: 'Group operations not supported by this provider', type: 'NotImplementedException', code: 501 } };
      }

      const body = request.body as { subject?: string; participants?: string[]; description?: string };

      if (!body.subject) {
        reply.status(400);
        return { error: { message: 'Missing required parameter: subject', type: 'InvalidParameterException', code: 100 } };
      }

      const result = await provider.createGroup(body.subject, body.participants, body.description);

      logger.info({ groupId: result.id, subject: body.subject }, 'Group created');

      reply.status(201);
      return result;
    } catch (error) {
      const err = error as Error;
      const providerErr = error as { code?: string; metaCode?: number; fbTraceId?: string };
      logger.error({ error: err }, 'Failed to create group');

      reply.status(500);
      return {
        error: {
          message: err.message,
          type: providerErr.code || 'APIException',
          code: providerErr.metaCode || 0,
          fbtrace_id: providerErr.fbTraceId,
        }
      };
    }
  });

  // GET /v1/groups - List groups
  server.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const provider = getProvider();

      if (!provider.getGroups) {
        reply.status(501);
        return { error: { message: 'Group operations not supported by this provider', type: 'NotImplementedException', code: 501 } };
      }

      const groups = await provider.getGroups();
      return { data: groups };
    } catch (error) {
      const err = error as Error;
      const providerErr = error as { code?: string; metaCode?: number; fbTraceId?: string };
      logger.error({ error: err }, 'Failed to list groups');

      reply.status(500);
      return {
        error: {
          message: err.message,
          type: providerErr.code || 'APIException',
          code: providerErr.metaCode || 0,
          fbtrace_id: providerErr.fbTraceId,
        }
      };
    }
  });

  // GET /v1/groups/:groupId - Get group info
  server.get('/:groupId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const provider = getProvider();
      const { groupId } = request.params as { groupId: string };

      if (!provider.getGroupInfo) {
        reply.status(501);
        return { error: { message: 'Group operations not supported by this provider', type: 'NotImplementedException', code: 501 } };
      }

      const group = await provider.getGroupInfo(groupId);
      return group;
    } catch (error) {
      const err = error as Error;
      const providerErr = error as { code?: string; metaCode?: number; fbTraceId?: string };
      logger.error({ error: err, groupId: (request.params as { groupId: string }).groupId }, 'Failed to get group info');

      reply.status(500);
      return {
        error: {
          message: err.message,
          type: providerErr.code || 'APIException',
          code: providerErr.metaCode || 0,
          fbtrace_id: providerErr.fbTraceId,
        }
      };
    }
  });

  // PATCH /v1/groups/:groupId - Update group
  server.patch('/:groupId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const provider = getProvider();
      const { groupId } = request.params as { groupId: string };
      const body = request.body as { subject?: string; description?: string };

      if (!provider.updateGroup) {
        reply.status(501);
        return { error: { message: 'Group operations not supported by this provider', type: 'NotImplementedException', code: 501 } };
      }

      if (!body.subject && !body.description) {
        reply.status(400);
        return { error: { message: 'At least one of subject or description is required', type: 'InvalidParameterException', code: 100 } };
      }

      await provider.updateGroup(groupId, body);

      logger.info({ groupId, updates: body }, 'Group updated');
      return { success: true };
    } catch (error) {
      const err = error as Error;
      const providerErr = error as { code?: string; metaCode?: number; fbTraceId?: string };
      logger.error({ error: err, groupId: (request.params as { groupId: string }).groupId }, 'Failed to update group');

      reply.status(500);
      return {
        error: {
          message: err.message,
          type: providerErr.code || 'APIException',
          code: providerErr.metaCode || 0,
          fbtrace_id: providerErr.fbTraceId,
        }
      };
    }
  });

  // DELETE /v1/groups/:groupId - Delete/leave group
  server.delete('/:groupId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const provider = getProvider();
      const { groupId } = request.params as { groupId: string };

      if (!provider.deleteGroup) {
        reply.status(501);
        return { error: { message: 'Group operations not supported by this provider', type: 'NotImplementedException', code: 501 } };
      }

      await provider.deleteGroup(groupId);

      logger.info({ groupId }, 'Group deleted');
      return { success: true };
    } catch (error) {
      const err = error as Error;
      const providerErr = error as { code?: string; metaCode?: number; fbTraceId?: string };
      logger.error({ error: err, groupId: (request.params as { groupId: string }).groupId }, 'Failed to delete group');

      reply.status(500);
      return {
        error: {
          message: err.message,
          type: providerErr.code || 'APIException',
          code: providerErr.metaCode || 0,
          fbtrace_id: providerErr.fbTraceId,
        }
      };
    }
  });

  // POST /v1/groups/:groupId/participants - Manage participants
  server.post('/:groupId/participants', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const provider = getProvider();
      const { groupId } = request.params as { groupId: string };
      const body = request.body as { participants?: string[]; action?: string };

      if (!provider.manageGroupParticipants) {
        reply.status(501);
        return { error: { message: 'Group operations not supported by this provider', type: 'NotImplementedException', code: 501 } };
      }

      if (!body.participants || !Array.isArray(body.participants) || body.participants.length === 0) {
        reply.status(400);
        return { error: { message: 'Missing required parameter: participants (non-empty array of phone numbers)', type: 'InvalidParameterException', code: 100 } };
      }

      const validActions = ['add', 'remove', 'promote', 'demote'];
      if (!body.action || !validActions.includes(body.action)) {
        reply.status(400);
        return { error: { message: `Missing or invalid action. Must be one of: ${validActions.join(', ')}`, type: 'InvalidParameterException', code: 100 } };
      }

      const action = body.action as 'add' | 'remove' | 'promote' | 'demote';
      const result = await provider.manageGroupParticipants(groupId, body.participants, action);

      logger.info({ groupId, action, count: body.participants.length }, 'Participants managed');
      return { participants: result };
    } catch (error) {
      const err = error as Error;
      const providerErr = error as { code?: string; metaCode?: number; fbTraceId?: string };
      logger.error({ error: err, groupId: (request.params as { groupId: string }).groupId }, 'Failed to manage participants');

      reply.status(500);
      return {
        error: {
          message: err.message,
          type: providerErr.code || 'APIException',
          code: providerErr.metaCode || 0,
          fbtrace_id: providerErr.fbTraceId,
        }
      };
    }
  });

  // GET /v1/groups/:groupId/invite - Get invite link
  server.get('/:groupId/invite', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const provider = getProvider();
      const { groupId } = request.params as { groupId: string };

      if (!provider.getGroupInviteLink) {
        reply.status(501);
        return { error: { message: 'Group operations not supported by this provider', type: 'NotImplementedException', code: 501 } };
      }

      const result = await provider.getGroupInviteLink(groupId);
      return result;
    } catch (error) {
      const err = error as Error;
      const providerErr = error as { code?: string; metaCode?: number; fbTraceId?: string };
      logger.error({ error: err, groupId: (request.params as { groupId: string }).groupId }, 'Failed to get invite link');

      reply.status(500);
      return {
        error: {
          message: err.message,
          type: providerErr.code || 'APIException',
          code: providerErr.metaCode || 0,
          fbtrace_id: providerErr.fbTraceId,
        }
      };
    }
  });
}
