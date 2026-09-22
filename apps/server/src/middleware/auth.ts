import { FastifyRequest, FastifyReply } from 'fastify';
import { supabaseAdmin } from '../shared/supabase.js';

export interface AuthenticatedUser {
  id: string;
  phone?: string | undefined;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

/**
 * Authentication Middleware.
 * Validates authentic Supabase JWT Bearer token on incoming requests.
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) {
      return reply.status(401).send({ error: 'Invalid or expired authentication token' });
    }

    request.user = {
      id: data.user.id,
      phone: data.user.phone,
    };
  } catch {
    return reply.status(401).send({ error: 'Authentication verification failed' });
  }
}
