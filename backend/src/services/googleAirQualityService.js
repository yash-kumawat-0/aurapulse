// ============================================
// Google Maps Air Quality Service
// ============================================
import { AIR_QUALITY_ENDPOINTS, getGoogleHeaders, GOOGLE_MAPS_API_KEY } from '../config/googleApi.js';
import { withCache } from '../config/redis.js';
import { encodeGeohash } from '../middleware/cacheMiddleware.js';

/**
 * Fetches current air quality conditions for a location.
 * Falls back to realistic micro-simulation if Google API key is not configured.
 *
 * @param {number} lat - Latitude.
 * @param {number} lng - Longitude.
 * @returns {Promise<object>} Current AQI data.
 */
export async function getCurrentConditions(lat, lng) {
  if (!GOOGLE_MAPS_API_KEY) {
    return getSimulatedCurrentConditions(lat, lng);
  }

  const cacheKey = `${encodeGeohash(lat, lng)}:current`;

  return withCache(
    cacheKey,
    async () => {
      try {
        const response = await fetch(AIR_QUALITY_ENDPOINTS.currentConditions, {
          method: 'POST',
          headers: getGoogleHeaders(),
          signal: AbortSignal.timeout(8000),
          body: JSON.stringify({
            location: { latitude: lat, longitude: lng },
            extraComputations: [
              'HEALTH_RECOMMENDATIONS',
              'DOMINANT_POLLUTANT_CONCENTRATION',
              'POLLUTANT_CONCENTRATION',
              'LOCAL_AQI',
              'POLLUTANT_ADDITIONAL_INFO',
            ],
            languageCode: 'en',
          }),
        });

        if (!response.ok) {
          console.warn(`Air Quality API warning (${response.status}), using simulated fallback.`);
          return getSimulatedCurrentConditions(lat, lng);
        }

        const data = await response.json();
        return normalizeCurrentConditions(data);
      } catch (err) {
        console.warn('Air Quality API fetch error:', err.message, '- falling back to simulation.');
        return getSimulatedCurrentConditions(lat, lng);
      }
    },
    1800,
  ); // 30-min cache
}

/**
 * Fetches hourly air quality forecast (up to 96 hours).
 * Falls back to diurnal inversion model if API key is not configured.
 *
 * @param {number} lat - Latitude.
 * @param {number} lng - Longitude.
 * @param {number} hours - Number of forecast hours (max 96).
 * @returns {Promise<object>} Hourly forecast data.
 */
export async function getForecast(lat, lng, hours = 48) {
  if (!GOOGLE_MAPS_API_KEY) {
    return getSimulatedForecast(lat, lng, hours);
  }

  const cacheKey = `${encodeGeohash(lat, lng)}:forecast:${hours}`;

  return withCache(
    cacheKey,
    async () => {
      try {
        const now = new Date();
        const end = new Date(now.getTime() + hours * 60 * 60 * 1000);

        const response = await fetch(AIR_QUALITY_ENDPOINTS.forecast, {
          method: 'POST',
          headers: getGoogleHeaders(),
          signal: AbortSignal.timeout(8000),
          body: JSON.stringify({
            location: { latitude: lat, longitude: lng },
            period: {
              startTime: now.toISOString(),
              endTime: end.toISOString(),
            },
            extraComputations: ['DOMINANT_POLLUTANT_CONCENTRATION', 'POLLUTANT_CONCENTRATION'],
            languageCode: 'en',
            pageSize: hours,
          }),
        });

        if (!response.ok) {
          console.warn(`Air Quality Forecast API warning (${response.status}), using simulated fallback.`);
          return getSimulatedForecast(lat, lng, hours);
        }

        const data = await response.json();
        return normalizeForecast(data);
      } catch (err) {
        console.warn('Air Quality Forecast API fetch error:', err.message, '- falling back to simulation.');
        return getSimulatedForecast(lat, lng, hours);
      }
    },
    3600,
  ); // 1-hour cache for forecasts
}

/**
 * Generates realistic air quality data based on diurnal inversion physics.
 */
