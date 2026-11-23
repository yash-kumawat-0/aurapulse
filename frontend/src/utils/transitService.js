// ============================================
// Transit Service — Real Metro/Rail Lines + Bus
// Queries OpenStreetMap Overpass API for actual
// metro, subway, light rail geometry WITH proper
// OFFICIAL Indian metro line colors.
// ============================================

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// ── Official Indian Metro Line Colors ──
// Mapping of known metro lines across Indian cities
const INDIAN_METRO_COLORS = {
  // ─ Pune Metro ─
  'purple line': '#7B1FA2',
  'aqua line': '#00BCD4',
  // Pune Metro (Marathi or alternate names)
  'pune metro line 1': '#7B1FA2',
  'pune metro line 2': '#00BCD4',

  // ─ Delhi Metro ─
  'red line': '#E53935',
  'yellow line': '#FDD835',
  'blue line': '#1E88E5',
  'blue line branch': '#1565C0',
  'green line': '#43A047',
  'violet line': '#7B1FA2',
  'magenta line': '#AD1457',
  'pink line': '#E91E63',
  'orange line': '#FB8C00',       // Airport Express
  'airport express': '#FB8C00',
  'grey line': '#78909C',
  'rapid metro': '#FF7043',

  // ─ Mumbai Metro ─
  'line 1': '#1E88E5',           // Versova–Andheri–Ghatkopar
  'line 2a': '#FDD835',
  'line 2b': '#FDD835',
  'line 3': '#00BCD4',           // Aqua (Colaba–Bandra–SEEPZ)
  'line 7': '#E53935',
  'line 7a': '#E53935',

  // ─ Bangalore (Namma Metro) ─
  'green line bangalore': '#43A047',
  'purple line bangalore': '#7B1FA2',
  'namma metro green': '#43A047',
  'namma metro purple': '#7B1FA2',

  // ─ Chennai Metro ─
  'blue line chennai': '#1E88E5',
  'green line chennai': '#43A047',

  // ─ Kolkata Metro ─
  'blue line kolkata': '#1E88E5',
  'green line kolkata': '#43A047',

  // ─ Hyderabad Metro ─
  'red line hyderabad': '#E53935',
  'blue line hyderabad': '#1E88E5',
  'green line hyderabad': '#43A047',

  // ─ Jaipur Metro ─
  'pink line jaipur': '#E91E63',

  // ─ Lucknow Metro ─
  'red line lucknow': '#E53935',

  // ─ Nagpur Metro ─
  'orange line nagpur': '#FB8C00',
  'aqua line nagpur': '#00BCD4',

  // ─ Kochi Metro ─
  'kochi metro': '#1E88E5',
};

/**
 * Normalize a color value from OSM data, or guess from line name.
 * Prioritizes official Indian metro colors over generic guesses.
 */
function normalizeColor(osmColor, lineName) {
  // 1) Try to match official Indian metro color by line name
  const lower = (lineName || '').toLowerCase().trim();
  for (const [key, color] of Object.entries(INDIAN_METRO_COLORS)) {
    if (lower.includes(key)) return color;
  }

  // 2) If OSM has a colour tag, use it
  if (osmColor) {
    if (osmColor.startsWith('#')) return osmColor;
    const named = {
      pink: '#E91E63', red: '#E53935', blue: '#1E88E5', green: '#43A047',
      yellow: '#FDD835', orange: '#FB8C00', purple: '#7B1FA2', violet: '#7B1FA2',
      magenta: '#AD1457', aqua: '#00BCD4', cyan: '#00BCD4', gold: '#FFD600',
      silver: '#9E9E9E', grey: '#78909C', gray: '#78909C', white: '#BDBDBD',
      black: '#424242', brown: '#795548', maroon: '#880E4F',
    };
    const lowerOsm = osmColor.toLowerCase().trim();
    if (named[lowerOsm]) return named[lowerOsm];
    return osmColor;
  }

  // 3) Generic guess from name keywords
  if (lower.includes('pink')) return '#E91E63';
  if (lower.includes('purple') || lower.includes('violet')) return '#7B1FA2';
  if (lower.includes('blue')) return '#1E88E5';
  if (lower.includes('red')) return '#E53935';
  if (lower.includes('green')) return '#43A047';
  if (lower.includes('yellow')) return '#FDD835';
  if (lower.includes('orange')) return '#FB8C00';
  if (lower.includes('magenta')) return '#AD1457';
  if (lower.includes('aqua') || lower.includes('cyan')) return '#00BCD4';
  if (lower.includes('grey') || lower.includes('gray')) return '#78909C';

  return '#7B1FA2'; // Default metro purple
}

