import { randomUUID } from 'crypto';
export function requestIdMiddleware(_req, res, next) {
  const requestId = randomUUID();
  res.setHeader('x-request-id', requestId);
  next();
}