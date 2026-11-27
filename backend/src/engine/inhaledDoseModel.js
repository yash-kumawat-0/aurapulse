// ============================================
// Inhaled Particulate Dose Calculator
// ============================================
// Computes the total mass of PM2.5 inhaled during a commute
// or outdoor activity using:
//
//   Dose = Σ (C_j × V_E(MET) × Δt_j × (1 - η_mask))
//
// Where:
//   C_j      = PM2.5 concentration along route segment j (µg/m³)
//   V_E      = Minute ventilation volume (L/min), from MET level
//   Δt_j     = Time spent in segment j (minutes)
//   η_mask   = Mask filtration efficiency (0.0 to 0.95)
// ============================================

/**
 * Metabolic Equivalent of Task (MET) to Minute Ventilation mapping.
 * V_E (L/min) ≈ MET × 7.0 (approximate for average adult)
 */
export const ACTIVITY_MODES = {
  resting_in_vehicle: { met: 1.3, ve: 9, label: 'Sitting in car/bus/metro' },
  walking_slow: { met: 2.5, ve: 18, label: 'Slow walking' },
  walking_brisk: { met: 3.5, ve: 25, label: 'Brisk walking' },
  cycling: { met: 5.0, ve: 35, label: 'Cycling' },
  two_wheeler: { met: 2.0, ve: 14, label: 'Riding scooter/motorcycle' },
  jogging: { met: 7.0, ve: 50, label: 'Jogging / Running' },
};

/**
 * Mask filtration efficiency values.
 */
export const MASK_TYPES = {
  none: { efficiency: 0.0, label: 'No mask' },
  cloth: { efficiency: 0.15, label: 'Cloth mask' },
  surgical: { efficiency: 0.25, label: 'Surgical mask' },
  kn95: { efficiency: 0.85, label: 'KN95 mask' },
  n95_sealed: { efficiency: 0.95, label: 'N95 / FFP2 (properly sealed)' },
};

/**
 * Calculates total inhaled PM2.5 dose for a single activity/commute segment.
 *
 * @param {object} params
 * @param {number} params.pm25Concentration - Average PM2.5 along path (µg/m³).
 * @param {number} params.durationMinutes - Time spent in this segment (minutes).
 * @param {string} params.activityMode - Key from ACTIVITY_MODES.
 * @param {string} params.maskType - Key from MASK_TYPES.
 * @returns {object} Dose calculation result.
 */
export function calculateSegmentDose({
  pm25Concentration,
  durationMinutes,
  activityMode = 'resting_in_vehicle',
  maskType = 'none',
}) {
  const activity = ACTIVITY_MODES[activityMode] || ACTIVITY_MODES.resting_in_vehicle;
  const mask = MASK_TYPES[maskType] || MASK_TYPES.none;

  // Dose (µg) = C (µg/m³) × V_E (L/min) × t (min) × (1 - η) × (1m³/1000L)
  const doseUg = (pm25Concentration * activity.ve * durationMinutes * (1 - mask.efficiency)) / 1000;

  return {
    dose_ug: Math.round(doseUg * 100) / 100,
    pm25_exposure: pm25Concentration,
    duration_min: durationMinutes,
    ventilation_rate_lpm: activity.ve,
    mask_efficiency: mask.efficiency,
    activity: activity.label,
    mask: mask.label,
  };
}

/**
 * Compares two commute options by computing total inhaled dose for each.
 *
 * @param {object} params
 * @param {object} params.routeA - { pm25: number, durationMin: number, activityMode: string, distanceKm: number }
 * @param {object} params.routeB - Same structure as routeA.
 * @param {string} params.maskType - Mask type applied equally to both routes.
 * @returns {object} Comparison result with dose, CO2, and recommendation.
 */
export function compareCommuteDoses({ routeA, routeB, maskType = 'none' }) {
  const doseA = calculateSegmentDose({
    pm25Concentration: routeA.pm25,
    durationMinutes: routeA.durationMin,
    activityMode: routeA.activityMode || 'two_wheeler',
    maskType,
  });

  const doseB = calculateSegmentDose({
    pm25Concentration: routeB.pm25,
    durationMinutes: routeB.durationMin,
    activityMode: routeB.activityMode || 'resting_in_vehicle',
    maskType,
  });

  // CO2 emission estimates (kg per km)
  const CO2_FACTORS = {
    two_wheeler: 0.05, // ~50g/km for 125cc scooter
    resting_in_vehicle: 0.02, // Metro/bus per passenger
    walking_slow: 0,
    walking_brisk: 0,
    cycling: 0,
    jogging: 0,
  };

  const co2A = (CO2_FACTORS[routeA.activityMode || 'two_wheeler'] || 0.05) * (routeA.distanceKm || 0);
  const co2B = (CO2_FACTORS[routeB.activityMode || 'resting_in_vehicle'] || 0.02) * (routeB.distanceKm || 0);
  const co2SavedKg = Math.round((co2A - co2B) * 100) / 100;

  const doseDiffPercent =
    doseA.dose_ug > 0 ? Math.round(((doseA.dose_ug - doseB.dose_ug) / doseA.dose_ug) * 100) : 0;

  const saferRoute = doseA.dose_ug <= doseB.dose_ug ? 'A' : 'B';
  const timeDiffMin = Math.round(routeB.durationMin - routeA.durationMin);

  return {
    route_a: {
      ...doseA,
      distance_km: routeA.distanceKm,
      co2_kg: Math.round(co2A * 100) / 100,
      label: routeA.label || 'Route A',
    },
    route_b: {
      ...doseB,
      distance_km: routeB.distanceKm,
      co2_kg: Math.round(co2B * 100) / 100,
      label: routeB.label || 'Route B',
    },
    comparison: {
      safer_route: saferRoute,
      dose_reduction_percent: Math.abs(doseDiffPercent),
      time_difference_min: timeDiffMin,
      co2_saved_kg: co2SavedKg > 0 ? co2SavedKg : 0,
    },
  };
}
