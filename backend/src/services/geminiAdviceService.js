// ============================================
// Gemini Advice Service
// ============================================
// Orchestrates the Gemini AI to generate personalized, structured
// air quality advice for families.
//
// CRITICAL RULE: Gemini NEVER generates or calculates numbers.
// All numerical values are computed deterministically by the
// physics engine and passed to Gemini as read-only context.
// Gemini only writes textual explanations and behavioral advice.
// ============================================
import { genAI, GEMINI_MODEL, ADVICE_RESPONSE_SCHEMA } from '../config/gemini.js';

/**
 * System prompt that strictly governs Gemini's behavior.
 */
const SYSTEM_PROMPT = `You are AuraPulse, a compassionate and practical air quality advisor for Indian families.

ABSOLUTE RULES:
1. NEVER invent, calculate, or guess any number. All numbers are provided to you in the DATA CONTEXT below — use them exactly as given.
2. NEVER mention specific medical dosages, drug names, or treatment plans. You are NOT a doctor.
3. Always speak in simple, warm, everyday language. Avoid jargon.
4. When mentioning times, use the 12-hour format (e.g., "2:30 PM", not "14:30").
5. Prioritize ACTIONABLE advice over fear. Don't just say "air is bad" — say what to DO.
6. For children and elderly, be extra gentle and specific.
7. Keep each tip to 1-2 sentences maximum.

Your job is to take the calculated environmental data and translate it into a family's daily game plan — like a caring neighbor who happens to know the science.`;

/**
 * Generates a structured family action plan using Gemini.
 *
 * @param {object} params
 * @param {object} params.currentAqi - Current AQI data from the Air Quality API.
 * @param {object} params.diurnalAnalysis - Output from diurnalOptimizer.
 * @param {object} params.indoorSimulation - Output from massBalanceModel.
 * @param {object} params.commuteComparison - Output from inhaledDoseModel (optional).
 * @param {Array} params.familyMembers - Array of { name, age, health_condition }.
 * @param {string} params.language - Preferred language (default: 'English').
 * @returns {Promise<object>} Structured JSON advice response.
 */
export async function generateFamilyAdvice({
  currentAqi,
  diurnalAnalysis,
  indoorSimulation,
  commuteComparison,
  familyMembers = [],
  language = 'English',
}) {
  if (!genAI) {
    return generateFallbackAdvice({ currentAqi, diurnalAnalysis, indoorSimulation, commuteComparison, familyMembers, language });
  }

  // Build the data context — these are the ONLY numbers Gemini can reference
  const dataContext = buildDataContext({
    currentAqi,
    diurnalAnalysis,
    indoorSimulation,
    commuteComparison,
    familyMembers,
  });

  const userPrompt = `Generate today's air quality action plan for this family.

Respond in: ${language}

DATA CONTEXT (use these numbers exactly, do not modify or recalculate):
${JSON.stringify(dataContext, null, 2)}

FAMILY MEMBERS:
${familyMembers.map((m) => `- ${m.name} (Age: ${m.age}, Condition: ${m.health_condition || 'None'})`).join('\n')}

Create the action plan following the response schema strictly.`;

  try {
    const result = await genAI.models.generateContent({
      model: GEMINI_MODEL,
      contents: userPrompt,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseSchema: ADVICE_RESPONSE_SCHEMA,
        temperature: 0.3,
      },
    });

    const responseText = result.text || '';
    const parsed = JSON.parse(responseText);
    return { success: true, advice: parsed, model: GEMINI_MODEL };
  } catch (err) {
    console.warn('Gemini API call failed, using rule-based advice fallback:', err.message);
    return generateFallbackAdvice({ currentAqi, diurnalAnalysis, indoorSimulation, commuteComparison, familyMembers, language });
  }
}

