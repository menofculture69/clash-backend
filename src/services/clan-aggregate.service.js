import { env } from '../config/env.js';
import { MemoryCache } from '../utils/cache.js';
import { clashService } from './clash.service.js';

const clanCache = new MemoryCache(env.CLAN_CACHE_TTL_SECONDS * 1000);

export class ClanAggregateService {
  async getFull(clanTag) {
    const cacheKey = `clan:${clanTag}`;
    const cached = clanCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const [profile, members, warLog, capitalRaidSeasons, currentWar] = await Promise.all([
      clashService.getClan(clanTag),
      clashService.getClanMembers(clanTag),
      clashService.getClanWarLog(clanTag),
      clashService.getClanCapitalRaidSeasons(clanTag),
      clashService.getClanCurrentWar(clanTag)
    ]);

    const fullPayload = {
      profile,
      members,
      warLog,
      capitalRaidSeasons,
      currentWar,
      fetchedAt: new Date().toISOString()
    };
    clanCache.set(cacheKey, fullPayload);
    return fullPayload;
  }
}

export const clanAggregateService = new ClanAggregateService();