// ============================================
// DIY Air Purifier Sizer
// ============================================
// Calculates specifications for a Corsi-Rosenthal box — a low-cost
// DIY air purifier made from a box fan + MERV-13/HEPA filter panels.
//
// Cost: ₹1,200 - ₹1,800 vs ₹15,000 - ₹35,000 for branded units.
// Effectiveness: 300-400 m³/h CADR (comparable to mid-range purifiers).
// ============================================

/**
 * Standard DIY build configurations.
 */
export const DIY_CONFIGS = {
  basic_single: {
    label: 'Basic: 1 Fan + 1 Filter',
    filters: 1,
    fanSizeInch: 16,
    estimatedCADR: 180,
    costINR: 800,
    costUSD: 10,
  },
  standard_cube: {
    label: 'Standard Cube: 1 Fan + 4 Filters',
    filters: 4,
    fanSizeInch: 20,
    estimatedCADR: 350,
    costINR: 1500,
    costUSD: 18,
  },
  large_cube: {
    label: 'Large Cube: 1 Fan + 5 Filters',
    filters: 5,
    fanSizeInch: 24,
    estimatedCADR: 450,
    costINR: 2200,
    costUSD: 27,
  },
};

/**
 * Recommends a DIY purifier build based on room size and outdoor AQI.
 *
 * @param {object} params
 * @param {number} params.roomAreaSqft - Room floor area in square feet.
 * @param {number} params.ceilingHeightFt - Ceiling height (default 10).
 * @param {number} params.outdoorPM25 - Current outdoor PM2.5 (µg/m³).
 * @returns {object} DIY build recommendation with materials list.
 */
export function recommendDIYPurifier({
  roomAreaSqft = 150,
  ceilingHeightFt = 10,
  outdoorPM25 = 150,
}) {
  const volumeM3 = roomAreaSqft * 0.0929 * ceilingHeightFt * 0.3048;

  // Target: 5 air changes per hour for effective filtration
  const cadrNeeded = volumeM3 * 5;

  // Find the best matching DIY config
  let recommended = 'basic_single';
  if (cadrNeeded > 300) recommended = 'large_cube';
  else if (cadrNeeded > 150) recommended = 'standard_cube';

  // If outdoor PM2.5 is very high, upgrade recommendation
  if (outdoorPM25 > 200 && recommended === 'basic_single') {
    recommended = 'standard_cube';
  }

  const config = DIY_CONFIGS[recommended];
  const unitsNeeded = Math.ceil(cadrNeeded / config.estimatedCADR);

  return {
    room_volume_m3: Math.round(volumeM3 * 10) / 10,
    cadr_needed_m3h: Math.round(cadrNeeded),
    recommended_build: config.label,
    build_key: recommended,
    estimated_cadr: config.estimatedCADR,
    units_needed: unitsNeeded,
    total_estimated_cost_inr: config.costINR * unitsNeeded,
    total_estimated_cost_usd: config.costUSD * unitsNeeded,
    materials_list: [
      {
        item: `Box fan (${config.fanSizeInch}" / ${Math.round(config.fanSizeInch * 2.54)}cm)`,
        quantity: unitsNeeded,
        where_to_buy: 'Local hardware store or Amazon.in',
      },
      {
        item: 'MERV-13 or HEPA furnace filter panel (20"×20"×1")',
        quantity: config.filters * unitsNeeded,
        where_to_buy: 'Amazon.in, IndustryBuying.com, or local HVAC supplier',
      },
      {
        item: 'Cardboard for sealing edges',
        quantity: unitsNeeded,
        where_to_buy: 'Any packaging shop or reuse old boxes',
      },
      {
        item: 'Duct tape or packaging tape',
        quantity: unitsNeeded,
        where_to_buy: 'Stationery or hardware store',
      },
    ],
    assembly_steps: [
      'Arrange 4 filter panels in a square/cube shape (filter media facing inward).',
      'Tape the edges together tightly with duct tape — no air gaps.',
      'Seal the bottom with a cardboard square.',
      'Place the box fan on top (blowing upward/outward).',
      'Tape the fan to the filter cube, sealing all edges.',
      'Turn on the fan to medium or high speed.',
      'Replace filters every 2-3 months (or when visibly grey).',
    ],
    effectiveness_note: `This DIY purifier delivers ~${config.estimatedCADR} m³/h CADR, comparable to commercial purifiers costing ₹15,000+. Studies (Corsi et al., 2021) confirm 60-70% reduction in indoor PM2.5.`,
  };
}
