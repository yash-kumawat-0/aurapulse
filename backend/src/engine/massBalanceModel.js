// ============================================
// Indoor Mass-Balance Air Quality Model
// ============================================
// Implements the single-compartment mass-balance equation:
//
//   dC_in/dt = P * a * C_out - (a + k + CADR/V) * C_in + S/V
//
// Where:
//   C_in  = Indoor PM2.5 concentration (µg/m³)
//   C_out = Outdoor PM2.5 concentration (µg/m³)
//   P     = Penetration efficiency (0.0 - 1.0)
//   a     = Air exchange rate (ACH, per hour)
//   k     = Surface deposition rate (per hour)
//   CADR  = Clean Air Delivery Rate of purifier (m³/h), 0 if none
//   V     = Room volume (m³)
//   S     = Indoor source generation rate (µg/h)
// ============================================

/**
 * Window seal type presets for Air Change per Hour (ACH).
 * These represent typical infiltration rates for Indian housing.
 */
export const WINDOW_SEAL_PRESETS = {
  leaky_wood: { ach: 2.5, penetration: 0.90, label: 'Old Wooden (Leaky)' },
  standard_aluminum: { ach: 1.5, penetration: 0.85, label: 'Standard Aluminum Sliding' },
  sealed_upvc: { ach: 0.5, penetration: 0.70, label: 'Modern UPVC/Sealed Glass' },
  other: { ach: 1.8, penetration: 0.85, label: 'Custom Window Setup' },
};

/**
 * Common indoor smoke sources and their PM2.5 generation rates (µg/h).
 */
export const INDOOR_SOURCES = {
  none: 0,
  incense: 800,          // Single agarbatti stick
  mosquito_coil: 2000,   // One burning coil
  cooking_frying: 1200,  // Frying/tempering in oil
  smoking_cigarette: 1500,
  other: 700,
};

function estimateCustomWindowSeal(desc) {
  const txt = String(desc || '').toLowerCase();
  if (!txt.trim()) return WINDOW_SEAL_PRESETS.other;
  if (/open|gap|crack|broken|exhaust|balcony|no glass/.test(txt)) {
    return { ach: 2.6, penetration: 0.92, label: desc.trim() };
  }
  if (/seal|ac|closed|double|airtight|tape/.test(txt)) {
    return { ach: 0.7, penetration: 0.74, label: desc.trim() };
  }
  return { ach: 1.7, penetration: 0.85, label: desc.trim() };
}

function estimateCustomSourceRate(desc) {
  const txt = String(desc || '').toLowerCase();
  if (!txt.trim()) return INDOOR_SOURCES.other;
  if (/wood|stove|chulha|coal|heavy smoke|cigar/.test(txt)) return 1800;
  if (/paint|renovation|drill|construction|cement|dust/.test(txt)) return 1100;
  if (/candle|diya|agarbatti|oil|fry/.test(txt)) return 650;
  if (/clean|none|pet/.test(txt)) return 300;
  return 750;
}

/**
 * Natural surface deposition rate for PM2.5 particles (per hour).
 * Gravity settling + surface adhesion.
 */
const DEFAULT_DEPOSITION_RATE = 0.3;

/**
 * Calculates steady-state indoor PM2.5 concentration.
 *
 * At steady state, dC_in/dt = 0, solving for C_in:
 *   C_in = (P * a * C_out + S/V) / (a + k + CADR/V)
 *
 * @param {object} params
 * @param {number} params.outdoorPM25 - Current outdoor PM2.5 (µg/m³).
 * @param {number} params.roomAreaSqft - Room floor area in square feet.
 * @param {number} params.ceilingHeightFt - Ceiling height in feet (default 10).
 * @param {string} params.windowSealType - Key from WINDOW_SEAL_PRESETS.
 * @param {number} params.purifierCADR - Purifier CADR in m³/h (0 if no purifier).
 * @param {string} params.indoorSource - Key from INDOOR_SOURCES.
 * @returns {object} Indoor air quality prediction.
 */
