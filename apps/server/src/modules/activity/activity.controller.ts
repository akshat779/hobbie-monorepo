import { FastifyInstance } from 'fastify';
import {
  CreateActivitySchema,
  DiscoveryQuerySchema,
  RequestToJoinSchema,
  RespondJoinRequestSchema,
  SendMessageSchema,
  SubmitFeedbackSchema,
} from '@hobbie/shared';
import { authMiddleware } from '../../middleware/auth.js';
import { activityService } from './activity.service.js';

export async function activityRoutes(fastify: FastifyInstance) {
  // Discovery endpoint - Live PostGIS geospatial radius search
  fastify.get('/discovery', async (request, reply) => {
    const query = DiscoveryQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.status(400).send({ error: query.error.errors });
    }

    try {
      const activities = await activityService.getDiscoveryActivities(query.data);
      return reply.send({ activities });
    } catch (err: any) {
      request.log.error({ err }, 'Failed to fetch nearby activities');
      return reply.status(500).send({ error: err.message });
    }
  });

  // Create Activity endpoint
  fastify.post(
    '/activities',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const parsed = CreateActivitySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.errors });
      }

      try {
        const user = request.user!;
        const activity = await activityService.createActivity(user.id, parsed.data);
        return reply.status(201).send({ activity });
      } catch (err: any) {
        request.log.error({ err }, 'Failed to create activity');
        return reply.status(500).send({ error: err.message });
      }
    }
  );

  // Request to Join
  fastify.post(
    '/join-requests',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const parsed = RequestToJoinSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.errors });
      }

      try {
        const user = request.user!;
        const rpcData = await activityService.submitJoinRequest(user.id, parsed.data);
        return reply.status(201).send({ request: rpcData });
      } catch (err: any) {
        request.log.error({ err }, 'Failed to submit join request');
        return reply.status(400).send({ error: err.message });
      }
    }
  );

  // Send message in ephemeral room
  fastify.post(
    '/rooms/messages',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const parsed = SendMessageSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.errors });
      }

      try {
        const user = request.user!;
        const message = await activityService.sendRoomMessage(user.id, parsed.data);
        return reply.status(201).send({ message });
      } catch (err: any) {
        request.log.error({ err }, 'Failed to send room message');
        return reply.status(400).send({ error: err.message });
      }
    }
  );

  // Respond to Join Request (Accept / Decline)
  fastify.patch(
    '/join-requests/:id/respond',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const rawBody =
        typeof request.body === 'object' && request.body !== null
          ? request.body
          : {};
      const parsed = RespondJoinRequestSchema.safeParse({
        requestId: params.id,
        ...rawBody,
      });

      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.errors });
      }

      try {
        const user = request.user!;
        const result = await activityService.respondToJoinRequest(user.id, parsed.data);
        return reply.status(200).send({ request: result });
      } catch (err: any) {
        request.log.error({ err }, 'Failed to respond to join request');
        return reply.status(400).send({ error: err.message });
      }
    }
  );

  // Submit Post-Activity Feedback / Rating
  fastify.post(
    '/ratings',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const parsed = SubmitFeedbackSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.errors });
      }

      try {
        const user = request.user!;
        const rating = await activityService.submitRating(user.id, parsed.data);
        return reply.status(201).send({ rating });
      } catch (err: any) {
        request.log.error({ err }, 'Failed to insert feedback rating');
        return reply.status(400).send({ error: err.message });
      }
    }
  );
}
