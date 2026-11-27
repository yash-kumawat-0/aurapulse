// ============================================
// Google Gemini AI Client Config & Env Key Failover
// Uses GEMINI_API_KEYS (pool) + GEMINI_API_KEY in backend/.env
// ============================================
import { GoogleGenAI } from '@google/genai';

// Fast schema-compatible Flash models prioritized first
export const DEFAULT_GEMINI_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.6-flash',
  'gemini-3-flash-preview',
  'gemini-3.8-flash',
  'gemini-3.7-flash',
];

export const GEMINI_MODEL = DEFAULT_GEMINI_MODELS[0];

const exhaustedKeysUntil = new Map();
const degradedModelsUntil = new Map();
let lastHealthyModel = null;

function maskKeyFingerprint(key) {
  if (!key) return 'none';
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

/**
 * Resolves all API keys configured in GEMINI_API_KEYS (comma/newline separated)
 * and GEMINI_API_KEY cleanly in order without duplicates.
 */
export function resolveApiKeys() {
  const pool = [];
  const pushKey = (raw, source) => {
    const clean = (raw || '').trim();
    if (!clean || clean.startsWith('your-')) return;
    if (!pool.some((item) => item.key === clean)) {
      pool.push({
        key: clean,
        source,
        slot: `env_${pool.length + 1}`,
        fingerprint: maskKeyFingerprint(clean),
      });
    }
  };

  const multiEnv = process.env.GEMINI_API_KEYS || '';
  multiEnv
    .split(/[\r\n,;]+/)
    .map((k) => k.trim())
    .filter(Boolean)
    .forEach((k) => pushKey(k, 'env_pool'));

  if (process.env.GEMINI_API_KEY) {
    pushKey(process.env.GEMINI_API_KEY, 'env_primary');
  }

  return pool;
}

function getModelOrder() {
  const customModels = (process.env.GEMINI_MODELS || process.env.GEMINI_MODEL || '')
    .split(/[,;\s]+/)
    .map((m) => m.trim())
    .filter(Boolean);

  const merged = [];
  const addModel = (m) => {
    if (m && !merged.includes(m)) merged.push(m);
  };

  if (lastHealthyModel) addModel(lastHealthyModel);
  customModels.forEach(addModel);
  DEFAULT_GEMINI_MODELS.forEach(addModel);

  const now = Date.now();
  const healthy = merged.filter((m) => (degradedModelsUntil.get(m) || 0) <= now);
  return healthy.length > 0 ? healthy : merged;
}

function isKeyLevelError(err) {
  const status = err?.status || err?.code;
  const msg = String(err?.message || '').toLowerCase();
  return (
    status === 401 ||
    status === 403 ||
    status === 429 ||
    msg.includes('quota') ||
    msg.includes('resource_exhausted') ||
    msg.includes('rate limit') ||
    msg.includes('api key') ||
    msg.includes('unauthorized')
  );
}

function isModelLevelError(err) {
  const status = err?.status || err?.code;
  const msg = String(err?.message || '').toLowerCase();
  return (
    status === 404 ||
    status === 503 ||
    status === 500 ||
    msg.includes('no longer available') ||
    msg.includes('high demand') ||
    msg.includes('not found') ||
    msg.includes('timeout')
  );
}

function stripJsonFence(text) {
  const raw = String(text || '').trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : raw).trim();
}

function withTimeout(promise, ms = 11000) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`Gemini request timed out after ${ms}ms`);
      err.status = 504;
      reject(err);
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

/**
 * Executes a structured Gemini call with automatic env key rotation & model failover.
 */
export async function generateWithFailover({
  contents,
  systemInstruction,
  responseSchema,
  temperature = 0.35,
  timeoutMs = 11000,
}) {
  const allKeys = resolveApiKeys();
  if (allKeys.length === 0) {
    return {
      ok: false,
      reason: 'no_api_key_configured',
      attempts: 0,
      model: null,
    };
  }

  const now = Date.now();
  const healthyKeys = allKeys.filter((k) => (exhaustedKeysUntil.get(k.fingerprint) || 0) <= now);
  const candidateKeys = healthyKeys.length > 0 ? healthyKeys : allKeys;
  const modelOrder = getModelOrder();

  let attempts = 0;
  let lastErrorMsg = 'No response';

  for (const keyEntry of candidateKeys) {
    const client = new GoogleGenAI({ apiKey: keyEntry.key });

    for (const modelName of modelOrder) {
      attempts += 1;
      try {
        const result = await withTimeout(
          client.models.generateContent({
            model: modelName,
            contents,
            config: {
              ...(systemInstruction ? { systemInstruction } : {}),
              responseMimeType: 'application/json',
              ...(responseSchema ? { responseSchema } : {}),
              temperature,
            },
          }),
          timeoutMs,
        );

        const rawText = result?.text || '';
        const parsed = JSON.parse(stripJsonFence(rawText));
        lastHealthyModel = modelName;

        return {
          ok: true,
          data: parsed,
          model: modelName,
          attempts,
        };
      } catch (err) {
        lastErrorMsg = err?.message || String(err);

        if (isKeyLevelError(err)) {
          exhaustedKeysUntil.set(keyEntry.fingerprint, Date.now() + 5 * 60 * 1000);
          break;
        }

        if (isModelLevelError(err)) {
          const ttl = err?.status === 404 ? 60 * 60 * 1000 : 2 * 60 * 1000;
          degradedModelsUntil.set(modelName, Date.now() + ttl);
          continue;
        }
      }
    }
  }

  return {
    ok: false,
    reason: lastErrorMsg,
    attempts,
    model: null,
  };
}

