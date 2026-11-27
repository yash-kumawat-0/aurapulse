import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getAqiInfo, getPm25SafetyColor, getRiskColor } from '../src/utils/aqiColorMapper.js';
import { formatHour, formatPM25, formatCO2 } from '../src/utils/formatters.js';
import { getPM25Color, colorizeRoute, calcRouteAvgPM25, getColorLegend } from '../src/utils/aqiRouteColorizer.js';

describe('Frontend AQI color mapping & accessibility helpers', () => {
  it('maps CPCB AQI thresholds cleanly across all 6 bands', () => {
    assert.equal(getAqiInfo(35).label, 'Good');
    assert.equal(getAqiInfo(85).label, 'Satisfactory');
    assert.equal(getAqiInfo(160).label, 'Moderate');
    assert.equal(getAqiInfo(240).label, 'Poor');
    assert.equal(getAqiInfo(350).label, 'Very Poor');
    assert.equal(getAqiInfo(450).label, 'Severe');
  });

  it('returns consistent risk & PM2.5 safety badge colors with fallback', () => {
    assert.equal(getPm25SafetyColor(20), '#4CAF50');
    assert.equal(getPm25SafetyColor(280), '#880E4F');
    assert.equal(getRiskColor('SEVERE'), '#880E4F');
    assert.equal(getRiskColor('UNKNOWN'), '#94A3B8');
  });
});

describe('Frontend unit & display formatters', () => {
  it('formats 24h hours, PM2.5 and CO2 cleanly', () => {
    assert.equal(formatHour(0), '12:00 AM');
    assert.equal(formatHour(12), '12:00 PM');
    assert.equal(formatHour(15), '3:00 PM');
    assert.equal(formatPM25(123.6), '124 µg/m³');
    assert.equal(formatCO2(0.45), '450 g CO₂');
    assert.equal(formatCO2(2.35), '2.4 kg CO₂');
  });
});

describe('Frontend route PM2.5 colorizer', () => {
  it('colorizes route segments deterministically and computes valid averages', () => {
    const coords = [
      [18.52, 73.85],
      [18.525, 73.86],
      [18.53, 73.87],
      [18.535, 73.88],
      [18.54, 73.89],
    ];
    const segs = colorizeRoute(coords, 120, 1.0, 1, 2);
    assert.ok(segs.length >= 2);
    segs.forEach((s) => {
      assert.match(s.color, /^#[0-9A-Fa-f]{6}$/);
      assert.ok(s.pm25 > 0);
    });
    const avg = calcRouteAvgPM25(segs);
    assert.ok(avg > 0);
    assert.equal(getPM25Color(10), '#4CAF50');
    assert.ok(getColorLegend().length >= 5);
  });
});
