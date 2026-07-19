import { v4 as uuid } from 'uuid';
import { env } from '../config/env.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { sessionRepository } from '../repositories/session.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { AppError, UnauthorizedError } from '../utils/errors.js';
import { hashToken } from '../utils/hash.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { normalizeTag } from '../utils/tag.js';
import { clashService } from './clash.service.js';
function activeBan(user) {
  if (!user?.banned_at) return null;
  if (!user.banned_until) return {
    bannedUntil: null,
    banReason: user.ban_reason || 'Your account has been banned.'
  };
  if (new Date(user.banned_until).getTime() > Date.now()) {
    return {
      bannedUntil: user.banned_until,
      banReason: user.ban_reason || 'Your account has been temporarily banned.'
    };
  }
  return null;
}

export class AuthService {
  async login(input) {
    const playerTag = normalizeTag(input.playerTag);
    try {
      await clashService.verifyPlayerToken(playerTag, input.verifyToken);
      const player = await clashService.getPlayer(playerTag);
      const clan = player.clan ?? {};
      const leagueTier = player.leagueTier ?? {};
      const league = player.league ?? {};
      const tierIconUrls = leagueTier.iconUrls ?? {};
      const iconUrls = league.iconUrls ?? {};
      const user = await userRepository.upsertUser({
        playerTag,
        playerName: String(player.name ?? ''),
        clanTag: clan.tag ?? null,
        clanName: clan.name ?? null,
        avatarUrl: tierIconUrls.small ?? tierIconUrls.large ?? iconUrls.medium ?? iconUrls.small ?? null
      });
      const ban = activeBan(user);
      if (ban) {
        throw new AppError(
          ban.bannedUntil
            ? `Account banned until ${new Date(ban.bannedUntil).toLocaleString()}.`
            : 'Account permanently banned.',
          403,
          true,
          { ban }
        );
      }
      const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
      const session = await sessionRepository.createSession({
        userId: user.id,
        refreshTokenHash: hashToken(uuid()),
        deviceInfo: input.deviceInfo,
        expiresAt
      });
      const authClaims = {
        sub: user.id,
        sessionId: session.id,
        playerTag: user.player_tag,
        playerName: user.player_name,
        clanTag: user.clan_tag
      };
      const accessToken = signAccessToken(authClaims);
      const refreshToken = signRefreshToken({
        sub: user.id,
        sessionId: session.id
      });
      await sessionRepository.rotateRefreshToken(session.id, hashToken(refreshToken), expiresAt);
      await this.logAuthEventSafe({
        playerTag,
        success: true,
        ipAddress: input.ipAddress,
        deviceInfo: input.deviceInfo
      });
      return {
        accessToken,
        refreshToken,
        session: {
          playerTag: user.player_tag,
          playerName: user.player_name,
          clanTag: user.clan_tag,
          clanName: user.clan_name,
          playerAvatarUrl: user.avatar_url
        }
      };
    } catch (error) {
      await this.logAuthEventSafe({
        playerTag,
        success: false,
        ipAddress: input.ipAddress,
        deviceInfo: input.deviceInfo,
        reason: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
  async logAuthEventSafe(input) {
    try {
      await auditRepository.logAuthEvent(input);
    } catch (error) {
      console.warn('Auth audit log failed:', error);
    }
  }
  async refresh(refreshToken) {
    const claims = verifyRefreshToken(refreshToken);
    const session = await sessionRepository.getById(claims.sessionId);
    if (!session || session.revoked_at || new Date(session.expires_at).getTime() < Date.now()) {
      throw new UnauthorizedError('Refresh session is invalid or expired.');
    }
    if (session.refresh_token_hash !== hashToken(refreshToken)) {
      await sessionRepository.revokeSession(session.id);
      throw new UnauthorizedError('Refresh token mismatch.');
    }
    const user = await userRepository.getById(session.user_id);
    if (!user) {
      throw new UnauthorizedError('User not found.');
    }
    const ban = activeBan(user);
    if (ban) {
      await sessionRepository.revokeSession(session.id);
      throw new UnauthorizedError(ban.bannedUntil ? 'Account is temporarily banned.' : 'Account is permanently banned.');
    }
    const nextRefreshToken = signRefreshToken({
      sub: user.id,
      sessionId: session.id
    });
    const nextExpiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
    await sessionRepository.rotateRefreshToken(
      session.id,
      hashToken(nextRefreshToken),
      nextExpiresAt
    );
    const accessToken = signAccessToken({
      sub: user.id,
      sessionId: session.id,
      playerTag: user.player_tag,
      playerName: user.player_name,
      clanTag: user.clan_tag
    });
    return {
      accessToken,
      refreshToken: nextRefreshToken
    };
  }
  async logout(sessionId) {
    await sessionRepository.revokeSession(sessionId);
  }
  async me(userId) {
    const user = await userRepository.getById(userId);
    if (!user) {
      throw new AppError('User not found.', 404, true);
    }
    const ban = activeBan(user);
    return {
      playerTag: user.player_tag,
      playerName: user.player_name,
      clanTag: user.clan_tag,
      clanName: user.clan_name,
      playerAvatarUrl: user.avatar_url,
      isBanned: Boolean(ban),
      bannedUntil: ban?.bannedUntil ?? null,
      banReason: ban?.banReason ?? ''
    };
  }
}
export const authService = new AuthService();
