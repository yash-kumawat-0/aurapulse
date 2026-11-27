// ============================================
// Backend Unit Tests — Mass Balance Model
// ============================================
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateIndoorPM25 } from '../src/engine/massBalanceModel.js';

describe('massBalanceModel', () => {
  it('should calculate indoor PM2.5 lower than outdoor with sealed windows and no sources', () => {
    const result = calculateIndoorPM25({
      outdoorPM25: 200,
      roomAreaSqft: 150,
      ceilingHeightFt: 10,
      windowSealType: 'sealed_upvc',
      purifierCADR: 0,
      indoorSource: 'none',
    });

    assert.ok(result.indoor_pm25 < 200, `Indoor (${result.indoor_pm25}) should be less than outdoor (200)`);
    assert.ok(result.io_ratio < 1, 'IO ratio should be less than 1');
  });

  it('should show significant reduction with a purifier', () => {
    const withoutPurifier = calculateIndoorPM25({
      outdoorPM25: 200,
      windowSealType: 'standard_aluminum',
      purifierCADR: 0,
    });

    const withPurifier = calculateIndoorPM25({
      outdoorPM25: 200,
      windowSealType: 'standard_aluminum',
      purifierCADR: 300,
    });

    assert.ok(
      withPurifier.indoor_pm25 < withoutPurifier.indoor_pm25,
      `With purifier (${withPurifier.indoor_pm25}) should be less than without (${withoutPurifier.indoor_pm25})`,
    );
  });

  it('should increase indoor PM2.5 when indoor smoke source is present', () => {
    const noSource = calculateIndoorPM25({
      outdoorPM25: 100,
      indoorSource: 'none',
    });

    const withIncense = calculateIndoorPM25({
      outdoorPM25: 100,
      indoorSource: 'incense',
    });

    assert.ok(
      withIncense.indoor_pm25 > noSource.indoor_pm25,
      `With incense (${withIncense.indoor_pm25}) should be higher than without (${noSource.indoor_pm25})`,
    );
  });

  it('should recommend higher CADR for leaky windows', () => {
    const leaky = calculateIndoorPM25({
      outdoorPM25: 300,
      windowSealType: 'leaky_wood',
    });

    const sealed = calculateIndoorPM25({
      outdoorPM25: 300,
      windowSealType: 'sealed_upvc',
    });

    assert.ok(
      leaky.cadr_needed_for_safe >= sealed.cadr_needed_for_safe,
      'Leaky windows should need higher CADR',
    );
  });
});
