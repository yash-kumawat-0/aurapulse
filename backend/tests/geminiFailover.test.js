import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveApiKeys, getAiStatus } from '../src/config/gemini.js';
import { calculateIndoorPM25 } from '../src/engine/massBalanceModel.js';
import { generateIndoorAiShoppingAndPlan } from '../src/services/geminiIndoorService.js';
import { generateCommuteAiAnalysis, generateOriginCommuteBrief } from '../src/services/geminiCommuteService.js';
import { diagnoseSymptomTrigger } from '../src/services/geminiAdviceService.js';

describe('Env multi-key failover, custom inputs, calibration & visual diagnostics', () => {
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

  it('reacts dynamically to custom "other" window seals and AI physics calibration', () => {
    const openOther = calculateIndoorPM25({
      outdoorPM25: 150,
      roomAreaSqft: 150,
      ceilingHeightFt: 10,
      windowSealType: 'other',
      customWindowDesc: 'Balcony door cracked open',
      indoorSource: 'other',
      customSourceDesc: 'Wood stove smoke',
    });
    const calibrated = calculateIndoorPM25({
      outdoorPM25: 150,
      roomAreaSqft: 150,
      ceilingHeightFt: 10,
      windowSealType: 'other',
      customWindowDesc: 'Sealed balcony',
      indoorSource: 'other',
      customSourceDesc: 'Heavy charcoal grill',
      aiCalibration: { window_ach: 3.1, window_penetration: 0.94, source_rate_ug_h: 2900 },
    });
    assert.ok(openOther.indoor_pm25 > 100);
    assert.ok(calibrated.indoor_pm25 > openOther.indoor_pm25);
  });

  it('produces regional DIY prices, store URLs, filter lifespan & zero-cost hacks', async () => {
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
      assert.ok(result.economics.filter_life_days > 10);
      assert.ok(Array.isArray(result.zero_cost_hacks) && result.zero_cost_hacks.length >= 2);
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

  it('returns structured commute visual stickers, mode notes & origin timing brief cleanly', async () => {
    const prevSingle = process.env.GEMINI_API_KEY;
    const prevPool = process.env.GEMINI_API_KEYS;
    try {
      delete process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEYS;
      const brief = await generateOriginCommuteBrief({
        originLabel: 'Hinjewadi, Pune',
        currentAqi: { aqi: 185, pm25: 95 },
        diurnalAnalysis: {
          cleanest_window: { start_label: '2:00 PM', end_label: '4:00 PM', avg_pm25: 48 },
          dirtiest_window: { start_label: '7:00 AM', end_label: '9:00 AM', avg_pm25: 135 },
          morning_trap_warning: true,
        },
      });
      assert.ok(brief.best_leave_window.includes('2:00 PM'));
      assert.ok(Array.isArray(brief.origin_stickers) && brief.origin_stickers.length >= 2);

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
      assert.ok(Array.isArray(res.mode_notes) && res.mode_notes.length === 2);
      assert.ok(res.safe_tip_sticker.length > 5);
    } finally {
      process.env.GEMINI_API_KEY = prevSingle;
      process.env.GEMINI_API_KEYS = prevPool;
    }
  });

  it('diagnoses family symptoms with trigger badges and doctor summary', async () => {
    const prevSingle = process.env.GEMINI_API_KEY;
    const prevPool = process.env.GEMINI_API_KEYS;
    try {
      delete process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEYS;
      const diag = await diagnoseSymptomTrigger({
        locationLabel: 'Pune, India',
        currentAqi: { aqi: 210, pm25: 120, pm10: 190, aqi_category: 'Very Unhealthy' },
        indoorSimulation: { indoor_pm25: 95 },
        homeProfile: { indoor_source: 'other', custom_source_desc: 'Candles' },
        member: { name: 'Aarav', age: 9, health_condition: 'OTHER', custom_issue: 'Dust allergy' },
        symptom: 'Wheeze / Cough',
      });
      assert.ok(diag.likely_trigger.length > 5);
      assert.ok(Array.isArray(diag.rescue_stickers) && diag.rescue_stickers.length === 3);
      assert.ok(diag.doctor_summary.includes('Aarav'));
    } finally {
      process.env.GEMINI_API_KEY = prevSingle;
      process.env.GEMINI_API_KEYS = prevPool;
    }
  });
});
