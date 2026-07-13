import { MongoClient } from 'mongodb';

import { env } from './env.js';
import { AppError } from '../utils/errors.js';

let client;
let database;

export async function getMongoDatabase() {
  if (!env.MONGODB_URI) {
    throw new AppError('Content service is not configured.', 503, true);
  }

  if (database) return database;
  client = new MongoClient(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 8000,
    maxPoolSize: 10
  });
  await client.connect();
  database = client.db(env.MONGODB_DATABASE);
  await Promise.all([
    database.collection('layouts').createIndex({ townHall: 1, published: 1, createdAt: -1 }),
    database.collection('strategies').createIndex({ townHall: 1, published: 1, createdAt: -1 }),
    database.collection('posts').createIndex({ published: 1, createdAt: -1 })
  ]);
  return database;
}
