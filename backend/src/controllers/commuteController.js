// ============================================
// Commute Controller
// ============================================
import { computeRoutes } from '../services/googleRoutesService.js';
import { getCurrentConditions, getForecast } from '../services/googleAirQualityService.js';
import { analyzeDiurnalPattern } from '../engine/diurnalOptimizer.js';
import { generateCommuteAiAnalysis, generateOriginCommuteBrief } from '../services/geminiCommuteService.js';
import { compareCommuteDoses, calculateSegmentDose } from '../engine/inhaledDoseModel.js';
import {
  PM25_MULTIPLIERS,
  ACTIVITY_BY_MODE,
  CO2_FACTORS,
  pm25ToAqi,
  getCommuteHealthStatus,
  evaluateMultiLegRoute,
  evaluateSingleModeRoute,
} from '../engine/commuteLegEvaluator.js';
import { createApiError } from '../middleware/errorHandler.js';

/**
 * POST /api/v1/commute/compare
 * Compares two commute modes by inhaled particulate dose and CO2.
 */
export async function compareCommutes(req, res, next) {
  try {
    const { origin, destination, modes, mask_type } = req.body;

    if (!origin?.latitude || !origin?.longitude) {
      throw createApiError('origin with latitude and longitude is required.', 400);
    }
    if (!destination?.latitude || !destination?.longitude) {
      throw createApiError('destination with latitude and longitude is required.', 400);
    }

    const travelModes = modes || ['TWO_WHEELER', 'TRANSIT'];
    const [originAqi, destAqi, routeResults] = await Promise.all([
      getCurrentConditions(origin.latitude, origin.longitude),
      getCurrentConditions(destination.latitude, destination.longitude),
      computeRoutes(origin, destination, travelModes),
    ]);

    const avgPM25 = Math.round(((originAqi.pm25 + destAqi.pm25) / 2) * 10) / 10;

    const comparison = compareCommuteDoses({
      pm25Concentration: avgPM25,
      routes: routeResults.routes,
      maskType: mask_type || 'none',
    });

    res.json({
      success: true,
      data: {
        comparison,
        base_pm25: avgPM25,
        origin_aqi: originAqi.aqi,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/commute/multi-compare
 * Compares all transport modes and queries Gemini AI for live timing + safety stickers.
 */
export async function multiCompare(req, res, next) {
  try {
    const { origin, routes, mask_type, origin_label, destination_label, language, skip_ai } = req.body;

    if (!origin?.latitude || !origin?.longitude) {
      throw createApiError('origin with latitude and longitude is required.', 400);
    }
    if (!routes || !Array.isArray(routes) || routes.length === 0) {
      throw createApiError('At least one route is required.', 400);
    }

    const [originAqi, forecastData] = await Promise.all([
      getCurrentConditions(origin.latitude, origin.longitude),
      getForecast(origin.latitude, origin.longitude, 48).catch(() => null),
    ]);
    const basePM25 = originAqi.pm25 || 100;
    const diurnalAnalysis = forecastData?.hourly ? analyzeDiurnalPattern(forecastData.hourly) : null;

    const results = routes.map((route) =>
      Array.isArray(route.legs) && route.legs.length > 0
        ? evaluateMultiLegRoute(route, basePM25, mask_type || 'none')
        : evaluateSingleModeRoute(route, basePM25, mask_type || 'none'),
    );

    results.sort((a, b) => a.dose_ug - b.dose_ug);
    if (results.length > 0) results[0].is_safest = true;

    const safestRoute = results[0] || null;
    const aiCommuteAnalysis = !skip_ai
      ? await generateCommuteAiAnalysis({
          originLabel: origin_label || origin?.label,
          destinationLabel: destination_label,
          originAqi,
          diurnalAnalysis,
          routes: results,
          language: language || 'English',
        })
      : null;

    res.json({
      success: true,
      data: {
        routes: results,
        base_pm25: basePM25,
        origin_aqi: originAqi.aqi,
        safest_mode: aiCommuteAnalysis?.recommended_mode || safestRoute?.mode || null,
        safest_route_summary: safestRoute,
        ai_commute_analysis: aiCommuteAnalysis,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/commute/multi-leg
 * Calculates total inhaled PM2.5, effective trip AQI, and safer counterfactuals.
 */
export async function calculateMultiLegCommute(req, res, next) {
  try {
    const { origin, legs, mask_type = 'none', base_pm25 } = req.body;

    if (!legs || !Array.isArray(legs) || legs.length === 0) {
      throw createApiError('At least one commute leg is required.', 400);
    }

    let basePM25 = parseFloat(base_pm25);
    let originAqiVal = null;
    if (!basePM25 && origin?.latitude && origin?.longitude) {
      const originAqi = await getCurrentConditions(origin.latitude, origin.longitude);
      basePM25 = originAqi.pm25 || 100;
      originAqiVal = originAqi.aqi;
    }
    if (!basePM25) basePM25 = 100;
    if (!originAqiVal) originAqiVal = pm25ToAqi(basePM25);

    const evaluatedLegs = legs.map((leg, idx) => {
      const mode = leg.mode || 'WALK';
      const durationMin = Math.max(1, parseFloat(leg.duration_min) || 10);
      const distanceKm = Math.max(0.1, parseFloat(leg.distance_km) || 1);
      const effectivePm = Math.round(basePM25 * (PM25_MULTIPLIERS[mode] || 1.0) * 10) / 10;
      const activityMode = leg.activity_mode || ACTIVITY_BY_MODE[mode] || 'resting_in_vehicle';
      const legMask = leg.mask_type || mask_type || 'none';

      const dose = calculateSegmentDose({
        pm25Concentration: effectivePm,
        durationMinutes: durationMin,
        activityMode,
        maskType: legMask,
      });

      return {
        index: idx,
        mode,
        duration_min: durationMin,
        distance_km: distanceKm,
        effective_pm25: effectivePm,
        effective_aqi: pm25ToAqi(effectivePm),
        dose_ug: dose.dose_ug,
        co2_kg: Math.round((CO2_FACTORS[mode] || 0) * distanceKm * 100) / 100,
        mask_type: legMask,
      };
    });

    const totalDoseUg = Math.round(evaluatedLegs.reduce((s, l) => s + l.dose_ug, 0) * 100) / 100;
    const totalDuration = Math.round(evaluatedLegs.reduce((s, l) => s + l.duration_min, 0));
    const totalDistance = Math.round(evaluatedLegs.reduce((s, l) => s + l.distance_km, 0) * 10) / 10;
    const totalCo2 = Math.round(evaluatedLegs.reduce((s, l) => s + l.co2_kg, 0) * 100) / 100;

    const weightedPm =
      totalDuration > 0
        ? Math.round(
            (evaluatedLegs.reduce((s, l) => s + l.effective_pm25 * l.duration_min, 0) / totalDuration) * 10,
          ) / 10
        : basePM25;
    const estimatedTripAqi = pm25ToAqi(weightedPm);

    const legsWithShare = evaluatedLegs.map((l) => ({
      ...l,
      share_percent: totalDoseUg > 0 ? Math.round((l.dose_ug / totalDoseUg) * 100) : 0,
    }));

    const healthStatus = getCommuteHealthStatus(totalDoseUg, estimatedTripAqi);
    const worstLeg = [...legsWithShare].sort((a, b) => b.dose_ug - a.dose_ug)[0];

    const exposedModes = new Set(['WALK', 'TWO_WHEELER', 'BICYCLE']);
    const maskedLegs = legsWithShare.map((l) => {
      if (!exposedModes.has(l.mode)) return l;
      const d = calculateSegmentDose({
        pm25Concentration: l.effective_pm25,
        durationMinutes: l.duration_min,
        activityMode: ACTIVITY_BY_MODE[l.mode] || 'walking_brisk',
        maskType: 'n95_sealed',
      });
      return { ...l, mask_type: 'n95_sealed', dose_ug: d.dose_ug };
    });
    const maskedDose = Math.round(maskedLegs.reduce((s, l) => s + l.dose_ug, 0) * 100) / 100;

    const directMetroPm = Math.round(basePM25 * PM25_MULTIPLIERS.METRO * 10) / 10;
    const directMetroDose = calculateSegmentDose({
      pm25Concentration: directMetroPm,
      durationMinutes: totalDuration,
      activityMode: 'resting_in_vehicle',
      maskType: mask_type || 'none',
    }).dose_ug;

    const saferOptions = [];
    if (maskedDose < totalDoseUg - 0.5) {
      saferOptions.push({
        id: 'n95-exposed',
        title: 'Wear N95 mask on open legs',
        desc: `Same route (${legsWithShare.map((l) => l.mode).join(' → ')}) with N95 mask.`,
        new_dose_ug: maskedDose,
        saved_ug: Math.round((totalDoseUg - maskedDose) * 100) / 100,
        reduction_percent: Math.round(((totalDoseUg - maskedDose) / Math.max(totalDoseUg, 0.1)) * 100),
      });
    }
    if (directMetroDose < totalDoseUg - 0.5) {
      saferOptions.push({
        id: 'direct-metro',
        title: 'Direct Metro corridor',
        desc: 'Use filtered Metro cabin air where stations connect.',
        new_dose_ug: directMetroDose,
        saved_ug: Math.round((totalDoseUg - directMetroDose) * 100) / 100,
        reduction_percent: Math.round(((totalDoseUg - directMetroDose) / Math.max(totalDoseUg, 0.1)) * 100),
      });
    }

    res.json({
      success: true,
      data: {
        legs: legsWithShare,
        totals: {
          total_dose_ug: totalDoseUg,
          total_duration_min: totalDuration,
          total_distance_km: totalDistance,
          total_co2_kg: totalCo2,
          weighted_avg_pm25: weightedPm,
          estimated_trip_aqi: estimatedTripAqi,
          origin_aqi: originAqiVal,
          base_pm25: basePM25,
        },
        worst_leg: worstLeg,
        health_status: healthStatus,
        safer_options: saferOptions.sort((a, b) => a.new_dose_ug - b.new_dose_ug),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/commute/location-brief
 * Instant live Gemini departure timing & street exposure brief for a Start location.
 */
export async function getOriginCommuteBrief(req, res, next) {
  try {
    const { lat, lng, origin_label, language } = req.body;
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    const [currentAqi, forecastData] = await Promise.all([
      getCurrentConditions(latitude, longitude),
      getForecast(latitude, longitude, 48).catch(() => null),
    ]);

    const diurnalAnalysis = forecastData?.hourly ? analyzeDiurnalPattern(forecastData.hourly) : null;
    const brief = await generateOriginCommuteBrief({
      originLabel: origin_label,
      currentAqi,
      diurnalAnalysis,
      language: language || 'English',
    });

    res.json({
      success: true,
      data: {
        aqi: currentAqi.aqi,
        pm25: currentAqi.pm25,
        diurnal_cleanest: diurnalAnalysis?.cleanest_window || null,
        diurnal_dirtiest: diurnalAnalysis?.dirtiest_window || null,
        brief,
      },
    });
  } catch (err) {
    next(err);
  }
}
