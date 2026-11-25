// ============================================
// Commute Controller
// ============================================
import { computeRoutes } from '../services/googleRoutesService.js';
import { getCurrentConditions } from '../services/googleAirQualityService.js';
import { compareCommuteDoses, calculateSegmentDose } from '../engine/inhaledDoseModel.js';
import { createApiError } from '../middleware/errorHandler.js';

/**
 * PM2.5 exposure multipliers by transport mode.
 * Models how much road-level pollution actually reaches the commuter.
 */
const PM25_MULTIPLIERS = {
  DRIVE: 1.2,
  TWO_WHEELER: 1.4,
  TRANSIT: 0.4,
  METRO: 0.3,       // Underground + filtered cabin air
  TRANSFER: 0.35,   // Indoor station platform interchange walk
  BUS: 0.6,         // Cabin filtration but road-level intake
  WALK: 1.0,
  BICYCLE: 1.3,
};

const ACTIVITY_BY_MODE = {
  DRIVE: 'resting_in_vehicle',
  TWO_WHEELER: 'two_wheeler',
  TRANSIT: 'resting_in_vehicle',
  METRO: 'resting_in_vehicle',
  TRANSFER: 'walking_slow',
  BUS: 'resting_in_vehicle',
  WALK: 'walking_brisk',
  BICYCLE: 'cycling',
};

const CO2_FACTORS = {
  DRIVE: 0.12,
  TWO_WHEELER: 0.05,
  TRANSIT: 0.02,
  METRO: 0.015,
  BUS: 0.025,
  WALK: 0,
  BICYCLE: 0,
};

// Approximate US-EPA / Indian AQI from PM2.5 (µg/m³)
function pm25ToAqi(pm) {
  if (pm <= 12) return Math.round((pm / 12) * 50);
  if (pm <= 35.4) return Math.round(50 + ((pm - 12) / 23.4) * 50);
  if (pm <= 55.4) return Math.round(100 + ((pm - 35.4) / 20) * 50);
  if (pm <= 150.4) return Math.round(150 + ((pm - 55.4) / 95) * 50);
  if (pm <= 250.4) return Math.round(200 + ((pm - 150.4) / 100) * 100);
  return Math.round(300 + ((pm - 250.4) / 150) * 150);
}

