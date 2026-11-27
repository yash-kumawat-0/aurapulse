// ============================================
// Gemini Commute Exposure, Timing & Visual Stickers AI Service
// Evaluates fresh user location, route legs, distances, hourly
// forecast & live AQI to return visual emojis and smart timing.
// ============================================
import { generateWithFailover } from '../config/gemini.js';

const COMMUTE_BRIEF_SCHEMA = {
  type: 'object',
  properties: {
    best_leave_window: {
      type: 'string',
      description: 'Crisp optimal departure time window (e.g., 10:00 AM – 12:00 PM).',
    },
    avoid_window: {
      type: 'string',
      description: 'Worst smog trapping window (e.g., 7:00 AM – 9:00 AM).',
    },
    departure_savings_pct: {
      type: 'integer',
      description: 'Estimated percent PM2.5 saved by leaving during best_leave_window vs avoid_window.',
    },
    headline_verdict: {
      type: 'string',
      description: 'Ultra-short scannable headline under 10 words.',
    },
    recommended_quick_mode: {
      type: 'string',
      enum: ['METRO', 'TRANSIT', 'DRIVE', 'BUS', 'TWO_WHEELER', 'WALK', 'BICYCLE'],
    },
    origin_stickers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          emoji: { type: 'string', description: 'Single Unicode emoji character like 🚇, 😷, ⏰, 🌬️.' },
          label: { type: 'string', description: 'Short 2-5 word chip.' },
        },
        required: ['emoji', 'label'],
      },
    },
  },
  required: [
    'best_leave_window',
    'avoid_window',
    'departure_savings_pct',
    'headline_verdict',
    'recommended_quick_mode',
    'origin_stickers',
  ],
};

const COMMUTE_AI_SCHEMA = {
  type: 'object',
  properties: {
    recommended_mode: {
      type: 'string',
      enum: ['DRIVE', 'TWO_WHEELER', 'METRO', 'BUS', 'WALK', 'BICYCLE'],
    },
    ai_estimated_dose_ug: { type: 'number' },
    reduction_vs_worst_pct: { type: 'integer' },
    cigarette_equivalent: {
      type: 'number',
      description: 'Equivalent cigarettes smoked (roughly dose_ug / 22 rounded to 1 decimal).',
    },
    best_leave_window: {
      type: 'string',
      description: 'Best time window to leave based on hourly PM2.5 & PBL forecast (e.g. 10:00 AM – 1:00 PM).',
    },
    departure_savings_pct: { type: 'integer' },
    headline_verdict: {
      type: 'string',
      description: 'Ultra-crisp verdict under 11 words.',
    },
    safe_tip_sticker: {
      type: 'string',
      description: 'Crisp actionable travel tip under 12 words using live route specifics.',
    },
    action_stickers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          emoji: { type: 'string', description: 'Single Unicode emoji character ONLY (e.g. 🛡️, 😷, ❄️, ⏰). Never plain text words.' },
          label: { type: 'string', description: 'Short 2-5 word visual chip.' },
        },
        required: ['emoji', 'label'],
      },
    },
    mode_notes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          mode: { type: 'string', enum: ['DRIVE', 'TWO_WHEELER', 'METRO', 'BUS', 'WALK', 'BICYCLE'] },
          emoji: { type: 'string', description: 'Single Unicode emoji character ONLY (e.g. ✅, ⚠️, 🚨, 🚇, 😷).' },
          note: { type: 'string', description: 'Ultra-short 2-4 word card badge text.' },
        },
        required: ['mode', 'emoji', 'note'],
      },
    },
  },
  required: [
    'recommended_mode',
    'ai_estimated_dose_ug',
    'reduction_vs_worst_pct',
    'cigarette_equivalent',
    'best_leave_window',
    'departure_savings_pct',
    'headline_verdict',
    'safe_tip_sticker',
    'action_stickers',
    'mode_notes',
  ],
};

const ICON_FALLBACK_MAP = {
  shield: '🛡️',
  mask: '😷',
  metro: '🚇',
  train: '🚇',
  bus: '🚌',
  walk: '🚶',
  clock: '⏰',
  time: '⏰',
  wind: '💨',
  ac: '❄️',
  alert: '⚠️',
  danger: '🚨',
  check: '✅',
};

function sanitizeEmoji(raw, defaultEmoji = '🛡️') {
  const s = String(raw || '').trim();
  if (!s) return defaultEmoji;
  const key = s.toLowerCase();
  if (ICON_FALLBACK_MAP[key]) return ICON_FALLBACK_MAP[key];
  if (/^[a-z0-9_-]+$/i.test(s)) return defaultEmoji;
  return s;
}

