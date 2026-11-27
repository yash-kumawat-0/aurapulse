import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeDiurnalPattern } from '../src/engine/diurnalOptimizer.js';

describe('diurnalOptimizer', () => {
  it('returns error object cleanly when hourly input is empty', () => {
    const emptyRes = analyzeDiurnalPattern([]);
    assert.ok(emptyRes.error);
  });

  it('identifies cleanest afternoon window and dirtiest morning inversion peak', () => {
    const hours = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      dateLabel: 'Today',
      pm25: (h >= 6 && h <= 8) ? 240 : (h >= 14 && h <= 16 ? 45 : 110),
    }));

    const result = analyzeDiurnalPattern(hours);
    assert.equal(result.cleanest_window.start_hour, 14);
    assert.equal(result.dirtiest_window.start_hour, 6);
    assert.equal(result.morning_trap_warning, true);
    assert.equal(result.ventilation_recommendation.should_ventilate, true);
  });

  it('disables natural ventilation advice when cleanest window exceeds 100 PM2.5', () => {
    const severeHours = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      dateLabel: 'Today',
      pm25: 185,
    }));

    const result = analyzeDiurnalPattern(severeHours);
    assert.equal(result.ventilation_recommendation.should_ventilate, false);
  });
});
