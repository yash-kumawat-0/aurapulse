// ============================================
// AQI Controller
// ============================================
import { getCurrentConditions, getForecast } from '../services/googleAirQualityService.js';
import { getWeatherData } from '../services/openMeteoService.js';
import { analyzeDiurnalPattern } from '../engine/diurnalOptimizer.js';
import { createApiError } from '../middleware/errorHandler.js';

/**
 * GET /api/v1/aqi/current?lat=17.49&lng=78.39
 * Returns current air quality conditions for a location.
 */
export async function getCurrent(req, res, next) {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) throw createApiError('lat and lng query parameters are required.', 400);

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    const data = await getCurrentConditions(latitude, longitude);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/aqi/diurnal?lat=17.49&lng=78.39
 * Returns 48-hour diurnal analysis with clean/dirty windows.
 */
export async function getDiurnal(req, res, next) {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) throw createApiError('lat and lng query parameters are required.', 400);

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    // Fetch forecast and weather in parallel
    const [forecastData, weatherData] = await Promise.all([
      getForecast(latitude, longitude, 48),
      getWeatherData(latitude, longitude),
    ]);

    // Run diurnal analysis on the forecast data
    const diurnalAnalysis = analyzeDiurnalPattern(forecastData.hourly);

    res.json({
      success: true,
      data: {
        diurnal: diurnalAnalysis,
        weather: weatherData.current,
        forecast_hours: forecastData.count,
      },
    });
  } catch (err) {
    next(err);
  }
}
