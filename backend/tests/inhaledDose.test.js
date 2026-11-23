// ============================================
// Backend Unit Tests — Inhaled Dose Model
// ============================================
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateSegmentDose, compareCommuteDoses } from '../src/engine/inhaledDoseModel.js';

describe('inhaledDoseModel', () => {
  it('should calculate higher dose for cycling than sitting in vehicle at same PM2.5', () => {
    const sitting = calculateSegmentDose({
      pm25Concentration: 150,
      durationMinutes: 30,
      activityMode: 'resting_in_vehicle',
      maskType: 'none',
    });

    const cycling = calculateSegmentDose({
      pm25Concentration: 150,
      durationMinutes: 30,
      activityMode: 'cycling',
      maskType: 'none',
    });

    assert.ok(
      cycling.dose_ug > sitting.dose_ug,
      `Cycling (${cycling.dose_ug}) should inhale more than sitting (${sitting.dose_ug})`
    );
  });

  it('should reduce dose significantly with N95 mask', () => {
    const noMask = calculateSegmentDose({
      pm25Concentration: 200,
      durationMinutes: 30,
      activityMode: 'walking_brisk',
      maskType: 'none',
    });

    const n95 = calculateSegmentDose({
      pm25Concentration: 200,
      durationMinutes: 30,
      activityMode: 'walking_brisk',
      maskType: 'n95_sealed',
    });

    assert.ok(
      n95.dose_ug < noMask.dose_ug * 0.1,
      `N95 dose (${n95.dose_ug}) should be < 10% of unmasked (${noMask.dose_ug})`
    );
  });

  it('should correctly identify safer route in comparison', () => {
    const result = compareCommuteDoses({
      routeA: { pm25: 200, durationMin: 25, activityMode: 'two_wheeler', distanceKm: 12, label: 'Scooter' },
      routeB: { pm25: 60, durationMin: 32, activityMode: 'resting_in_vehicle', distanceKm: 15, label: 'Metro' },
      maskType: 'none',
    });

    assert.equal(result.comparison.safer_route, 'B', 'Metro should be the safer route');
    assert.ok(result.comparison.dose_reduction_percent > 0, 'Dose reduction should be positive');
    assert.ok(result.comparison.co2_saved_kg >= 0, 'CO2 saved should be non-negative');
  });
});
