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

  async getByPlayerTag(playerTag) {
    const result = await pool.query(
      `select id, player_tag, player_name, clan_tag, clan_name, avatar_url, banned_until, ban_reason, banned_at
       from app_users
       where player_tag = $1`,
      [playerTag]
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

  async createDeletionRequest(userId, reason = '') {
    const result = await pool.query(
      `
      insert into account_deletion_requests (user_id, player_tag, player_name, reason)
      select id, player_tag, player_name, $2
      from app_users
      where id = $1
      on conflict (user_id, status)
      do update set
        reason = excluded.reason,
        requested_at = now()
      returning id, user_id, player_tag, player_name, reason, status, requested_at, completed_at
      `,
      [userId, reason]
    );
    return result.rows[0] ?? null;
  }

  async deleteUserData(userId) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const userResult = await client.query(
        'select id, player_tag, player_name from app_users where id = $1',
        [userId]
      );
      const user = userResult.rows[0];
      if (!user) {
        await client.query('rollback');
        return null;
      }

      await client.query('delete from social_notifications where player_tag = $1', [user.player_tag]);
      await client.query('delete from social_post_likes where player_tag = $1', [user.player_tag]);
      await client.query('delete from social_post_poll_votes where player_tag = $1', [user.player_tag]);
      await client.query('delete from social_post_shares where player_tag = $1', [user.player_tag]);
      await client.query('delete from social_post_reports where reporter_tag = $1', [user.player_tag]);
      await client.query('delete from social_post_comments where player_tag = $1', [user.player_tag]);
      await client.query('delete from social_follows where follower_tag = $1 or following_tag = $1', [user.player_tag]);
      await client.query('delete from social_blocks where blocker_tag = $1 or blocked_tag = $1', [user.player_tag]);
      await client.query('delete from social_posts where player_tag = $1', [user.player_tag]);
      await client.query('delete from auth_audit_logs where player_tag = $1', [user.player_tag]);
      await client.query(
        `update account_deletion_requests
         set status = 'completed', completed_at = now()
         where user_id = $1 and status = 'pending'`,
        [userId]
      );
      await client.query('delete from app_users where id = $1', [userId]);
      await client.query('commit');
      return user;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }
}

export const userRepository = new UserRepository();
