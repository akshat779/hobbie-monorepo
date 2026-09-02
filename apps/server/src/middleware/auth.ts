import { FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../config/env.js';

export interface AuthenticatedUser {
  id: string;
  phone?: string;
  isDev?: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

/**
 * Authentication Middleware with Dev Persona Bypass.
 * In development or test mode, accepts X-Dev-User-Id header for instant multi-user simulation.
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Check for Dev Persona Switcher header in non-production
  if (env.NODE_ENV !== 'production') {
    const devUserId = request.headers['x-dev-user-id'];
    if (typeof devUserId === 'string' && devUserId.length > 0) {
      request.user = {
        id: devUserId,
        isDev: true,
      };
      return;
    }
  }

  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');
  // For MVP/early testing, parse token or Supabase JWT
  if (token === 'dev-token-alex') {
    request.user = { id: '00000000-0000-0000-0000-000000000001', isDev: true };
    return;
  }
  if (token === 'dev-token-sam') {
    request.user = { id: '00000000-0000-0000-0000-000000000002', isDev: true };
    return;
  }

  // Placeholder for Supabase JWT verification
  request.user = { id: token, isDev: false };
}
