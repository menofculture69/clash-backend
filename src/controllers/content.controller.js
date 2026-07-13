import { ObjectId } from 'mongodb';
import { z } from 'zod';

import { getMongoDatabase } from '../config/mongo.js';
import { AppError } from '../utils/errors.js';

const townHalls = ['TH18', 'TH17', 'TH16', 'TH15'];
const layoutSchema = z.object({ title: z.string().min(3).max(120), townHall: z.enum(townHalls), description: z.string().max(500).optional().default(''), imageUrl: z.string().url().optional().default(''), layoutUrl: z.string().url(), published: z.boolean().optional().default(true) });
const strategySchema = z.object({ title: z.string().min(3).max(120), townHall: z.enum(townHalls), troops: z.array(z.string().min(1)).max(30).default([]), spells: z.array(z.string().min(1)).max(20).default([]), clanCastle: z.array(z.string().min(1)).max(15).default([]), heroes: z.array(z.string().min(1)).max(16).default([]), published: z.boolean().optional().default(true) });
const postSchema = z.object({ authorName: z.string().min(2).max(60), authorRole: z.string().max(60).optional().default('Community'), body: z.string().min(1).max(2000), imageUrl: z.string().url().optional().default(''), published: z.boolean().optional().default(true), featured: z.boolean().optional().default(false) });
const collections = { layouts: layoutSchema, strategies: strategySchema, posts: postSchema };

function collectionFor(kind) {
  if (!collections[kind]) throw new AppError('Unknown content type.', 404, true);
  return collections[kind];
}
function serialize(document) { const { _id, ...rest } = document; return { id: _id.toString(), ...rest }; }
function objectId(id) { if (!ObjectId.isValid(id)) throw new AppError('Invalid content id.', 400, true); return new ObjectId(id); }

export class ContentController {
  async listPublic(req, res, requestedKind) {
    const kind = requestedKind ?? String(req.params.kind);
    collectionFor(kind);
    const db = await getMongoDatabase();
    const query = { published: true };
    if (kind !== 'posts' && req.query.townHall) query.townHall = String(req.query.townHall).toUpperCase();
    if (kind === 'posts' && req.query.feed === 'featured') query.featured = true;
    const items = await db.collection(kind).find(query).sort({ createdAt: -1 }).limit(80).toArray();
    res.json({ items: items.map(serialize) });
  }
  async listAdmin(req, res) {
    const kind = String(req.params.kind); collectionFor(kind);
    const db = await getMongoDatabase();
    const items = await db.collection(kind).find({}).sort({ createdAt: -1 }).limit(200).toArray();
    res.json({ items: items.map(serialize) });
  }
  async create(req, res) {
    const kind = String(req.params.kind); const schema = collectionFor(kind);
    const payload = schema.parse(req.body); const now = new Date(); const db = await getMongoDatabase();
    const result = await db.collection(kind).insertOne({ ...payload, createdAt: now, updatedAt: now });
    res.status(201).json({ item: serialize({ _id: result.insertedId, ...payload, createdAt: now, updatedAt: now }) });
  }
  async update(req, res) {
    const kind = String(req.params.kind); const schema = collectionFor(kind);
    const payload = schema.partial().parse(req.body); const db = await getMongoDatabase();
    const result = await db.collection(kind).findOneAndUpdate({ _id: objectId(String(req.params.id)) }, { $set: { ...payload, updatedAt: new Date() } }, { returnDocument: 'after' });
    if (!result) throw new AppError('Content item not found.', 404, true);
    res.json({ item: serialize(result) });
  }
  async remove(req, res) {
    const kind = String(req.params.kind); collectionFor(kind); const db = await getMongoDatabase();
    const result = await db.collection(kind).deleteOne({ _id: objectId(String(req.params.id)) });
    if (!result.deletedCount) throw new AppError('Content item not found.', 404, true);
    res.status(204).send();
  }
}
export const contentController = new ContentController();
