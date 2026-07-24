import { z } from 'zod';

import { pool } from '../config/database.js';
import { env } from '../config/env.js';
import { userRepository } from '../repositories/user.repository.js';
import { cloudinaryService } from '../services/cloudinary.service.js';
import { clashService } from '../services/clash.service.js';
import { AppError } from '../utils/errors.js';
import { normalizeTag } from '../utils/tag.js';

const townHalls = ['TH18', 'TH17', 'TH16', 'TH15'];
const armyCategories = [
  'troops',
  'superTroops',
  'spells',
  'heroes',
  'siegeMachines',
  'pets',
  'heroEquipment'
];
const socialHashtags = [
  'Casual',
  'Suggestions',
  'Recruitment',
  'Need Help',
  'Polls'
];
const hallTypes = ['townHall', 'builderHall'];
const tagSchema = z
  .string()
  .min(3)
  .max(16)
  .transform((value) => normalizeTag(value));
const strategyUnitSchema = z
  .union([
    z.string().min(1).max(120),
    z.object({
      name: z.string().min(1).max(120),
      count: z.coerce.number().int().min(1).max(999).optional().default(1)
    })
  ])
  .transform((value) =>
    typeof value === 'string' ? { name: value, count: 1 } : { name: value.name, count: value.count }
  );
const heroLoadoutSchema = z.object({
  hero: strategyUnitSchema,
  pet: strategyUnitSchema,
  equipment: z.array(strategyUnitSchema).length(2)
}).refine(
  (loadout) => new Set(loadout.equipment.map((item) => item.name)).size === 2,
  { message: 'Each hero must use two different equipment items.', path: ['equipment'] }
);
const armyLinkSchema = z.union([
  z.literal(''),
  z.string().url().refine((value) => {
    const url = new URL(value);
    return url.hostname === 'link.clashofclans.com' && url.searchParams.get('action') === 'CopyArmy';
  }, 'Use an official Clash of Clans CopyArmy link.')
]);
const optionalWebUrlSchema = z.preprocess(
  (value) => {
    const input = String(value ?? '').trim();
    if (!input) return '';
    return /^https?:\/\//i.test(input) ? input : `https://${input}`;
  },
  z.union([
    z.literal(''),
    z.string().url().refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), {
      message: 'Link URL must use http or https.'
    })
  ])
);
const kindSchemas = {
  layouts: z.object({
    title: z.string().min(3).max(120),
    townHall: z.enum(townHalls),
    description: z.string().max(500).optional().default(''),
    imageUrl: z.union([z.string().url(), z.literal('')]).optional().default(''),
    layoutUrl: z.string().url(),
    published: z.boolean().optional().default(true)
  }),
  announcements: z.object({
    title: z.string().min(2).max(120).optional().default('Clash Companion'),
    message: z.string().min(1).max(1200),
    imageUrl: z.union([z.string().url(), z.literal('')]).optional().default(''),
    linkLabel: z.string().max(80).optional().default(''),
    linkUrl: optionalWebUrlSchema.optional().default(''),
    pollQuestion: z.string().max(160).optional().nullable(),
    pollOptions: z.array(z.string().min(1).max(80)).max(6).optional().default([]),
    published: z.boolean().optional().default(true)
  }),
  strategies: z.object({
    title: z.string().min(3).max(120),
    townHall: z.enum(townHalls),
    troops: z.array(strategyUnitSchema).optional().default([]),
    spells: z.array(strategyUnitSchema).optional().default([]),
    clanCastle: z.array(strategyUnitSchema).optional().default([]),
    heroes: z.array(strategyUnitSchema).optional().default([]),
    heroLoadouts: z
      .array(heroLoadoutSchema)
      .max(4)
      .refine(
        (loadouts) => new Set(loadouts.map((item) => item.hero.name)).size === loadouts.length,
        'A hero can only be selected once.'
      )
      .refine(
        (loadouts) => new Set(loadouts.map((item) => item.pet.name)).size === loadouts.length,
        'Each hero must use a different pet.'
      )
      .optional()
      .default([]),
    armyLink: armyLinkSchema.optional().default(''),
    published: z.boolean().optional().default(true)
  }),
  posts: z.object({
    playerTag: z.string().min(1).optional(),
    authorName: z.string().min(2).max(60).optional(),
    authorRole: z.string().max(60).optional(),
    body: z.string().max(2000).optional().default(''),
    imageUrl: z.union([z.string().url(), z.literal('')]).optional().default(''),
    pollQuestion: z.string().max(160).optional().nullable(),
    pollOptions: z.array(z.string().min(1).max(80)).max(6).optional().default([]),
    hashtags: z.array(z.enum(socialHashtags)).max(5).optional().default([]),
    published: z.boolean().optional().default(true),
    featured: z.boolean().optional().default(false)
  }),
  army: z.object({
    name: z.string().min(1).max(120),
    category: z.enum(armyCategories),
    village: z.enum(['home', 'builderBase']),
    imageUrl: z.string().url()
  }),
  halls: z.object({
    hallType: z.enum(hallTypes),
    level: z.coerce.number().int().min(1).max(99),
    imageUrl: z.string().url()
  })
};

const uploadSchema = z.object({
  dataUrl: z.string()
    .max(2_700_000, 'Image must be smaller than 2 MB.')
    .regex(/^data:image\/(?:jpeg|png|webp);base64,/i, 'Only JPEG, PNG, and WebP images are allowed.'),
  folder: z.string().regex(/^clash-companion\/[a-z0-9-]+$/i).optional()
});

const containsLink = (value) => /(?:https?:\/\/|www\.|(?:^|\s)[a-z0-9-]+\.(?:com|net|org|io|co|in)(?:\b|\/))/i.test(value);
const safeSocialText = (maximum) => z.string().max(maximum).refine(
  (value) => !containsLink(value),
  'Links are not allowed in community text.'
);

const userImageUrlSchema = z.union([
  z.literal(''),
  z.string().url().refine((value) => {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      url.hostname === 'res.cloudinary.com' &&
      url.pathname.startsWith(`/${env.CLOUDINARY_CLOUD_NAME}/image/upload/`);
  }, 'Images must be uploaded through Clash Companion.')
]);

