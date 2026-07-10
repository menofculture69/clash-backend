import { Router } from 'express';

import { clanController } from '../controllers/clan.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';

export const clanRouter = Router();

clanRouter.get('/tag/:clanTag', asyncHandler((req, res) => clanController.byTag(req, res)));
clanRouter.get(
  '/tag/:clanTag/members',
  asyncHandler((req, res) => clanController.membersByTag(req, res))
);
clanRouter.get(
  '/tag/:clanTag/warlog',
  asyncHandler((req, res) => clanController.warLogByTag(req, res))
);
clanRouter.get(
  '/tag/:clanTag/currentwar',
  asyncHandler((req, res) => clanController.currentWarByTag(req, res))
);
clanRouter.get(
  '/tag/:clanTag/capitalraidseasons',
  asyncHandler((req, res) => clanController.capitalRaidSeasonsByTag(req, res))
);
clanRouter.get(
  '/tag/:clanTag/full',
  asyncHandler((req, res) => clanController.fullByTag(req, res))
);

clanRouter.get('/me', requireAuth, asyncHandler((req, res) => clanController.me(req, res)));
clanRouter.get('/me/members', requireAuth, asyncHandler((req, res) => clanController.members(req, res)));
clanRouter.get('/me/warlog', requireAuth, asyncHandler((req, res) => clanController.warLog(req, res)));
clanRouter.get(
  '/me/currentwar',
  requireAuth,
  asyncHandler((req, res) => clanController.currentWar(req, res))
);
clanRouter.get(
  '/me/capitalraidseasons',
  requireAuth,
  asyncHandler((req, res) => clanController.capitalRaidSeasons(req, res))
);
clanRouter.get('/me/full', requireAuth, asyncHandler((req, res) => clanController.full(req, res)));
