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
import {
  calculateDistanceKm,
  fuzzCoordinates,
} from '../matching/matching.service.js';

// In-memory mock storage for rapid Phase 1 testing and offline simulation
const mockActivities: any[] = [];
const mockJoinRequests: any[] = [];
const mockMessages: any[] = [];

export async function activityRoutes(fastify: FastifyInstance) {
  // Discovery endpoint - Live map feed with dynamic radius
  fastify.get('/discovery', async (request, reply) => {
    const query = DiscoveryQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.status(400).send({ error: query.error.errors });
    }

    const { latitude, longitude, radiusKm, interestIds } = query.data;

    const matched = mockActivities
      .filter((act) => act.status === 'open')
      .map((act) => {
        const distance = calculateDistanceKm(
          { latitude, longitude },
          act.rawLocation
        );
        return { ...act, distanceKm: distance };
      })
      .filter((act) => act.distanceKm <= radiusKm)
      .filter((act) => {
        if (!interestIds || interestIds.length === 0) return true;
        return interestIds.includes(act.interestId);
      });

    return reply.send({ activities: matched });
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

      const user = request.user!;
      const data = parsed.data;
      const fuzzed = fuzzCoordinates(data.location);

      const now = new Date();
      const expiresAt = new Date(
        now.getTime() + data.ttlHours * 60 * 60 * 1000
      );

      const newActivity = {
        id: `act-${Date.now()}`,
        hostId: user.id,
        hostName: user.id.includes('1') ? 'Alex' : 'Sam',
        hostIsVerified: true,
        hostTrustScore: 4.8,
        interestId: data.interestId,
        title: data.title,
        description: data.description,
        tier: data.tier,
        fuzzedLocation: fuzzed,
        rawLocation: data.location,
        venueName: data.venueName,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        maxParticipants: data.maxParticipants,
        currentParticipantsCount: 1,
        status: 'open',
      };

      mockActivities.push(newActivity);
      return reply.status(201).send({ activity: newActivity });
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

      const user = request.user!;
      const newRequest = {
        id: `req-${Date.now()}`,
        activityId: parsed.data.activityId,
        userId: user.id,
        userName: user.id.includes('2') ? 'Sam' : 'Alex',
        userTrustScore: 4.9,
        isVerified: true,
        message: parsed.data.message,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      mockJoinRequests.push(newRequest);
      return reply.status(201).send({ request: newRequest });
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

      const user = request.user!;
      const message = {
        id: `msg-${Date.now()}`,
        activityId: parsed.data.activityId,
        senderId: user.id,
        senderName: user.id.includes('1') ? 'Alex' : 'Sam',
        content: parsed.data.content,
        createdAt: new Date().toISOString(),
        isHost: user.id.includes('1'),
      };

      mockMessages.push(message);
      return reply.status(201).send({ message });
    }
  );

  // Respond to Join Request (Accept / Decline)
  fastify.patch(
    '/join-requests/:id/respond',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const parsed = RespondJoinRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.errors });
      }

      const { id } = request.params as { id: string };
      const req = mockJoinRequests.find((r) => r.id === id);
      if (!req) {
        return reply.status(404).send({ error: 'Join request not found' });
      }

      req.status = parsed.data.action === 'accept' ? 'accepted' : 'declined';
      return reply.status(200).send({ request: req });
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

      const user = request.user!;
      const rating = {
        id: `rate-${Date.now()}`,
        reviewerId: user.id,
        ...parsed.data,
        createdAt: new Date().toISOString(),
      };

      return reply.status(201).send({ rating });
    }
  );
}