const publicPostSchema = z.object({
  playerTag: z.string().min(1),
  body: safeSocialText(2000).optional().default(''),
  imageUrl: userImageUrlSchema.optional().default(''),
  pollQuestion: z.string().max(160).optional().nullable(),
  pollOptions: z.array(z.string().min(1).max(80)).max(6).optional().default([]),
  hashtags: z.array(z.enum(socialHashtags)).max(5).optional().default([])
});

const commentSchema = z.object({
  playerTag: z.string().min(1),
  body: safeSocialText(500).refine((value) => value.trim().length > 0, 'Comment cannot be empty.')
});

const followSchema = z.object({
  followerTag: z.string().min(1),
  followingTag: z.string().min(1)
});

const reportSchema = z.object({
  playerTag: z.string().min(1),
  reason: z.string().max(300).optional().default('Reported from app')
});

const announcementReactionSchema = z.object({
  playerTag: tagSchema,
  reaction: z.enum(['like', 'love', 'laugh', 'wow', 'sad', 'support'])
});

const announcementVoteSchema = z.object({
  playerTag: tagSchema,
  optionIndex: z.coerce.number().int().min(0).max(5)
});

const postVoteSchema = z.object({
  playerTag: tagSchema,
  optionIndex: z.coerce.number().int().min(0).max(5)
});

const userBanSchema = z.object({
  days: z.coerce.number().int().min(1).max(3650).optional().nullable(),
  permanent: z.boolean().optional().default(false),
  reason: z.string().max(300).optional().default('')
});

function ensureKind(kind) {
  if (!kindSchemas[kind]) {
    throw new AppError('Unknown content type.', 404, true);
  }
}

function ensureAnnouncementPoll(value) {
  if (value.pollQuestion && (value.pollOptions ?? []).length < 2) {
    throw new AppError('A poll needs at least two options.', 400, true);
  }
  const hasLabel = Boolean(value.linkLabel?.trim());
  const hasUrl = Boolean(value.linkUrl?.trim());
  if (hasLabel !== hasUrl) {
    throw new AppError('Add both link button text and link URL, or leave both blank.', 400, true);
  }
}

