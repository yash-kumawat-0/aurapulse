// ============================================
// IndoorAirSimulator — Auto-fetch + Sliders
// Auto-runs simulation when AQI data is available.
// Interactive range selectors with live preview.
// ============================================
import { useState, useEffect, useRef } from 'react';
import { useUser } from '../../context/UserContext.jsx';
import { useAqi } from '../../context/AqiContext.jsx';
import './IndoorAirSimulator.css';

// ── Room presets ──
const ROOM_PRESETS = [
  { key: 'small', label: '🛏️ Small Room', area: 100, icon: '🛏️' },
  { key: 'bedroom', label: '🛌 Bedroom', area: 150, icon: '🛌' },
  { key: 'living', label: '🛋️ Living Room', area: 200, icon: '🛋️' },
  { key: 'hall', label: '🏠 Hall', area: 300, icon: '🏠' },
];

// ── Window types with infiltration info ──
const WINDOW_TYPES = [
  { key: 'leaky_wood', label: 'Old Wood', desc: 'High air leak', icon: '🪟', level: 'bad' },
  { key: 'standard_aluminum', label: 'Aluminum', desc: 'Standard seal', icon: '🔲', level: 'ok' },
  { key: 'sealed_upvc', label: 'UPVC Sealed', desc: 'Tight seal', icon: '✨', level: 'good' },
];

// ── Indoor pollution sources ──
const SOURCES = [
  { key: 'none', label: 'None', icon: '🚫', pm25: 0 },
  { key: 'incense', label: 'Incense', icon: '🪔', pm25: 80 },
  { key: 'mosquito_coil', label: 'Mosquito Coil', icon: '🦟', pm25: 150 },
  { key: 'cooking_frying', label: 'Cooking/Frying', icon: '🍳', pm25: 120 },
  { key: 'smoking', label: 'Smoking', icon: '🚬', pm25: 200 },
];