function normalizeStickers(list = [], fallbackEmoji = '🛡️') {
  return (list || []).map((st) => {
    const emoji = sanitizeEmoji(st.emoji || st.icon, fallbackEmoji);
    return {
      icon: emoji,
      emoji,
      label: st.label,
    };
  });
}

const ORIGIN_SYSTEM_PROMPT = `You are AuraPulse's real-time departure & commute timing advisor.
Analyze live origin AQI, PM2.5, atmospheric trapping hours, and clean hours to compute the smartest departure window, worst trapping hours, and crisp visual emoji stickers.
IMPORTANT: Every emoji field MUST contain a single Unicode emoji character (like ⏰, 🚇, 😷, 🌬️), never English words.`;

const ROUTE_SYSTEM_PROMPT = `You are AuraPulse's commute air-safety & departure optimizer.
Analyze fresh origin/destination names, live street AQI, PM2.5, hourly clean/dirty forecast windows, every transport mode's distance/duration/inhaled µg dose, and multi-leg Metro/Bus/Walk transfers.
Return exact telemetry-grounded insights with ultra-short visual emoji stickers for BOTH the hero bar and EACH individual transport card (mode_notes).
IMPORTANT: Every emoji field MUST be an actual Unicode emoji character (🛡️, 😷, 🚇, 🚨, ✅, ⏰), NEVER plain words like "shield" or "mask".`;

export async function generateOriginCommuteBrief({
  originLabel,
  currentAqi,
  diurnalAnalysis,
  language = 'English',
}) {
  const bestStart = diurnalAnalysis?.cleanest_window?.start_label || '11:00 AM';
  const bestEnd = diurnalAnalysis?.cleanest_window?.end_label || '3:00 PM';
  const badStart = diurnalAnalysis?.dirtiest_window?.start_label || '7:00 AM';
  const badEnd = diurnalAnalysis?.dirtiest_window?.end_label || '9:00 AM';
  const cleanPm = diurnalAnalysis?.cleanest_window?.avg_pm25 ?? Math.round((currentAqi?.pm25 || 90) * 0.65);
  const dirtyPm = diurnalAnalysis?.dirtiest_window?.avg_pm25 ?? Math.round((currentAqi?.pm25 || 120) * 1.2);
  const calcSavePct = dirtyPm > 0 ? Math.max(8, Math.min(72, Math.round(((dirtyPm - cleanPm) / dirtyPm) * 100))) : 25;

  const ctx = {
    location: originLabel || 'Current Origin',
    current_aqi: currentAqi?.aqi ?? null,
    current_pm25: currentAqi?.pm25 ?? null,
    best_window: `${bestStart} – ${bestEnd}`,
    best_window_pm25: cleanPm,
    worst_window: `${badStart} – ${badEnd}`,
    worst_window_pm25: dirtyPm,
    morning_trap: Boolean(diurnalAnalysis?.morning_trap_warning),
    estimated_timing_savings_pct: calcSavePct,
    language,
  };

  const aiRes = await generateWithFailover({
    contents: `Generate a fast visual departure & street air brief in ${language}:\n${JSON.stringify(ctx)}`,
    systemInstruction: ORIGIN_SYSTEM_PROMPT,
    responseSchema: COMMUTE_BRIEF_SCHEMA,
    temperature: 0.35,
  });

  if (aiRes.ok && aiRes.data) {
    return {
      ...aiRes.data,
      origin_stickers: normalizeStickers(aiRes.data.origin_stickers, '⏰'),
      ai_powered: true,
      model: aiRes.model,
    };
  }

  return {
    best_leave_window: `${bestStart} – ${bestEnd}`,
    avoid_window: `${badStart} – ${badEnd}`,
    departure_savings_pct: calcSavePct,
    headline_verdict: `Leave ${bestStart} to dodge ${Math.round(dirtyPm)} µg/m³ smog peak`,
    recommended_quick_mode: (currentAqi?.pm25 || 100) > 85 ? 'METRO' : 'TRANSIT',
    origin_stickers: [
      { icon: '⏰', emoji: '⏰', label: `Best: ${bestStart}` },
      { icon: '🌫️', emoji: '🌫️', label: `Avoid: ${badStart}` },
      { icon: '😷', emoji: '😷', label: (currentAqi?.pm25 || 90) > 75 ? 'N95 Needed' : 'Light Breeze' },
    ],
    ai_powered: false,
    model: 'aurapulse-timing-fallback',
  };
}

