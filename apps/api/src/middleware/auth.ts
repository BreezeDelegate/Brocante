import { timingSafeEqual } from 'node:crypto';

import type { RequestHandler } from 'express';

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function apiTokenMiddleware(apiToken?: string): RequestHandler {
  return (request, response, next) => {
    if (!apiToken) {
      next();
      return;
    }

    const header = request.get('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7) : '';

    if (!token || !safeEqual(token, apiToken)) {
      response.status(401).json({ error: 'unauthorized' });
      return;
    }

    next();
  };
}
