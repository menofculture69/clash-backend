import { Router } from 'express';

import { contentController } from '../controllers/content.controller.js';
import { requireAdmin } from '../middleware/admin.js';
import { asyncHandler } from '../utils/async-handler.js';

export const contentRouter = Router();
const publicKinds = ['layouts', 'strategies', 'posts'];
for (const kind of publicKinds) contentRouter.get(`/${kind}`, asyncHandler((req, res) => contentController.listPublic(req, res, kind)));

export const adminContentRouter = Router();
adminContentRouter.use(requireAdmin);
adminContentRouter.get('/:kind', asyncHandler((req, res) => contentController.listAdmin(req, res)));
adminContentRouter.post('/:kind', asyncHandler((req, res) => contentController.create(req, res)));
adminContentRouter.patch('/:kind/:id', asyncHandler((req, res) => contentController.update(req, res)));
adminContentRouter.delete('/:kind/:id', asyncHandler((req, res) => contentController.remove(req, res)));
