import { Router } from 'express';

import { contentController } from '../controllers/content.controller.js';
import { requireAdmin } from '../middleware/admin.js';
import { auditAdminMutation } from '../middleware/admin-audit.js';
import { optionalAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';

export const contentRouter = Router();
const publicKinds = ['layouts', 'announcements', 'strategies', 'posts', 'army', 'halls'];
for (const kind of publicKinds) {
  const middleware = ['announcements', 'posts'].includes(kind) ? [optionalAuth] : [];
  contentRouter.get(`/${kind}`, ...middleware, asyncHandler((req, res) => contentController.listPublic(req, res, kind)));
}
contentRouter.get('/notifications', asyncHandler((req, res) => contentController.notifications(req, res)));
contentRouter.post('/posts', asyncHandler((req, res) => contentController.createPublicPost(req, res)));
contentRouter.post('/announcements/:id/reaction', asyncHandler((req, res) => contentController.reactToAnnouncement(req, res)));
contentRouter.post('/announcements/:id/vote', asyncHandler((req, res) => contentController.voteAnnouncementPoll(req, res)));
contentRouter.post('/posts/:id/vote', asyncHandler((req, res) => contentController.votePostPoll(req, res)));
contentRouter.post('/posts/:id/like', asyncHandler((req, res) => contentController.like(req, res)));
contentRouter.get('/posts/:id/comments', asyncHandler((req, res) => contentController.comments(req, res)));
contentRouter.post('/posts/:id/comment', asyncHandler((req, res) => contentController.comment(req, res)));
contentRouter.post('/posts/:id/report', asyncHandler((req, res) => contentController.report(req, res)));
contentRouter.post('/posts/:id/share', asyncHandler((req, res) => contentController.share(req, res)));
contentRouter.post('/follows', asyncHandler((req, res) => contentController.follow(req, res)));
contentRouter.delete('/follows', asyncHandler((req, res) => contentController.unfollow(req, res)));
contentRouter.get('/follows/counts', optionalAuth, asyncHandler((req, res) => contentController.followCounts(req, res)));
contentRouter.get('/follows/:type', optionalAuth, asyncHandler((req, res) => contentController.followList(req, res)));
contentRouter.post('/uploads/image', asyncHandler((req, res) => contentController.upload(req, res)));

export const adminContentRouter = Router();
adminContentRouter.use(requireAdmin);
adminContentRouter.use(auditAdminMutation);
adminContentRouter.post('/uploads/image', asyncHandler((req, res) => contentController.upload(req, res)));
adminContentRouter.post('/users/:id/ban', asyncHandler((req, res) => contentController.banUser(req, res)));
adminContentRouter.post('/users/:id/unban', asyncHandler((req, res) => contentController.unbanUser(req, res)));
adminContentRouter.get('/:kind', asyncHandler((req, res) => contentController.listAdmin(req, res)));
adminContentRouter.post('/:kind', asyncHandler((req, res) => contentController.create(req, res)));
adminContentRouter.patch('/:kind/:id', asyncHandler((req, res) => contentController.update(req, res)));
adminContentRouter.delete('/:kind/:id', asyncHandler((req, res) => contentController.remove(req, res)));
