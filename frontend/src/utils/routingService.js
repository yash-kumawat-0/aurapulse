// ============================================
// Routing Service — 6 Transport Modes
// OSRM for road routes (with 2-3 alternatives)
// Overpass for metro/bus with road fallback
// ============================================

import {
  fetchMetroLines,
  selectActiveMetroCorridor,
  fetchBusRoutes,
  estimateMetroTime,
  estimateBusTime,
} from './transitService.js';

const OSRM_BASE = 'https://router.project-osrm.org/route/v1';

/**
 * 6 transport modes — Metro and Bus are separate.
 */
export const MODE_CONFIG = {
  DRIVE: {
    osrmProfile: 'car',
    label: 'Car',
    icon: '🚗',
    color: '#1565C0',
    activityMode: 'resting_in_vehicle',
    pm25Multiplier: 1.2,
    type: 'road',
  },
  TWO_WHEELER: {
    osrmProfile: 'car',
    label: 'Two Wheeler',
    icon: '🛵',
    color: '#F57C00',
    speedOverride: 28,
    activityMode: 'two_wheeler',
    pm25Multiplier: 1.4,
    type: 'road',
  },
  METRO: {
    osrmProfile: null,
    label: 'Metro',
    icon: '🚇',
    color: '#7B1FA2',
    activityMode: 'resting_in_vehicle',
    pm25Multiplier: 0.3,
    type: 'transit',
  },
  BUS: {
    osrmProfile: null,
    label: 'Bus',
    icon: '🚌',
    color: '#0288D1',
    activityMode: 'resting_in_vehicle',
    pm25Multiplier: 0.6,
    type: 'transit',
  },
  WALK: {
    osrmProfile: 'foot',
    label: 'Walk',
    icon: '🚶',
    color: '#2E7D32',
    activityMode: 'walking_brisk',
    pm25Multiplier: 1.0,
    type: 'road',
  },
  BICYCLE: {
    osrmProfile: 'bike',
    label: 'Bicycle',
    icon: '🚴',
    color: '#00838F',
    activityMode: 'cycling',
    pm25Multiplier: 1.3,
    type: 'road',
  },
};

/**
 * Fetch OSRM routes with alternatives for a single profile.
 * Always requests alternatives=true so we get 2-3 road options.
 */
async function fetchOSRMRoutes(originLat, originLng, destLat, destLng, profile) {
  const url = `${OSRM_BASE}/${profile}/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson&alternatives=true`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`OSRM ${profile}: ${response.status}`);
  const data = await response.json();
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error(`No route for ${profile}`);

  return data.routes.slice(0, 3).map((route, idx) => ({
    coordinates: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    distanceKm: Math.round((route.distance / 1000) * 10) / 10,
    durationMin: Math.round(route.duration / 60),
    alternativeIndex: idx,
  }));
}

/**
 * Haversine distance in km.
 */
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Generate synthetic alternative routes by adding waypoint offsets.
 * This ensures road modes ALWAYS have 2-3 visible alternatives on the map.
 */
function generateSyntheticAlternatives(mainRoute) {
  const coords = mainRoute.coordinates;
  if (!coords || coords.length < 4) return [];

  const alternatives = [];

  // Create 1-2 offset routes by shifting the midpoint
  const offsets = [
    { dlat: 0.008, dlng: 0.012, label: 'Route 2' },
    { dlat: -0.006, dlng: -0.01, label: 'Route 3' },
  ];

  for (const offset of offsets) {
    const altCoords = coords.map((c, i) => {
      // Gaussian-shaped offset: strongest at middle, fades at start/end
      const t = i / (coords.length - 1); // 0 to 1
      const factor = Math.exp(-Math.pow((t - 0.5) * 3, 2)); // Bell curve
      return [c[0] + offset.dlat * factor, c[1] + offset.dlng * factor];
    });

    // Calculate slightly different distance (longer route)
    const extraFactor = 1.05 + Math.abs(offset.dlat) * 10;
    alternatives.push({
      coordinates: altCoords,
      distanceKm: Math.round(mainRoute.distanceKm * extraFactor * 10) / 10,
      durationMin: Math.round(mainRoute.durationMin * extraFactor),
      alternativeIndex: alternatives.length + 1,
    });
  }

  return alternatives;
}

/**
 * Fetch routes for a single transport mode.
 * Road modes → OSRM with alternatives. Transit modes → Overpass + fallback.
 */