export function getAiStatus() {
  const keys = resolveApiKeys();
  const now = Date.now();
  const healthyKeys = keys.filter((k) => (exhaustedKeysUntil.get(k.fingerprint) || 0) <= now);
  const healthyModels = getModelOrder();

  return {
    configured: keys.length > 0,
    key_count: keys.length,
    healthy_key_count: healthyKeys.length,
    preferred_model: healthyModels[0] || DEFAULT_GEMINI_MODELS[0],
  };
}

const firstEnvKey = resolveApiKeys()[0]?.key;
export const genAI = firstEnvKey ? new GoogleGenAI({ apiKey: firstEnvKey }) : null;

export const ADVICE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    overall_summary: {
      type: 'string',
      description: 'Short plain headline (1 sentence max, under 16 words).',
    },
    family_advice: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          member_name: { type: 'string' },
          risk_level: { type: 'string', enum: ['LOW', 'MODERATE', 'HIGH', 'SEVERE'] },
          action_visual_scene: {
            type: 'string',
            enum: [
              'STAY_INDOORS_SEALED',
              'MASK_UP_OUTSIDE',
              'SAFE_GREEN_WALK',
              'RUN_AIR_PURIFIER',
              'KEEP_INHALER_READY',
            ],
          },
          safe_budget_ug: {
            type: 'integer',
            description:
              'Daily personal safe inhaled PM2.5 budget in ug (e.g. 60 for asthma/infant, 130 for healthy adult).',
          },
          best_outdoor_time: {
            type: 'string',
            description: 'Compact safe window chip e.g. 2-4 PM.',
          },
          primary_action: {
            type: 'string',
            description: 'Short direct visual headline (under 9 words).',
          },
          sticker_badges: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                emoji: { type: 'string', description: 'Single Unicode emoji (e.g. 😷, 🪟, 💨, ⏰, 💊).' },
                tag: { type: 'string', description: 'Ultra-short 2-4 word visual badge.' },
              },
              required: ['emoji', 'tag'],
            },
          },
          detailed_tips: {
            type: 'array',
            items: { type: 'string' },
            description: '2-3 ultra-concise scannable chips (under 7 words each).',
          },
        },
        required: [
          'member_name',
          'risk_level',
          'action_visual_scene',
          'safe_budget_ug',
          'best_outdoor_time',
          'primary_action',
          'sticker_badges',
          'detailed_tips',
        ],
      },
    },
    ventilation_advice: {
      type: 'string',
      description: 'Short window timing chip (under 10 words).',
    },
    commute_advice: {
      type: 'string',
      description: 'Short travel tip chip (under 10 words).',
    },
  },
  required: ['overall_summary', 'family_advice', 'ventilation_advice', 'commute_advice'],
};

export const SYMPTOM_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    trigger_emoji: {
      type: 'string',
      description: 'Single Unicode emoji matching root cause (🌫️, 🕯️, 🛵, 🪟).',
    },
    likely_trigger: {
      type: 'string',
      description: 'Crisp cause label under 10 words grounded in live telemetry.',
    },
    trigger_source: {
      type: 'string',
      enum: ['OUTDOOR_SPIKE', 'INDOOR_SMOKE_LEAK', 'COMMUTE_EXPOSURE', 'MULTI_FACTOR'],
    },
    confidence_pct: { type: 'integer' },
    rescue_stickers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          emoji: { type: 'string', description: 'Single Unicode emoji ONLY.' },
          action: { type: 'string', description: 'Immediate 2-5 word rescue step.' },
        },
        required: ['emoji', 'action'],
      },
    },
    doctor_summary: {
      type: 'string',
      description:
        'Concise clinical summary (1-2 short sentences) stating PM2.5 levels, exposure & trigger for a doctor/school note.',
    },
  },
  required: [
    'trigger_emoji',
    'likely_trigger',
    'trigger_source',
    'confidence_pct',
    'rescue_stickers',
    'doctor_summary',
  ],
};

export default genAI;
