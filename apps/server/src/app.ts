import fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { activityRoutes } from './modules/activity/activity.controller.js';

export function buildApp() {
  const app = fastify({
    logger: true,
  });

  app.register(helmet, { contentSecurityPolicy: false });
  app.register(cors, { origin: true });

  // Health check
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Register API modules
  app.register(activityRoutes, { prefix: '/api/v1' });

  return app;
}
