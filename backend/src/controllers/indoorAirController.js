// ============================================
// Indoor Air Controller
// ============================================
import { calculateIndoorPM25, recommendPurifierSize } from '../engine/massBalanceModel.js';
import { recommendDIYPurifier } from '../engine/purifierSizer.js';
import { createApiError } from '../middleware/errorHandler.js';

/**
 * POST /api/v1/indoor/simulate
 * Simulates indoor air quality based on room parameters and outdoor AQI.
 */
export async function simulateIndoorAir(req, res, next) {
  try {
    const {
      outdoor_pm25,
      room_area_sqft,
      ceiling_height_ft,
      window_seal_type,
      purifier_cadr,
      indoor_source,
    } = req.body;

    if (outdoor_pm25 === undefined) {
      throw createApiError('outdoor_pm25 is required.', 400);
    }

    const simulation = calculateIndoorPM25({
      outdoorPM25: parseFloat(outdoor_pm25),
      roomAreaSqft: parseInt(room_area_sqft) || 150,
      ceilingHeightFt: parseInt(ceiling_height_ft) || 10,
      windowSealType: window_seal_type || 'standard_aluminum',
      purifierCADR: parseFloat(purifier_cadr) || 0,
      indoorSource: indoor_source || 'none',
    });

    const purifierRec = recommendPurifierSize(
      parseInt(room_area_sqft) || 150,
      parseInt(ceiling_height_ft) || 10,
    );

    const diyRec = recommendDIYPurifier({
      roomAreaSqft: parseInt(room_area_sqft) || 150,
      ceilingHeightFt: parseInt(ceiling_height_ft) || 10,
      outdoorPM25: parseFloat(outdoor_pm25),
    });

    const diyTotalCadr = diyRec.estimated_cadr * diyRec.units_needed;

    const diySimulation = calculateIndoorPM25({
      outdoorPM25: parseFloat(outdoor_pm25),
      roomAreaSqft: parseInt(room_area_sqft) || 150,
      ceilingHeightFt: parseInt(ceiling_height_ft) || 10,
      windowSealType: window_seal_type || 'standard_aluminum',
      purifierCADR: diyTotalCadr,
      indoorSource: indoor_source || 'none',
    });

    const sourceFreeSimulation = calculateIndoorPM25({
      outdoorPM25: parseFloat(outdoor_pm25),
      roomAreaSqft: parseInt(room_area_sqft) || 150,
      ceilingHeightFt: parseInt(ceiling_height_ft) || 10,
      windowSealType: window_seal_type || 'standard_aluminum',
      purifierCADR: parseFloat(purifier_cadr) || 0,
      indoorSource: 'none',
    });

    res.json({
      success: true,
      data: {
        simulation,
        diy_simulation: diySimulation,
        source_free_simulation: sourceFreeSimulation,
        purifier_recommendation: purifierRec,
        diy_purifier: diyRec,
      },
    });
  } catch (err) {
    next(err);
  }
}
