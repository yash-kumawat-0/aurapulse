import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  pm25ToAqi,
  getCommuteHealthStatus,
  evaluateMultiLegRoute,
  evaluateSingleModeRoute,
} from '../src/engine/commuteLegEvaluator.js';

describe('commuteLegEvaluator', () => {
  it('maps PM2.5 breakpoints cleanly to rising AQI categories', () => {
    assert.ok(pm25ToAqi(10) <= 50);
    assert.ok(pm25ToAqi(60) > 150);
    assert.ok(pm25ToAqi(260) > 300);
  });

  it('classifies commute lung dose into accurate risk tiers', () => {
    assert.equal(getCommuteHealthStatus(6, 55).level, 'LOW');
    assert.equal(getCommuteHealthStatus(16, 110).level, 'MODERATE');
    assert.equal(getCommuteHealthStatus(32, 160).level, 'HIGH');
    assert.equal(getCommuteHealthStatus(65, 220).level, 'SEVERE');
  });

  it('scores Metro feeder multi-leg chain dramatically lower than two-wheeler', () => {
    const basePm = 140;
    const bike = evaluateSingleModeRoute(
      {
        mode: 'TWO_WHEELER',
        label: 'Two Wheeler',
        distance_km: 12,
        duration_min: 32,
        activity_mode: 'two_wheeler',
      },
      basePm,
    );
    const metro = evaluateMultiLegRoute(
      {
        mode: 'METRO',
        label: 'Metro + Bus',
        legs: [
          { role: 'first', mode: 'WALK', distance_km: 0.4, duration_min: 5 },
          { role: 'main', mode: 'METRO', line_name: 'Aqua Line', distance_km: 11, duration_min: 20 },
          { role: 'last', mode: 'BUS', distance_km: 1.5, duration_min: 7 },
        ],
      },
      basePm,
    );

    assert.ok(metro.dose_ug < bike.dose_ug);
    assert.ok(metro.n95_feeder_dose_ug <= metro.dose_ug);
    assert.equal(metro.legs.length, 3);
  });
});