function getCommuteHealthStatus(totalDoseUg, avgAqi) {
  if (totalDoseUg <= 10 && avgAqi <= 80) {
    return {
      level: 'LOW',
      label: 'Low Risk · Healthy Commute',
      advice: 'Particulate load on your lungs stays low across this trip.',
    };
  }
  if (totalDoseUg <= 22 && avgAqi <= 140) {
    return {
      level: 'MODERATE',
      label: 'Moderate Exposure',
      advice: 'Manageable for healthy adults; sensitive riders benefit from a mask on walking legs.',
    };
  }
  if (totalDoseUg <= 40) {
    return {
      level: 'HIGH',
      label: 'High Exposure · Caution',
      advice: 'Heavy smog intake on open legs. Switching to enclosed transit or N95 is advised.',
    };
  }
  return {
    level: 'SEVERE',
    label: 'Severe Smog Intake',
    advice: 'High respiratory dose. Prefer Metro/closed transit and wear a sealed N95 mask.',
  };
}

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
    if (travelModes.length < 2) {
      throw createApiError('At least 2 travel modes are required for comparison.', 400);
    }

    const [routes, originAqi] = await Promise.all([
      computeRoutes(origin, destination, travelModes),
      getCurrentConditions(origin.latitude, origin.longitude),
    ]);

    if (routes.length < 2) {
      throw createApiError('Could not compute routes for both travel modes.', 500);
    }

    const avgPM25 = originAqi.pm25 || 100;
    const routeA = routes[0];
    const routeB = routes[1];

    const comparison = compareCommuteDoses({
      routeA: {
        pm25: avgPM25 * (PM25_MULTIPLIERS[routeA.travel_mode] || 1.0),
        durationMin: routeA.duration_min,
        activityMode: routeA.activity_mode,
        distanceKm: routeA.distance_km,
        label: routeA.label,
      },
      routeB: {
        pm25: avgPM25 * (PM25_MULTIPLIERS[routeB.travel_mode] || 1.0),
        durationMin: routeB.duration_min,
        activityMode: routeB.activity_mode,
        distanceKm: routeB.distance_km,
        label: routeB.label,
      },
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
 * Compares ALL transport modes at once — returns dose for each route.
 *
 * Body: {
 *   origin: { latitude, longitude },
 *   routes: [
 *     { mode: "DRIVE", distance_km: 12.3, duration_min: 25, activity_mode: "resting_in_vehicle" },
 *     { mode: "WALK", distance_km: 11.1, duration_min: 148, activity_mode: "walking_brisk" },
 *     ...
 *   ],
 *   mask_type: "none"
 * }
 */
export async function multiCompare(req, res, next) {
  try {
    const { origin, routes, mask_type } = req.body;

    if (!origin?.latitude || !origin?.longitude) {
      throw createApiError('origin with latitude and longitude is required.', 400);
    }
    if (!routes || !Array.isArray(routes) || routes.length === 0) {
      throw createApiError('At least one route is required.', 400);
    }

    // Get current air quality at origin
    const originAqi = await getCurrentConditions(origin.latitude, origin.longitude);
    const basePM25 = originAqi.pm25 || 100;

    // CO2 emission factors (kg per km)
    const CO2_FACTORS = {
      DRIVE: 0.12,
      TWO_WHEELER: 0.05,
      TRANSIT: 0.02,
      WALK: 0,
      BICYCLE: 0,
    };

    // Evaluate each route (supports single-mode routes AND automatic multi-leg chains like Bus -> Metro -> Walk)
    const results = routes.map((route) => {
      if (Array.isArray(route.legs) && route.legs.length > 0) {
        const evalLegs = route.legs.map((leg) => {
          const mode = leg.mode || 'WALK';
          const mult = PM25_MULTIPLIERS[mode] || 1.0;
          const effPm = Math.round(basePM25 * mult * 10) / 10;
          const dur = Math.max(1, parseFloat(leg.duration_min) || 5);
          const dist = Math.max(0.1, parseFloat(leg.distance_km) || 0.5);
          const dose = calculateSegmentDose({
            pm25Concentration: effPm,
            durationMinutes: dur,
            activityMode: leg.activity_mode || ACTIVITY_BY_MODE[mode] || 'resting_in_vehicle',
            maskType: leg.mask_type || mask_type || 'none',
          });
          return {
            role: leg.role || null,
            coverage_pct: leg.coverage_pct || null,
            line_name: leg.line_name || null,
            mode,
            duration_min: dur,
            distance_km: dist,
            effective_pm25: effPm,
            effective_aqi: pm25ToAqi(effPm),
            dose_ug: dose.dose_ug,
            co2_kg: Math.round((CO2_FACTORS[mode] || 0) * dist * 100) / 100,
          };
        });

        const totalDose = Math.round(evalLegs.reduce((s, l) => s + l.dose_ug, 0) * 100) / 100;
        const totalDur = Math.round(evalLegs.reduce((s, l) => s + l.duration_min, 0));
        const totalDist = Math.round(evalLegs.reduce((s, l) => s + l.distance_km, 0) * 10) / 10;
        const totalCo2 = Math.round(evalLegs.reduce((s, l) => s + l.co2_kg, 0) * 100) / 100;
        const weightedPm = totalDur > 0
          ? Math.round((evalLegs.reduce((s, l) => s + l.effective_pm25 * l.duration_min, 0) / totalDur) * 10) / 10
          : basePM25;
        const tripAqi = pm25ToAqi(weightedPm);
        const healthStatus = getCommuteHealthStatus(totalDose, tripAqi);

        // Compare vs walking those feeder gaps directly (and vs adding N95 on exposed gaps)
        const walkGapDose = Math.round(evalLegs.reduce((s, l) => {
          if (l.mode === 'METRO' || l.mode === 'TRANSFER') return s + l.dose_ug;
          const wPm = basePM25 * PM25_MULTIPLIERS.WALK;
          const wDur = Math.max(3, Math.round((l.distance_km / 4.8) * 60));
          return s + calculateSegmentDose({
            pm25Concentration: wPm,
            durationMinutes: wDur,
            activityMode: 'walking_brisk',
            maskType: mask_type || 'none',
          }).dose_ug;
        }, 0) * 100) / 100;

        const n95FeederDose = Math.round(evalLegs.reduce((s, l) => {
          if (l.mode === 'METRO' || l.mode === 'TRANSFER') return s + l.dose_ug;
          return s + calculateSegmentDose({
            pm25Concentration: l.effective_pm25,
            durationMinutes: l.duration_min,
            activityMode: ACTIVITY_BY_MODE[l.mode] || 'resting_in_vehicle',
            maskType: 'n95_sealed',
          }).dose_ug;
        }, 0) * 100) / 100;

        return {
          mode: route.mode,
          label: route.label || route.mode,
          dose_ug: totalDose,
          pm25_exposure: weightedPm,
          estimated_aqi: tripAqi,
          health_status: healthStatus,
          distance_km: totalDist,
          duration_min: totalDur,
          co2_kg: totalCo2,
          legs: evalLegs,
          walk_gap_dose_ug: walkGapDose,
          n95_feeder_dose_ug: n95FeederDose,
        };
      }

      const multiplier = PM25_MULTIPLIERS[route.mode] || 1.0;
      const effectivePM25 = Math.round(basePM25 * multiplier * 10) / 10;
      const effAqi = pm25ToAqi(effectivePM25);

      const dose = calculateSegmentDose({
        pm25Concentration: effectivePM25,
        durationMinutes: route.duration_min,
        activityMode: route.activity_mode || 'resting_in_vehicle',
        maskType: mask_type || 'none',
      });

      const co2Kg = Math.round((CO2_FACTORS[route.mode] || 0) * route.distance_km * 100) / 100;

      return {
        mode: route.mode,
        label: route.label || route.mode,
        dose_ug: dose.dose_ug,
        pm25_exposure: effectivePM25,
        estimated_aqi: effAqi,
        health_status: getCommuteHealthStatus(dose.dose_ug, effAqi),
        distance_km: route.distance_km,
        duration_min: route.duration_min,
        co2_kg: co2Kg,
        ventilation_rate_lpm: dose.ventilation_rate_lpm,
        activity: dose.activity,
        mask: dose.mask,
      };
    });

    // Sort by dose (safest first)
    results.sort((a, b) => a.dose_ug - b.dose_ug);

    if (results.length > 0) {
      results[0].is_safest = true;
    }

    // Attach crisp automated safe path suggestion across all evaluated modes
    const safestRoute = results[0] || null;
    res.json({
      success: true,
      data: {
        routes: results,
        base_pm25: basePM25,
        origin_aqi: originAqi.aqi,
        safest_mode: safestRoute?.mode || null,
        safest_route_summary: safestRoute,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/commute/multi-leg
 * Calculates total inhaled PM2.5, effective trip AQI, health status, and safer options
 * for a combined multi-modal journey (e.g., Walk -> Metro -> Bus).
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
      const mult = PM25_MULTIPLIERS[mode] || 1.0;
      const effectivePm = Math.round(basePM25 * mult * 10) / 10;
      const activityMode = leg.activity_mode || ACTIVITY_BY_MODE[mode] || 'resting_in_vehicle';
      const legMask = leg.mask_type || mask_type || 'none';

      const dose = calculateSegmentDose({
        pm25Concentration: effectivePm,
        durationMinutes: durationMin,
        activityMode,
        maskType: legMask,
      });

      const co2Kg = Math.round((CO2_FACTORS[mode] || 0) * distanceKm * 100) / 100;

      return {
        index: idx,
        mode,
        duration_min: durationMin,
        distance_km: distanceKm,
        effective_pm25: effectivePm,
        effective_aqi: pm25ToAqi(effectivePm),
        dose_ug: dose.dose_ug,
        co2_kg: co2Kg,
        mask_type: legMask,
      };
    });

    const totalDoseUg = Math.round(evaluatedLegs.reduce((s, l) => s + l.dose_ug, 0) * 100) / 100;
    const totalDuration = Math.round(evaluatedLegs.reduce((s, l) => s + l.duration_min, 0));
    const totalDistance = Math.round(evaluatedLegs.reduce((s, l) => s + l.distance_km, 0) * 10) / 10;
    const totalCo2 = Math.round(evaluatedLegs.reduce((s, l) => s + l.co2_kg, 0) * 100) / 100;

    const weightedPm = totalDuration > 0
      ? Math.round((evaluatedLegs.reduce((s, l) => s + l.effective_pm25 * l.duration_min, 0) / totalDuration) * 10) / 10
      : basePM25;
    const estimatedTripAqi = pm25ToAqi(weightedPm);

    const legsWithShare = evaluatedLegs.map((l) => ({
      ...l,
      share_percent: totalDoseUg > 0 ? Math.round((l.dose_ug / totalDoseUg) * 100) : 0,
    }));

    const healthStatus = getCommuteHealthStatus(totalDoseUg, estimatedTripAqi);

    // Highest-exposure leg identification
    const worstLeg = [...legsWithShare].sort((a, b) => b.dose_ug - a.dose_ug)[0];

    // Safer Option 1: Wear N95/FFP2 mask on exposed outdoor legs (Walk / Bike / Two-Wheeler)
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

    // Safer Option 2: Switch Bus/Two-Wheeler/Drive legs -> Metro (or enclosed Bus for Walk > 10m)
    const enclosedLegs = legsWithShare.map((l) => {
      let betterMode = l.mode;
      if (l.mode === 'TWO_WHEELER' || l.mode === 'BICYCLE') betterMode = 'METRO';
      else if (l.mode === 'BUS' || l.mode === 'DRIVE') betterMode = 'METRO';
      else if (l.mode === 'WALK' && l.duration_min >= 10) betterMode = 'BUS';

      const effPm = Math.round(basePM25 * (PM25_MULTIPLIERS[betterMode] || 0.3) * 10) / 10;
      const d = calculateSegmentDose({
        pm25Concentration: effPm,
        durationMinutes: l.duration_min,
        activityMode: ACTIVITY_BY_MODE[betterMode] || 'resting_in_vehicle',
        maskType: l.mask_type,
      });
      return { ...l, mode: betterMode, effective_pm25: effPm, dose_ug: d.dose_ug };
    });
    const enclosedDose = Math.round(enclosedLegs.reduce((s, l) => s + l.dose_ug, 0) * 100) / 100;

    // Safer Option 3: Single Direct Metro commute for whole duration
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
        desc: `Same route (${legsWithShare.map((l) => l.mode).join(' → ')}) with N95 mask when walking/riding.`,
        new_dose_ug: maskedDose,
        saved_ug: Math.round((totalDoseUg - maskedDose) * 100) / 100,
        reduction_percent: Math.round(((totalDoseUg - maskedDose) / Math.max(totalDoseUg, 0.1)) * 100),
        suggested_legs: maskedLegs.map((l) => ({ mode: l.mode, duration_min: l.duration_min, distance_km: l.distance_km, mask_type: l.mask_type })),
      });
    }
    if (enclosedDose < totalDoseUg - 0.5) {
      saferOptions.push({
        id: 'upgrade-transit',
        title: 'Shift exposed legs to Metro / Bus',
        desc: `Suggested steps: ${enclosedLegs.map((l) => l.mode).join(' → ')}`,
        new_dose_ug: enclosedDose,
        saved_ug: Math.round((totalDoseUg - enclosedDose) * 100) / 100,
        reduction_percent: Math.round(((totalDoseUg - enclosedDose) / Math.max(totalDoseUg, 0.1)) * 100),
        suggested_legs: enclosedLegs.map((l) => ({ mode: l.mode, duration_min: l.duration_min, distance_km: l.distance_km, mask_type: l.mask_type })),
      });
    }
    if (directMetroDose < totalDoseUg - 0.5) {
      saferOptions.push({
        id: 'direct-metro',
        title: 'Direct Metro corridor',
        desc: 'Use filtered Metro cabin air for the full trip where stations connect.',
        new_dose_ug: directMetroDose,
        saved_ug: Math.round((totalDoseUg - directMetroDose) * 100) / 100,
        reduction_percent: Math.round(((totalDoseUg - directMetroDose) / Math.max(totalDoseUg, 0.1)) * 100),
        suggested_legs: [{ mode: 'METRO', duration_min: totalDuration, distance_km: totalDistance, mask_type: mask_type || 'none' }],
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