export function calculateIndoorPM25({
  outdoorPM25,
  roomAreaSqft = 150,
  ceilingHeightFt = 10,
  windowSealType = 'standard_aluminum',
  purifierCADR = 0,
  indoorSource = 'none',
  customWindowDesc = '',
  customSourceDesc = '',
}) {
  // Convert room dimensions to metric (m³)
  const roomAreaM2 = roomAreaSqft * 0.0929;
  const ceilingHeightM = ceilingHeightFt * 0.3048;
  const volumeM3 = roomAreaM2 * ceilingHeightM;

  // Get seal parameters (supports custom 'other' input dynamically)
  const seal = windowSealType === 'other'
    ? estimateCustomWindowSeal(customWindowDesc)
    : (WINDOW_SEAL_PRESETS[windowSealType] || WINDOW_SEAL_PRESETS.standard_aluminum);
  const P = seal.penetration;
  const a = seal.ach;
  const k = DEFAULT_DEPOSITION_RATE;
  const S = indoorSource === 'other'
    ? estimateCustomSourceRate(customSourceDesc)
    : (INDOOR_SOURCES[indoorSource] || 0);

  // Steady-state indoor PM2.5
  const numerator = (P * a * outdoorPM25) + (S / volumeM3);
  const denominator = a + k + (purifierCADR / volumeM3);
  const indoorPM25 = numerator / denominator;

  // Indoor-to-outdoor ratio
  const ioRatio = outdoorPM25 > 0 ? indoorPM25 / outdoorPM25 : 0;

  // Time constant (hours to reach ~63% of steady state)
  const timeConstantHours = 1 / denominator;

  // Calculate what purifier CADR would be needed to get indoor PM2.5 below 35 µg/m³
  // Target: 35 = (P * a * C_out + S/V) / (a + k + CADR_needed/V)
  // CADR_needed = V * ((P * a * C_out + S/V) / 35 - a - k)
  const targetIndoor = 35; // WHO 24-hour guideline
  const cadrNeeded = Math.max(
    0,
    volumeM3 * (numerator / targetIndoor - a - k)
  );

  return {
    indoor_pm25: Math.round(indoorPM25 * 10) / 10,
    outdoor_pm25: outdoorPM25,
    io_ratio: Math.round(ioRatio * 100) / 100,
    io_ratio_percent: Math.round(ioRatio * 100),
    room_volume_m3: Math.round(volumeM3 * 10) / 10,
    time_to_equilibrium_hours: Math.round(timeConstantHours * 10) / 10,
    seal_type: seal.label,
    ach_rate: a,
    indoor_source_ugph: S,
    purifier_cadr_applied: purifierCADR,
    cadr_needed_for_safe: Math.round(cadrNeeded),
    is_safe: indoorPM25 <= targetIndoor,
    recommendation: indoorPM25 <= targetIndoor
      ? 'Indoor air quality is within safe limits.'
      : purifierCADR > 0
        ? `Current purifier is insufficient. You need at least ${Math.round(cadrNeeded)} m³/h CADR to bring indoor PM2.5 below 35 µg/m³.`
        : `Without a purifier, indoor PM2.5 will reach ${Math.round(indoorPM25)} µg/m³. Consider a purifier with at least ${Math.round(cadrNeeded)} m³/h CADR, or build a DIY Corsi-Rosenthal box.`,
  };
}

/**
 * Calculates the recommended air purifier size for a room
 * using the ANSI/AHAM formula:
 *   CADR_recommended = Room Volume (m³) × 5 air changes per hour
 *   (industry standard: purifier should clean the room 5x/hour)
 *
 * @param {number} roomAreaSqft - Room floor area in square feet.
 * @param {number} ceilingHeightFt - Ceiling height in feet.
 * @returns {object} Purifier sizing recommendation.
 */
export function recommendPurifierSize(roomAreaSqft = 150, ceilingHeightFt = 10) {
  const volumeM3 = roomAreaSqft * 0.0929 * ceilingHeightFt * 0.3048;
  const targetACH = 5;
  const cadrNeeded = volumeM3 * targetACH;

  // DIY Corsi-Rosenthal box with 4x MERV-13 filters + box fan
  // typically delivers 300-400 m³/h CADR
  const diyCADR = 350;
  const diyCoversRoom = diyCADR >= cadrNeeded;

  return {
    room_volume_m3: Math.round(volumeM3 * 10) / 10,
    recommended_cadr_m3h: Math.round(cadrNeeded),
    recommended_cadr_cfm: Math.round(cadrNeeded / 1.699),
    diy_box_sufficient: diyCoversRoom,
    diy_box_cadr: diyCADR,
    guidance: diyCoversRoom
      ? 'A single DIY Corsi-Rosenthal box fan (₹1,200-1,800) will sufficiently clean this room.'
      : `This room needs ${Math.round(cadrNeeded)} m³/h CADR. Consider ${Math.ceil(cadrNeeded / diyCADR)} DIY box fans or a commercial purifier rated for this capacity.`,
  };
}
