import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { encodeTag } from '../utils/tag.js';

export class ClashService {
  async verifyPlayerToken(playerTag, verifyToken) {
    const encodedTag = encodeTag(playerTag);
    const normalizedToken = String(verifyToken)
      .replace(/[\s\u200B-\u200D\uFEFF]/g, '')
      .toLowerCase();
    const result = await this.requestJson(`/players/${encodedTag}/verifytoken`, {
      method: 'POST',
      body: JSON.stringify({ token: normalizedToken })
    });

    if (String(result.status).toLowerCase() !== 'ok') {
      throw new AppError(
        'The Clash API did not accept this verification token. Generate a new API Token in Clash of Clans and try again.',
        401,
        true,
        { code: 'VERIFY_TOKEN_REJECTED' }
      );
    }
  }

  getPlayer(playerTag) {
    return this.requestJson(`/players/${encodeTag(playerTag)}`);
  }

  getPlayerBattleLog(playerTag) {
    return this.requestItems(`/players/${encodeTag(playerTag)}/battlelog`);
  }

  getPlayerLeagueHistory(playerTag) {
    return this.requestItems(`/players/${encodeTag(playerTag)}/leaguehistory`);
  }

  getClan(clanTag) {
    return this.requestJson(`/clans/${encodeTag(clanTag)}`);
  }

  getClanMembers(clanTag) {
    return this.requestItems(`/clans/${encodeTag(clanTag)}/members`);
  }

  getClanWarLog(clanTag) {
    return this.requestItems(`/clans/${encodeTag(clanTag)}/warlog`);
  }

  getClanCapitalRaidSeasons(clanTag) {
    return this.requestItems(`/clans/${encodeTag(clanTag)}/capitalraidseasons`);
  }

  async getClanCurrentWar(clanTag) {
    try {
      return await this.requestJson(`/clans/${encodeTag(clanTag)}/currentwar`);
    } catch {
      return null;
    }
  }

  async requestItems(path) {
    try {
      const json = await this.requestJson(path);
      return json.items ?? [];
    } catch {
      return [];
    }
  }

  async requestJson(path, init) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    try {
      const response = await fetch(`${env.CLASH_API_BASE_URL}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${env.CLASH_API_JWT}`,
          'Content-Type': 'application/json',
          ...(init?.headers ?? {})
        }
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const reason =
          typeof data.reason === 'string'
            ? data.reason
            : typeof data.message === 'string'
              ? data.message
              : 'Clash API request failed.';
        if (response.status === 403) {
          throw new AppError(
            'The Clash API rejected the backend API key or server IP. Update the Clash developer key allowlist and restart the backend.',
            503,
            true,
            { code: 'CLASH_API_ACCESS_DENIED', upstreamReason: reason }
          );
        }
        throw new AppError(reason, response.status, true, {
          code: 'CLASH_API_REQUEST_FAILED',
          upstreamReason: reason
        });
      }

      return data;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError('Unable to reach Clash API.', 502, true);
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const clashService = new ClashService();
