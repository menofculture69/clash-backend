import { LRUCache } from 'lru-cache';
export class MemoryCache {
  constructor(ttlMs) {
    this.cache = new LRUCache({
      max: 500,
      ttl: ttlMs
    });
  }
  get(key) {
    return this.cache.get(key);
  }
  set(key, value) {
    this.cache.set(key, value);
  }
}