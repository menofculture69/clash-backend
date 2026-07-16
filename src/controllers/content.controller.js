import { z } from 'zod';

import { pool } from '../config/database.js';
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
  'Trophies',
  'Town Hall Level',
  'Donation',
  'Clan Capital Contribution',
  'War Stars'
];
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
const kindSchemas = {
  layouts: z.object({
    title: z.string().min(3).max(120),
    townHall: z.enum(townHalls),
    description: z.string().max(500).optional().default(''),
    imageUrl: z.string().url().optional().default(''),
    layoutUrl: z.string().url(),
    published: z.boolean().optional().default(true)
  }),
  strategies: z.object({
    title: z.string().min(3).max(120),
    townHall: z.enum(townHalls),
    troops: z.array(strategyUnitSchema).optional().default([]),
    spells: z.array(strategyUnitSchema).optional().default([]),
    clanCastle: z.array(strategyUnitSchema).optional().default([]),
    heroes: z.array(strategyUnitSchema).optional().default([]),
    heroLoadouts: z.array(heroLoadoutSchema).max(4).optional().default([]),
    published: z.boolean().optional().default(true)
  }),
  posts: z.object({
    playerTag: z.string().min(1).optional(),
    authorName: z.string().min(2).max(60).optional(),
    authorRole: z.string().max(60).optional(),
    body: z.string().max(2000).optional().default(''),
    imageUrl: z.string().url().optional().default(''),
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
  })
};

const uploadSchema = z.object({
  dataUrl: z.string().min(1),
  folder: z.string().min(1).max(80).optional()
});

const publicPostSchema = z.object({
  playerTag: z.string().min(1),
  body: z.string().max(2000).optional().default(''),
  imageUrl: z.string().url().optional().default(''),
  pollQuestion: z.string().max(160).optional().nullable(),
  pollOptions: z.array(z.string().min(1).max(80)).max(6).optional().default([]),
  hashtags: z.array(z.enum(socialHashtags)).max(5).optional().default([])
});

const commentSchema = z.object({
  playerTag: z.string().min(1),
  body: z.string().min(1).max(500)
});

function ensureKind(kind) {
  if (!kindSchemas[kind]) {
    throw new AppError('Unknown content type.', 404, true);
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
    published: row.published,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPost(row) {
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
    hashtags: row.hashtags ?? [],
    likeCount: row.like_count,
    commentCount: row.comment_count,
    shareCount: row.share_count,
    featured: row.featured,
    published: row.published,
    createdAt: row.created_at,
    updatedAt: row.updated_at
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
    body: row.body,
    createdAt: row.created_at
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

async function playerIdentity(playerTag) {
  const normalizedTag = normalizeTag(playerTag);
  const player = await clashService.getPlayer(normalizedTag);
  const leagueIcon = player.league?.iconUrls?.medium ?? player.league?.iconUrls?.small ?? null;
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

export class ContentController {
  async listPublic(req, res, kind) {
    ensureKind(kind);
    const townHall = req.query.townHall ? String(req.query.townHall).toUpperCase() : null;
    const featuredOnly = kind === 'posts' && req.query.feed === 'featured';
    const hashtag = kind === 'posts' && req.query.hashtag ? String(req.query.hashtag) : null;

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

    const result = await pool.query(
      `
      select * from social_posts
      where published = true ${featuredOnly ? 'and featured = true' : ''}
        ${hashtag ? "and hashtags @> $1::jsonb" : ''}
      order by created_at desc
      limit 100
      `,
      hashtag ? [JSON.stringify([hashtag])] : []
    );
    return res.json({ items: result.rows.map(mapPost) });
  }

  async listAdmin(req, res) {
    const kind = String(req.params.kind);
    ensureKind(kind);

    if (kind === 'layouts') {
      const result = await pool.query('select * from content_layouts order by created_at desc');
      return res.json({ items: result.rows.map(mapLayout) });
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

    if (kind === 'strategies') {
      const result = await pool.query(
        `
        insert into content_strategies
          (title, town_hall, troops, spells, clan_castle, heroes, hero_loadouts, published)
        values ($1, $2, $3, $4, $5, $6, $7, $8)
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
        (player_tag, player_name, player_avatar_url, player_clan_name, player_clan_role, body, image_url, poll_question, poll_options, hashtags, featured, published)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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

    if (kind === 'strategies') {
      const current = await pool.query('select * from content_strategies where id = $1', [id]);
      if (!current.rows[0]) throw new AppError('Content not found.', 404, true);
      const next = { ...mapStrategy(current.rows[0]), ...payload };
      const result = await pool.query(
        `
        update content_strategies
        set title = $2, town_hall = $3, troops = $4, spells = $5,
            clan_castle = $6, heroes = $7, hero_loadouts = $8,
            published = $9, updated_at = now()
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

    throw new AppError('Post updates are not supported from this route yet.', 400, true);
  }

  async remove(req, res) {
    const kind = String(req.params.kind);
    ensureKind(kind);
    const id = toUuid(req.params.id);
    const table =
      kind === 'layouts'
        ? 'content_layouts'
        : kind === 'strategies'
          ? 'content_strategies'
          : kind === 'army'
            ? 'army_items'
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
    const playerTag = req.query.playerTag ? normalizeTag(String(req.query.playerTag)) : null;
    const result = await pool.query(
      `
      select * from social_notifications
      where player_tag is null ${playerTag ? 'or player_tag = $1' : ''}
      order by created_at desc
      limit 30
      `,
      playerTag ? [playerTag] : []
    );
    return res.json({ items: result.rows.map(mapNotification) });
  }

  async upload(req, res) {
    const payload = uploadSchema.parse(req.body);
    const result = await cloudinaryService.uploadDataUrl(payload);
    return res.status(201).json(result);
  }

  async like(req, res) {
    const postId = toUuid(req.params.id);
    const playerTag = normalizeTag(String(req.body.playerTag ?? ''));
    await pool.query(
      `
      insert into social_post_likes (post_id, player_tag)
      values ($1, $2)
      on conflict do nothing
      `,
      [postId, playerTag]
    );
    const result = await pool.query(
      `
      update social_posts
      set like_count = (select count(*)::int from social_post_likes where post_id = $1)
      where id = $1
      returning like_count
      `,
      [postId]
    );
    return res.json({ likeCount: result.rows[0]?.like_count ?? 0 });
  }

  async comment(req, res) {
    const postId = toUuid(req.params.id);
    const payload = commentSchema.parse(req.body);
    const identity = await playerIdentity(payload.playerTag);
    const comment = await pool.query(
      `
      insert into social_post_comments (post_id, player_tag, player_name, body)
      values ($1, $2, $3, $4)
      returning *
      `,
      [postId, identity.playerTag, identity.playerName, payload.body]
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

  async comments(req, res) {
    const postId = toUuid(req.params.id);
    const result = await pool.query(
      `
      select * from social_post_comments
      where post_id = $1
      order by created_at asc
      limit 100
      `,
      [postId]
    );
    return res.json({ items: result.rows.map(mapComment) });
  }

  async share(req, res) {
    const postId = toUuid(req.params.id);
    const result = await pool.query(
      `
      update social_posts
      set share_count = share_count + 1
      where id = $1
      returning share_count
      `,
      [postId]
    );
    return res.json({ shareCount: result.rows[0]?.share_count ?? 0 });
  }
}

export const contentController = new ContentController();
