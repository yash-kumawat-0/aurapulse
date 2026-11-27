import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { errorHandler, createApiError } from '../src/middleware/errorHandler.js';
import { encodeGeohash, aqiCacheMiddleware } from '../src/middleware/cacheMiddleware.js';
import { getCurrentConditions, getForecast } from '../src/services/googleAirQualityService.js';
import { getWeatherData } from '../src/services/openMeteoService.js';
import { parseValidCoordinates, sanitizeTextInput } from '../src/middleware/validateRequest.js';

describe('Backend Middleware & Security Error Handling', () => {
  it('encodes coordinate geohashes consistently for spatial caching', () => {
    const req = { query: { lat: '18.5204', lng: '73.8567' } };
    let called = false;
    aqiCacheMiddleware(req, {}, () => {
      called = true;
    });
    assert.equal(called, true);
    assert.equal(req.geohash, 'geo:18.52:73.86');
    assert.equal(encodeGeohash(28.6139, 77.209), 'geo:28.61:77.21');
  });

  it('redacts raw 500 error details in production while preserving 400 validation errors', () => {
    const prevEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      const payloads = [];
      const mockRes = {
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(obj) {
          payloads.push({ statusCode: this.statusCode, body: obj });
        },
      };

      errorHandler(createApiError('Sensitive DB leak', 500), {}, mockRes, () => {});
      errorHandler(createApiError('Bad field value', 400), {}, mockRes, () => {});

      assert.equal(payloads[0].statusCode, 500);
      assert.equal(payloads[0].body.error.message, 'Internal Server Error');
      assert.equal(payloads[1].statusCode, 400);
      assert.equal(payloads[1].body.error.message, 'Bad field value');
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  it('sanitizes control characters and enforces strict coordinate validation', () => {
    assert.equal(sanitizeTextInput('  hello\x00world\n  ', 8), 'hellowor');
    assert.deepEqual(parseValidCoordinates('18.52', '73.85'), { lat: 18.52, lng: 73.85 });
    assert.throws(() => parseValidCoordinates('NaN', '73.85'), /between -90 and 90/);
    assert.throws(() => parseValidCoordinates('18.52', '190'), /between -180 and 180/);
  });
});

describe('Air Quality & Weather Service Simulations', () => {
  it('returns structured AQI conditions and 48h hourly forecasts cleanly', async () => {
    const current = await getCurrentConditions(18.5204, 73.8567);
    assert.ok(current.aqi > 0);
    assert.ok(current.pm25 > 0);
    assert.ok(Array.isArray(current.pollutants) && current.pollutants.length >= 2);

    const forecast = await getForecast(18.5204, 73.8567, 48);
    assert.equal(forecast.hourly.length, 48);
    assert.ok(forecast.hourly[0].pm25 > 0);
  });

  it('retrieves structured weather boundary-layer telemetry cleanly', async () => {
    const weather = await getWeatherData(18.5204, 73.8567);
    assert.ok(weather.current);
    assert.ok(Array.isArray(weather.hourly) && weather.hourly.length >= 24);
  });
});
