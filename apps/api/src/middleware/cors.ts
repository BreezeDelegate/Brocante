import type { RequestHandler } from 'express';

import { config } from '../config.js';

function isSameOrigin(origin: string, protocol: string, host: string | undefined): boolean {
  if (!host) return false;
  try {
    const url = new URL(origin);
    return url.host === host && url.protocol === `${protocol}:`;
  } catch {
    return false;
  }
}

export const corsPolicy: RequestHandler = (request, response, next) => {
  const origin = request.get('origin');
  if (!origin || isSameOrigin(origin, request.protocol, request.get('host'))) {
    next();
    return;
  }

  if (!config.corsOrigins.includes(origin)) {
    response.status(403).json({ error: 'origin not allowed' });
    return;
  }

  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Vary', 'Origin');
  response.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

  if (request.method === 'OPTIONS') {
    response.sendStatus(204);
    return;
  }

  next();
};
