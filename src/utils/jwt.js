import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';

export function signAccessToken(claims) {
  return jwt.sign(claims, env.APP_JWT_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS
  });
}

export function signRefreshToken(claims) {
  return jwt.sign(claims, env.APP_REFRESH_SECRET, {
    expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d`
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.APP_JWT_SECRET);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.APP_REFRESH_SECRET);
}