function IndoorAirSimulator() {
  const { homeProfile, setHomeProfile, location } = useUser();
  const { currentAqi, indoorData, loadIndoorSimulation, loadAqiData, loading } = useAqi();

  const [roomArea, setRoomArea] = useState(homeProfile.room_area_sqft);
  const [ceilingHeight, setCeilingHeight] = useState(homeProfile.ceiling_height_ft || 10);
  const [sealType, setSealType] = useState(homeProfile.window_seal_type);
  const [source, setSource] = useState(homeProfile.indoor_source);
  const [cadr, setCadr] = useState(homeProfile.purifier_cadr);
  const hasAutoRun = useRef(false);

  // ── Auto-fetch AQI if location is detected but no AQI data yet ──
  useEffect(() => {
    if (location && !currentAqi && !loading) {
      loadAqiData(location.lat, location.lng);
    }
  }, [location, currentAqi, loading, loadAqiData]);

  // ── Auto-run simulation once AQI data arrives ──
  useEffect(() => {
    if (currentAqi && !hasAutoRun.current) {
      hasAutoRun.current = true;
      runSimulation(currentAqi.pm25);
    }
  }, [currentAqi]); // eslint-disable-line

  const runSimulation = (pm25Override) => {
    const params = {
      outdoor_pm25: pm25Override ?? currentAqi?.pm25 ?? 150,
      room_area_sqft: roomArea,
      ceiling_height_ft: ceilingHeight,
      window_seal_type: sealType,
      purifier_cadr: cadr,
      indoor_source: source,
    };
    setHomeProfile({ ...homeProfile, ...params });
    loadIndoorSimulation(params);
  };

  const handleChange = (setter, value) => {
    setter(value);
    // Re-run simulation after a short delay so slider feels responsive
    setTimeout(() => {
      hasAutoRun.current = true; // prevent double-auto
    }, 100);
  };

  const handleSimulate = () => runSimulation();

  const sim = indoorData?.simulation;
  const outdoorPM = currentAqi?.pm25 || 150;

  // Color helper for indoor PM2.5
  const getIndoorColor = (pm) => {
    if (pm <= 12) return '#2E7D32';
    if (pm <= 35) return '#4CAF50';
    if (pm <= 55) return '#F9A825';
    if (pm <= 150) return '#EF6C00';
    return '#C62828';
  };

  const getIndoorLabel = (pm) => {
    if (pm <= 12) return 'Excellent';
    if (pm <= 35) return 'Safe';
    if (pm <= 55) return 'Moderate';
    if (pm <= 150) return 'Unhealthy';
    return 'Hazardous';
  };

  return (
    <div className="card indoor-card">
      <div className="indoor-header">
        <h3 className="indoor-title">🏠 Indoor Air Simulator</h3>
        {currentAqi && (
          <div className="indoor-outdoor-badge">
            <span className="indoor-outdoor-dot" style={{ background: getIndoorColor(outdoorPM) }} />
            Outdoor: <strong>{Math.round(outdoorPM)}</strong> µg/m³
          </div>
        )}
        {!currentAqi && location && (
          <span className="indoor-loading-badge">⏳ Fetching air quality...</span>
        )}
      </div>

      <div className="indoor-controls">
        {/* ── Room Size ── */}
        <div className="indoor-section">
          <label className="indoor-label">Room Type</label>
          <div className="indoor-room-grid">
            {ROOM_PRESETS.map((r) => (
              <button key={r.key}
                className={`indoor-room-btn ${roomArea === r.area ? 'indoor-room-btn--on' : ''}`}
                onClick={() => { setRoomArea(r.area); }}>
                <span className="indoor-room-icon">{r.icon}</span>
                <span className="indoor-room-name">{r.label.replace(r.icon + ' ', '')}</span>
                <span className="indoor-room-size">{r.area} ft²</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Ceiling Height Slider ── */}
        <div className="indoor-section">
          <label className="indoor-label">Ceiling Height</label>
          <div className="indoor-range-wrap">
            <input type="range" className="indoor-range" min="8" max="14" step="1"
              value={ceilingHeight} onChange={(e) => setCeilingHeight(Number(e.target.value))} />
            <div className="indoor-range-info">
              <span className="indoor-range-val">{ceilingHeight} ft</span>
              <span className="indoor-range-hint">{ceilingHeight <= 9 ? 'Low' : ceilingHeight <= 11 ? 'Standard' : 'High'}</span>
            </div>
          </div>
        </div>

        {/* ── Window Seal Type ── */}
        <div className="indoor-section">
          <label className="indoor-label">Window Seal Quality</label>
          <div className="indoor-seal-grid">
            {WINDOW_TYPES.map((w) => (
              <button key={w.key}
                className={`indoor-seal-btn ${sealType === w.key ? 'indoor-seal-btn--on' : ''}`}
                onClick={() => setSealType(w.key)}>
                <span className="indoor-seal-icon">{w.icon}</span>
                <span className="indoor-seal-name">{w.label}</span>
                <span className={`indoor-seal-level indoor-seal-level--${w.level}`}>{w.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Indoor Pollution Source ── */}
        <div className="indoor-section">
          <label className="indoor-label">Indoor Pollution Source</label>
          <div className="indoor-source-grid">
            {SOURCES.map((s) => (
              <button key={s.key}
                className={`indoor-source-btn ${source === s.key ? 'indoor-source-btn--on' : ''}`}
                onClick={() => setSource(s.key)}>
                <span className="indoor-source-icon">{s.icon}</span>
                <span className="indoor-source-name">{s.label}</span>
                {s.pm25 > 0 && <span className="indoor-source-pm">+{s.pm25} µg</span>}
              </button>
            ))}
          </div>
        </div>

        {/* ── Purifier CADR Slider ── */}
        <div className="indoor-section">
          <label className="indoor-label">Air Purifier CADR</label>
          <div className="indoor-range-wrap">
            <input type="range" className="indoor-range indoor-range--purifier" min="0" max="600" step="10"
              value={cadr} onChange={(e) => setCadr(Number(e.target.value))} />
            <div className="indoor-range-info">
              <span className="indoor-range-val" style={{ color: cadr > 0 ? '#2E7D32' : 'var(--text-muted)' }}>
                {cadr > 0 ? `${cadr} m³/h` : 'No purifier'}
              </span>
              <span className="indoor-range-hint">
                {cadr === 0 ? 'Slide to add' : cadr < 150 ? 'Small room' : cadr < 350 ? 'Medium room' : 'Large room'}
              </span>
            </div>
          </div>
        </div>

        <button className="indoor-sim-btn" onClick={handleSimulate} disabled={!currentAqi && !location}>
          🔬 {sim ? 'Re-simulate' : 'Simulate'}
        </button>
      </div>

      {/* ── Results ── */}
      {sim && (
        <div className="indoor-result">
          <div className="indoor-result-cards">
            <div className="indoor-result-card indoor-result-card--main"
              style={{ borderColor: getIndoorColor(sim.indoor_pm25) }}>
              <span className="indoor-result-label">Indoor PM2.5</span>
              <span className="indoor-result-num" style={{ color: getIndoorColor(sim.indoor_pm25) }}>
                {sim.indoor_pm25}
              </span>
              <span className="indoor-result-unit">µg/m³</span>
              <span className="indoor-result-badge" style={{ background: getIndoorColor(sim.indoor_pm25) + '20', color: getIndoorColor(sim.indoor_pm25) }}>
                {getIndoorLabel(sim.indoor_pm25)}
              </span>
            </div>

            <div className="indoor-result-card">
              <span className="indoor-result-label">I/O Ratio</span>
              <span className="indoor-result-num">{sim.io_ratio_percent}%</span>
              <span className="indoor-result-unit">of outdoor air</span>
            </div>

            <div className="indoor-result-card">
              <span className="indoor-result-label">Outdoor</span>
              <span className="indoor-result-num" style={{ color: getIndoorColor(outdoorPM) }}>{Math.round(outdoorPM)}</span>
              <span className="indoor-result-unit">µg/m³</span>
            </div>
          </div>

          {/* Visual bar: Outdoor → Indoor comparison */}
          <div className="indoor-compare-bar">
            <div className="indoor-compare-track">
              <div className="indoor-compare-outdoor" style={{
                width: `${Math.min(100, (outdoorPM / Math.max(outdoorPM, sim.indoor_pm25, 100)) * 100)}%`,
                background: getIndoorColor(outdoorPM),
              }}>
                <span>Outdoor</span>
              </div>
            </div>
            <div className="indoor-compare-track">
              <div className="indoor-compare-indoor" style={{
                width: `${Math.min(100, (sim.indoor_pm25 / Math.max(outdoorPM, sim.indoor_pm25, 100)) * 100)}%`,
                background: getIndoorColor(sim.indoor_pm25),
              }}>
                <span>Indoor</span>
              </div>
            </div>
          </div>

          {sim.is_safe && (
            <div className="indoor-banner indoor-banner--safe">✅ Safe — below WHO guideline (35 µg/m³)</div>
          )}
          {!sim.is_safe && sim.cadr_needed_for_safe > 0 && (
            <div className="indoor-banner indoor-banner--warn">
              💡 Need a purifier with <strong>{sim.cadr_needed_for_safe} m³/h CADR</strong> to reach safe levels
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default IndoorAirSimulator;
