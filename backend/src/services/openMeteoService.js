// ============================================
// Open-Meteo Weather Service (Free, No API Key)
// ============================================
// Fetches meteorological data for the boundary layer model:
//   - Planetary Boundary Layer (PBL) height
//   - Wind speed and direction
//   - Temperature and relative humidity
//   - Atmospheric pressure
// ============================================

const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';

/**
 * Fetches weather data relevant to air quality modeling.
 *
 * @param {number} lat - Latitude.
 * @param {number} lng - Longitude.
 * @returns {Promise<object>} Weather data including PBL height.
 */
export async function getWeatherData(lat, lng) {
  try {
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lng.toString(),
      hourly: [
        'temperature_2m',
        'relative_humidity_2m',
        'wind_speed_10m',
        'wind_direction_10m',
        'boundary_layer_height',
        'surface_pressure',
      ].join(','),
      forecast_days: '2',
      timezone: 'auto',
    });

    const response = await fetch(`${OPEN_METEO_BASE}?${params}`);

    if (!response.ok) {
      console.warn(`Open-Meteo API error (${response.status}), using simulated weather.`);
      return getSimulatedWeatherData(lat, lng);
    }

    const data = await response.json();
    return normalizeWeatherData(data);
  } catch (err) {
    console.warn('Open-Meteo fetch failed:', err.message, '- using simulated weather.');
    return getSimulatedWeatherData(lat, lng);
  }
}

/**
 * Simulated weather data fallback when Open-Meteo is unreachable.
 */
function getSimulatedWeatherData(lat, lng) {
  const now = new Date();
  const hours = [];
  for (let i = 0; i < 48; i++) {
    const time = new Date(now.getTime() + i * 3600000);
    const h = time.getHours();
    // Realistic diurnal temperature curve
    const temp = 22 + 8 * Math.sin(((h - 6) / 24) * Math.PI * 2);
    // PBL height: low at night, high in afternoon
    const pbl = h >= 10 && h <= 16 ? 1200 + (h - 10) * 150 : 300 + h * 20;
    hours.push({
      hour: h,
      dateLabel: time.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' }),
      iso: time.toISOString(),
      temperature_c: Math.round(temp * 10) / 10,
      humidity_percent: 55 + Math.round(Math.sin(h / 6) * 15),
      wind_speed_kmh: 8 + Math.round(Math.sin(h / 4) * 5),
      wind_direction_deg: 220 + Math.round(Math.sin(h / 8) * 40),
      pbl_height_m: Math.round(pbl),
      pressure_hpa: 1013,
    });
  }
  const currentIdx = 0;
  return {
    current: hours[currentIdx],
    hourly: hours,
    timezone: 'Asia/Kolkata',
    location: { latitude: lat, longitude: lng },
    is_simulated: true,
  };
}

/**
 * Normalizes Open-Meteo response into a clean format.
 */
function normalizeWeatherData(raw) {
  const hourly = raw.hourly || {};
  const times = hourly.time || [];

  const hours = times.map((isoTime, i) => {
    const dt = new Date(isoTime);
    return {
      hour: dt.getHours(),
      dateLabel: dt.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' }),
      iso: isoTime,
      temperature_c: hourly.temperature_2m?.[i] || null,
      humidity_percent: hourly.relative_humidity_2m?.[i] || null,
      wind_speed_kmh: hourly.wind_speed_10m?.[i] || null,
      wind_direction_deg: hourly.wind_direction_10m?.[i] || null,
      pbl_height_m: hourly.boundary_layer_height?.[i] || null,
      pressure_hpa: hourly.surface_pressure?.[i] || null,
    };
  });

  // Current conditions (closest hour)
  const now = new Date();
  const currentHourIndex = hours.findIndex((h) => {
    const hTime = new Date(h.iso);
    return hTime.getHours() === now.getHours() && hTime.getDate() === now.getDate();
  });
  const current = currentHourIndex >= 0 ? hours[currentHourIndex] : hours[0];

  return {
    current,
    hourly: hours,
    timezone: raw.timezone || 'UTC',
    location: { latitude: raw.latitude, longitude: raw.longitude },
  };
}
