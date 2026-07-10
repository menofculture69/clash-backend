import { env } from '../config/env.js';
import { MemoryCache } from '../utils/cache.js';
import { clashService } from './clash.service.js';

const playerCache = new MemoryCache(env.PLAYER_CACHE_TTL_SECONDS * 1000);

export class PlayerService {
  async getFull(playerTag) {
    const cacheKey = `player:${playerTag}`;
    const cached = playerCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const profile = await clashService.getPlayer(playerTag);
    const battleLog = await clashService.getPlayerBattleLog(playerTag);
    const leagueHistory = await clashService.getPlayerLeagueHistory(playerTag);
    const fullPayload = {
      profile,
      battleLog,
      leagueHistory,
      fetchedAt: new Date().toISOString()
    };
    playerCache.set(cacheKey, fullPayload);
    return fullPayload;
  }
}

export const playerService = new PlayerService();