function getSimulatedCurrentConditions(lat, lng) {
  const hour = new Date().getHours();
  // Diurnal curve: peaks 6-9 AM, lowest 2-4:30 PM, rises 7-11 PM
  let basePM25 = 142;
  if (hour >= 6 && hour <= 9)
    basePM25 = 210; // Morning inversion
  else if (hour >= 13 && hour <= 16)
    basePM25 = 58; // Clean window
  else if (hour >= 19 && hour <= 23) basePM25 = 165; // Night rush & cooling

  // Small variation based on coords
  const coordHash = Math.abs(Math.sin(lat * 12.9898 + lng * 78.233)) * 20;
  const pm25 = Math.round(basePM25 + coordHash);
  const pm10 = Math.round(pm25 * 1.45);
  const aqi = Math.round(pm25 * 1.32);

  return {
    aqi,
    aqi_category: aqi > 300 ? 'Severe' : aqi > 200 ? 'Very Poor' : aqi > 100 ? 'Moderate' : 'Good',
    aqi_color: aqi > 200 ? '#F44336' : '#FF9800',
    dominant_pollutant: 'pm25',
    local_aqi: aqi,
    local_aqi_name: 'CPCB AQI',
    pm25,
    pm10,
    pollutants: [
      {
        code: 'pm25',
        display_name: 'PM2.5',
        full_name: 'Fine particulate matter',
        concentration_ug_m3: pm25,
        concentration_unit: 'µg/m³',
      },
      {
        code: 'pm10',
        display_name: 'PM10',
        full_name: 'Inhalable particulate matter',
        concentration_ug_m3: pm10,
        concentration_unit: 'µg/m³',
      },
      {
        code: 'no2',
        display_name: 'NO2',
        full_name: 'Nitrogen dioxide',
        concentration_ug_m3: 45,
        concentration_unit: 'µg/m³',
      },
    ],
    health_recommendations: {
      generalPopulation:
        'Wear N95 masks during peak morning hours. Reschedule outdoor runs to mid-afternoon.',
    },
    timestamp: new Date().toISOString(),
    is_simulated: true,
  };
}

/**
 * Generates 48-hour diurnal forecast with realistic atmospheric dispersion.
 */
function getSimulatedForecast(lat, lng, hours = 48) {
  const hourly = [];
  const now = new Date();

  for (let i = 0; i < hours; i++) {
    const time = new Date(now.getTime() + i * 3600000);
    const h = time.getHours();

    // Diurnal inversion curve:
    // 05:00 - 09:00: Severe (inversion layer traps particles)
    // 10:00 - 13:00: Moderate (solar convective heating begins)
    // 14:00 - 16:30: Clean Gold Window (maximum boundary layer mixing)
    // 17:00 - 21:00: Evening rush spike
    // 22:00 - 04:00: Surface cooling and particle accumulation
    let pm25;
    if (h >= 6 && h <= 9) pm25 = 200 + (h % 3) * 15;
    else if (h >= 10 && h <= 13) pm25 = 110 - (h - 10) * 15;
    else if (h >= 14 && h <= 16)
      pm25 = 48 + (h % 2) * 8; // Cleanest
    else if (h >= 17 && h <= 21) pm25 = 120 + (h - 17) * 15;
    else pm25 = 150 + (h % 4) * 10;

    const aqi = Math.round(pm25 * 1.25);
    hourly.push({
      hour: h,
      dateLabel: time.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' }),
      iso: time.toISOString(),
      aqi,
      category: aqi > 200 ? 'Unhealthy' : aqi > 100 ? 'Moderate' : 'Good',
      pm25,
      dominant_pollutant: 'pm25',
    });
  }

  return { hourly, count: hourly.length, is_simulated: true };
}

/**
 * Normalizes current conditions response into a clean format.
 */
function normalizeCurrentConditions(raw) {
  const indexes = raw.indexes || [];
  const universalAqi = indexes.find((i) => i.code === 'uaqi') || indexes[0] || {};
  const localAqi = indexes.find((i) => i.code !== 'uaqi') || {};

  const pollutants = (raw.pollutants || []).map((p) => ({
    code: p.code,
    display_name: p.displayName,
    full_name: p.fullName,
    concentration_ug_m3: p.concentration?.value || 0,
    concentration_unit: p.concentration?.units || 'µg/m³',
  }));

  const pm25 = pollutants.find((p) => p.code === 'pm25');
  const pm10 = pollutants.find((p) => p.code === 'pm10');

  return {
    aqi: universalAqi.aqi || 0,
    aqi_category: universalAqi.category || 'Unknown',
    aqi_color: universalAqi.color || null,
    dominant_pollutant: universalAqi.dominantPollutant || 'Unknown',
    local_aqi: localAqi.aqi || null,
    local_aqi_name: localAqi.displayName || null,
    pm25: pm25?.concentration_ug_m3 || 0,
    pm10: pm10?.concentration_ug_m3 || 0,
    pollutants,
    health_recommendations: raw.healthRecommendations || {},
    timestamp: raw.dateTime || new Date().toISOString(),
  };
}

/**
 * Normalizes forecast response into an array of hourly data points.
 */
function normalizeForecast(raw) {
  const hourlyData = (raw.hourlyForecasts || []).map((entry) => {
    const indexes = entry.indexes || [];
    const uaqi = indexes.find((i) => i.code === 'uaqi') || indexes[0] || {};
    const pollutants = entry.pollutants || [];
    const pm25 = pollutants.find((p) => p.code === 'pm25');

    const dt = new Date(entry.dateTime);
    return {
      hour: dt.getHours(),
      dateLabel: dt.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' }),
      iso: entry.dateTime,
      aqi: uaqi.aqi || 0,
      category: uaqi.category || 'Unknown',
      pm25: pm25?.concentration?.value || 0,
      dominant_pollutant: uaqi.dominantPollutant || 'Unknown',
    };
  });

  return { hourly: hourlyData, count: hourlyData.length };
}