function generateFallbackAdvice({ currentAqi, diurnalAnalysis, indoorSimulation, familyMembers }) {
  const aqiVal = currentAqi?.aqi || 180;
  const cleanestWindow = diurnalAnalysis?.cleanest_window?.start_label
    ? `${diurnalAnalysis.cleanest_window.start_label} – ${diurnalAnalysis.cleanest_window.end_label}`
    : '2:00 PM – 4:30 PM';

  const familyAdvice = familyMembers.map((m) => {
    const cond = m.health_condition?.toUpperCase() || 'NONE';
    let risk_level = 'MODERATE';
    let primary_action = `Reschedule any outdoor physical exertion strictly to the ${cleanestWindow} clean air window.`;
    let detailed_tips = [
      'Keep car cabin air recirculation switched on during travel.',
      'Rinse face and eyes with fresh water after arriving home.',
    ];

    if (cond === 'ASTHMA' || cond === 'COPD') {
      risk_level = aqiVal > 150 ? 'SEVERE' : 'HIGH';
      primary_action = 'Keep preventative inhaler within reach and stay in a room with air filtration.';
      detailed_tips = [
        'Avoid stepping outside during the morning inversion (before 9:30 AM).',
        'Wear a tightly sealed N95/FFP2 respirator if transit is necessary.',
        'Avoid exposure to indoor agarbatti or frying fumes.',
      ];
    } else if (cond === 'HEART_CONDITION') {
      risk_level = 'HIGH';
      primary_action = 'Cancel early morning verandah or garden walks; cold winter smog constricts arteries.';
      detailed_tips = [
        `Take mild walks only between ${cleanestWindow} when particulate concentration is lowest.`,
        'Keep blood pressure and prescribed cardiovascular medication on strict schedule.',
        'Ensure the bedroom air is filtered before sleeping.',
      ];
    } else if (cond === 'INFANT' || cond === 'PREGNANT') {
      risk_level = 'HIGH';
      primary_action = 'Keep indoor nursery air clean and limit exposure to street traffic fumes.';
      detailed_tips = [
        'Ensure windows remain closed during morning peak traffic hours.',
        'Use wet mopping instead of dry broom sweeping to avoid kicking up settled dust.',
      ];
    }

    return {
      member_name: m.name,
      risk_level,
      primary_action,
      detailed_tips,
    };
  });

  return {
    success: true,
    advice: {
      overall_summary: `Current AQI is ${aqiVal} (${currentAqi?.aqi_category || 'Unhealthy'}). Winter atmospheric dynamics create severe particulate trapping in the early morning. Shift all outdoor routines to the afternoon clean window.`,
      family_advice: familyAdvice,
      ventilation_advice: `Open windows for 20-30 minutes only during the cleanest window (${cleanestWindow}) to air out stale indoor air without letting in peak smog.`,
      commute_advice: 'Choose enclosed public transit (Metro) or vehicle with AC recirculation over open two-wheelers to cut particulate lung deposition by more than half.',
    },
    model: 'aurapulse-expert-rule-engine',
  };
}

/**
 * Builds the read-only data context passed to Gemini.
 * This is the ONLY source of truth for all numbers.
 */
function buildDataContext({ currentAqi, diurnalAnalysis, indoorSimulation, commuteComparison }) {
  const context = {};

  if (currentAqi) {
    context.current_air_quality = {
      aqi: currentAqi.aqi,
      category: currentAqi.aqi_category,
      pm25_ug_m3: currentAqi.pm25,
      pm10_ug_m3: currentAqi.pm10,
      dominant_pollutant: currentAqi.dominant_pollutant,
    };
  }

  if (diurnalAnalysis && !diurnalAnalysis.error) {
    context.diurnal = {
      cleanest_window: diurnalAnalysis.cleanest_window,
      dirtiest_window: diurnalAnalysis.dirtiest_window,
      ventilation_advice: diurnalAnalysis.ventilation_recommendation,
      morning_trap_active: diurnalAnalysis.morning_trap_warning,
      daily_avg_pm25: diurnalAnalysis.daily_average_pm25,
    };
  }

  if (indoorSimulation) {
    context.indoor = {
      predicted_indoor_pm25: indoorSimulation.indoor_pm25,
      io_ratio_percent: indoorSimulation.io_ratio_percent,
      is_safe: indoorSimulation.is_safe,
      purifier_cadr_needed: indoorSimulation.cadr_needed_for_safe,
      recommendation: indoorSimulation.recommendation,
    };
  }

  if (commuteComparison) {
    context.commute = {
      route_a: {
        label: commuteComparison.route_a.label,
        dose_ug: commuteComparison.route_a.dose_ug,
        duration_min: commuteComparison.route_a.duration_min,
        co2_kg: commuteComparison.route_a.co2_kg,
      },
      route_b: {
        label: commuteComparison.route_b.label,
        dose_ug: commuteComparison.route_b.dose_ug,
        duration_min: commuteComparison.route_b.duration_min,
        co2_kg: commuteComparison.route_b.co2_kg,
      },
      safer_route: commuteComparison.comparison.safer_route,
      dose_reduction_percent: commuteComparison.comparison.dose_reduction_percent,
      co2_saved_kg: commuteComparison.comparison.co2_saved_kg,
    };
  }

  return context;
}
