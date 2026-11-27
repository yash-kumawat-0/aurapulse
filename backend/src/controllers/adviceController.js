// ============================================
// Advice & Symptom Trigger Controller
// ============================================
import { getCurrentConditions, getForecast } from '../services/googleAirQualityService.js';
import { analyzeDiurnalPattern } from '../engine/diurnalOptimizer.js';
import { calculateIndoorPM25 } from '../engine/massBalanceModel.js';
import { generateFamilyAdvice, diagnoseSymptomTrigger } from '../services/geminiAdviceService.js';
import { createApiError } from '../middleware/errorHandler.js';

/**
 * POST /api/v1/advice/generate
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
      customWindowDesc: homeParams.custom_window_desc,
      customSourceDesc: homeParams.custom_source_desc,
    });

    const adviceResult = await generateFamilyAdvice({
      locationLabel: location_label,
      currentAqi,
      diurnalAnalysis,
      indoorSimulation,
      commuteComparison: commute_comparison,
      familyMembers: family_members,
      homeProfile: homeParams,
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
        ai_powered: adviceResult.ai_powered,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/advice/symptom-check
 */
export async function diagnoseSymptom(req, res, next) {
  try {
    const {
      lat,
      lng,
      location_label,
      member,
      symptom,
      custom_symptom,
      home_profile,
      commute_comparison,
      language,
    } = req.body;

    if (!lat || !lng) throw createApiError('lat and lng are required.', 400);
    if (!symptom && !custom_symptom) throw createApiError('symptom or custom_symptom is required.', 400);

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    const [currentAqi, forecastData] = await Promise.all([
      getCurrentConditions(latitude, longitude),
      getForecast(latitude, longitude, 48).catch(() => null),
    ]);

    const diurnalAnalysis = forecastData?.hourly ? analyzeDiurnalPattern(forecastData.hourly) : null;
    const homeParams = home_profile || {};
    const indoorSimulation = calculateIndoorPM25({
      outdoorPM25: currentAqi.pm25,
      roomAreaSqft: homeParams.room_area_sqft || 150,
      ceilingHeightFt: homeParams.ceiling_height_ft || 10,
      windowSealType: homeParams.window_seal_type || 'standard_aluminum',
      purifierCADR: homeParams.purifier_cadr || 0,
      indoorSource: homeParams.indoor_source || 'none',
      customWindowDesc: homeParams.custom_window_desc,
      customSourceDesc: homeParams.custom_source_desc,
    });

    const diagnosis = await diagnoseSymptomTrigger({
      locationLabel: location_label,
      currentAqi,
      diurnalAnalysis,
      indoorSimulation,
      commuteComparison: commute_comparison,
      homeProfile: homeParams,
      member,
      symptom,
      customSymptom: custom_symptom,
      language: language || 'English',
    });

    res.json({
      success: true,
      data: diagnosis,
    });
  } catch (err) {
    next(err);
  }
}
