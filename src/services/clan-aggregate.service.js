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

    const enrichedMembers = await this.enrichMembers(members);

    const fullPayload = {
      profile,
      members: enrichedMembers,
      warLog,
      capitalRaidSeasons,
      currentWar,
      fetchedAt: new Date().toISOString()
    };
    clanCache.set(cacheKey, fullPayload);
    return fullPayload;
  }

  async enrichMembers(members) {
    const enriched = [];
    for (let index = 0; index < members.length; index += 8) {
      const batch = members.slice(index, index + 8);
      const profiles = await Promise.allSettled(
        batch.map((member) => clashService.getPlayer(member.tag))
      );

      profiles.forEach((result, batchIndex) => {
        const member = batch[batchIndex];
        if (result.status !== 'fulfilled') {
          enriched.push(member);
          return;
        }
        const profile = result.value;
        enriched.push({
          ...member,
          townHallLevel: profile.townHallLevel ?? member.townHallLevel ?? 0,
          townHallWeaponLevel: profile.townHallWeaponLevel ?? member.townHallWeaponLevel ?? 0,
          expLevel: profile.expLevel ?? member.expLevel ?? 0,
          leagueTier: profile.leagueTier ?? member.leagueTier,
          league: profile.league ?? member.league
        });
      });
    }
    return enriched;
  }
}

export const clanAggregateService = new ClanAggregateService();
