import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveApiKeys, getAiStatus } from '../src/config/gemini.js';
import { calculateIndoorPM25 } from '../src/engine/massBalanceModel.js';
import { generateIndoorAiShoppingAndPlan } from '../src/services/geminiIndoorService.js';
import { generateCommuteAiAnalysis } from '../src/services/geminiCommuteService.js';

describe('Env multi-key failover, custom inputs & AI output integrity', () => {
  it('resolves GEMINI_API_KEYS pool and primary key from env without duplicates', () => {
    const prevSingle = process.env.GEMINI_API_KEY;
    const prevPool = process.env.GEMINI_API_KEYS;
    try {
      process.env.GEMINI_API_KEY = 'primary-key-1';
      process.env.GEMINI_API_KEYS = 'pool-key-a, primary-key-1, pool-key-b';
      const resolved = resolveApiKeys();
      assert.deepEqual(
        resolved.map((k) => k.key),
        ['pool-key-a', 'primary-key-1', 'pool-key-b'],
      );
      const status = getAiStatus();
      assert.equal(status.configured, true);
      assert.equal(status.key_count, 3);
    } finally {
      process.env.GEMINI_API_KEY = prevSingle;
      process.env.GEMINI_API_KEYS = prevPool;
    }
  });

  it('reacts dynamically to custom "other" window seals and indoor smoke descriptions', () => {
    const openOther = calculateIndoorPM25({
      outdoorPM25: 150,
      roomAreaSqft: 150,
      ceilingHeightFt: 10,
      windowSealType: 'other',
      customWindowDesc: 'Balcony door cracked open',
      indoorSource: 'other',
      customSourceDesc: 'Wood stove smoke',
    });
    const sealedOther = calculateIndoorPM25({
      outdoorPM25: 150,
      roomAreaSqft: 150,
      ceilingHeightFt: 10,
      windowSealType: 'other',
      customWindowDesc: 'Airtight AC room sealed',
      indoorSource: 'none',
    });
    assert.ok(openOther.indoor_pm25 > sealedOther.indoor_pm25 + 40);
  });

  it('produces verified regional shopping URLs and INR pricing inside DIY Needed Parts', async () => {
    const prevSingle = process.env.GEMINI_API_KEY;
    const prevPool = process.env.GEMINI_API_KEYS;
    try {
      delete process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEYS;
      const result = await generateIndoorAiShoppingAndPlan({
        locationLabel: 'Pune, Maharashtra, India',
        lat: 18.5915,
        lng: 73.7200,
        outdoorPm25: 150,
        simulation: { room_volume_m3: 42.5, indoor_pm25: 98, cadr_needed_for_safe: 215 },
        diySimulation: { indoor_pm25: 22 },
        diyRec: { filters: 4, units_needed: 1, fan_size_inch: 20, estimated_cadr: 350 },
        roomAreaSqft: 150,
        ceilingHeightFt: 10,
        windowSealType: 'other',
        customWindowDesc: 'Balcony sliding gap',
        indoorSource: 'other',
        customSourceDesc: 'Candles',
      });
      assert.equal(result.ai_powered, false);
      assert.equal(result.currency_code, 'INR');
      assert.equal(result.diy_parts.length, 3);
      assert.ok(Array.isArray(result.visual_badges) && result.visual_badges.length >= 1);
      result.diy_parts.forEach((p) => {
        assert.ok(p.platform_links.length >= 2);
        p.platform_links.forEach((l) => {
          assert.match(l.url, /^https:\/\//);
        });
      });
    } finally {
      process.env.GEMINI_API_KEY = prevSingle;
      process.env.GEMINI_API_KEYS = prevPool;
    }
  });

  it('returns structured commute visual stickers cleanly even when AI keys are absent', async () => {
    const prevSingle = process.env.GEMINI_API_KEY;
    const prevPool = process.env.GEMINI_API_KEYS;
    try {
      delete process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEYS;
      const res = await generateCommuteAiAnalysis({
        originLabel: 'Hinjewadi, Pune',
        destinationLabel: 'Viman Nagar, Pune',
        originAqi: { aqi: 185, pm25: 95, aqi_category: 'Unhealthy' },
        routes: [
          { mode: 'METRO', label: 'Pink Line ⇄ Aqua Line', distance_km: 26, duration_min: 55, dose_ug: 34, estimated_aqi: 82 },
          { mode: 'TWO_WHEELER', label: 'Two Wheeler', distance_km: 24, duration_min: 62, dose_ug: 110, estimated_aqi: 210 },
        ],
      });
      assert.equal(res.recommended_mode, 'METRO');
      assert.ok(res.headline_verdict.length > 5);
      assert.ok(Array.isArray(res.action_stickers) && res.action_stickers.length >= 1);
    } finally {
      process.env.GEMINI_API_KEY = prevSingle;
      process.env.GEMINI_API_KEYS = prevPool;
    }
  });
});
