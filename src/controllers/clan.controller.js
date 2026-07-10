import { clashService } from '../services/clash.service.js';
import { AppError } from '../utils/errors.js';
import { clanAggregateService } from '../services/clan-aggregate.service.js';
export class ClanController {
  async byTag(req, res) {
    const payload = await clashService.getClan(String(req.params.clanTag));
    res.status(200).json(payload);
  }
  async membersByTag(req, res) {
    const payload = await clashService.getClanMembers(String(req.params.clanTag));
    res.status(200).json({ items: payload });
  }
  async warLogByTag(req, res) {
    const payload = await clashService.getClanWarLog(String(req.params.clanTag));
    res.status(200).json({ items: payload });
  }
  async currentWarByTag(req, res) {
    const payload = await clashService.getClanCurrentWar(String(req.params.clanTag));
    res.status(200).json(payload);
  }
  async capitalRaidSeasonsByTag(req, res) {
    const payload = await clashService.getClanCapitalRaidSeasons(String(req.params.clanTag));
    res.status(200).json({ items: payload });
  }
  async fullByTag(req, res) {
    const payload = await clanAggregateService.getFull(String(req.params.clanTag));
    res.status(200).json(payload);
  }
  async me(req, res) {
    const clanTag = this.requireClanTag(req);
    const payload = await clashService.getClan(clanTag);
    res.status(200).json(payload);
  }
  async members(req, res) {
    const clanTag = this.requireClanTag(req);
    const payload = await clashService.getClanMembers(clanTag);
    res.status(200).json({ items: payload });
  }
  async warLog(req, res) {
    const clanTag = this.requireClanTag(req);
    const payload = await clashService.getClanWarLog(clanTag);
    res.status(200).json({ items: payload });
  }
  async currentWar(req, res) {
    const clanTag = this.requireClanTag(req);
    const payload = await clashService.getClanCurrentWar(clanTag);
    res.status(200).json(payload);
  }
  async capitalRaidSeasons(req, res) {
    const clanTag = this.requireClanTag(req);
    const payload = await clashService.getClanCapitalRaidSeasons(clanTag);
    res.status(200).json({ items: payload });
  }
  async full(req, res) {
    const clanTag = this.requireClanTag(req);
    const payload = await clanAggregateService.getFull(clanTag);
    res.status(200).json(payload);
  }
  requireClanTag(req) {
    const clanTag = req.auth?.clanTag;
    if (!clanTag) {
      throw new AppError('Authenticated player is not in a clan.', 404, true);
    }
    return clanTag;
  }
}
export const clanController = new ClanController();