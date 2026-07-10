import { clashService } from '../services/clash.service.js';
import { playerService } from '../services/player.service.js';
export class PlayerController {
  async byTag(req, res) {
    const payload = await clashService.getPlayer(String(req.params.playerTag));
    res.status(200).json(payload);
  }
  async battleLogByTag(req, res) {
    const payload = await clashService.getPlayerBattleLog(String(req.params.playerTag));
    res.status(200).json({ items: payload });
  }
  async leagueHistoryByTag(req, res) {
    const payload = await clashService.getPlayerLeagueHistory(String(req.params.playerTag));
    res.status(200).json({ items: payload });
  }
  async fullByTag(req, res) {
    const payload = await playerService.getFull(String(req.params.playerTag));
    res.status(200).json(payload);
  }
  async me(req, res) {
    const payload = await clashService.getPlayer(req.auth.playerTag);
    res.status(200).json(payload);
  }
  async battleLog(req, res) {
    const payload = await clashService.getPlayerBattleLog(req.auth.playerTag);
    res.status(200).json({ items: payload });
  }
  async leagueHistory(req, res) {
    const payload = await clashService.getPlayerLeagueHistory(req.auth.playerTag);
    res.status(200).json({ items: payload });
  }
  async full(req, res) {
    const payload = await playerService.getFull(req.auth.playerTag);
    res.status(200).json(payload);
  }
}
export const playerController = new PlayerController();