import { Router } from 'express';

import { contentController } from '../controllers/content.controller.js';
import { requireAdmin } from '../middleware/admin.js';
import { asyncHandler } from '../utils/async-handler.js';

export const contentRouter = Router();
const publicKinds = ['layouts', 'strategies', 'posts', 'army', 'halls'];
for (const kind of publicKinds) contentRouter.get(`/${kind}`, asyncHandler((req, res) => contentController.listPublic(req, res, kind)));
contentRouter.get('/notifications', asyncHandler((req, res) => contentController.notifications(req, res)));
contentRouter.post('/posts', asyncHandler((req, res) => contentController.createPublicPost(req, res)));
contentRouter.post('/posts/:id/like', asyncHandler((req, res) => contentController.like(req, res)));
contentRouter.get('/posts/:id/comments', asyncHandler((req, res) => contentController.comments(req, res)));
contentRouter.post('/posts/:id/comment', asyncHandler((req, res) => contentController.comment(req, res)));
contentRouter.post('/posts/:id/share', asyncHandler((req, res) => contentController.share(req, res)));
contentRouter.post('/uploads/image', asyncHandler((req, res) => contentController.upload(req, res)));

export const adminContentRouter = Router();
adminContentRouter.use(requireAdmin);
adminContentRouter.post('/uploads/image', asyncHandler((req, res) => contentController.upload(req, res)));
adminContentRouter.get('/:kind', asyncHandler((req, res) => contentController.listAdmin(req, res)));
adminContentRouter.post('/:kind', asyncHandler((req, res) => contentController.create(req, res)));
adminContentRouter.patch('/:kind/:id', asyncHandler((req, res) => contentController.update(req, res)));
adminContentRouter.delete('/:kind/:id', asyncHandler((req, res) => contentController.remove(req, res)));