export async function generateCommuteAiAnalysis({
  originLabel,
  destinationLabel,
  originAqi,
  diurnalAnalysis,
  routes = [],
  language = 'English',
}) {
  const best = routes[0] || null;
  const worst = routes[routes.length - 1] || best;
  const bestDose = best?.dose_ug ?? 0;
  const worstDose = worst?.dose_ug ?? bestDose;
  const calcReduction = worstDose > 0 ? Math.max(0, Math.round(((worstDose - bestDose) / worstDose) * 100)) : 0;
  const cigEq = Math.round((worstDose / 22) * 10) / 10;

  const bestWindow = diurnalAnalysis?.cleanest_window?.start_label
    ? `${diurnalAnalysis.cleanest_window.start_label} – ${diurnalAnalysis.cleanest_window.end_label}`
    : '11:00 AM – 3:00 PM';
  const cleanPm = diurnalAnalysis?.cleanest_window?.avg_pm25 ?? bestDose;
  const dirtyPm = diurnalAnalysis?.dirtiest_window?.avg_pm25 ?? Math.max(cleanPm * 1.35, 100);
  const depSavingsPct = dirtyPm > 0 ? Math.max(5, Math.min(70, Math.round(((dirtyPm - cleanPm) / dirtyPm) * 100))) : 28;

  const telemetryContext = {
    trip: {
      origin: originLabel || `${originAqi?.latitude || ''},${originAqi?.longitude || ''}`,
      destination: destinationLabel || 'Destination',
      origin_aqi: originAqi?.aqi ?? null,
      origin_pm25_ug_m3: originAqi?.pm25 ?? null,
      best_diurnal_window: bestWindow,
      dirtiest_diurnal_window: diurnalAnalysis?.dirtiest_window
        ? `${diurnalAnalysis.dirtiest_window.start_label} – ${diurnalAnalysis.dirtiest_window.end_label}`
        : null,
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
    contents: `Analyze this fresh commute trip and optimal departure window in ${language}:\n${JSON.stringify(telemetryContext)}`,
    systemInstruction: ROUTE_SYSTEM_PROMPT,
    responseSchema: COMMUTE_AI_SCHEMA,
    temperature: 0.35,
  });

  if (aiRes.ok && aiRes.data) {
    return {
      ...aiRes.data,
      action_stickers: normalizeStickers(aiRes.data.action_stickers, '🛡️'),
      mode_notes: (aiRes.data.mode_notes || []).map((mn) => ({
        mode: mn.mode,
        emoji: sanitizeEmoji(mn.emoji, '📊'),
        note: mn.note,
      })),
      ai_powered: true,
      model: aiRes.model,
    };
  }

  return {
    recommended_mode: best?.mode || 'METRO',
    ai_estimated_dose_ug: bestDose,
    reduction_vs_worst_pct: calcReduction,
    cigarette_equivalent: cigEq,
    best_leave_window: bestWindow,
    departure_savings_pct: depSavingsPct,
    headline_verdict: best
      ? `${best.label} (${bestDose} µg) · −${calcReduction}% smog`
      : 'Enclosed transit minimizes smog intake',
    safe_tip_sticker: best
      ? `Pick ${best.label} + leave ${bestWindow} to slash lung dose`
      : 'Switch to Metro or sealed cabin with N95',
    action_stickers: [
      ...(best?.legs?.some((l) => l.mode === 'BUS' || l.mode === 'WALK')
        ? [{ icon: '😷', emoji: '😷', label: 'N95 on Feeder Leg' }]
        : []),
      { icon: '❄️', emoji: '❄️', label: 'AC Recirculate' },
      { icon: '⏰', emoji: '⏰', label: `Best: ${bestWindow}` },
      { icon: '🛡️', emoji: '🛡️', label: `Saves ${calcReduction}% PM2.5` },
    ],
    mode_notes: routes.map((r, idx) => ({
      mode: r.mode,
      emoji: idx === 0 ? '✅' : idx === routes.length - 1 ? '🚨' : '⚡',
      note: idx === 0 ? 'Lowest lung dose' : idx === routes.length - 1 ? 'Avoid open smog' : `${r.dose_ug} µg inhaled`,
    })),
    ai_powered: false,
    model: 'aurapulse-commute-fallback',
  };
}
