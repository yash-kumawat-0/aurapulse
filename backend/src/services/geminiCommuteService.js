// ============================================
// Gemini Commute Exposure & Safe Route AI Service
// Evaluates real route legs, distances, and live AQI
// to generate personalized exposure insights & tips.
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
      description: 'Estimated total PM2.5 inhaled (µg) for the recommended route, grounded in candidate doses.',
    },
    headline_verdict: {
      type: 'string',
      description: 'Concise 1-sentence recommendation citing exact route/interchange, distance, and µg exposure.',
    },
    total_pollution_summary: {
      type: 'string',
      description: '1-2 sentence explanation comparing cleanest vs highest-exposure mode using provided telemetry.',
    },
    safer_route_tips: {
      type: 'array',
      items: { type: 'string' },
      description: 'Two to three specific tips tailored to the route legs (e.g. N95 on bus feeders, AC recirculation).',
    },
    mode_notes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          mode: { type: 'string' },
          note: { type: 'string' },
        },
        required: ['mode', 'note'],
      },
    },
  },
  required: [
    'recommended_mode',
    'ai_estimated_dose_ug',
    'headline_verdict',
    'total_pollution_summary',
    'safer_route_tips',
    'mode_notes',
  ],
};

const SYSTEM_PROMPT = `You are AuraPulse's environmental commute analyst.
Given live origin AQI, PM2.5 (µg/m³), trip distance/duration, and exact candidate routes (including Metro Interchanges and first/last-mile Walk/Bus legs), evaluate pollution inhalation and advise the safest practical path.
RULES:
1. Ground every number strictly in the JSON telemetry provided — never invent distances, stations, or doses.
2. Explain plainly why enclosed Metro / AC Car reduces lung inhalation vs open walking, cycling, or two-wheelers.
3. Keep each tip specific to the legs shown (e.g. metro interchange walk, bus feeder gaps, N95 usage).`;

/**
 * Generates Gemini AI exposure synthesis and safe path guidance across all evaluated routes.
 */
export async function generateCommuteAiAnalysis({
  originLabel,
  destinationLabel,
  originAqi,
  routes = [],
  language = 'English',
  overrideKey,
}) {
  const best = routes[0] || null;
  const worst = routes[routes.length - 1] || best;

  const telemetryContext = {
    trip: {
      origin: originLabel || `${originAqi?.latitude || ''},${originAqi?.longitude || ''}`,
      destination: destinationLabel || 'Destination',
      origin_aqi: originAqi?.aqi ?? null,
      origin_pm25_ug_m3: originAqi?.pm25 ?? null,
      aqi_category: originAqi?.aqi_category || 'Moderate',
    },
    candidate_routes: routes.map((r) => ({
      mode: r.mode,
      label: r.label,
      distance_km: r.distance_km,
      duration_min: r.duration_min,
      estimated_aqi: r.estimated_aqi,
      calculated_dose_ug: r.dose_ug,
      health_status: r.health_status?.label || null,
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

  const promptText = `Analyze these commute options for pollution exposure and recommend the safest path in ${language}.
DATA CONTEXT:
${JSON.stringify(telemetryContext, null, 2)}`;

  const aiRes = await generateWithFailover({
    contents: promptText,
    systemInstruction: SYSTEM_PROMPT,
    responseSchema: COMMUTE_AI_SCHEMA,
    overrideKey,
    temperature: 0.2,
  });

  if (aiRes.ok && aiRes.data) {
    return {
      ...aiRes.data,
      ai_powered: true,
      model: aiRes.model,
      key_slot: aiRes.key_slot,
      key_source: aiRes.key_source,
      prompt_preview: `Origin AQI ${telemetryContext.trip.origin_aqi} (${telemetryContext.trip.origin_pm25_ug_m3} µg/m³) across ${routes.length} modes (${telemetryContext.trip.origin} → ${telemetryContext.trip.destination})`,
      input_context: telemetryContext,
    };
  }

  // Honest deterministic fallback if AI quota/keys are unavailable
  const fallbackDose = best?.dose_ug ?? 0;
  const maxDose = worst?.dose_ug ?? fallbackDose;
  const savedPct = maxDose > 0 ? Math.max(0, Math.round(((maxDose - fallbackDose) / maxDose) * 100)) : 0;

  return {
    recommended_mode: best?.mode || 'METRO',
    ai_estimated_dose_ug: fallbackDose,
    headline_verdict: best
      ? `${best.label} (${best.mode}) keeps inhaled PM2.5 lowest at ${fallbackDose} µg over ${best.distance_km} km.`
      : 'Select enclosed transit to minimize roadside particulate inhalation.',
    total_pollution_summary: best && worst && worst.mode !== best.mode
      ? `Choosing ${best.mode} instead of ${worst.mode} (${maxDose} µg) cuts total trip inhalation by ~${savedPct}% at current AQI ${originAqi?.aqi ?? 150}.`
      : `Estimated total exposure is ${fallbackDose} µg based on live AQI and travel time.`,
    safer_route_tips: [
      best?.legs?.some((l) => l.mode === 'BUS' || l.mode === 'WALK')
        ? 'Wear a snug N95 mask on open Walk/Bus feeder legs and remove it inside filtered Metro cabins.'
        : 'Keep cabin AC set to Recirculate throughout road stretches.',
      'Avoid main-arterial traffic corridors during peak congestion hours when possible.',
    ],
    mode_notes: routes.map((r) => ({
      mode: r.mode,
      note: `${r.dose_ug} µg estimated over ${r.distance_km} km (${r.duration_min} min).`,
    })),
    ai_powered: false,
    model: 'aurapulse-commute-fallback',
    fallback_reason: aiRes.reason || null,
    key_slot: null,
    prompt_preview: `Fallback used (${aiRes.reason || 'no API key'}) for ${routes.length} modes.`,
    input_context: telemetryContext,
  };
}
