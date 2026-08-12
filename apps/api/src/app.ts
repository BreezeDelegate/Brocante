import { randomUUID } from 'node:crypto';

import express, { type ErrorRequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { z } from 'zod';

import { config } from './config.js';
import { apiTokenMiddleware } from './middleware/auth.js';
import { corsPolicy } from './middleware/cors.js';
import { ebay } from './providers/ebay.js';
import { leboncoin } from './providers/leboncoin.js';
import { vinted } from './providers/vinted.js';
import { identify } from './services/identify.js';
import { SearchService } from './services/search.js';
import type { Provider, ProviderId } from './types.js';

const providerIdSchema = z.enum(['vinted', 'leboncoin', 'ebay']);
const identifySchema = z.object({
  image: z
    .string()
    .min(100)
    .max(7_500_000)
    .regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/),
});
const searchSchema = z.object({
  query: z.string().trim().min(2).max(160),
  providers: z
    .array(providerIdSchema)
    .min(1)
    .max(3)
    .refine((providers) => new Set(providers).size === providers.length, 'duplicate providers'),
});
const requestIdPattern = /^[A-Za-z0-9._-]{1,80}$/;

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (response.headersSent) return;

  const status =
    typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 500;

  if (status === 413) {
    response.status(413).json({ error: 'payload too large' });
    return;
  }

  console.error(error instanceof Error ? error.name : 'UnknownError');
  response.status(500).json({ error: 'internal server error' });
};

export function createApp(
  providerMap: Record<ProviderId, Provider> = { vinted, leboncoin, ebay },
  apiToken = config.API_TOKEN,
): express.Express {
  const app = express();
  const searchService = new SearchService(providerMap);

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy ? 1 : false);
  app.use(helmet());
  app.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(corsPolicy);
  app.use((request, response, next) => {
    const incomingRequestId = request.get('x-request-id') ?? '';
    const requestId = requestIdPattern.test(incomingRequestId) ? incomingRequestId : randomUUID();
    const startedAt = performance.now();
    response.setHeader('x-request-id', requestId);
    response.on('finish', () => {
      const durationMs = Math.round(performance.now() - startedAt);
      console.info(
        JSON.stringify({
          requestId,
          method: request.method,
          path: request.path,
          status: response.statusCode,
          durationMs,
        }),
      );
    });
    next();
  });
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: config.REQUESTS_PER_MINUTE,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: 'rate limit exceeded' },
      skip: (request) => request.path === '/health',
    }),
  );
  app.use(express.json({ limit: config.JSON_LIMIT, type: 'application/json' }));

  app.get('/health', (_request, response) => {
    response.json({ ok: true });
  });

  app.use(apiTokenMiddleware(apiToken));

  app.post('/identify', async (request, response) => {
    const parsed = identifySchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'invalid image' });
      return;
    }

    response.json({ label: await identify(parsed.data.image) });
  });

  app.post('/search', async (request, response) => {
    const parsed = searchSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'invalid request' });
      return;
    }

    const result = await searchService.search(parsed.data.query, parsed.data.providers);
    response.json(result);
  });

  app.use((_request, response) => {
    response.status(404).json({ error: 'not found' });
  });

  app.use(errorHandler);

  return app;
}
