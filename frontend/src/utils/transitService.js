// ============================================
// Transit Service — Official Indian Metro Lines + Bus
// Queries Overpass mirrors + reliable city metro fallback
// so metro lines ALWAYS render with official colors.
// Computes active Point A -> Point B metro corridor
// vs thin background lines for the rest of the network.
// ============================================

import { INDIAN_METRO_COLORS, CITY_METRO_NETWORKS } from '../data/metroNetworks.js';

const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

function normalizeColor(osmColor, lineName) {
  const lower = (lineName || '').toLowerCase().trim();
  for (const [key, color] of Object.entries(INDIAN_METRO_COLORS)) {
    if (lower.includes(key)) return color;
  }

  if (osmColor) {
    if (osmColor.startsWith('#')) return osmColor;
    const named = {
      pink: '#E91E63',
      red: '#E53935',
      blue: '#1E88E5',
      green: '#43A047',
      yellow: '#EAB308',
      orange: '#FB8C00',
      purple: '#7B1FA2',
      violet: '#7B1FA2',
      magenta: '#AD1457',
      aqua: '#00BCD4',
      cyan: '#00BCD4',
      gold: '#EAB308',
      grey: '#78909C',
      gray: '#78909C',
    };
    const lowerOsm = osmColor.toLowerCase().trim();
    if (named[lowerOsm]) return named[lowerOsm];
    return osmColor;
  }

  if (lower.includes('pink')) return '#E91E63';
  if (lower.includes('purple') || lower.includes('violet')) return '#7B1FA2';
  if (lower.includes('blue')) return '#1E88E5';
  if (lower.includes('red')) return '#E53935';
  if (lower.includes('green')) return '#43A047';
  if (lower.includes('yellow')) return '#EAB308';
  if (lower.includes('orange')) return '#FB8C00';
  if (lower.includes('magenta')) return '#AD1457';
  if (lower.includes('aqua') || lower.includes('cyan')) return '#00BCD4';
  if (lower.includes('grey') || lower.includes('gray')) return '#78909C';

  return '#7B1FA2';
}

function distKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getCityFallbackNetwork(lat1, lng1, lat2, lng2) {
  const midLat = (lat1 + lat2) / 2;
  const midLng = (lng1 + lng2) / 2;
  const cityNet = CITY_METRO_NETWORKS.find(
    (c) => midLat >= c.bounds.s && midLat <= c.bounds.n && midLng >= c.bounds.w && midLng <= c.bounds.e,
  );
  if (!cityNet) return [];
  return cityNet.lines.map((l) => ({
    name: l.name,
    color: l.color,
    coordinates: l.coordinates,
    segments: [l.coordinates],
    type: 'network',
  }));
}

async function queryOverpassWithMirrors(query, timeoutMs = 6500) {
  for (const url of OVERPASS_MIRRORS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!response.ok) continue;
      const data = await response.json();
      if (data?.elements) return data.elements;
    } catch {
      clearTimeout(timer);
    }
  }
  return [];
}

/**
 * Fetch city-wide metro lines with original colors (Overpass + curated city fallback).
 * Ensures missing/under-construction lines (like Pune Line 3 Pink Line) also appear cleanly.
 */
export async function fetchMetroLines(originLat, originLng, destLat, destLng) {
  const pad = 0.08;
  const south = Math.min(originLat, destLat) - pad;
  const north = Math.max(originLat, destLat) + pad;
  const west = Math.min(originLng, destLng) - pad;
  const east = Math.max(originLng, destLng) + pad;

  const query = `[out:json][timeout:12];
(
  relation["route"~"^(subway|light_rail|metro)$"](${south},${west},${north},${east});
  way["railway"~"^(subway|light_rail)$"](${south},${west},${north},${east});
);
out body geom;`;

  const elements = await queryOverpassWithMirrors(query);
  const lines = [];
  const usedWayIds = new Set();
  const seenNames = new Set();

  for (const el of elements) {
    if (el.type !== 'relation') continue;
    const rawName = el.tags?.name || el.tags?.ref || 'Metro Line';
    const baseName = rawName
      .replace(/\s*\(.*?\)\s*/g, '')
      .replace(/\s*(forward|return|up|down)\s*/gi, '')
      .trim();
    const normKey = baseName.toLowerCase();
    if (seenNames.has(normKey)) continue;

    const segments = [];
    for (const member of el.members || []) {
      if (member.type === 'way' && member.geometry?.length) {
        segments.push(member.geometry.map((p) => [p.lat, p.lon]));
        if (member.ref) usedWayIds.add(member.ref);
      }
    }

    const flatCoords = segments.flat();
    if (flatCoords.length > 2) {
      seenNames.add(normKey);
      const osmColor = el.tags?.colour || el.tags?.color || null;
      lines.push({
        name: baseName,
        color: normalizeColor(osmColor, baseName),
        coordinates: flatCoords,
        segments,
        type: 'relation',
      });
    }
  }

  for (const el of elements) {
    if (el.type !== 'way' || !el.geometry?.length) continue;
    if (usedWayIds.has(el.id)) continue;
    const coords = el.geometry.map((p) => [p.lat, p.lon]);
    const name = el.tags?.name || el.tags?.ref || 'Metro Track';
    const osmColor = el.tags?.colour || el.tags?.color || null;
    lines.push({
      name,
      color: normalizeColor(osmColor, name),
      coordinates: coords,
      segments: [coords],
      type: 'way',
    });
  }

  // Merge any curated city lines missing from Overpass (e.g., Overpass 502 or unmapped Pink Line)
  const fallbackCityLines = getCityFallbackNetwork(originLat, originLng, destLat, destLng);
  for (const fb of fallbackCityLines) {
    const colorAlreadyLoaded = lines.some((l) => l.color.toLowerCase() === fb.color.toLowerCase());
    if (lines.length === 0 || !colorAlreadyLoaded) {
      lines.push(fb);
    }
  }

  return lines;
}

