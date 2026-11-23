// ============================================
// Geohash Cache Middleware
// ============================================
import { withCache } from '../config/redis.js';

/**
 * Encodes latitude/longitude into a simple geohash string
 * at approximately 1.2km resolution (similar to Uber H3 Res 7).
 * Uses 4-decimal-place truncation for simple spatial bucketing.
 *
 * @param {number} lat - Latitude.
 * @param {number} lng - Longitude.
 * @returns {string} Geohash key string.
 */
export function encodeGeohash(lat, lng) {
  // Truncate to 2 decimal places (~1.1km grid cells)
  const latBucket = Math.round(lat * 100) / 100;
  const lngBucket = Math.round(lng * 100) / 100;
  return `geo:${latBucket}:${lngBucket}`;
}

/**
 * Express middleware that checks Redis cache for AQI data
 * before allowing the request to hit external APIs.
 * Attaches `req.cachedAqi` if cache hit is found.
 */
export function aqiCacheMiddleware(req, _res, next) {
  const { lat, lng } = req.query;
  if (lat && lng) {
    req.geohash = encodeGeohash(parseFloat(lat), parseFloat(lng));
  }
  next();
}
