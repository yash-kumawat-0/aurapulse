import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchCurrentAqi,
  fetchDiurnal,
  fetchIndoorSimulation,
  fetchOriginCommuteBrief,
  fetchMultiCommuteComparison,
  fetchAdvice,
  fetchSymptomCheck,
} from '../src/services/api.js';
import { generateViewportAqiGrid, calcRouteAvgPM25 } from '../src/utils/aqiRouteColorizer.js';
import { lightenHex } from '../src/utils/transitService.js';
import { CITY_METRO_NETWORKS } from '../src/data/metroNetworks.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('Frontend API client & error handling', () => {
  it('sends structured POST/GET payloads cleanly and returns JSON responses', async () => {
    const calls = [];
    globalThis.fetch = async (url, config) => {
      calls.push({ url, method: config.method || 'GET', body: config.body });
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ success: true, data: { ok: true } }),
      };
    };

    await fetchCurrentAqi(18.52, 73.85);
    await fetchDiurnal(18.52, 73.85);
    await fetchIndoorSimulation({ outdoor_pm25: 140 });
    await fetchOriginCommuteBrief({ lat: 18.52, lng: 73.85 });
    await fetchMultiCommuteComparison({ origin: { latitude: 18.52, longitude: 73.85 }, routes: [] });
    await fetchAdvice({ lat: 18.52, lng: 73.85, family_members: [] });
    await fetchSymptomCheck({ lat: 18.52, lng: 73.85, symptom: 'Wheeze' });

    assert.equal(calls.length, 7);
    assert.match(calls[0].url, /\/api\/v1\/aqi\/current\?lat=18\.52&lng=73\.85$/);
    assert.equal(calls[3].method, 'POST');
    assert.match(calls[6].url, /\/api\/v1\/advice\/symptom-check$/);
  });

  it('throws clear errors on HTTP failures or malformed non-JSON bodies', async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ success: false, error: { message: 'Invalid coordinates' } }),
    });
    await assert.rejects(() => fetchCurrentAqi(999, 73), /Invalid coordinates/);

    globalThis.fetch = async () => ({
      ok: false,
      status: 502,
      text: async () => 'Bad Gateway HTML',
    });
    await assert.rejects(() => fetchIndoorSimulation({}), /Unexpected API response \(502\)/);
  });
});

describe('Frontend transit datasets & spatial color helpers', () => {
  it('provides valid bounded metro datasets and hex color lightening', () => {
    assert.ok(CITY_METRO_NETWORKS.length >= 6);
    CITY_METRO_NETWORKS.forEach((city) => {
      assert.ok(city.lines.length >= 2);
      city.lines.forEach((line) => {
        assert.match(line.color, /^#[0-9A-Fa-f]{6}$/);
        assert.ok(line.coordinates.length >= 4);
      });
    });
    const lighter = lightenHex('#7B1FA2', 0.5);
    assert.match(lighter, /^#[0-9A-Fa-f]{6}$/);
    assert.notEqual(lighter, '#7B1FA2');
  });

  it('builds seamless viewport AQI grid cells and safe averages for empty inputs', () => {
    const fakeBounds = {
      getSouth: () => 18.48,
      getNorth: () => 18.58,
      getWest: () => 73.80,
      getEast: () => 73.92,
    };
    const cells = generateViewportAqiGrid(fakeBounds, 110, 4, 4);
    assert.equal(cells.length, 16);
    cells.forEach((c) => {
      assert.ok(c.pm25 > 0);
      assert.match(c.color, /^#[0-9A-Fa-f]{6}$/);
    });
    assert.equal(calcRouteAvgPM25([]), 0);
  });
});
