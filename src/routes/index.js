import { Router } from 'express';

import { authRouter } from './auth.routes.js';
import { clanRouter } from './clan.routes.js';
import { healthRouter } from './health.routes.js';
import { playerRouter } from './player.routes.js';
import { adminContentRouter, contentRouter } from './content.routes.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/players', playerRouter);
apiRouter.use('/clans', clanRouter);
apiRouter.use('/content', contentRouter);
apiRouter.use('/admin/content', adminContentRouter);