/**
 * Fetch real metro / subway / light-rail lines with their actual colors.
 * Queries RELATIONS (which carry line name + colour tags like "Pink Line").
 */
export async function fetchMetroLines(originLat, originLng, destLat, destLng) {
  const pad = 0.06; // Wider bounding box to catch full metro lines
  const south = Math.min(originLat, destLat) - pad;
  const north = Math.max(originLat, destLat) + pad;
  const west = Math.min(originLng, destLng) - pad;
  const east = Math.max(originLng, destLng) + pad;

  const query = `[out:json][timeout:20];
(
  relation["route"~"^(subway|light_rail|metro)$"](${south},${west},${north},${east});
  way["railway"~"^(subway|light_rail)$"](${south},${west},${north},${east});
);
out body geom;`;

  try {
    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) return [];
    const data = await response.json();
    if (!data.elements?.length) return [];

    const lines = [];
    const usedWayIds = new Set();
    const seenNames = new Set(); // Deduplicate return/forward trips

    // ── 1) Process RELATIONS (complete metro lines with names + colors) ──
    for (const el of data.elements) {
      if (el.type !== 'relation') continue;

      const name = el.tags?.name || el.tags?.ref || 'Metro Line';
      const color = el.tags?.colour || el.tags?.color || null;

      // Deduplicate: "Line 1 (Forward)" and "Line 1 (Return)" → keep one
      const baseName = name.replace(/\s*\(.*?\)\s*/g, '').replace(/\s*(forward|return|up|down)\s*/gi, '').trim();
      if (seenNames.has(baseName.toLowerCase())) continue;

      // Extract geometry from relation members (ways)
      const allCoords = [];
      for (const member of (el.members || [])) {
        if (member.type === 'way' && member.geometry?.length) {
          const segCoords = member.geometry.map((p) => [p.lat, p.lon]);
          allCoords.push(...segCoords);
          if (member.ref) usedWayIds.add(member.ref);
        }
      }

      if (allCoords.length > 2) {
        seenNames.add(baseName.toLowerCase());
        lines.push({
          coordinates: allCoords,
          name: baseName,
          color: normalizeColor(color, baseName),
          type: 'relation',
        });
      }
    }

    // ── 2) Process standalone WAYS not covered by relations ──
    for (const el of data.elements) {
      if (el.type !== 'way' || !el.geometry?.length) continue;
      if (usedWayIds.has(el.id)) continue;

      const coords = el.geometry.map((p) => [p.lat, p.lon]);
      const name = el.tags?.name || el.tags?.ref || 'Metro';
      const color = el.tags?.colour || el.tags?.color || null;

      lines.push({
        coordinates: coords,
        name,
        color: normalizeColor(color, name),
        type: 'way',
      });
    }

    return lines;
  } catch {
    return [];
  }
}

/**
 * Fetch real bus route geometry near the route corridor.
 */
export async function fetchBusRoutes(originLat, originLng, destLat, destLng) {
  const pad = 0.02;
  const south = Math.min(originLat, destLat) - pad;
  const north = Math.max(originLat, destLat) + pad;
  const west = Math.min(originLng, destLng) - pad;
  const east = Math.max(originLng, destLng) + pad;

  const query = `[out:json][timeout:12];(relation["route"="bus"](${south},${west},${north},${east}););out body geom qt 8;`;

  try {
    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) return [];
    const data = await response.json();
    if (!data.elements?.length) return [];

    const routes = [];
    for (const rel of data.elements) {
      if (rel.type !== 'relation' || !rel.members) continue;
      const allCoords = [];
      for (const member of rel.members) {
        if (member.type === 'way' && member.geometry?.length) {
          allCoords.push(...member.geometry.map((p) => [p.lat, p.lon]));
        }
      }
      if (allCoords.length > 2) {
        const name = rel.tags?.name || rel.tags?.ref || 'Bus Route';
        const color = rel.tags?.colour || rel.tags?.color || '#0288D1';
        routes.push({ coordinates: allCoords, name, color: normalizeColor(color, name) });
      }
    }
    return routes.slice(0, 5);
  } catch {
    return [];
  }
}

export function estimateMetroTime(distanceKm) {
  return Math.max(10, Math.round((distanceKm / 33) * 60) + 10);
}

export function estimateBusTime(distanceKm) {
  return Math.max(10, Math.round((distanceKm / 18) * 60) + 6);
}
