// ============================================
// MultiModalPlanner — Mix-and-Match Trip AQI &
// Inhaled Dose Estimator (e.g. Walk -> Metro -> Bus)
// Shows total AQI exposure, total inhaled µg,
// health status, and safer route swaps.
// ============================================
import { useState, useEffect } from 'react';
import { fetchMultiLegCommute } from '../../services/api.js';
import './MultiModalPlanner.css';

const LEG_MODES = [
  { key: 'WALK', label: 'Walk', icon: '🚶' },
  { key: 'METRO', label: 'Metro', icon: '🚇' },
  { key: 'BUS', label: 'Bus', icon: '🚌' },
  { key: 'TWO_WHEELER', label: 'Scooter', icon: '🛵' },
  { key: 'DRIVE', label: 'Car', icon: '🚗' },
  { key: 'BICYCLE', label: 'Bicycle', icon: '🚴' },
];

const MASK_OPTIONS = [
  { key: 'none', label: 'No Mask' },
  { key: 'surgical', label: 'Surgical' },
  { key: 'kn95', label: 'KN95' },
  { key: 'n95_sealed', label: 'N95 Sealed' },
];

const PRESET_JOURNEYS = [
  {
    id: 'walk-metro-bus',
    label: '🚶 Walk → 🚇 Metro → 🚌 Bus',
    legs: [
      { mode: 'WALK', duration_min: 10, distance_km: 0.8, mask_type: 'none' },
      { mode: 'METRO', duration_min: 25, distance_km: 12, mask_type: 'none' },
      { mode: 'BUS', duration_min: 12, distance_km: 4, mask_type: 'none' },
    ],
  },
  {
    id: 'walk-metro-walk',
    label: '🚶 Walk → 🚇 Metro → 🚶 Walk',
    legs: [
      { mode: 'WALK', duration_min: 8, distance_km: 0.6, mask_type: 'none' },
      { mode: 'METRO', duration_min: 28, distance_km: 14, mask_type: 'none' },
      { mode: 'WALK', duration_min: 8, distance_km: 0.6, mask_type: 'none' },
    ],
  },
  {
    id: 'scooter-metro-walk',
    label: '🛵 Scooter → 🚇 Metro → 🚶 Walk',
    legs: [
      { mode: 'TWO_WHEELER', duration_min: 12, distance_km: 5, mask_type: 'none' },
      { mode: 'METRO', duration_min: 22, distance_km: 11, mask_type: 'none' },
      { mode: 'WALK', duration_min: 6, distance_km: 0.5, mask_type: 'none' },
    ],
  },
];

const HEALTH_STYLE = {
  LOW: { color: '#15803D', bg: '#ECFDF5', border: '#86EFAC', icon: '🟢' },
  MODERATE: { color: '#B45309', bg: '#FFFBEB', border: '#FCD34D', icon: '🟡' },
  HIGH: { color: '#C2410C', bg: '#FFF7ED', border: '#FDBA74', icon: '🟠' },
  SEVERE: { color: '#B91C1C', bg: '#FEF2F2', border: '#FCA5A5', icon: '🔴' },
};

function getModeMeta(modeKey) {
  return LEG_MODES.find((m) => m.key === modeKey) || { key: modeKey, label: modeKey, icon: '🚆' };
}

