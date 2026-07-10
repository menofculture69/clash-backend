import { Router } from 'express';

import { authController } from '../controllers/auth.controller.js';
import { asyncHandler } from '../utils/async-handler.js';
import { requireAuth } from '../middleware/auth.js';
import { authRateLimit } from '../middleware/rate-limit.js';
import { validateBody } from '../middleware/validate.js';
import { loginSchema, refreshSchema } from '../validators/auth.validator.js';

export const authRouter = Router();

authRouter.post(
  '/login',
  authRateLimit,
  validateBody(loginSchema),
  asyncHandler((req, res) => authController.login(req, res))
);
authRouter.post(
  '/refresh',
  authRateLimit,
  validateBody(refreshSchema),
  asyncHandler((req, res) => authController.refresh(req, res))
);
authRouter.post(
  '/logout',
  requireAuth,
  asyncHandler((req, res) => authController.logout(req, res))
);
authRouter.get('/me', requireAuth, asyncHandler((req, res) => authController.me(req, res)));
