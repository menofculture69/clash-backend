import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';

export function signAccessToken(claims) {
  return jwt.sign(claims, env.APP_JWT_SECRET, {
    algorithm: 'HS256',
    issuer: 'clash-companion-api',
    audience: 'clash-companion-app',
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS
  });
}

export function signRefreshToken(claims) {
  return jwt.sign(claims, env.APP_REFRESH_SECRET, {
    algorithm: 'HS256',
    issuer: 'clash-companion-api',
    audience: 'clash-companion-refresh',
    expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d`
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.APP_JWT_SECRET, {
    algorithms: ['HS256'],
    issuer: 'clash-companion-api',
    audience: 'clash-companion-app'
  });
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.APP_REFRESH_SECRET, {
    algorithms: ['HS256'],
    issuer: 'clash-companion-api',
    audience: 'clash-companion-refresh'
  });
}
