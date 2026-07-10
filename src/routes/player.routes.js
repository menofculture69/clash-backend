import { Router } from 'express';

import { playerController } from '../controllers/player.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';

export const playerRouter = Router();

playerRouter.get('/tag/:playerTag', asyncHandler((req, res) => playerController.byTag(req, res)));
playerRouter.get(
  '/tag/:playerTag/battlelog',
  asyncHandler((req, res) => playerController.battleLogByTag(req, res))
);
playerRouter.get(
  '/tag/:playerTag/leaguehistory',
  asyncHandler((req, res) => playerController.leagueHistoryByTag(req, res))
);
playerRouter.get(
  '/tag/:playerTag/full',
  asyncHandler((req, res) => playerController.fullByTag(req, res))
);

playerRouter.get('/me', requireAuth, asyncHandler((req, res) => playerController.me(req, res)));
playerRouter.get(
  '/me/battlelog',
  requireAuth,
  asyncHandler((req, res) => playerController.battleLog(req, res))
);
playerRouter.get(
  '/me/leaguehistory',
  requireAuth,
  asyncHandler((req, res) => playerController.leagueHistory(req, res))
);
playerRouter.get('/me/full', requireAuth, asyncHandler((req, res) => playerController.full(req, res)));
