import { env } from '../config/env.js';
import { MemoryCache } from '../utils/cache.js';
import { clashService } from './clash.service.js';

const playerCache = new MemoryCache(env.PLAYER_CACHE_TTL_SECONDS * 1000);

function achievementValue(achievements, names, infoMatches) {
  for (const achievement of achievements ?? []) {
    const name = String(achievement.name ?? '').toLowerCase();
    const info = String(achievement.info ?? '').toLowerCase();
    const completionInfo = String(achievement.completionInfo ?? '').toLowerCase();
    const matchesName = names.some((match) => name.includes(match));
    const matchesInfo = infoMatches.some(
      (match) => info.includes(match) || completionInfo.includes(match)
    );
    if (matchesName || matchesInfo) {
      return Number(achievement.value ?? 0) || 0;
    }
  }
  return 0;
}

function normalizePlayerStats(profile) {
  const attackWins = Number(profile.attackWins ?? 0) || 0;
  const defenseWins = Number(profile.defenseWins ?? 0) || 0;
  return {
    ...profile,
    attackWins: attackWins || achievementValue(
      profile.achievements,
      ['conqueror'],
      ['win multiplayer battles']
    ),
    defenseWins: defenseWins || achievementValue(
      profile.achievements,
      ['unbreakable'],
      ['successfully defend against attacks']
    )
  };
}

export class PlayerService {
  async getFull(playerTag) {
    const cacheKey = `player:${playerTag}`;
    const cached = playerCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const profile = normalizePlayerStats(await clashService.getPlayer(playerTag));
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