/**
 * Lighten a hex color cleanly toward white for unselected thin metro lines.
 */
export function lightenHex(hex, factor = 0.55) {
  if (!hex || !hex.startsWith('#') || (hex.length !== 7 && hex.length !== 4)) return hex || '#B39DDB';
  let full = hex;
  if (hex.length === 4) {
    full = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  const r = parseInt(full.slice(1, 3), 16);
  const g = parseInt(full.slice(3, 5), 16);
  const b = parseInt(full.slice(5, 7), 16);
  const mix = (c) => Math.round(c + (255 - c) * factor);
  const toHex = (v) => v.toString(16).padStart(2, '0');
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

function measurePathKm(coords) {
  let km = 0;
  for (let i = 1; i < coords.length; i++) {
    km += distKm(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
  }
  return km;
}

function sliceLineCoords(coords, idx1, idx2) {
  if (!coords?.length) return [];
  const lo = Math.min(idx1, idx2);
  const hi = Math.max(idx1, idx2);
  const seg = coords.slice(lo, hi + 1);
  return idx1 <= idx2 ? seg : [...seg].reverse();
}

function buildFeederLeg(role, gapKm) {
  if (gapKm < 0.25) return null;
  const mode = gapKm > 0.7 ? 'BUS' : 'WALK';
  const dur =
    mode === 'WALK'
      ? Math.max(3, Math.round((gapKm / 4.8) * 60))
      : Math.max(4, Math.round((gapKm / 18) * 60) + 3);
  return {
    role,
    mode,
    distance_km: gapKm,
    duration_min: dur,
    activity_mode: mode === 'WALK' ? 'walking_brisk' : 'resting_in_vehicle',
  };
}

/**
 * Determine best metro route connecting Point A (Origin) and Point B (Destination):
 *   - Supports direct single line when one line covers both ends
 *   - Automatically detects 2-line Metro Interchange (Line A -> Transfer -> Line B)
 *     when cross-city travel gets closer to both Origin and Destination
 */
export function selectActiveMetroCorridor(metroLines, originLat, originLng, destLat, destLng) {
  if (!metroLines?.length) {
    return {
      annotatedLines: [],
      activeIndex: null,
      activeLine: null,
      interchangePlan: null,
      boardPoint: null,
      alightPoint: null,
    };
  }

  const scored = metroLines.map((line, index) => {
    const coords = (line.coordinates || []).filter((c) => c && !isNaN(c[0]) && !isNaN(c[1]));
    let minA = Infinity;
    let minB = Infinity;
    let ptA = null;
    let ptB = null;
    let idxA = 0;
    let idxB = 0;

    coords.forEach((pt, i) => {
      const dA = distKm(originLat, originLng, pt[0], pt[1]);
      if (dA < minA) {
        minA = dA;
        ptA = pt;
        idxA = i;
      }
      const dB = distKm(destLat, destLng, pt[0], pt[1]);
      if (dB < minB) {
        minB = dB;
        ptB = pt;
        idxB = i;
      }
    });

    return { index, line, minA, minB, totalDist: minA + minB, ptA, ptB, idxA, idxB, coords };
  });

  // 1) Evaluate Best Single Direct Line
  const bestSingle = [...scored].sort((a, b) => a.totalDist - b.totalDist)[0];
  const activeIndex = bestSingle ? bestSingle.index : 0;

  const annotatedLines = scored.map((item) => {
    const isActive = item.index === activeIndex;
    let activeSegments = null;
    let metroTrackKm = 0;

    if (item.line.type === 'network' && item.coords.length >= 2) {
      const sub = sliceLineCoords(item.coords, item.idxA, item.idxB);
      if (sub.length >= 2) {
        activeSegments = [sub];
        metroTrackKm = measurePathKm(sub);
      }
    } else if (item.line.segments?.length) {
      activeSegments = item.line.segments;
    }

    if (metroTrackKm <= 0 && item.ptA && item.ptB) {
      metroTrackKm = distKm(item.ptA[0], item.ptA[1], item.ptB[0], item.ptB[1]) * 1.15;
    }

    const firstMileKm = Math.round(item.minA * 1.25 * 10) / 10;
    const lastMileKm = Math.round(item.minB * 1.25 * 10) / 10;
    const metroKm = Math.max(0.5, Math.round(metroTrackKm * 10) / 10);
    const totalKm = Math.round((firstMileKm + metroKm + lastMileKm) * 10) / 10;
    const coveragePct = totalKm > 0 ? Math.min(100, Math.round((metroKm / totalKm) * 100)) : 100;

    const autoLegs = [];
    const fLeg = buildFeederLeg('first', firstMileKm);
    if (fLeg) autoLegs.push(fLeg);
    autoLegs.push({
      role: 'main',
      mode: 'METRO',
      distance_km: metroKm,
      duration_min: Math.max(5, Math.round((metroKm / 34) * 60) + 4),
      activity_mode: 'resting_in_vehicle',
      coverage_pct: coveragePct,
      line_name: item.line.name,
    });
    const lLeg = buildFeederLeg('last', lastMileKm);
    if (lLeg) autoLegs.push(lLeg);

    return {
      ...item.line,
      isActive,
      lightColor: lightenHex(item.line.color, 0.22),
      activeSegments,
      boardPoint: item.ptA,
      alightPoint: item.ptB,
      autoPlan: {
        firstMileKm,
        metroKm,
        lastMileKm,
        totalKm,
        totalDurationMin: autoLegs.reduce((sum, l) => sum + l.duration_min, 0),
        coveragePct,
        legs: autoLegs,
      },
    };
  });

  // 2) Evaluate Smart 2-Line Metro Interchange (Line A -> Transfer Station -> Line B)
  let bestInterchange = null;
  for (let i = 0; i < scored.length; i++) {
    for (let j = 0; j < scored.length; j++) {
      if (i === j) continue;
      const a = scored[i];
      const b = scored[j];
      if (!a.coords.length || !b.coords.length) continue;

      // Find closest station pair where Line A intersects/transfers to Line B
      let minXferDist = Infinity;
      let xferIdxA = 0;
      let xferIdxB = 0;
      a.coords.forEach((pa, ia) => {
        b.coords.forEach((pb, ib) => {
          const d = distKm(pa[0], pa[1], pb[0], pb[1]);
          if (d < minXferDist) {
            minXferDist = d;
            xferIdxA = ia;
            xferIdxB = ib;
          }
        });
      });

      if (minXferDist > 1.6) continue; // Not connected at a practical interchange hub

      const subA = sliceLineCoords(a.coords, a.idxA, xferIdxA);
      const subB = sliceLineCoords(b.coords, xferIdxB, b.idxB);
      const kmA =
        subA.length >= 2
          ? measurePathKm(subA)
          : distKm(a.ptA[0], a.ptA[1], a.coords[xferIdxA][0], a.coords[xferIdxA][1]);
      const kmB =
        subB.length >= 2
          ? measurePathKm(subB)
          : distKm(b.coords[xferIdxB][0], b.coords[xferIdxB][1], b.ptB[0], b.ptB[1]);

      // Must meaningfully travel on BOTH lines (avoids pointless transfers for 200m)
      if (kmA < 0.7 || kmB < 0.7) continue;

      const feederTotal = a.minA + b.minB;
      // Trigger interchange if feeder gaps shrink significantly (>= 1.2 km closer) vs best single line
      if (feederTotal + 1.2 < bestSingle.totalDist) {
        if (!bestInterchange || feederTotal < bestInterchange.feederTotal) {
          bestInterchange = {
            feederTotal,
            a,
            b,
            subA: subA.length >= 2 ? subA : [a.ptA, a.coords[xferIdxA]],
            subB: subB.length >= 2 ? subB : [b.coords[xferIdxB], b.ptB],
            kmA: Math.round(kmA * 10) / 10,
            kmB: Math.round(kmB * 10) / 10,
            xferPoint: a.coords[xferIdxA],
            boardPoint: a.ptA,
            alightPoint: b.ptB,
          };
        }
      }
    }
  }

  let interchangePlan = null;
  if (bestInterchange) {
    const { a, b, subA, subB, kmA, kmB, xferPoint, boardPoint, alightPoint } = bestInterchange;
    const firstMileKm = Math.round(a.minA * 1.25 * 10) / 10;
    const lastMileKm = Math.round(b.minB * 1.25 * 10) / 10;
    const totalMetroKm = Math.round((kmA + kmB) * 10) / 10;
    const totalKm = Math.round((firstMileKm + totalMetroKm + lastMileKm) * 10) / 10;
    const coveragePct = totalKm > 0 ? Math.min(100, Math.round((totalMetroKm / totalKm) * 100)) : 100;

    const legs = [];
    const fLeg = buildFeederLeg('first', firstMileKm);
    if (fLeg) legs.push(fLeg);

    const durA = Math.max(4, Math.round((kmA / 34) * 60) + 3);
    const durB = Math.max(4, Math.round((kmB / 34) * 60) + 3);

    legs.push({
      role: 'main',
      mode: 'METRO',
      distance_km: kmA,
      duration_min: durA,
      activity_mode: 'resting_in_vehicle',
      line_name: a.line.name,
      color: a.line.color,
      coverage_pct: Math.round((kmA / totalKm) * 100),
    });

    legs.push({
      role: 'transfer',
      mode: 'TRANSFER',
      distance_km: 0.1,
      duration_min: 4,
      activity_mode: 'walking_slow',
      line_name: 'Station Interchange',
    });

    legs.push({
      role: 'main',
      mode: 'METRO',
      distance_km: kmB,
      duration_min: durB,
      activity_mode: 'resting_in_vehicle',
      line_name: b.line.name,
      color: b.line.color,
      coverage_pct: Math.round((kmB / totalKm) * 100),
    });

    const lLeg = buildFeederLeg('last', lastMileKm);
    if (lLeg) legs.push(lLeg);

    interchangePlan = {
      lineAIndex: a.index,
      lineBIndex: b.index,
      lineAName: a.line.name.split('(')[0].trim(),
      lineBName: b.line.name.split('(')[0].trim(),
      lineAColor: a.line.color,
      lineBColor: b.line.color,
      segments: [
        {
          lineIndex: a.index,
          name: a.line.name,
          color: a.line.color,
          coords: subA,
          distance_km: kmA,
          duration_min: durA,
        },
        {
          lineIndex: b.index,
          name: b.line.name,
          color: b.line.color,
          coords: subB,
          distance_km: kmB,
          duration_min: durB,
        },
      ],
      transferPoint: xferPoint,
      boardPoint,
      alightPoint,
      firstMileKm,
      lastMileKm,
      metroKm: totalMetroKm,
      totalKm,
      totalDurationMin: legs.reduce((s, l) => s + l.duration_min, 0),
      coveragePct,
      legs,
    };
  }

  return {
    annotatedLines,
    activeIndex,
    activeLine: annotatedLines[activeIndex] || null,
    interchangePlan,
    boardPoint: interchangePlan ? interchangePlan.boardPoint : bestSingle?.ptA || null,
    alightPoint: interchangePlan ? interchangePlan.alightPoint : bestSingle?.ptB || null,
  };
}

/**
 * Fetch real bus route geometry near the route corridor.
 */
export async function fetchBusRoutes(originLat, originLng, destLat, destLng) {
  const pad = 0.025;
  const south = Math.min(originLat, destLat) - pad;
  const north = Math.max(originLat, destLat) + pad;
  const west = Math.min(originLng, destLng) - pad;
  const east = Math.max(originLng, destLng) + pad;

  const query = `[out:json][timeout:10];(relation["route"="bus"](${south},${west},${north},${east}););out body geom qt 6;`;
  const elements = await queryOverpassWithMirrors(query, 6000);

  const routes = [];
  for (const rel of elements) {
    if (rel.type !== 'relation' || !rel.members) continue;
    const segments = [];
    for (const member of rel.members) {
      if (member.type === 'way' && member.geometry?.length) {
        segments.push(member.geometry.map((p) => [p.lat, p.lon]));
      }
    }
    const allCoords = segments.flat();
    if (allCoords.length > 2) {
      const name = rel.tags?.name || rel.tags?.ref || 'Bus Route';
      const color = rel.tags?.colour || rel.tags?.color || '#0288D1';
      routes.push({ coordinates: allCoords, segments, name, color: normalizeColor(color, name) });
    }
  }
  return routes.slice(0, 5);
}

export function estimateMetroTime(distanceKm) {
  return Math.max(10, Math.round((distanceKm / 33) * 60) + 10);
}

export function estimateBusTime(distanceKm) {
  return Math.max(10, Math.round((distanceKm / 18) * 60) + 6);
}
