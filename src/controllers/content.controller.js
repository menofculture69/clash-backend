import { z } from 'zod';

import { pool } from '../config/database.js';
import { cloudinaryService } from '../services/cloudinary.service.js';
import { clashService } from '../services/clash.service.js';
import { AppError } from '../utils/errors.js';
import { normalizeTag } from '../utils/tag.js';

const townHalls = ['TH18', 'TH17', 'TH16', 'TH15'];
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
    troops: z.array(z.string()).optional().default([]),
    spells: z.array(z.string()).optional().default([]),
    clanCastle: z.array(z.string()).optional().default([]),
    heroes: z.array(z.string()).optional().default([]),
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
    published: z.boolean().optional().default(true),
    featured: z.boolean().optional().default(false)
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
  pollOptions: z.array(z.string().min(1).max(80)).max(6).optional().default([])
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
  return {
    id: row.id,
    title: row.title,
    townHall: row.town_hall,
    troops: row.troops ?? [],
    spells: row.spells ?? [],
    clanCastle: row.clan_castle ?? [],
    heroes: row.heroes ?? [],
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
    authorName: row.player_name,
    authorRole: row.player_tag,
    body: row.body,
    imageUrl: row.image_url,
    pollQuestion: row.poll_question,
    pollOptions: row.poll_options ?? [],
    likeCount: row.like_count,
    commentCount: row.comment_count,
    shareCount: row.share_count,
    featured: row.featured,
    published: row.published,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function playerIdentity(playerTag) {
  const normalizedTag = normalizeTag(playerTag);
  const player = await clashService.getPlayer(normalizedTag);
  const leagueIcon = player.league?.iconUrls?.medium ?? player.league?.iconUrls?.small ?? null;
  return {
    playerTag: normalizedTag,
    playerName: String(player.name ?? normalizedTag),
    playerAvatarUrl: leagueIcon
  };
}

export class ContentController {
  async listPublic(req, res, kind) {
    ensureKind(kind);
    const townHall = req.query.townHall ? String(req.query.townHall).toUpperCase() : null;
    const featuredOnly = kind === 'posts' && req.query.feed === 'featured';

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

    const result = await pool.query(
      `
      select * from social_posts
      where published = true ${featuredOnly ? 'and featured = true' : ''}
      order by created_at desc
      limit 100
      `
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
        insert into content_strategies (title, town_hall, troops, spells, clan_castle, heroes, published)
        values ($1, $2, $3, $4, $5, $6, $7)
        returning *
        `,
        [
          payload.title,
          payload.townHall,
          JSON.stringify(payload.troops),
          JSON.stringify(payload.spells),
          JSON.stringify(payload.clanCastle),
          JSON.stringify(payload.heroes),
          payload.published
        ]
      );
      return res.status(201).json(mapStrategy(result.rows[0]));
    }

    const identity = payload.playerTag
      ? await playerIdentity(payload.playerTag)
      : {
          playerTag: payload.authorRole ?? 'admin',
          playerName: payload.authorName ?? 'Clash Companion',
          playerAvatarUrl: null
        };
    const result = await pool.query(
      `
      insert into social_posts
        (player_tag, player_name, player_avatar_url, body, image_url, poll_question, poll_options, featured, published)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      returning *
      `,
      [
        identity.playerTag,
        identity.playerName,
        identity.playerAvatarUrl,
        payload.body,
        payload.imageUrl,
        payload.pollQuestion ?? null,
        JSON.stringify(payload.pollOptions),
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
        (player_tag, player_name, player_avatar_url, body, image_url, poll_question, poll_options, published)
      values ($1, $2, $3, $4, $5, $6, $7, true)
      returning *
      `,
      [
        identity.playerTag,
        identity.playerName,
        identity.playerAvatarUrl,
        payload.body,
        payload.imageUrl,
        payload.pollQuestion ?? null,
        JSON.stringify(payload.pollOptions)
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
            clan_castle = $6, heroes = $7, published = $8, updated_at = now()
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
          next.published
        ]
      );
      return res.json(mapStrategy(result.rows[0]));
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
          : 'social_posts';
    await pool.query(`delete from ${table} where id = $1`, [id]);
    return res.status(204).send();
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
    return res.status(201).json(comment.rows[0]);
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
