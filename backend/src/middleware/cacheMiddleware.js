// ============================================
// Geohash Cache Middleware
// ============================================

/**
 * Encodes latitude/longitude into an ~1.1km grid geohash key.
 *
 * @param {number} lat - Latitude.
 * @param {number} lng - Longitude.
 * @returns {string} Geohash key string.
 */
export function encodeGeohash(lat, lng) {
  const latBucket = Math.round(lat * 100) / 100;
  const lngBucket = Math.round(lng * 100) / 100;
  return `geo:${latBucket}:${lngBucket}`;
}

/**
 * Attaches spatial geohash metadata to AQI requests for upstream Redis caching.
 */
export function aqiCacheMiddleware(req, _res, next) {
  const { lat, lng } = req.query;
  if (lat && lng) {
    req.geohash = encodeGeohash(parseFloat(lat), parseFloat(lng));
  }
  next();
}
