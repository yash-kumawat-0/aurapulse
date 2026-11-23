// ============================================
// AQI Route Colorizer
// Splits a route polyline into colored segments
// based on estimated PM2.5 concentration.
//
// Uses a physics-inspired model that varies PM2.5
// along the route to simulate passing through
// different urban zones (highway, residential,
// commercial, green corridors).
// ============================================

/**
 * PM2.5 → Color mapping (WHO + US EPA breakpoints)
 */
const PM25_COLOR_SCALE = [
  { max: 12,   color: '#4CAF50', label: 'Good' },
  { max: 35.4, color: '#8BC34A', label: 'Moderate' },
  { max: 55.4, color: '#FFEB3B', label: 'USG' },
  { max: 150.4, color: '#FF9800', label: 'Unhealthy' },
  { max: 250.4, color: '#F44336', label: 'Very Unhealthy' },
  { max: Infinity, color: '#880E4F', label: 'Hazardous' },
];

/**
 * Get the display color for a PM2.5 value.
 */
export function getPM25Color(pm25) {
  for (const level of PM25_COLOR_SCALE) {
    if (pm25 <= level.max) return level.color;
  }
  return '#880E4F';
}

/**
 * Seeded pseudo-random for consistent results per route.
 */
function seededRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * Estimate PM2.5 at a point along a route.
 * Uses a combination of:
 *  - Base ambient PM2.5 from origin
 *  - Sinusoidal variation (urban zones)
 *  - Road-type factor (turns = intersections = higher PM2.5)
 *  - Deterministic "randomness" seeded by position
 *
 * @param {number} basePM25 - Ambient PM2.5 at origin
 * @param {number} progress - 0.0 to 1.0 (how far along the route)
 * @param {number} seed - Unique seed for this route variant
 * @param {number} turnDensity - 0 to 1, how curvy this segment is
 * @returns {number} Estimated PM2.5 at this point
 */
function estimateSegmentPM25(basePM25, progress, seed, turnDensity) {
  // Zone variation: simulates industrial → residential → commercial → green belt
  const zoneWave = Math.sin(progress * Math.PI * 3.5 + seed) * 0.25;

  // Traffic hotspot near middle of route (highway interchange)
  const hotspot = Math.exp(-Math.pow((progress - 0.4 - seed * 0.1) * 5, 2)) * 0.3;

  // Turn density factor (more turns = urban = higher PM2.5)
  const turnFactor = turnDensity * 0.15;

  // Slight seeded variation for realism
  const noise = (seededRandom(seed + progress * 100) - 0.5) * 0.1;

  const multiplier = 1.0 + zoneWave + hotspot + turnFactor + noise;
  return Math.max(5, basePM25 * Math.max(0.4, multiplier));
}

/**
 * Calculate turn density at a point in the coordinate array.
 * Higher values = more curvy route segment.
 */
function calcTurnDensity(coords, index, windowSize = 3) {
  if (coords.length < 3) return 0;

  let totalAngle = 0;
  let count = 0;
  const start = Math.max(1, index - windowSize);
  const end = Math.min(coords.length - 1, index + windowSize);

  for (let i = start; i < end; i++) {
    const [lat1, lng1] = coords[i - 1];
    const [lat2, lng2] = coords[i];
    const [lat3, lng3] = coords[i + 1] || coords[i];

    const angle1 = Math.atan2(lat2 - lat1, lng2 - lng1);
    const angle2 = Math.atan2(lat3 - lat2, lng3 - lng2);
    let diff = Math.abs(angle2 - angle1);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    totalAngle += diff;
    count++;
  }

  return count > 0 ? Math.min(1, (totalAngle / count) / (Math.PI / 4)) : 0;
}

/**
 * Split a route into colored segments based on estimated AQI.
 *
 * @param {Array<[number,number]>} coordinates - Route coordinates [lat, lng]
 * @param {number} basePM25 - Ambient PM2.5 at origin (from AQI API)
 * @param {number} modeMultiplier - PM2.5 exposure multiplier for transport mode
 * @param {number} routeSeed - Unique seed per route variant (0, 1, 2...)
 * @param {number} segmentSize - Points per segment (default 8)
 * @returns {Array<{ points: [number,number][], color: string, pm25: number }>}
 */
export function colorizeRoute(coordinates, basePM25, modeMultiplier = 1.0, routeSeed = 0, segmentSize = 8) {
  if (!coordinates || coordinates.length < 2) return [];

  const effectiveBase = basePM25 * modeMultiplier;
  const totalPoints = coordinates.length;
  const segments = [];

  for (let i = 0; i < totalPoints - 1; i += Math.max(1, segmentSize - 1)) {
    const end = Math.min(i + segmentSize, totalPoints);
    const segmentCoords = coordinates.slice(i, end);
    if (segmentCoords.length < 2) continue;

    // Progress along route (0 to 1)
    const progress = (i + segmentCoords.length / 2) / totalPoints;

    // Turn density at this segment
    const turnDensity = calcTurnDensity(coordinates, i + Math.floor(segmentCoords.length / 2));

    // Estimate PM2.5 for this segment
    const segPM25 = estimateSegmentPM25(effectiveBase, progress, routeSeed, turnDensity);

    segments.push({
      points: segmentCoords,
      color: getPM25Color(segPM25),
      pm25: Math.round(segPM25),
    });
  }

  return segments;
}

/**
 * Calculate the route-average PM2.5 from colored segments.
 */
export function calcRouteAvgPM25(segments) {
  if (!segments.length) return 0;
  const total = segments.reduce((sum, s) => sum + s.pm25, 0);
  return Math.round(total / segments.length);
}

/**
 * Returns the legend items for the color scale.
 */
export function getColorLegend() {
  return [
    { color: '#4CAF50', label: 'Good (0-12)' },
    { color: '#8BC34A', label: 'Moderate (12-35)' },
    { color: '#FFEB3B', label: 'Sensitive (35-55)' },
    { color: '#FF9800', label: 'Unhealthy (55-150)' },
    { color: '#F44336', label: 'Very Unhealthy (150+)' },
  ];
}
