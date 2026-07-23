import { authService } from '../services/auth.service.js';
export class AuthController {
  async login(req, res) {
    const payload = await authService.login({
      playerTag: req.body.playerTag,
      verifyToken: req.body.verifyToken,
      deviceInfo: req.body.deviceInfo,
      ipAddress: req.ip
    });
    res.status(200).json(payload);
  }
  async refresh(req, res) {
    const payload = await authService.refresh(req.body.refreshToken);
    res.status(200).json(payload);
  }
  async logout(req, res) {
    await authService.logout(req.auth.sessionId);
    res.status(204).send();
  }
  async me(req, res) {
    const payload = await authService.me(req.auth.sub);
    res.status(200).json(payload);
  }

  async updateAvatar(req, res) {
    const payload = await authService.updateAvatar(req.auth.sub, req.body.dataUrl);
    res.status(200).json(payload);
  }
}
export const authController = new AuthController();
