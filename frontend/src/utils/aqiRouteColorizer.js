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
  { max: 12, color: '#4CAF50', label: 'Good' },
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

  return count > 0 ? Math.min(1, totalAngle / count / (Math.PI / 4)) : 0;
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
 * Returns the category label for a PM2.5 value.
 */
export function getPM25Label(pm25) {
  for (const level of PM25_COLOR_SCALE) {
    if (pm25 <= level.max) return level.label;
  }
  return 'Hazardous';
}

/**
 * Generate a seamless AQI color grid covering the entire visible map viewport.
 * Uses smooth deterministic 2D spatial variation around basePM25 so colors
 * stay consistent across pan/zoom while covering 100% of the map.
 */
export function generateViewportAqiGrid(bounds, basePM25 = 100, cols = 7, rows = 5) {
  if (!bounds) return [];
  const south = bounds.getSouth();
  const north = bounds.getNorth();
  const west = bounds.getWest();
  const east = bounds.getEast();
  const latSpan = north - south;
  const lngSpan = east - west;
  if (latSpan <= 0 || lngSpan <= 0) return [];

  const stepLat = latSpan / rows;
  const stepLng = lngSpan / cols;
  const base = Math.max(10, basePM25);
  const cells = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const sLat = south + r * stepLat;
      const nLat = sLat + stepLat;
      const wLng = west + c * stepLng;
      const eLng = wLng + stepLng;
      const midLat = (sLat + nLat) / 2;
      const midLng = (wLng + eLng) / 2;

      // Smooth spatial pollution variation (~0.68x green belts to ~1.35x traffic corridors)
      const waveA = Math.sin(midLat * 95 + midLng * 72);
      const waveB = Math.cos(midLat * 54 - midLng * 110);
      const mult = 1.0 + waveA * 0.2 + waveB * 0.14;
      const pm25 = Math.max(6, Math.round(base * mult));

      cells.push({
        id: `cell-${r}-${c}`,
        bounds: [
          [sLat, wLng],
          [nLat, eLng],
        ],
        pm25,
        color: getPM25Color(pm25),
        label: getPM25Label(pm25),
      });
    }
  }

  return cells;
}

/**
 * Generate colored AQI zones across the map around origin, destination, and corridor.
 * Lets users visually inspect air quality zones right on the map in color.
 */
export function generateMapAqiZones(origin, destination, basePM25 = 100) {
  if (!origin || isNaN(origin.lat) || isNaN(origin.lng)) return [];

  const points = [];
  const base = Math.max(12, basePM25);

  const offsets = [
    { dLat: 0, dLng: 0, mult: 1.0, area: 'Start Location', radius: 1100 },
    { dLat: 0.018, dLng: 0.016, mult: 1.18, area: 'Commercial Hub', radius: 1300 },
    { dLat: -0.016, dLng: 0.019, mult: 0.78, area: 'Green / Park Belt', radius: 1250 },
    { dLat: 0.014, dLng: -0.018, mult: 1.28, area: 'Traffic Junction', radius: 1200 },
    { dLat: -0.019, dLng: -0.014, mult: 0.88, area: 'Residential Zone', radius: 1300 },
  ];

  offsets.forEach((o, i) => {
    const pm25 = Math.round(base * o.mult);
    points.push({
      id: `orig-zone-${i}`,
      lat: origin.lat + o.dLat,
      lng: origin.lng + o.dLng,
      radius: o.radius,
      pm25,
      color: getPM25Color(pm25),
      label: getPM25Label(pm25),
      area: o.area,
    });
  });

  if (destination && !isNaN(destination.lat) && !isNaN(destination.lng)) {
    const midLat = (origin.lat + destination.lat) / 2;
    const midLng = (origin.lng + destination.lng) / 2;

    const corridorOffsets = [
      { lat: midLat, lng: midLng, mult: 1.15, area: 'Mid-Corridor', radius: 1400 },
      {
        lat: (origin.lat + midLat) / 2 + 0.008,
        lng: (origin.lng + midLng) / 2 - 0.007,
        mult: 0.82,
        area: 'Breezy Pocket',
        radius: 1150,
      },
      {
        lat: (destination.lat + midLat) / 2 - 0.006,
        lng: (destination.lng + midLng) / 2 + 0.008,
        mult: 1.25,
        area: 'Junction Zone',
        radius: 1200,
      },
      { lat: destination.lat, lng: destination.lng, mult: 0.96, area: 'Destination Area', radius: 1200 },
      {
        lat: destination.lat + 0.015,
        lng: destination.lng + 0.014,
        mult: 1.22,
        area: 'Ring Road Sector',
        radius: 1250,
      },
    ];

    corridorOffsets.forEach((c, i) => {
      const pm25 = Math.round(base * c.mult);
      points.push({
        id: `dest-zone-${i}`,
        lat: c.lat,
        lng: c.lng,
        radius: c.radius,
        pm25,
        color: getPM25Color(pm25),
        label: getPM25Label(pm25),
        area: c.area,
      });
    });
  }

  return points;
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
