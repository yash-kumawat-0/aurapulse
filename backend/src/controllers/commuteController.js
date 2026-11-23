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
  BUS: 0.6,         // Cabin filtration but road-level intake
  WALK: 1.0,
  BICYCLE: 1.3,
};

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

    // Calculate dose for each route
    const results = routes.map((route) => {
      const multiplier = PM25_MULTIPLIERS[route.mode] || 1.0;
      const effectivePM25 = basePM25 * multiplier;

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

    // Mark the safest
    if (results.length > 0) {
      results[0].is_safest = true;
    }

    res.json({
      success: true,
      data: {
        routes: results,
        base_pm25: basePM25,
        origin_aqi: originAqi.aqi,
        safest_mode: results[0]?.mode || null,
      },
    });
  } catch (err) {
    next(err);
  }
}
