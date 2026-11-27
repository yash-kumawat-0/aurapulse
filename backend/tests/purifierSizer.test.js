import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { recommendDIYPurifier } from '../src/engine/purifierSizer.js';

describe('purifierSizer', () => {
  it('recommends compact single-filter build for small clean-ish bedrooms', () => {
    const res = recommendDIYPurifier({ roomAreaSqft: 80, ceilingHeightFt: 9, outdoorPM25: 90 });
    assert.equal(res.build_key, 'basic_single');
    assert.equal(res.units_needed, 1);
    assert.ok(res.materials_list.length >= 4);
  });

  it('upgrades small rooms to standard cube under severe PM2.5 (>200)', () => {
    const res = recommendDIYPurifier({ roomAreaSqft: 80, ceilingHeightFt: 9, outdoorPM25: 260 });
    assert.equal(res.build_key, 'standard_cube');
  });

  it('scales unit count automatically for large halls', () => {
    const res = recommendDIYPurifier({ roomAreaSqft: 350, ceilingHeightFt: 12, outdoorPM25: 150 });
    assert.equal(res.build_key, 'large_cube');
    assert.ok(res.units_needed >= 2);
  });
});
