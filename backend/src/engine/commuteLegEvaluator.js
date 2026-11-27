// ============================================
// Commute Leg & Exposure Evaluation Engine
// Shared calculation logic for single-mode, multi-compare,
// and multi-leg transit dose scoring.
// ============================================
import { calculateSegmentDose } from './inhaledDoseModel.js';

export const PM25_MULTIPLIERS = {
  DRIVE: 1.2,
  TWO_WHEELER: 1.4,
  TRANSIT: 0.4,
  METRO: 0.3,
  TRANSFER: 0.35,
  BUS: 0.6,
  WALK: 1.0,
  BICYCLE: 1.3,
};

export const ACTIVITY_BY_MODE = {
  DRIVE: 'resting_in_vehicle',
  TWO_WHEELER: 'two_wheeler',
  TRANSIT: 'resting_in_vehicle',
  METRO: 'resting_in_vehicle',
  TRANSFER: 'walking_slow',
  BUS: 'resting_in_vehicle',
  WALK: 'walking_brisk',
  BICYCLE: 'cycling',
};

export const CO2_FACTORS = {
  DRIVE: 0.12,
  TWO_WHEELER: 0.05,
  TRANSIT: 0.02,
  METRO: 0.015,
  BUS: 0.025,
  WALK: 0,
  BICYCLE: 0,
};

/**
 * Converts PM2.5 concentration (µg/m³) into approximate AQI.
 *
 * @param {number} pm - PM2.5 concentration.
 * @returns {number} Integer AQI value.
 */
export function pm25ToAqi(pm) {
  if (pm <= 12) return Math.round((pm / 12) * 50);
  if (pm <= 35.4) return Math.round(50 + ((pm - 12) / 23.4) * 50);
  if (pm <= 55.4) return Math.round(100 + ((pm - 35.4) / 20) * 50);
  if (pm <= 150.4) return Math.round(150 + ((pm - 55.4) / 95) * 50);
  if (pm <= 250.4) return Math.round(200 + ((pm - 150.4) / 100) * 100);
  return Math.round(300 + ((pm - 250.4) / 150) * 150);
}

/**
 * Categorizes total inhaled commute dose and average trip AQI into health status.
 *
 * @param {number} totalDoseUg - Total µg PM2.5 inhaled.
 * @param {number} avgAqi - Average trip AQI.
 * @returns {{ level: string, label: string, advice: string }}
 */
export function getCommuteHealthStatus(totalDoseUg, avgAqi) {
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
 * Evaluates a multi-leg route chain (e.g. Walk -> Metro -> Transfer -> Bus).
 *
 * @param {object} route - Candidate route with nested legs array.
 * @param {number} basePM25 - Origin ambient PM2.5.
 * @param {string} maskType - Active mask filter type.
 * @returns {object} Evaluated route summary and counterfactual walk/N95 baselines.
 */
export function evaluateMultiLegRoute(route, basePM25, maskType = 'none') {
  const evalLegs = route.legs.map((leg) => {
    const mode = leg.mode || 'WALK';
    const mult = PM25_MULTIPLIERS[mode] || 1.0;
    const effectivePm = Math.round(basePM25 * mult * 10) / 10;
    const durMin = Math.max(1, leg.duration_min || 10);
    const distKm = Math.max(0.1, leg.distance_km || 1);
    const activity = leg.activity_mode || ACTIVITY_BY_MODE[mode] || 'resting_in_vehicle';

    const doseRes = calculateSegmentDose({
      pm25Concentration: effectivePm,
      durationMinutes: durMin,
      activityMode: activity,
      maskType,
    });

    const co2 = Math.round((CO2_FACTORS[mode] || 0) * distKm * 100) / 100;

    return {
      role: leg.role || 'segment',
      mode,
      line_name: leg.line_name || null,
      coverage_pct: leg.coverage_pct || null,
      distance_km: Math.round(distKm * 10) / 10,
      duration_min: Math.round(durMin),
      effective_pm25: effectivePm,
      effective_aqi: pm25ToAqi(effectivePm),
      dose_ug: doseRes.dose_ug,
      co2_kg: co2,
    };
  });

  const totalDose = Math.round(evalLegs.reduce((s, l) => s + l.dose_ug, 0) * 100) / 100;
  const totalDur = Math.round(evalLegs.reduce((s, l) => s + l.duration_min, 0));
  const totalDist = Math.round(evalLegs.reduce((s, l) => s + l.distance_km, 0) * 10) / 10;
  const totalCo2 = Math.round(evalLegs.reduce((s, l) => s + l.co2_kg, 0) * 100) / 100;
  const weightedPm =
    totalDur > 0
      ? Math.round((evalLegs.reduce((s, l) => s + l.effective_pm25 * l.duration_min, 0) / totalDur) * 10) / 10
      : basePM25;
  const tripAqi = pm25ToAqi(weightedPm);

  const walkGapDose =
    Math.round(
      evalLegs.reduce((s, l) => {
        if (l.mode === 'METRO' || l.mode === 'TRANSFER') return s + l.dose_ug;
        const wPm = Math.round(basePM25 * PM25_MULTIPLIERS.WALK * 10) / 10;
        const wDur = Math.max(l.duration_min, Math.round((l.distance_km / 4.8) * 60));
        return (
          s +
          calculateSegmentDose({
            pm25Concentration: wPm,
            durationMinutes: wDur,
            activityMode: 'walking_brisk',
            maskType,
          }).dose_ug
        );
      }, 0) * 100,
    ) / 100;

  const n95FeederDose =
    Math.round(
      evalLegs.reduce((s, l) => {
        if (l.mode === 'METRO' || l.mode === 'TRANSFER') return s + l.dose_ug;
        return (
          s +
          calculateSegmentDose({
            pm25Concentration: l.effective_pm25,
            durationMinutes: l.duration_min,
            activityMode: ACTIVITY_BY_MODE[l.mode] || 'resting_in_vehicle',
            maskType: 'n95_sealed',
          }).dose_ug
        );
      }, 0) * 100,
    ) / 100;

  return {
    mode: route.mode,
    label: route.label || route.mode,
    dose_ug: totalDose,
    pm25_exposure: weightedPm,
    estimated_aqi: tripAqi,
    health_status: getCommuteHealthStatus(totalDose, tripAqi),
    distance_km: totalDist,
    duration_min: totalDur,
    co2_kg: totalCo2,
    legs: evalLegs,
    walk_gap_dose_ug: walkGapDose,
    n95_feeder_dose_ug: n95FeederDose,
  };
}

/**
 * Evaluates a single-mode commute route (Drive, Two-Wheeler, Walk, Bicycle).
 *
 * @param {object} route - Single-mode route metrics.
 * @param {number} basePM25 - Origin ambient PM2.5.
 * @param {string} maskType - Active mask filter type.
 * @returns {object}
 */
export function evaluateSingleModeRoute(route, basePM25, maskType = 'none') {
  const multiplier = PM25_MULTIPLIERS[route.mode] || 1.0;
  const effectivePM25 = Math.round(basePM25 * multiplier * 10) / 10;
  const effAqi = pm25ToAqi(effectivePM25);

  const dose = calculateSegmentDose({
    pm25Concentration: effectivePM25,
    durationMinutes: route.duration_min,
    activityMode: route.activity_mode || 'resting_in_vehicle',
    maskType,
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
}
