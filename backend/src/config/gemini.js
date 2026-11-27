// ============================================
// Google Gemini AI Client Config & Multi-Key Failover
// ============================================
import { GoogleGenAI } from '@google/genai';

// Proven fast schema-compatible models prioritized first for low serverless cold-start latency
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

// Track cooldowns in-memory so exhausted keys / throttled models skip fast
const exhaustedKeysUntil = new Map(); // keyFingerprint -> timestamp
const degradedModelsUntil = new Map(); // modelName -> timestamp
let lastHealthyModel = null;

function maskKeyFingerprint(key) {
  if (!key) return 'none';
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

/**
 * Resolves all candidate API keys in priority order:
 *   1. Optional per-request runtime key (from UI key switcher / X-Gemini-Api-Key)
 *   2. GEMINI_API_KEYS (comma/newline separated pool)
 *   3. GEMINI_API_KEY
 */
export function resolveApiKeys(overrideKey) {
  const pool = [];
  const pushKey = (raw, source) => {
    const clean = (raw || '').trim();
    if (!clean || clean.startsWith('your-')) return;
    if (!pool.some((item) => item.key === clean)) {
      pool.push({
        key: clean,
        source,
        slot: source === 'user_override' ? 'override' : `env_${pool.length + 1}`,
        fingerprint: maskKeyFingerprint(clean),
      });
    }
  };

  if (overrideKey) pushKey(overrideKey, 'user_override');

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

function withTimeout(promise, ms = 12000) {
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
 * Executes a structured Gemini call with automatic key rotation & model failover.
 * Never throws; returns `{ ok: false, ... }` when all keys/models fail or exhaust.
 */
export async function generateWithFailover({
  contents,
  systemInstruction,
  responseSchema,
  overrideKey,
  temperature = 0.25,
  timeoutMs = 11000,
}) {
  const allKeys = resolveApiKeys(overrideKey);
  if (allKeys.length === 0) {
    return {
      ok: false,
      reason: 'no_api_key_configured',
      attempts: 0,
      model: null,
      key_slot: null,
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
          rawText,
          model: modelName,
          key_slot: keyEntry.slot,
          key_source: keyEntry.source,
          attempts,
        };
      } catch (err) {
        lastErrorMsg = err?.message || String(err);

        if (isKeyLevelError(err)) {
          // Put exhausted/invalid key on cooldown and switch straight to next backup key
          exhaustedKeysUntil.set(keyEntry.fingerprint, Date.now() + 5 * 60 * 1000);
          break;
        }

        if (isModelLevelError(err)) {
          const ttl = (err?.status === 404) ? 60 * 60 * 1000 : 2 * 60 * 1000;
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
    key_slot: null,
  };
}

/**
 * Returns non-secret AI runtime health metrics for /api/health and UI status badge.
 */
export function getAiStatus(overrideKey) {
  const keys = resolveApiKeys(overrideKey);
  const now = Date.now();
  const healthyKeys = keys.filter((k) => (exhaustedKeysUntil.get(k.fingerprint) || 0) <= now);
  const healthyModels = getModelOrder();

  return {
    configured: keys.length > 0,
    key_count: keys.length,
    healthy_key_count: healthyKeys.length,
    preferred_model: healthyModels[0] || DEFAULT_GEMINI_MODELS[0],
    fallback_models_count: healthyModels.length,
  };
}

/**
 * Legacy helper exported for backwards compatibility.
 */
const firstEnvKey = resolveApiKeys()[0]?.key;
export const genAI = firstEnvKey ? new GoogleGenAI({ apiKey: firstEnvKey }) : null;

/**
 * The strict JSON response schema for Family Action Plan generation.
 */
export const ADVICE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    overall_summary: {
      type: 'string',
      description: 'A 2-3 sentence plain-language summary of today\'s air quality situation for this location.',
    },
    family_advice: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          member_name: { type: 'string' },
          risk_level: { type: 'string', enum: ['LOW', 'MODERATE', 'HIGH', 'SEVERE'] },
          primary_action: {
            type: 'string',
            description: 'The single most important thing this person should do today.',
          },
          detailed_tips: {
            type: 'array',
            items: { type: 'string' },
            description: 'Two to three additional specific, actionable tips.',
          },
        },
        required: ['member_name', 'risk_level', 'primary_action', 'detailed_tips'],
      },
    },
    ventilation_advice: {
      type: 'string',
      description: 'When to open windows today and for how long, based on the calculated clean window.',
    },
    commute_advice: {
      type: 'string',
      description: 'Which commute option is safer and why, explained simply.',
    },
  },
  required: ['overall_summary', 'family_advice', 'ventilation_advice', 'commute_advice'],
};

export default genAI;
