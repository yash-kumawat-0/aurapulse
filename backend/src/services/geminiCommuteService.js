// ============================================
// Gemini Commute Exposure & Safe Route AI Service
// Evaluates fresh user route legs, distances & live AQI
// to return visual stickers and route recommendations.
// ============================================
import { generateWithFailover } from '../config/gemini.js';

const COMMUTE_AI_SCHEMA = {
  type: 'object',
  properties: {
    recommended_mode: {
      type: 'string',
      enum: ['DRIVE', 'TWO_WHEELER', 'METRO', 'BUS', 'WALK', 'BICYCLE'],
    },
    ai_estimated_dose_ug: {
      type: 'number',
    },
    reduction_vs_worst_pct: {
      type: 'integer',
    },
    headline_verdict: {
      type: 'string',
      description: 'Ultra-crisp label under 12 words (e.g., Metro cuts exposure 74% via Civil Court interchange).',
    },
    action_stickers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          icon: { type: 'string' },
          label: { type: 'string', description: 'Short 2-5 word visual chip (e.g. N95 on Bus Gap).' },
        },
        required: ['icon', 'label'],
      },
    },
    mode_notes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          mode: { type: 'string' },
          note: { type: 'string', description: 'Short 4-8 word takeaway.' },
        },
        required: ['mode', 'note'],
      },
    },
  },
  required: [
    'recommended_mode',
    'ai_estimated_dose_ug',
    'reduction_vs_worst_pct',
    'headline_verdict',
    'action_stickers',
    'mode_notes',
  ],
};

const SYSTEM_PROMPT = `You are AuraPulse's commute air-safety analyst.
Analyze the fresh trip inputs (live origin AQI, PM2.5, route distances, durations, and Metro/Bus/Walk leg chains) to recommend the safest mode and short scannable visual action stickers.
Use exact telemetry numbers; avoid long sentences — keep every badge short and immediately visual.`;

export async function generateCommuteAiAnalysis({
  originLabel,
  destinationLabel,
  originAqi,
  routes = [],
  language = 'English',
}) {
  const best = routes[0] || null;
  const worst = routes[routes.length - 1] || best;
  const bestDose = best?.dose_ug ?? 0;
  const worstDose = worst?.dose_ug ?? bestDose;
  const calcReduction = worstDose > 0 ? Math.max(0, Math.round(((worstDose - bestDose) / worstDose) * 100)) : 0;

  const telemetryContext = {
    trip: {
      origin: originLabel || `${originAqi?.latitude || ''},${originAqi?.longitude || ''}`,
      destination: destinationLabel || 'Destination',
      origin_aqi: originAqi?.aqi ?? null,
      origin_pm25_ug_m3: originAqi?.pm25 ?? null,
    },
    routes: routes.map((r) => ({
      mode: r.mode,
      label: r.label,
      distance_km: r.distance_km,
      duration_min: r.duration_min,
      estimated_aqi: r.estimated_aqi,
      calculated_dose_ug: r.dose_ug,
      legs: Array.isArray(r.legs)
        ? r.legs.map((l) => ({
            role: l.role,
            mode: l.mode,
            line_name: l.line_name,
            distance_km: l.distance_km,
            duration_min: l.duration_min,
            dose_ug: l.dose_ug,
          }))
        : null,
    })),
    language,
  };

  const aiRes = await generateWithFailover({
    contents: `Analyze this fresh commute trip in ${language}:\n${JSON.stringify(telemetryContext)}`,
    systemInstruction: SYSTEM_PROMPT,
    responseSchema: COMMUTE_AI_SCHEMA,
    temperature: 0.35,
  });

  if (aiRes.ok && aiRes.data) {
    return {
      ...aiRes.data,
      ai_powered: true,
      model: aiRes.model,
    };
  }

  return {
    recommended_mode: best?.mode || 'METRO',
    ai_estimated_dose_ug: bestDose,
    reduction_vs_worst_pct: calcReduction,
    headline_verdict: best
      ? `${best.label} (${bestDose} µg) · −${calcReduction}% exposure`
      : 'Enclosed transit minimizes smog intake',
    action_stickers: [
      ...(best?.legs?.some((l) => l.mode === 'BUS' || l.mode === 'WALK')
        ? [{ icon: '😷', label: 'N95 on Feeder Leg' }]
        : []),
      { icon: '❄️', label: 'AC Recirculate' },
      { icon: '🛡️', label: `Saves ${calcReduction}% PM2.5` },
    ],
    mode_notes: routes.map((r) => ({
      mode: r.mode,
      note: `${r.dose_ug} µg · ${r.distance_km} km`,
    })),
    ai_powered: false,
    model: 'aurapulse-commute-fallback',
  };
}