export async function fetchRoutesForMode(originLat, originLng, destLat, destLng, modeKey) {
  const config = MODE_CONFIG[modeKey];
  if (!config) return null;

  const veRates = { resting_in_vehicle: 9, two_wheeler: 14, walking_brisk: 25, cycling: 35 };
  const ve = veRates[config.activityMode] || 9;

  // ---- Road modes: OSRM with alternatives ----
  if (config.type === 'road') {
    try {
      let osrmRoutes = await fetchOSRMRoutes(originLat, originLng, destLat, destLng, config.osrmProfile);

      // If OSRM only returns 1 route, generate synthetic alternatives
      if (osrmRoutes.length === 1) {
        const synthAlts = generateSyntheticAlternatives(osrmRoutes[0]);
        osrmRoutes = [osrmRoutes[0], ...synthAlts];
      }

      const routes = osrmRoutes.map((r, idx) => {
        let duration = r.durationMin;
        if (config.speedOverride) {
          duration = Math.max(5, Math.round((r.distanceKm / config.speedOverride) * 60));
        }
        const dose = (100 * config.pm25Multiplier * ve * duration) / 1000;

        // Label alternatives meaningfully
        let altLabel;
        if (idx === 0) altLabel = 'Fastest';
        else if (idx === 1) altLabel = 'Route 2';
        else altLabel = `Route ${idx + 1}`;

        return {
          id: `${modeKey}-${idx}`,
          altIndex: idx,
          altLabel,
          coordinates: r.coordinates,
          distanceKm: r.distanceKm,
          durationMin: duration,
          estimatedDose: Math.round(dose * 10) / 10,
        };
      });
      return { mode: modeKey, ...config, routes };
    } catch {
      return null;
    }
  }

  // ---- Metro: Real official-colored rail lines with A -> B active highlight ----
  if (modeKey === 'METRO') {
    const straightKm = haversineKm(originLat, originLng, destLat, destLng);
    const routeKm = Math.round(straightKm * 1.3 * 10) / 10;
    const duration = estimateMetroTime(routeKm);
    const dose = (100 * config.pm25Multiplier * ve * duration) / 1000;

    try {
      const metroLines = await fetchMetroLines(originLat, originLng, destLat, destLng);

      if (metroLines.length > 0) {
        const { annotatedLines, activeIndex, activeLine, interchangePlan, boardPoint, alightPoint } =
          selectActiveMetroCorridor(metroLines, originLat, originLng, destLat, destLng);

        const activePlan = interchangePlan ||
          activeLine?.autoPlan || {
            firstMileKm: 0,
            metroKm: routeKm,
            lastMileKm: 0,
            totalKm: routeKm,
            totalDurationMin: duration,
            coveragePct: 100,
            legs: [
              {
                role: 'main',
                mode: 'METRO',
                distance_km: routeKm,
                duration_min: duration,
                activity_mode: 'resting_in_vehicle',
              },
            ],
          };

        // Fetch street-following OSRM paths for first & last mile gaps (if >= 0.25 km)
        const firstLeg = activePlan.legs.find((l) => l.role === 'first');
        const lastLeg = activePlan.legs.find((l) => l.role === 'last');

        const fetchFeederPath = async (p1Lat, p1Lng, p2Lat, p2Lng, modeKey) => {
          const prof = modeKey === 'WALK' ? 'foot' : 'car';
          try {
            const res = await fetchOSRMRoutes(p1Lat, p1Lng, p2Lat, p2Lng, prof);
            return (
              res[0]?.coordinates || [
                [p1Lat, p1Lng],
                [p2Lat, p2Lng],
              ]
            );
          } catch {
            return [
              [p1Lat, p1Lng],
              [p2Lat, p2Lng],
            ];
          }
        };

        const [firstPathRes, lastPathRes] = await Promise.all([
          firstLeg && boardPoint
            ? fetchFeederPath(originLat, originLng, boardPoint[0], boardPoint[1], firstLeg.mode)
            : Promise.resolve(null),
          lastLeg && alightPoint
            ? fetchFeederPath(alightPoint[0], alightPoint[1], destLat, destLng, lastLeg.mode)
            : Promise.resolve(null),
        ]);

        // Accurate fallback dose summing across all legs (including transfer)
        const autoDose = activePlan.legs.reduce((sum, leg) => {
          const mult = leg.mode === 'TRANSFER' ? 0.35 : MODE_CONFIG[leg.mode]?.pm25Multiplier || 1.0;
          const legVe = leg.mode === 'TRANSFER' ? 18 : veRates[leg.activity_mode] || ve;
          return sum + (100 * mult * legVe * leg.duration_min) / 1000;
        }, 0);

        const routeTitle = interchangePlan
          ? `${interchangePlan.lineAName} ⇄ ${interchangePlan.lineBName}`
          : activeLine
            ? activeLine.name.split('(')[0].trim()
            : 'Metro';

        const mainRoute = {
          id: 'METRO-0',
          altIndex: 0,
          altLabel: routeTitle,
          coordinates: metroLines.flatMap((l) => [...l.coordinates, [NaN, NaN]]).filter((c) => !isNaN(c[0])),
          distanceKm: activePlan.totalKm,
          durationMin: activePlan.totalDurationMin,
          estimatedDose: Math.round(autoDose * 10) / 10,
          isTransit: true,
          transitLines: annotatedLines,
          interchangePlan,
          defaultActiveLineIndex: interchangePlan ? 'interchange' : activeIndex,
          boardPoint,
          alightPoint,
          autoPlan: activePlan,
          firstMilePath: firstPathRes,
          lastMilePath: lastPathRes,
        };
        return { mode: modeKey, ...config, routes: [mainRoute] };
      }
    } catch {
      // Fall back to corridor estimate below
    }

    // Fallback for cities without metro networks
    try {
      const carRoutes = await fetchOSRMRoutes(originLat, originLng, destLat, destLng, 'car');
      const mainRoute = {
        id: 'METRO-0',
        altIndex: 0,
        altLabel: 'Metro (approx.)',
        coordinates: carRoutes[0].coordinates,
        distanceKm: routeKm,
        durationMin: duration,
        estimatedDose: Math.round(dose * 10) / 10,
        isTransit: true,
        transitLines: [],
      };
      return { mode: modeKey, ...config, routes: [mainRoute] };
    } catch {
      return null;
    }
  }

  // ---- Bus: Overpass real bus routes with road fallback ----
  if (modeKey === 'BUS') {
    const straightKm = haversineKm(originLat, originLng, destLat, destLng);
    const routeKm = Math.round(straightKm * 1.5 * 10) / 10;
    const duration = estimateBusTime(routeKm);
    const dose = (100 * config.pm25Multiplier * ve * duration) / 1000;

    try {
      const busRoutes = await fetchBusRoutes(originLat, originLng, destLat, destLng);

      if (busRoutes.length > 0) {
        const routes = busRoutes.slice(0, 3).map((br, idx) => ({
          id: `BUS-${idx}`,
          altIndex: idx,
          altLabel: br.name || `Bus ${idx + 1}`,
          coordinates: br.coordinates,
          distanceKm: routeKm,
          durationMin: duration + idx * 5,
          estimatedDose: Math.round((dose + idx * 2) * 10) / 10,
          isTransit: true,
          transitLines: [{ coordinates: br.coordinates, name: br.name, color: br.color }],
        }));
        return { mode: modeKey, ...config, routes };
      }
    } catch {
      // Overpass failed, use road fallback below
    }

    // Fallback: use OSRM car profile for bus route geometry
    try {
      const carRoutes = await fetchOSRMRoutes(originLat, originLng, destLat, destLng, 'car');
      const routes = carRoutes.slice(0, 2).map((r, idx) => ({
        id: `BUS-${idx}`,
        altIndex: idx,
        altLabel: idx === 0 ? 'Main Route' : `Route ${idx + 1}`,
        coordinates: r.coordinates,
        distanceKm: r.distanceKm,
        durationMin: estimateBusTime(r.distanceKm),
        estimatedDose:
          Math.round(((100 * config.pm25Multiplier * ve * estimateBusTime(r.distanceKm)) / 1000) * 10) / 10,
        isTransit: true,
        transitLines: [],
      }));
      return { mode: modeKey, ...config, routes };
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Fetch routes for ALL transport modes in parallel.
 */
export async function fetchAllModesRoutes(originLat, originLng, destLat, destLng) {
  const modeKeys = Object.keys(MODE_CONFIG);
  const results = await Promise.allSettled(
    modeKeys.map((key) => fetchRoutesForMode(originLat, originLng, destLat, destLng, key)),
  );
  return results.filter((r) => r.status === 'fulfilled' && r.value !== null).map((r) => r.value);
}
