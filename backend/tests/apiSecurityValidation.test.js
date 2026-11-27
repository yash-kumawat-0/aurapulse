import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../server.js';

let server;
let baseUrl;

async function jsonReq(path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const body = await res.json();
  return { status: res.status, headers: res.headers, body };
}

describe('HTTP API Security, Validation & End-to-End Route Handlers', () => {
  before(async () => {
    process.env.NODE_ENV = 'test';
    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('serves /api/health with OWASP + CSP security headers and hides X-Powered-By', async () => {
    const res = await jsonReq('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.headers.get('x-powered-by'), null);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.ok(res.headers.get('content-security-policy')?.includes("frame-ancestors 'none'"));
    assert.ok(res.headers.get('referrer-policy'));
  });

  it('returns structured 404 JSON for unknown /api paths', async () => {
    const res = await jsonReq('/api/v1/does-not-exist');
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.match(res.body.error.message, /not found/i);
  });

  it('rejects out-of-range coordinates and malformed payloads with HTTP 400', async () => {
    const badAqi = await jsonReq('/api/v1/aqi/current?lat=120&lng=73.8');
    assert.equal(badAqi.status, 400);

    const badSim = await jsonReq('/api/v1/indoor/simulate', {
      method: 'POST',
      body: JSON.stringify({ outdoor_pm25: -50 }),
    });
    assert.equal(badSim.status, 400);

    const badBrief = await jsonReq('/api/v1/commute/location-brief', {
      method: 'POST',
      body: JSON.stringify({ lat: 999, lng: 73 }),
    });
    assert.equal(badBrief.status, 400);

    const badMultiCompare = await jsonReq('/api/v1/commute/multi-compare', {
      method: 'POST',
      body: JSON.stringify({ origin: { latitude: 18.5, longitude: 73.8 }, routes: [] }),
    });
    assert.equal(badMultiCompare.status, 400);

    const badAdvice = await jsonReq('/api/v1/advice/generate', {
      method: 'POST',
      body: JSON.stringify({ lat: 18.5, lng: 73.8, family_members: [] }),
    });
    assert.equal(badAdvice.status, 400);
  });

  it('validates symptom-check inputs and simulates custom indoor + family endpoints cleanly', async () => {
    const badSym = await jsonReq('/api/v1/advice/symptom-check', {
      method: 'POST',
      body: JSON.stringify({ lat: 18.52, lng: 73.85 }),
    });
    assert.equal(badSym.status, 400);

    const sim = await jsonReq('/api/v1/indoor/simulate', {
      method: 'POST',
      body: JSON.stringify({
        outdoor_pm25: 165,
        room_area_sqft: 180,
        ceiling_height_ft: 10,
        window_seal_type: 'other',
        custom_window_desc: 'Balcony gap',
        indoor_source: 'other',
        custom_source_desc: 'Candles',
        skip_ai: true,
      }),
    });
    assert.equal(sim.status, 200);
    assert.equal(sim.body.success, true);
    assert.ok(sim.body.data.simulation.indoor_pm25 > 0);
    assert.ok(sim.body.data.diy_simulation.indoor_pm25 < sim.body.data.simulation.indoor_pm25);

    const familyBad = await jsonReq('/api/v1/family', {
      method: 'POST',
      body: JSON.stringify({ user_id: 'u1', name: 'Test', age: 250 }),
    });
    assert.equal(familyBad.status, 400);

    const familyOk = await jsonReq('/api/v1/family', {
      method: 'POST',
      body: JSON.stringify({ user_id: 'u1', name: 'Meera', age: 34, health_condition: 'NONE' }),
    });
    assert.equal(familyOk.status, 201);
    assert.equal(familyOk.body.data.name, 'Meera');
  });
});