function MultiModalPlanner({ origin, basePM25 }) {
  const [legs, setLegs] = useState(PRESET_JOURNEYS[0].legs);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // Recalculate automatically via deterministic backend whenever legs or location PM2.5 changes
  useEffect(() => {
    if (!legs.length) return;
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetchMultiLegCommute({
          origin: origin ? { latitude: origin.lat, longitude: origin.lng } : undefined,
          base_pm25: basePM25 || 100,
          legs,
        });
        if (active) setResult(res.data);
      } catch {
        // Fallback local calculation if backend unavailable
        if (active) setResult(null);
      } finally {
        if (active) setLoading(false);
      }
    }, 180);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [legs, origin, basePM25]);

  const updateLeg = (idx, field, val) => {
    setLegs((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, [field]: val } : l))
    );
  };

  const addLeg = () => {
    setLegs((prev) => [...prev, { mode: 'BUS', duration_min: 10, distance_km: 3, mask_type: 'none' }]);
  };

  const removeLeg = (idx) => {
    if (legs.length <= 1) return;
    setLegs((prev) => prev.filter((_, i) => i !== idx));
  };

  const applySuggestion = (suggestedLegs) => {
    if (!suggestedLegs?.length) return;
    setLegs(suggestedLegs);
  };

  const totals = result?.totals;
  const status = result?.health_status;
  const hStyle = status ? (HEALTH_STYLE[status.level] || HEALTH_STYLE.MODERATE) : HEALTH_STYLE.MODERATE;

  return (
    <div className="card mmp-card">
      <div className="mmp-header">
        <div>
          <h3 className="mmp-title">🔀 Multi-Step Journey Exposure Planner</h3>
          <p className="mmp-sub">Combine steps (e.g. Walk → Metro → Bus) to see total AQI exposure, inhaled dose &amp; safer swaps.</p>
        </div>
        <div className="mmp-presets">
          {PRESET_JOURNEYS.map((p) => (
            <button
              key={p.id}
              type="button"
              className="mmp-preset-btn"
              onClick={() => setLegs(p.legs)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Editable Steps Chain ── */}
      <div className="mmp-legs">
        {legs.map((leg, idx) => {
          const meta = getModeMeta(leg.mode);
          const legEval = result?.legs?.[idx];
          return (
            <div key={idx} className="mmp-leg-chip">
              <div className="mmp-leg-head">
                <span className="mmp-leg-step">Step {idx + 1}</span>
                {legs.length > 1 && (
                  <button
                    type="button"
                    className="mmp-leg-del"
                    onClick={() => removeLeg(idx)}
                    title="Remove step"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="mmp-leg-controls">
                <select
                  aria-label={`Step ${idx + 1} transport`}
                  value={leg.mode}
                  onChange={(e) => updateLeg(idx, 'mode', e.target.value)}
                  className="mmp-select"
                >
                  {LEG_MODES.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.icon} {m.label}
                    </option>
                  ))}
                </select>

                <label className="mmp-min-wrap">
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={leg.duration_min}
                    onChange={(e) => updateLeg(idx, 'duration_min', Math.max(1, Number(e.target.value)))}
                    className="mmp-min-input"
                  />
                  <span>min</span>
                </label>

                <select
                  aria-label={`Step ${idx + 1} mask`}
                  value={leg.mask_type || 'none'}
                  onChange={(e) => updateLeg(idx, 'mask_type', e.target.value)}
                  className="mmp-mask-select"
                >
                  {MASK_OPTIONS.map((mk) => (
                    <option key={mk.key} value={mk.key}>{mk.label}</option>
                  ))}
                </select>
              </div>

              {legEval && (
                <div className="mmp-leg-foot">
                  <span>{meta.icon} AQI ~{legEval.effective_aqi}</span>
                  <strong>{legEval.dose_ug} µg ({legEval.share_percent}%)</strong>
                </div>
              )}
            </div>
          );
        })}

        <button type="button" className="mmp-add-btn" onClick={addLeg}>
          + Add Step
        </button>
      </div>

      {/* ── Totals + Health Status + Safer Suggestions ── */}
      {totals && status && (
        <div className="mmp-summary-row">
          {/* Health Status + Key Totals */}
          <div className="mmp-health-box" style={{ background: hStyle.bg, borderColor: hStyle.border }}>
            <div className="mmp-health-top">
              <span className="mmp-health-badge" style={{ color: hStyle.color }}>
                {hStyle.icon} {status.label}
              </span>
              {loading && <span className="mmp-calc-tag">Updating...</span>}
            </div>
            <div className="mmp-totals-strip">
              <div className="mmp-tot-item">
                <span>Total Inhaled</span>
                <strong style={{ color: hStyle.color }}>{totals.total_dose_ug} µg</strong>
              </div>
              <div className="mmp-tot-item">
                <span>Trip Avg AQI</span>
                <strong>{totals.estimated_trip_aqi} AQI</strong>
              </div>
              <div className="mmp-tot-item">
                <span>Total Time</span>
                <strong>{totals.total_duration_min} min</strong>
              </div>
            </div>
            <p className="mmp-health-note">{status.advice}</p>
          </div>

          {/* Safer Alternative Suggestions */}
          {result.safer_options?.length > 0 && (
            <div className="mmp-safer-box">
              <span className="mmp-safer-title">🛡️ Safer Alternatives</span>
              <div className="mmp-safer-list">
                {result.safer_options.slice(0, 2).map((opt) => (
                  <div key={opt.id} className="mmp-safer-item">
                    <div className="mmp-safer-copy">
                      <strong>{opt.title} · <span style={{ color: '#15803D' }}>{opt.new_dose_ug} µg (−{opt.reduction_percent}%)</span></strong>
                      <span>{opt.desc}</span>
                    </div>
                    <button
                      type="button"
                      className="mmp-apply-btn"
                      onClick={() => applySuggestion(opt.suggested_legs)}
                    >
                      Use This
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MultiModalPlanner;
