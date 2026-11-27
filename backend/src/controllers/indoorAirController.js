// ============================================
// Indoor Air Controller (Calibrated Gemini Physics + Economics + Shopping)
// ============================================
import { calculateIndoorPM25, recommendPurifierSize } from '../engine/massBalanceModel.js';
import { recommendDIYPurifier } from '../engine/purifierSizer.js';
import { generateIndoorAiShoppingAndPlan } from '../services/geminiIndoorService.js';
import { createApiError } from '../middleware/errorHandler.js';

/**
 * POST /api/v1/indoor/simulate
 */
export async function simulateIndoorAir(req, res, next) {
  try {
    const {
      outdoor_pm25,
      room_area_sqft,
      ceiling_height_ft,
      window_seal_type,
      custom_window_desc,
      purifier_cadr,
      indoor_source,
      custom_source_desc,
      location_label,
      lat,
      lng,
      language,
      skip_ai,
    } = req.body;

    if (outdoor_pm25 === undefined) {
      throw createApiError('outdoor_pm25 is required.', 400);
    }

    const area = parseInt(room_area_sqft, 10) || 150;
    const height = parseInt(ceiling_height_ft, 10) || 10;
    const seal = window_seal_type || 'standard_aluminum';
    const src = indoor_source || 'none';
    const outPm = parseFloat(outdoor_pm25);

    const baseSim = calculateIndoorPM25({
      outdoorPM25: outPm,
      roomAreaSqft: area,
      ceilingHeightFt: height,
      windowSealType: seal,
      purifierCADR: parseFloat(purifier_cadr) || 0,
      indoorSource: src,
      customWindowDesc: custom_window_desc,
      customSourceDesc: custom_source_desc,
    });

    const purifierRec = recommendPurifierSize(area, height);
    const diyRec = recommendDIYPurifier({
      roomAreaSqft: area,
      ceilingHeightFt: height,
      outdoorPM25: outPm,
    });
    const diyTotalCadr = diyRec.estimated_cadr * diyRec.units_needed;

    const baseDiySim = calculateIndoorPM25({
      outdoorPM25: outPm,
      roomAreaSqft: area,
      ceilingHeightFt: height,
      windowSealType: seal,
      purifierCADR: diyTotalCadr,
      indoorSource: src,
      customWindowDesc: custom_window_desc,
      customSourceDesc: custom_source_desc,
    });

    const aiIndoorGuidance = !skip_ai
      ? await generateIndoorAiShoppingAndPlan({
          locationLabel: location_label,
          lat,
          lng,
          outdoorPm25: outPm,
          simulation: baseSim,
          diySimulation: baseDiySim,
          diyRec,
          roomAreaSqft: area,
          ceilingHeightFt: height,
          windowSealType: seal,
          customWindowDesc: custom_window_desc,
          indoorSource: src,
          customSourceDesc: custom_source_desc,
          language: language || 'English',
        })
      : null;

    const aiCal = aiIndoorGuidance?.calibrated_physics || null;

    const simulation = aiCal
      ? {
          ...calculateIndoorPM25({
            outdoorPM25: outPm,
            roomAreaSqft: area,
            ceilingHeightFt: height,
            windowSealType: seal,
            purifierCADR: parseFloat(purifier_cadr) || 0,
            indoorSource: src,
            customWindowDesc: custom_window_desc,
            customSourceDesc: custom_source_desc,
            aiCalibration: aiCal,
          }),
          ai_calibrated: true,
          ai_seal_note: aiCal.ai_adjusted_label || null,
        }
      : { ...baseSim, ai_calibrated: false };

    const diySimulation = aiCal
      ? calculateIndoorPM25({
          outdoorPM25: outPm,
          roomAreaSqft: area,
          ceilingHeightFt: height,
          windowSealType: seal,
          purifierCADR: diyTotalCadr,
          indoorSource: src,
          customWindowDesc: custom_window_desc,
          customSourceDesc: custom_source_desc,
          aiCalibration: aiCal,
        })
      : baseDiySim;

    const sourceFreeSimulation = calculateIndoorPM25({
      outdoorPM25: outPm,
      roomAreaSqft: area,
      ceilingHeightFt: height,
      windowSealType: seal,
      purifierCADR: parseFloat(purifier_cadr) || 0,
      indoorSource: 'none',
      customWindowDesc: custom_window_desc,
      aiCalibration: aiCal ? { ...aiCal, source_rate_ug_h: 0 } : null,
    });

    res.json({
      success: true,
      data: {
        simulation,
        diy_simulation: diySimulation,
        source_free_simulation: sourceFreeSimulation,
        purifier_recommendation: purifierRec,
        diy_purifier: diyRec,
        ai_indoor_guidance: aiIndoorGuidance,
      },
    });
  } catch (err) {
    next(err);
  }
}
