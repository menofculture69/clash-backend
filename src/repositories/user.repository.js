import { pool } from '../config/database.js';

export class UserRepository {
  async upsertUser(input) {
    const query = `
      insert into app_users (player_tag, player_name, clan_tag, clan_name, avatar_url)
      values ($1, $2, $3, $4, $5)
      on conflict (player_tag)
      do update set
        player_name = excluded.player_name,
        clan_tag = excluded.clan_tag,
        clan_name = excluded.clan_name,
        avatar_url = excluded.avatar_url,
        updated_at = now()
      returning id, player_tag, player_name, clan_tag, clan_name, avatar_url, banned_until, ban_reason, banned_at
    `;

    const values = [
      input.playerTag,
      input.playerName,
      input.clanTag ?? null,
      input.clanName ?? null,
      input.avatarUrl ?? null
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async getById(userId) {
    const result = await pool.query(
      `select id, player_tag, player_name, clan_tag, clan_name, avatar_url, banned_until, ban_reason, banned_at from app_users where id = $1`,
      [userId]
    );
    return result.rows[0] ?? null;
  }

  async updateAvatarUrl(userId, avatarUrl) {
    const result = await pool.query(
      `update app_users
       set avatar_url = $2, updated_at = now()
       where id = $1
       returning id, player_tag, player_name, clan_tag, clan_name, avatar_url, banned_until, ban_reason, banned_at`,
      [userId, avatarUrl]
    );
    return result.rows[0] ?? null;
  }

  async syncAvatarReferences(playerTag, avatarUrl) {
    await pool.query(
      `update social_posts
       set player_avatar_url = $2, updated_at = now()
       where player_tag = $1`,
      [playerTag, avatarUrl]
    );
    await pool.query(
      `update social_follows
       set follower_avatar_url = $2
       where follower_tag = $1`,
      [playerTag, avatarUrl]
    );
    await pool.query(
      `update social_follows
       set following_avatar_url = $2
       where following_tag = $1`,
      [playerTag, avatarUrl]
    );
  }
}

export const userRepository = new UserRepository();
