// ============================================
// Advice Controller
// ============================================
// Orchestrates ALL engines and services to generate
// the final family action plan via Gemini.
// ============================================
import { getCurrentConditions, getForecast } from '../services/googleAirQualityService.js';
import { analyzeDiurnalPattern } from '../engine/diurnalOptimizer.js';
import { calculateIndoorPM25 } from '../engine/massBalanceModel.js';
import { generateFamilyAdvice } from '../services/geminiAdviceService.js';
import { createApiError } from '../middleware/errorHandler.js';

/**
 * POST /api/v1/advice/generate
 * Generates a comprehensive family action plan.
 *
 * Body: {
 *   lat: number,
 *   lng: number,
 *   family_members: [{ name, age, health_condition }],
 *   home_profile: { room_area_sqft, ceiling_height_ft, window_seal_type, indoor_source },
 *   language: "English" | "Hindi" | "Telugu"
 * }
 */
export async function generateAdvice(req, res, next) {
  try {
    const { lat, lng, family_members, home_profile, language } = req.body;

    if (!lat || !lng) throw createApiError('lat and lng are required.', 400);
    if (!family_members || family_members.length === 0) {
      throw createApiError('At least one family member is required.', 400);
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    // Step 1: Gather all external data in parallel
    const [currentAqi, forecastData] = await Promise.all([
      getCurrentConditions(latitude, longitude),
      getForecast(latitude, longitude, 48),
    ]);

    // Step 2: Run deterministic physics calculations
    const diurnalAnalysis = analyzeDiurnalPattern(forecastData.hourly);

    const homeParams = home_profile || {};
    const indoorSimulation = calculateIndoorPM25({
      outdoorPM25: currentAqi.pm25,
      roomAreaSqft: homeParams.room_area_sqft || 150,
      ceilingHeightFt: homeParams.ceiling_height_ft || 10,
      windowSealType: homeParams.window_seal_type || 'standard_aluminum',
      purifierCADR: homeParams.purifier_cadr || 0,
      indoorSource: homeParams.indoor_source || 'none',
    });

    // Step 3: Send all calculated data to Gemini for natural language advice
    const adviceResult = await generateFamilyAdvice({
      currentAqi,
      diurnalAnalysis,
      indoorSimulation,
      familyMembers: family_members,
      language: language || 'English',
    });

    res.json({
      success: true,
      data: {
        advice: adviceResult.advice || adviceResult.raw_response,
        calculated_data: {
          current_aqi: {
            aqi: currentAqi.aqi,
            category: currentAqi.aqi_category,
            pm25: currentAqi.pm25,
            pm10: currentAqi.pm10,
          },
          cleanest_window: diurnalAnalysis.cleanest_window,
          dirtiest_window: diurnalAnalysis.dirtiest_window,
          indoor_pm25: indoorSimulation.indoor_pm25,
          indoor_is_safe: indoorSimulation.is_safe,
          morning_trap_warning: diurnalAnalysis.morning_trap_warning,
        },
        model: adviceResult.model,
      },
    });
  } catch (err) {
    next(err);
  }
}
