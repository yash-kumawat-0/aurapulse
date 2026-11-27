// ============================================
// Upstash Serverless Redis Client
// ============================================
import { Redis } from '@upstash/redis';

const redisUrl = process.env.UPSTASH_REDIS_URL;
const redisToken = process.env.UPSTASH_REDIS_TOKEN;

if (!redisUrl || !redisToken) {
  console.warn(
    '⚠️  UPSTASH_REDIS_URL or UPSTASH_REDIS_TOKEN not set. Caching will fall through to live API calls.',
  );
}

export const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

/**
 * Wraps a data-fetching function with geohash-based caching.
 * @param {string} cacheKey - Unique key (e.g., geohash + endpoint).
 * @param {Function} fetchFn - Async function that returns fresh data.
 * @param {number} ttlSeconds - Cache TTL in seconds (default 1800 = 30 min).
 * @returns {Promise<any>} Cached or freshly fetched data.
 */
export async function withCache(cacheKey, fetchFn, ttlSeconds = 1800) {
  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return typeof cached === 'string' ? JSON.parse(cached) : cached;
      }
    } catch (err) {
      console.error('Redis GET error:', err.message);
    }
  }

  const freshData = await fetchFn();

  if (redis && freshData) {
    try {
      await redis.set(cacheKey, JSON.stringify(freshData), { ex: ttlSeconds });
    } catch (err) {
      console.error('Redis SET error:', err.message);
    }
  }

  return freshData;
}

export default redis;
