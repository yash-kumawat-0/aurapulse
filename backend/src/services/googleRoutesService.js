// ============================================
// Google Maps Routes Service
// ============================================
import { ROUTES_ENDPOINTS, getGoogleHeaders, GOOGLE_MAPS_API_KEY } from '../config/googleApi.js';

/**
 * Computes routes between origin and destination for multiple travel modes.
 *
 * @param {object} origin - { latitude, longitude }
 * @param {object} destination - { latitude, longitude }
 * @param {string[]} modes - Array of travel modes: 'DRIVE', 'TWO_WHEELER', 'TRANSIT', 'WALK', 'BICYCLE'
 * @returns {Promise<object[]>} Array of route summaries per mode.
 */
export async function computeRoutes(origin, destination, modes = ['DRIVE', 'TRANSIT']) {
  if (!GOOGLE_MAPS_API_KEY) {
    return getSimulatedRoutes(origin, destination, modes);
  }

  const results = await Promise.allSettled(
    modes.map((mode) => computeSingleRoute(origin, destination, mode))
  );

  const successful = results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value);

  return successful.length >= 2 ? successful : getSimulatedRoutes(origin, destination, modes);
}

function getSimulatedRoutes(origin, destination, modes) {
  // Compute approximate straight-line distance in km (Haversine approximation)
  const dLat = (destination.latitude - origin.latitude) * 111;
  const dLng = (destination.longitude - origin.longitude) * 105;
  const straightKm = Math.max(3, Math.sqrt(dLat * dLat + dLng * dLng));
  const roadKm = Math.round(straightKm * 1.35 * 10) / 10;

  return modes.map((mode) => {
    let speedKmh = 25; // default urban speed
    let activityMode = 'resting_in_vehicle';
    let label = mode;

    if (mode === 'TWO_WHEELER') {
      speedKmh = 28;
      activityMode = 'two_wheeler';
      label = 'Scooter / Bike (Road)';
    } else if (mode === 'TRANSIT') {
      speedKmh = 35;
      activityMode = 'resting_in_vehicle';
      label = 'Metro / Train + Walk';
    } else if (mode === 'DRIVE') {
      speedKmh = 24;
      activityMode = 'resting_in_vehicle';
      label = 'Car / Cab (AC Recirc)';
    } else if (mode === 'WALK') {
      speedKmh = 4.5;
      activityMode = 'walking_brisk';
      label = 'Walking';
    } else if (mode === 'BICYCLE') {
      speedKmh = 14;
      activityMode = 'cycling';
      label = 'Bicycle';
    }

    const durationMin = Math.max(10, Math.round((roadKm / speedKmh) * 60));
    return {
      travel_mode: mode,
      duration_min: durationMin,
      distance_km: roadKm,
      activity_mode: activityMode,
      encoded_polyline: null,
      label,
    };
  });
}

/**
 * Computes a single route for one travel mode.
 */
async function computeSingleRoute(origin, destination, travelMode) {
  const fieldMask = 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration';

  const body = {
    origin: {
      location: { latLng: { latitude: origin.latitude, longitude: origin.longitude } },
    },
    destination: {
      location: { latLng: { latitude: destination.latitude, longitude: destination.longitude } },
    },
    travelMode,
    routingPreference: travelMode === 'TRANSIT' ? undefined : 'TRAFFIC_AWARE',
    computeAlternativeRoutes: false,
  };

  const response = await fetch(ROUTES_ENDPOINTS.computeRoutes, {
    method: 'POST',
    headers: getGoogleHeaders(fieldMask),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Routes API error for ${travelMode} (${response.status}): ${errBody}`);
  }

  const data = await response.json();
  const route = (data.routes || [])[0];

  if (!route) {
    throw new Error(`No route found for mode ${travelMode}`);
  }

  // Parse duration string like "1234s" to minutes
  const durationSeconds = parseInt(route.duration?.replace('s', '') || '0', 10);
  const durationMinutes = Math.round(durationSeconds / 60);
  const distanceKm = Math.round((route.distanceMeters || 0) / 100) / 10;

  // Map travel mode to activity mode for dose calculation
  const activityModeMap = {
    DRIVE: 'resting_in_vehicle',
    TWO_WHEELER: 'two_wheeler',
    TRANSIT: 'resting_in_vehicle',
    WALK: 'walking_brisk',
    BICYCLE: 'cycling',
  };

  return {
    travel_mode: travelMode,
    duration_min: durationMinutes,
    distance_km: distanceKm,
    activity_mode: activityModeMap[travelMode] || 'resting_in_vehicle',
    encoded_polyline: route.polyline?.encodedPolyline || null,
    label: formatModeLabel(travelMode),
  };
}

function formatModeLabel(mode) {
  const labels = {
    DRIVE: 'Car / Auto',
    TWO_WHEELER: 'Scooter / Bike',
    TRANSIT: 'Metro / Bus',
    WALK: 'Walking',
    BICYCLE: 'Bicycle',
  };
  return labels[mode] || mode;
}