function normalizeArmyName(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function toUuid(value) {
  const parsed = z.string().uuid().safeParse(value);
  if (!parsed.success) {
    throw new AppError('Invalid content id.', 400, true);
  }
  return parsed.data;
}

function mapLayout(row) {
  return {
    id: row.id,
    title: row.title,
    townHall: row.town_hall,
    description: row.description,
    imageUrl: row.image_url,
    layoutUrl: row.layout_url,
    published: row.published,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapAnnouncement(row) {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    imageUrl: row.image_url,
    linkLabel: row.link_label,
    linkUrl: row.link_url,
    pollQuestion: row.poll_question,
    pollOptions: row.poll_options ?? [],
    reactionCounts: row.reaction_counts ?? {},
    viewerReaction: row.viewer_reaction ?? null,
    pollResults: row.poll_results ?? [],
    viewerVote: row.viewer_vote == null ? null : Number(row.viewer_vote),
    published: row.published,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapStrategy(row) {
  const units = (value) =>
    (value ?? []).map((entry) =>
      typeof entry === 'string' ? { name: entry, count: 1 } : { name: entry.name, count: entry.count ?? 1 }
    );
  return {
    id: row.id,
    title: row.title,
    townHall: row.town_hall,
    troops: units(row.troops),
    spells: units(row.spells),
    clanCastle: units(row.clan_castle),
    heroes: units(row.heroes),
    heroLoadouts: (row.hero_loadouts ?? []).map((loadout) => ({
      hero: units([loadout.hero])[0],
      pet: units([loadout.pet])[0],
      equipment: units(loadout.equipment)
    })),
    armyLink: row.army_link ?? '',
    published: row.published,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPost(row) {
  const normalizedAuthorTag = String(row.player_tag ?? '').trim().toLowerCase();
  const isAdminPost =
    Boolean(row.is_admin_post) ||
    normalizedAuthorTag === 'admin' ||
    normalizedAuthorTag === 'official' ||
    normalizedAuthorTag === 'clash companion';

  return {
    id: row.id,
    playerTag: row.player_tag,
    playerName: row.player_name,
    playerAvatarUrl: row.player_avatar_url,
    playerClanName: row.player_clan_name,
    playerClanRole: row.player_clan_role,
    authorName: row.player_name,
    authorRole: row.player_tag,
    body: row.body,
    imageUrl: row.image_url,
    pollQuestion: row.poll_question,
    pollOptions: row.poll_options ?? [],
    pollResults: row.poll_results ?? [],
    viewerVote: row.viewer_vote == null ? null : Number(row.viewer_vote),
    hashtags: row.hashtags ?? [],
    likeCount: row.like_count,
    commentCount: row.comment_count,
    shareCount: row.share_count,
    isAdminPost,
    isFollowing: Boolean(row.is_following),
    isLiked: Boolean(row.is_liked),
    viewerLiked: Boolean(row.is_liked),
    followerCount: Number(row.follower_count ?? 0),
    followingCount: Number(row.following_count ?? 0),
    featured: row.featured,
    published: row.published,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapFollowPerson(row, prefix = '') {
  const tag = row[`${prefix}tag`];
  return {
    playerTag: tag,
    playerName: row[`${prefix}name`],
    playerAvatarUrl: row[`${prefix}avatar_url`],
    playerClanName: row[`${prefix}clan_name`],
    createdAt: row.created_at
  };
}

function mapNotification(row) {
  return {
    id: row.id,
    playerTag: row.player_tag,
    type: row.type,
    message: row.message,
    metadata: row.metadata ?? {},
    createdAt: row.created_at
  };
}

function mapComment(row) {
  return {
    id: row.id,
    postId: row.post_id,
    playerTag: row.player_tag,
    playerName: row.player_name,
    playerAvatarUrl: row.player_avatar_url ?? '',
    body: row.body,
    createdAt: row.created_at
  };
}

function mapReport(row) {
  return {
    id: row.id,
    postId: row.post_id,
    reporterTag: row.reporter_tag,
    reporterName: row.reporter_name,
    reason: row.reason,
    createdAt: row.created_at,
    post: row.post_id
      ? {
          id: row.post_id,
          playerTag: row.post_player_tag,
          playerName: row.post_player_name,
          playerAvatarUrl: row.post_player_avatar_url,
          playerClanName: row.post_player_clan_name,
          playerClanRole: row.post_player_clan_role,
          body: row.post_body,
          imageUrl: row.post_image_url,
          pollQuestion: row.post_poll_question,
          pollOptions: row.post_poll_options ?? [],
          hashtags: row.post_hashtags ?? [],
          likeCount: row.post_like_count,
          commentCount: row.post_comment_count,
          shareCount: row.post_share_count,
          featured: row.post_featured,
          published: row.post_published,
          createdAt: row.post_created_at,
          updatedAt: row.post_updated_at
        }
      : null
  };
}

function mapArmyItem(row) {
  return {
    id: row.id,
    name: row.name,
    normalizedName: row.normalized_name,
    category: row.category,
    village: row.village,
    imageUrl: row.image_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapHallAsset(row) {
  return {
    id: row.id,
    hallType: row.hall_type,
    level: row.level,
    imageUrl: row.image_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function playerIdentity(playerTag) {
  const normalizedTag = normalizeTag(playerTag);
  const existingUser = await pool.query(
    'select banned_until, ban_reason, banned_at from app_users where player_tag = $1',
    [normalizedTag]
  );
  const ban = existingUser.rows[0];
  if (ban?.banned_at && (!ban.banned_until || new Date(ban.banned_until).getTime() > Date.now())) {
    throw new AppError(
      ban.banned_until ? 'Account is temporarily banned.' : 'Account is permanently banned.',
      403,
      true,
      { ban: { bannedUntil: ban.banned_until, banReason: ban.ban_reason || '' } }
    );
  }
  const player = await clashService.getPlayer(normalizedTag);
  const leagueIcon =
    player.leagueTier?.iconUrls?.small ??
    player.leagueTier?.iconUrls?.large ??
    player.league?.iconUrls?.medium ??
    player.league?.iconUrls?.small ??
    null;
  let clanRole = null;
  if (player.clan?.tag) {
    try {
      const members = await clashService.getClanMembers(player.clan.tag);
      const member = members.find((entry) => normalizeTag(entry.tag) === normalizedTag);
      clanRole = member?.role ?? null;
    } catch {
      clanRole = null;
    }
  }
  return {
    playerTag: normalizedTag,
    playerName: String(player.name ?? normalizedTag),
    playerAvatarUrl: leagueIcon,
    playerClanName: player.clan?.name ?? null,
    playerClanRole: clanRole
  };
}

function authenticatedTag(req) {
  const candidate = req.body?.playerTag ?? req.query?.playerTag ?? req.auth?.playerTag;
  if (!candidate) {
    throw new AppError('Player tag is required.', 400, true);
  }
  return normalizeTag(candidate);
}

function optionalAuthenticatedTag(req) {
  const candidate = req.query?.viewerTag ?? req.query?.playerTag ?? req.body?.playerTag ?? req.auth?.playerTag;
  if (!candidate) {
    return null;
  }
  try {
    return normalizeTag(candidate);
  } catch {
    return null;
  }
}

async function appUserIdForTag(playerTag) {
  const normalizedTag = normalizeTag(playerTag);
  const existing = await pool.query(
    'select id, banned_until, ban_reason, banned_at from app_users where player_tag = $1',
    [normalizedTag]
  );
  const user = existing.rows[0];
  if (user) {
    if (user.banned_at && (!user.banned_until || new Date(user.banned_until).getTime() > Date.now())) {
      throw new AppError(user.ban_reason ? `This account is banned: ${user.ban_reason}` : 'This account is banned.', 403, true);
    }
    return user.id;
  }

  const inserted = await pool.query(
    `insert into app_users (player_tag, player_name)
     values ($1, $1)
     on conflict (player_tag) do update set updated_at = now()
     returning id`,
    [normalizedTag]
  );
  return inserted.rows[0].id;
}

async function followCounts(playerTag, viewerTag = null) {
  const values = [playerTag];
  const viewerIndex = viewerTag
    ? (() => {
        values.push(viewerTag);
        return values.length;
      })()
    : null;
  const result = await pool.query(
    `
    select
      (select count(*)::int from social_follows where following_tag = $1) as follower_count,
      (select count(*)::int from social_follows where follower_tag = $1) as following_count,
      ${viewerIndex ? `exists (
        select 1 from social_follows
        where follower_tag = $${viewerIndex}
          and following_tag = $1
      )` : 'false'} as is_following
    `,
    values
  );
  return {
    followerCount: Number(result.rows[0]?.follower_count ?? 0),
    followingCount: Number(result.rows[0]?.following_count ?? 0),
    isFollowing: Boolean(result.rows[0]?.is_following)
  };
}

export class ContentController {
  async listPublic(req, res, kind) {
    ensureKind(kind);
    const townHall = req.query.townHall ? String(req.query.townHall).toUpperCase() : null;
    const featuredOnly = kind === 'posts' && req.query.feed === 'featured';
    const followingOnly = kind === 'posts' && req.query.feed === 'following';
    const hashtag = kind === 'posts' && req.query.hashtag ? String(req.query.hashtag) : null;
    const limit = kind === 'posts'
      ? Math.max(1, Math.min(50, Number.parseInt(String(req.query.limit ?? '10'), 10) || 10))
      : null;
    const offset = kind === 'posts'
      ? Math.max(0, Number.parseInt(String(req.query.offset ?? '0'), 10) || 0)
      : null;

    if (kind === 'layouts') {
      const values = townHall ? [townHall] : [];
      const result = await pool.query(
        `
        select * from content_layouts
        where published = true ${townHall ? 'and town_hall = $1' : ''}
        order by created_at desc
        limit 100
        `,
        values
      );
      return res.json({ items: result.rows.map(mapLayout) });
    }

    if (kind === 'announcements') {
      const viewerTag = optionalAuthenticatedTag(req);
      const result = await pool.query(
        `
        select a.*,
          coalesce((select jsonb_object_agg(x.reaction, x.total) from (
            select reaction, count(*)::int as total from announcement_reactions
            where announcement_id = a.id group by reaction
          ) x), '{}'::jsonb) as reaction_counts,
          (select ar.reaction from announcement_reactions ar join app_users u on u.id = ar.user_id
            where ar.announcement_id = a.id and u.player_tag = $1) as viewer_reaction,
          coalesce((select jsonb_agg((select count(*)::int from announcement_poll_votes v where v.announcement_id = a.id and v.option_index = i) order by i)
            from generate_series(0, jsonb_array_length(a.poll_options) - 1) i), '[]'::jsonb) as poll_results,
          (select av.option_index from announcement_poll_votes av join app_users u on u.id = av.user_id
            where av.announcement_id = a.id and u.player_tag = $1) as viewer_vote
        from content_announcements a
        where a.published = true
        order by a.created_at desc
        limit 50
        `,
        [viewerTag]
      );
      return res.json({ items: result.rows.map(mapAnnouncement) });
    }

    if (kind === 'strategies') {
      const values = townHall ? [townHall] : [];
      const result = await pool.query(
        `
        select * from content_strategies
        where published = true ${townHall ? 'and town_hall = $1' : ''}
        order by created_at desc
        limit 100
        `,
        values
      );
      return res.json({ items: result.rows.map(mapStrategy) });
    }

    if (kind === 'army') {
      const category = req.query.category ? String(req.query.category) : null;
      const values = category ? [category] : [];
      const result = await pool.query(
        `
        select * from army_items
        ${category ? 'where category = $1' : ''}
        order by category asc, village asc, name asc
        `,
        values
      );
      return res.json({ items: result.rows.map(mapArmyItem) });
    }

    if (kind === 'halls') {
      const hallType = req.query.hallType ? String(req.query.hallType) : null;
      const values = hallType ? [hallType] : [];
      const result = await pool.query(
        `
        select * from hall_assets
        ${hallType ? 'where hall_type = $1' : ''}
        order by hall_type asc, level desc
        `,
        values
      );
      return res.json({ items: result.rows.map(mapHallAsset) });
    }

    const viewerTag = optionalAuthenticatedTag(req);
    const values = [];
    const filters = ['p.published = true'];
    if (featuredOnly) filters.push('p.featured = true');
    if (hashtag) {
      values.push(JSON.stringify([hashtag]));
      filters.push(`p.hashtags @> $${values.length}::jsonb`);
    }
    if (followingOnly) {
      if (!viewerTag) return res.json({ items: [] });
      values.push(viewerTag);
      filters.push(`exists (
        select 1 from social_follows sf
        where sf.follower_tag = $${values.length}
          and sf.following_tag = p.player_tag
      )`);
    }
    const viewerIndex = viewerTag
      ? (() => {
          values.push(viewerTag);
          return values.length;
        })()
      : null;
    const result = await pool.query(
      `
      select p.*,
        ${viewerIndex ? `exists (
          select 1 from social_follows sf
          where sf.follower_tag = $${viewerIndex}
            and sf.following_tag = p.player_tag
        )` : 'false'} as is_following,
        ${viewerIndex ? `exists (
          select 1 from social_post_likes spl
          where spl.post_id = p.id
            and spl.player_tag = $${viewerIndex}
        )` : 'false'} as is_liked,
        ${`case
          when jsonb_array_length(p.poll_options) = 0 then '[]'::jsonb
          else (
            select jsonb_agg(
              (select count(*)::int from social_post_poll_votes sppv where sppv.post_id = p.id and sppv.option_index = i)
              order by i
            )
            from generate_series(0, jsonb_array_length(p.poll_options) - 1) i
          )
        end`} as poll_results,
        ${viewerIndex ? `(select sppv.option_index from social_post_poll_votes sppv
          where sppv.post_id = p.id and sppv.player_tag = $${viewerIndex})` : 'null'} as viewer_vote,
        (select count(*)::int from social_follows sf where sf.following_tag = p.player_tag) as follower_count,
        (select count(*)::int from social_follows sf where sf.follower_tag = p.player_tag) as following_count
      from social_posts p
      where ${filters.join(' and ')}
      order by p.created_at desc
      limit ${limit}
      offset ${offset}
      `,
      values
    );
    return res.json({ items: result.rows.map(mapPost) });
  }

  async listAdmin(req, res) {
    const kind = String(req.params.kind);
    if (kind === 'reports') {
      const result = await pool.query(
        `
        select
          r.*,
          p.id as post_id,
          p.player_tag as post_player_tag,
          p.player_name as post_player_name,
          p.player_avatar_url as post_player_avatar_url,
          p.player_clan_name as post_player_clan_name,
          p.player_clan_role as post_player_clan_role,
          p.body as post_body,
          p.image_url as post_image_url,
          p.poll_question as post_poll_question,
          p.poll_options as post_poll_options,
          p.hashtags as post_hashtags,
          p.like_count as post_like_count,
          p.comment_count as post_comment_count,
          p.share_count as post_share_count,
          p.featured as post_featured,
          p.published as post_published,
          p.created_at as post_created_at,
          p.updated_at as post_updated_at
        from social_post_reports r
        left join social_posts p on p.id = r.post_id
        order by r.created_at desc
        limit 200
        `
      );
      return res.json({ items: result.rows.map(mapReport) });
    }
    if (kind === 'users') {
      const result = await pool.query(`
        select u.*,
          (select max(created_at) from auth_audit_logs where player_tag = u.player_tag and success = true) as last_login_at,
          (select max(coalesce(last_used_at, created_at)) from app_sessions where user_id = u.id) as last_active_at,
          (select count(*)::int from app_sessions where user_id = u.id) as session_count,
          (select count(*)::int from app_sessions where user_id = u.id and revoked_at is null and expires_at > now()) as active_session_count,
          (select count(*)::int from auth_audit_logs where player_tag = u.player_tag and success = false) as failed_login_count,
          (select device_info from app_sessions where user_id = u.id order by coalesce(last_used_at, created_at) desc limit 1) as latest_device
        from app_users u order by coalesce(
          (select max(created_at) from auth_audit_logs where player_tag = u.player_tag and success = true),
          u.created_at
        ) desc limit 1000
      `);
      return res.json({ items: result.rows.map((row) => ({
        id: row.id, playerTag: row.player_tag, playerName: row.player_name,
        clanTag: row.clan_tag, clanName: row.clan_name, avatarUrl: row.avatar_url,
        bannedUntil: row.banned_until, banReason: row.ban_reason, bannedAt: row.banned_at,
        isBanned: Boolean(row.banned_at && (!row.banned_until || new Date(row.banned_until).getTime() > Date.now())),
        createdAt: row.created_at, updatedAt: row.updated_at,
        lastLoginAt: row.last_login_at, lastActiveAt: row.last_active_at,
        sessionCount: Number(row.session_count ?? 0), activeSessionCount: Number(row.active_session_count ?? 0),
        failedLoginCount: Number(row.failed_login_count ?? 0), latestDevice: row.latest_device
      })) });
    }
    ensureKind(kind);

    if (kind === 'layouts') {
      const result = await pool.query('select * from content_layouts order by created_at desc');
      return res.json({ items: result.rows.map(mapLayout) });
    }

    if (kind === 'announcements') {
      const result = await pool.query(`select a.*,
        coalesce((select jsonb_object_agg(x.reaction, x.total) from (select reaction, count(*)::int total from announcement_reactions where announcement_id = a.id group by reaction) x), '{}'::jsonb) reaction_counts,
        coalesce((select jsonb_agg((select count(*)::int from announcement_poll_votes v where v.announcement_id = a.id and v.option_index = i) order by i)
          from generate_series(0, jsonb_array_length(a.poll_options) - 1) i), '[]'::jsonb) poll_results
        from content_announcements a order by a.created_at desc`);
      return res.json({ items: result.rows.map(mapAnnouncement) });
    }

    if (kind === 'strategies') {
      const result = await pool.query('select * from content_strategies order by created_at desc');
      return res.json({ items: result.rows.map(mapStrategy) });
    }

    if (kind === 'army') {
      const result = await pool.query(
        'select * from army_items order by category asc, village asc, name asc'
      );
      return res.json({ items: result.rows.map(mapArmyItem) });
    }

    if (kind === 'halls') {
      const result = await pool.query(
        'select * from hall_assets order by hall_type asc, level desc'
      );
      return res.json({ items: result.rows.map(mapHallAsset) });
    }

    const result = await pool.query('select * from social_posts order by created_at desc');
    return res.json({ items: result.rows.map(mapPost) });
  }

  async create(req, res) {
    const kind = String(req.params.kind);
    ensureKind(kind);
    const payload = kindSchemas[kind].parse(req.body);

    if (kind === 'layouts') {
      const result = await pool.query(
        `
        insert into content_layouts (title, town_hall, description, image_url, layout_url, published)
        values ($1, $2, $3, $4, $5, $6)
        returning *
        `,
        [
          payload.title,
          payload.townHall,
          payload.description,
          payload.imageUrl,
          payload.layoutUrl,
          payload.published
        ]
      );
      return res.status(201).json(mapLayout(result.rows[0]));
    }

    if (kind === 'announcements') {
      ensureAnnouncementPoll(payload);
      const result = await pool.query(
        `
        insert into content_announcements (title, message, image_url, link_label, link_url, poll_question, poll_options, published)
        values ($1, $2, $3, $4, $5, $6, $7, $8)
        returning *
        `,
        [
          payload.title,
          payload.message,
          payload.imageUrl,
          payload.linkLabel,
          payload.linkUrl,
          payload.pollQuestion || null,
          JSON.stringify(payload.pollOptions),
          payload.published
        ]
      );
      return res.status(201).json(mapAnnouncement(result.rows[0]));
    }

    if (kind === 'strategies') {
      const result = await pool.query(
        `
        insert into content_strategies
          (title, town_hall, troops, spells, clan_castle, heroes, hero_loadouts, army_link, published)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        returning *
        `,
        [
          payload.title,
          payload.townHall,
          JSON.stringify(payload.troops),
          JSON.stringify(payload.spells),
          JSON.stringify(payload.clanCastle),
          JSON.stringify(payload.heroes),
          JSON.stringify(payload.heroLoadouts),
          payload.armyLink,
          payload.published
        ]
      );
      return res.status(201).json(mapStrategy(result.rows[0]));
    }

    if (kind === 'army') {
      const result = await pool.query(
        `
        insert into army_items (name, normalized_name, category, village, image_url)
        values ($1, $2, $3, $4, $5)
        on conflict (normalized_name, category, village)
        do update set
          name = excluded.name,
          image_url = excluded.image_url,
          updated_at = now()
        returning *
        `,
        [
          payload.name,
          normalizeArmyName(payload.name),
          payload.category,
          payload.village,
          payload.imageUrl
        ]
      );
      return res.status(201).json(mapArmyItem(result.rows[0]));
    }

    if (kind === 'halls') {
      const result = await pool.query(
        `
        insert into hall_assets (hall_type, level, image_url)
        values ($1, $2, $3)
        on conflict (hall_type, level)
        do update set
          image_url = excluded.image_url,
          updated_at = now()
        returning *
        `,
        [payload.hallType, payload.level, payload.imageUrl]
      );
      return res.status(201).json(mapHallAsset(result.rows[0]));
    }

    const identity = payload.playerTag
      ? await playerIdentity(payload.playerTag)
      : {
          playerTag: payload.authorRole ?? 'admin',
          playerName: payload.authorName ?? 'Clash Companion',
          playerAvatarUrl: null,
          playerClanName: null,
          playerClanRole: null
        };
    const result = await pool.query(
      `
      insert into social_posts
        (player_tag, player_name, player_avatar_url, player_clan_name, player_clan_role, body, image_url, poll_question, poll_options, hashtags, is_admin_post, featured, published)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $11, $12)
      returning *
      `,
      [
        identity.playerTag,
        identity.playerName,
        identity.playerAvatarUrl,
        identity.playerClanName,
        identity.playerClanRole,
        payload.body,
        payload.imageUrl,
        payload.pollQuestion ?? null,
        JSON.stringify(payload.pollOptions),
        JSON.stringify(payload.hashtags),
        payload.featured,
        payload.published
      ]
    );
    return res.status(201).json(mapPost(result.rows[0]));
  }

  async createPublicPost(req, res) {
    const payload = publicPostSchema.parse(req.body);
    const identity = await playerIdentity(payload.playerTag);
    const result = await pool.query(
      `
      insert into social_posts
        (player_tag, player_name, player_avatar_url, player_clan_name, player_clan_role, body, image_url, poll_question, poll_options, hashtags, published)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
      returning *
      `,
      [
        identity.playerTag,
        identity.playerName,
        identity.playerAvatarUrl,
        identity.playerClanName,
        identity.playerClanRole,
        payload.body,
        payload.imageUrl,
        payload.pollQuestion ?? null,
        JSON.stringify(payload.pollOptions),
        JSON.stringify(payload.hashtags)
      ]
    );
    return res.status(201).json(mapPost(result.rows[0]));
  }

  async update(req, res) {
    const kind = String(req.params.kind);
    ensureKind(kind);
    const id = toUuid(req.params.id);
    const payload = kindSchemas[kind].partial().parse(req.body);

    if (kind === 'layouts') {
      const current = await pool.query('select * from content_layouts where id = $1', [id]);
      if (!current.rows[0]) throw new AppError('Content not found.', 404, true);
      const next = { ...mapLayout(current.rows[0]), ...payload };
      const result = await pool.query(
        `
        update content_layouts
        set title = $2, town_hall = $3, description = $4, image_url = $5,
            layout_url = $6, published = $7, updated_at = now()
        where id = $1
        returning *
        `,
        [
          id,
          next.title,
          next.townHall,
          next.description,
          next.imageUrl,
          next.layoutUrl,
          next.published
        ]
      );
      return res.json(mapLayout(result.rows[0]));
    }

    if (kind === 'announcements') {
      const current = await pool.query('select * from content_announcements where id = $1', [id]);
      if (!current.rows[0]) throw new AppError('Content not found.', 404, true);
      const next = { ...mapAnnouncement(current.rows[0]), ...payload };
      ensureAnnouncementPoll(next);
      const result = await pool.query(
        `
        update content_announcements
        set title = $2, message = $3, image_url = $4, link_label = $5,
            link_url = $6, poll_question = $7, poll_options = $8, published = $9, updated_at = now()
        where id = $1
        returning *
        `,
        [
          id,
          next.title,
          next.message,
          next.imageUrl,
          next.linkLabel,
          next.linkUrl,
          next.pollQuestion || null,
          JSON.stringify(next.pollOptions ?? []),
          next.published
        ]
      );
      return res.json(mapAnnouncement(result.rows[0]));
    }

    if (kind === 'strategies') {
      const current = await pool.query('select * from content_strategies where id = $1', [id]);
      if (!current.rows[0]) throw new AppError('Content not found.', 404, true);
      const next = { ...mapStrategy(current.rows[0]), ...payload };
      const result = await pool.query(
        `
        update content_strategies
        set title = $2, town_hall = $3, troops = $4, spells = $5,
            clan_castle = $6, heroes = $7, hero_loadouts = $8,
            army_link = $9, published = $10, updated_at = now()
        where id = $1
        returning *
        `,
        [
          id,
          next.title,
          next.townHall,
          JSON.stringify(next.troops),
          JSON.stringify(next.spells),
          JSON.stringify(next.clanCastle),
          JSON.stringify(next.heroes),
          JSON.stringify(next.heroLoadouts),
          next.armyLink,
          next.published
        ]
      );
      return res.json(mapStrategy(result.rows[0]));
    }

    if (kind === 'army') {
      const current = await pool.query('select * from army_items where id = $1', [id]);
      if (!current.rows[0]) throw new AppError('Content not found.', 404, true);
      const next = { ...mapArmyItem(current.rows[0]), ...payload };
      const result = await pool.query(
        `
        update army_items
        set name = $2, normalized_name = $3, category = $4, village = $5,
            image_url = $6, updated_at = now()
        where id = $1
        returning *
        `,
        [
          id,
          next.name,
          normalizeArmyName(next.name),
          next.category,
          next.village,
          next.imageUrl
        ]
      );
      return res.json(mapArmyItem(result.rows[0]));
    }

    if (kind === 'halls') {
      const current = await pool.query('select * from hall_assets where id = $1', [id]);
      if (!current.rows[0]) throw new AppError('Content not found.', 404, true);
      const next = { ...mapHallAsset(current.rows[0]), ...payload };
      const result = await pool.query(
        `
        update hall_assets
        set hall_type = $2, level = $3, image_url = $4, updated_at = now()
        where id = $1
        returning *
        `,
        [id, next.hallType, next.level, next.imageUrl]
      );
      return res.json(mapHallAsset(result.rows[0]));
    }

    throw new AppError('Post updates are not supported from this route yet.', 400, true);
  }

  async reactToAnnouncement(req, res) {
    const announcementId = toUuid(req.params.id);
    const { playerTag, reaction } = announcementReactionSchema.parse(req.body);
    const userId = await appUserIdForTag(playerTag);
    const existing = await pool.query(
      'select reaction from announcement_reactions where announcement_id = $1 and user_id = $2',
      [announcementId, userId]
    );
    if (existing.rows[0]?.reaction === reaction) {
      await pool.query('delete from announcement_reactions where announcement_id = $1 and user_id = $2', [announcementId, userId]);
    } else {
      await pool.query(`insert into announcement_reactions (announcement_id, user_id, reaction)
        values ($1, $2, $3) on conflict (announcement_id, user_id)
        do update set reaction = excluded.reaction, updated_at = now()`, [announcementId, userId, reaction]);
    }
    return res.json({ success: true });
  }

  async voteAnnouncementPoll(req, res) {
    const announcementId = toUuid(req.params.id);
    const { playerTag, optionIndex } = announcementVoteSchema.parse(req.body);
    const userId = await appUserIdForTag(playerTag);
    const announcement = await pool.query('select poll_options from content_announcements where id = $1 and published = true', [announcementId]);
    if (!announcement.rows[0]) throw new AppError('Announcement not found.', 404, true);
    if (optionIndex >= (announcement.rows[0].poll_options ?? []).length) throw new AppError('Invalid poll option.', 400, true);
    await pool.query(`insert into announcement_poll_votes (announcement_id, user_id, option_index)
      values ($1, $2, $3) on conflict (announcement_id, user_id)
      do update set option_index = excluded.option_index, updated_at = now()`, [announcementId, userId, optionIndex]);
    return res.json({ success: true });
  }

  async votePostPoll(req, res) {
    const postId = toUuid(req.params.id);
    const { playerTag, optionIndex } = postVoteSchema.parse(req.body);
    const post = await pool.query('select poll_options from social_posts where id = $1 and published = true', [postId]);
    if (!post.rows[0]) throw new AppError('Post not found.', 404, true);
    if (optionIndex >= (post.rows[0].poll_options ?? []).length) {
      throw new AppError('Invalid poll option.', 400, true);
    }
    await pool.query(
      `insert into social_post_poll_votes (post_id, player_tag, option_index)
       values ($1, $2, $3)
       on conflict (post_id, player_tag)
       do update set option_index = excluded.option_index, updated_at = now()`,
      [postId, playerTag, optionIndex]
    );
    return res.json({ success: true });
  }

  async banUser(req, res) {
    const id = toUuid(req.params.id);
    const payload = userBanSchema.parse(req.body);
    const bannedUntil = payload.permanent
      ? null
      : new Date(Date.now() + Number(payload.days ?? 1) * 24 * 60 * 60 * 1000);
    const result = await pool.query(
      `update app_users
       set banned_until = $2, ban_reason = $3, banned_at = now(), updated_at = now()
       where id = $1
       returning id, player_tag, player_name, banned_until, ban_reason, banned_at`,
      [id, bannedUntil, payload.reason || 'Banned by admin.']
    );
    if (!result.rows[0]) throw new AppError('User not found.', 404, true);
    await pool.query('update app_sessions set revoked_at = now() where user_id = $1 and revoked_at is null', [id]);
    return res.json({
      id: result.rows[0].id,
      playerTag: result.rows[0].player_tag,
      playerName: result.rows[0].player_name,
      bannedUntil: result.rows[0].banned_until,
      banReason: result.rows[0].ban_reason,
      bannedAt: result.rows[0].banned_at,
      isBanned: true
    });
  }

  async unbanUser(req, res) {
    const id = toUuid(req.params.id);
    const result = await pool.query(
      `update app_users
       set banned_until = null, ban_reason = '', banned_at = null, updated_at = now()
       where id = $1
       returning id, player_tag, player_name`,
      [id]
    );
    if (!result.rows[0]) throw new AppError('User not found.', 404, true);
    return res.json({
      id: result.rows[0].id,
      playerTag: result.rows[0].player_tag,
      playerName: result.rows[0].player_name,
      isBanned: false
    });
  }

  async remove(req, res) {
    const kind = String(req.params.kind);
    if (kind === 'reports') {
      const id = toUuid(req.params.id);
      await pool.query('delete from social_post_reports where id = $1', [id]);
      return res.status(204).send();
    }
    ensureKind(kind);
    const id = toUuid(req.params.id);
    const table =
      kind === 'layouts'
        ? 'content_layouts'
        : kind === 'announcements'
          ? 'content_announcements'
          : kind === 'strategies'
            ? 'content_strategies'
            : kind === 'army'
              ? 'army_items'
              : kind === 'halls'
                ? 'hall_assets'
                : 'social_posts';
    if (kind === 'posts') {
      const current = await pool.query('select * from social_posts where id = $1', [id]);
      if (current.rows[0]) {
        await pool.query(
          `
          insert into social_notifications (player_tag, type, message, metadata)
          values ($1, 'post_deleted', $2, $3)
          `,
          [
            current.rows[0].player_tag,
            'Your post was removed by an admin because it did not follow community rules.',
            JSON.stringify({ postId: id, body: current.rows[0].body ?? '' })
          ]
        );
      }
    }
    await pool.query(`delete from ${table} where id = $1`, [id]);
    return res.status(204).send();
  }

  async notifications(req, res) {
    const playerTag = authenticatedTag(req);
    const result = await pool.query(
      `
      select * from social_notifications
      where player_tag is null or player_tag = $1
      order by created_at desc
      limit 30
      `,
      [playerTag]
    );
    return res.json({ items: result.rows.map(mapNotification) });
  }

  async upload(req, res) {
    const payload = uploadSchema.parse(req.body);
    const result = await cloudinaryService.uploadDataUrl({
      ...payload,
      folder: payload.folder ?? 'clash-companion/social'
    });
    return res.status(201).json(result);
  }

  async like(req, res) {
    const postId = toUuid(req.params.id);
    const playerTag = authenticatedTag(req);
    await appUserIdForTag(playerTag);
    const existing = await pool.query(
      `
      select 1 from social_post_likes
      where post_id = $1 and player_tag = $2
      `,
      [postId, playerTag]
    );
    const isLiked = existing.rowCount === 0;
    if (isLiked) {
      await pool.query(
        `
        insert into social_post_likes (post_id, player_tag)
        values ($1, $2)
        on conflict do nothing
        `,
        [postId, playerTag]
      );
    } else {
      await pool.query(
        `
        delete from social_post_likes
        where post_id = $1 and player_tag = $2
        `,
        [postId, playerTag]
      );
    }
    const result = await pool.query(
      `
      update social_posts
      set like_count = (select count(*)::int from social_post_likes where post_id = $1)
      where id = $1
      returning like_count
      `,
      [postId]
    );
    return res.json({
      likeCount: result.rows[0]?.like_count ?? 0,
      isLiked
    });
  }

  async follow(req, res) {
    const payload = followSchema.parse(req.body);
    const follower = await playerIdentity(payload.followerTag);
    const following = await playerIdentity(payload.followingTag);
    if (follower.playerTag === following.playerTag) {
      throw new AppError('You cannot follow yourself.', 400, true);
    }

    await pool.query(
      `
      insert into social_follows
        (follower_tag, following_tag, follower_name, follower_avatar_url,
         follower_clan_name, following_name, following_avatar_url, following_clan_name)
      values ($1, $2, $3, $4, $5, $6, $7, $8)
      on conflict (follower_tag, following_tag)
      do update set
        follower_name = excluded.follower_name,
        follower_avatar_url = excluded.follower_avatar_url,
        follower_clan_name = excluded.follower_clan_name,
        following_name = excluded.following_name,
        following_avatar_url = excluded.following_avatar_url,
        following_clan_name = excluded.following_clan_name
      `,
      [
        follower.playerTag,
        following.playerTag,
        follower.playerName,
        follower.playerAvatarUrl,
        follower.playerClanName,
        following.playerName,
        following.playerAvatarUrl,
        following.playerClanName
      ]
    );

    const counts = await followCounts(following.playerTag, follower.playerTag);
    return res.status(201).json({ ...counts, isFollowing: true });
  }

  async unfollow(req, res) {
    const payload = followSchema.parse(req.body);
    const followerTag = normalizeTag(payload.followerTag);
    const followingTag = normalizeTag(payload.followingTag);
    await pool.query(
      'delete from social_follows where follower_tag = $1 and following_tag = $2',
      [followerTag, followingTag]
    );
    const counts = await followCounts(followingTag, followerTag);
    return res.json({ ...counts, isFollowing: false });
  }

  async followCounts(req, res) {
    const playerTag = normalizeTag(String(req.query.playerTag ?? ''));
    const viewerTag = optionalAuthenticatedTag(req);
    const counts = await followCounts(playerTag, viewerTag);
    return res.json(counts);
  }

  async followList(req, res) {
    const type = String(req.params.type);
    if (!['followers', 'following'].includes(type)) {
      throw new AppError('Unknown follow list.', 404, true);
    }
    const playerTag = normalizeTag(String(req.query.playerTag ?? ''));
    const search = String(req.query.search ?? '').trim().toLowerCase();
    const values = [playerTag];
    const searchSql = search
      ? (() => {
          values.push(`%${search}%`);
          return `and (
            lower(${type === 'followers' ? 'follower_name' : 'following_name'}) like $${values.length}
            or lower(${type === 'followers' ? 'follower_tag' : 'following_tag'}) like $${values.length}
          )`;
        })()
      : '';
    const result = await pool.query(
      `
      select
        ${type === 'followers' ? 'follower_tag' : 'following_tag'} as tag,
        ${type === 'followers' ? 'follower_name' : 'following_name'} as name,
        ${type === 'followers' ? 'follower_avatar_url' : 'following_avatar_url'} as avatar_url,
        ${type === 'followers' ? 'follower_clan_name' : 'following_clan_name'} as clan_name,
        created_at
      from social_follows
      where ${type === 'followers' ? 'following_tag' : 'follower_tag'} = $1
      ${searchSql}
      order by created_at desc
      limit 100
      `,
      values
    );
    return res.json({ items: result.rows.map((row) => mapFollowPerson(row)) });
  }

  async comment(req, res) {
    const postId = toUuid(req.params.id);
    const payload = commentSchema.parse(req.body);
    const identity = await playerIdentity(payload.playerTag);
    const comment = await pool.query(
      `
      insert into social_post_comments (post_id, player_tag, player_name, body)
      values ($1, $2, $3, $4)
      returning
        id,
        post_id,
        player_tag,
        player_name,
        body,
        created_at,
        $5::text as player_avatar_url
      `,
      [
        postId,
        identity.playerTag,
        identity.playerName,
        payload.body,
        identity.playerAvatarUrl ?? ''
      ]
    );
    await pool.query(
      `
      update social_posts
      set comment_count = (select count(*)::int from social_post_comments where post_id = $1)
      where id = $1
      `,
      [postId]
    );
    return res.status(201).json(mapComment(comment.rows[0]));
  }

  async report(req, res) {
    const postId = toUuid(req.params.id);
    const payload = reportSchema.parse(req.body);
    const identity = await playerIdentity(payload.playerTag);
    const post = await pool.query(
      'select id from social_posts where id = $1 and published = true',
      [postId]
    );
    if (!post.rows[0]) {
      throw new AppError('Post not found.', 404, true);
    }

    const result = await pool.query(
      `
      insert into social_post_reports (post_id, reporter_tag, reporter_name, reason)
      values ($1, $2, $3, $4)
      on conflict (post_id, reporter_tag)
      do update set
        reporter_name = excluded.reporter_name,
        reason = excluded.reason,
        created_at = now()
      returning *
      `,
      [postId, identity.playerTag, identity.playerName, payload.reason]
    );
    return res.status(201).json({
      message: 'Thanks for reporting this post.',
      report: mapReport(result.rows[0])
    });
  }

  async comments(req, res) {
    const postId = toUuid(req.params.id);
    const result = await pool.query(
      `
      select
        c.*,
        coalesce(u.avatar_url, '') as player_avatar_url
      from social_post_comments c
      left join app_users u on u.player_tag = c.player_tag
      where c.post_id = $1
      order by c.created_at asc
      limit 100
      `,
      [postId]
    );
    return res.json({ items: result.rows.map(mapComment) });
  }

  async playerIdentity(req, res) {
    const playerTag = normalizeTag(String(req.params.playerTag ?? ''));
    const user = await userRepository.getByPlayerTag(playerTag);
    return res.json({
      playerTag,
      playerName: user?.player_name ?? '',
      clanTag: user?.clan_tag ?? '',
      clanName: user?.clan_name ?? '',
      playerAvatarUrl: user?.avatar_url ?? ''
    });
  }

  async share(req, res) {
    const postId = toUuid(req.params.id);
    const playerTag = authenticatedTag(req);
    await appUserIdForTag(playerTag);
    await pool.query(
      `insert into social_post_shares (post_id, player_tag)
       values ($1, $2) on conflict do nothing`,
      [postId, playerTag]
    );
    const result = await pool.query(
      `
      update social_posts
      set share_count = (select count(*)::int from social_post_shares where post_id = $1)
      where id = $1
      returning share_count
      `,
      [postId]
    );
    return res.json({ shareCount: result.rows[0]?.share_count ?? 0 });
  }
}

export const contentController = new ContentController();
