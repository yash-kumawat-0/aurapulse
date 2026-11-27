// ============================================
// Advice Controller — Full Telemetry + Dynamic Gemini AI
// ============================================
import { getCurrentConditions, getForecast } from '../services/googleAirQualityService.js';
import { analyzeDiurnalPattern } from '../engine/diurnalOptimizer.js';
import { calculateIndoorPM25 } from '../engine/massBalanceModel.js';
import { generateFamilyAdvice } from '../services/geminiAdviceService.js';
import { createApiError } from '../middleware/errorHandler.js';

/**
 * POST /api/v1/advice/generate
 * Generates a comprehensive personalized family action plan.
 */
export async function generateAdvice(req, res, next) {
  try {
    const {
      lat,
      lng,
      location_label,
      family_members,
      home_profile,
      commute_comparison,
      language,
    } = req.body;

    if (!lat || !lng) throw createApiError('lat and lng are required.', 400);
    if (!family_members || family_members.length === 0) {
      throw createApiError('At least one family member is required.', 400);
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    const [currentAqi, forecastData] = await Promise.all([
      getCurrentConditions(latitude, longitude),
      getForecast(latitude, longitude, 48),
    ]);

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

    const adviceResult = await generateFamilyAdvice({
      locationLabel: location_label,
      currentAqi,
      diurnalAnalysis,
      indoorSimulation,
      commuteComparison: commute_comparison,
      familyMembers: family_members,
      language: language || 'English',
      overrideKey: req.get('X-Gemini-Api-Key'),
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
        ai_audit: {
          ai_powered: adviceResult.ai_powered,
          model: adviceResult.model,
          key_slot: adviceResult.key_slot,
          fallback_reason: adviceResult.fallback_reason || null,
          prompt_preview: adviceResult.prompt_preview,
          input_context: adviceResult.input_context,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}
