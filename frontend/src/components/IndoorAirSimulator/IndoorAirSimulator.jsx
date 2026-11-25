// ============================================
// IndoorAirSimulator — Redesigned with circular
// gauges, 3D result panel, no DIY section.
// ============================================
import { useState, useEffect, useRef } from 'react';
import { useUser } from '../../context/UserContext.jsx';
import { useAqi } from '../../context/AqiContext.jsx';
import './IndoorAirSimulator.css';

// ── Room presets ──
const ROOM_PRESETS = [
  { key: 'small', label: 'Small Room', area: 100, icon: '🛏️' },
  { key: 'bedroom', label: 'Bedroom', area: 150, icon: '🛌' },
  { key: 'living', label: 'Living Room', area: 200, icon: '🛋️' },
  { key: 'hall', label: 'Hall', area: 300, icon: '🏠' },
];

// ── Window types ──
const WINDOW_TYPES = [
  { key: 'leaky_wood', label: 'Old Wood', desc: 'High leak', icon: '🪟', level: 'bad' },
  { key: 'standard_aluminum', label: 'Aluminum', desc: 'Standard', icon: '🔲', level: 'ok' },
  { key: 'sealed_upvc', label: 'UPVC Sealed', desc: 'Tight seal', icon: '✨', level: 'good' },
];

// ── Indoor pollution sources ──
const SOURCES = [
  { key: 'none', label: 'None', icon: '🚫', pm25: 0 },
  { key: 'incense', label: 'Incense', icon: '🪔', pm25: 80 },
  { key: 'mosquito_coil', label: 'Coil', icon: '🦟', pm25: 150 },
  { key: 'cooking_frying', label: 'Cooking', icon: '🍳', pm25: 120 },
  { key: 'smoking', label: 'Smoking', icon: '🚬', pm25: 200 },
];

// ── Circular Gauge SVG Component ──
function CircularGauge({ value, maxValue, label, sublabel, color, size = 140 }) {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const cappedRatio = Math.min(value / Math.max(maxValue, 1), 1);
  const offset = circumference * (1 - cappedRatio);
  const center = size / 2;

  return (
    <div className="indoor-gauge" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background track */}
        <circle cx={center} cy={center} r={radius}
          fill="none" stroke="#e8ecef" strokeWidth="10"
          transform={`rotate(-90 ${center} ${center})`} />
        {/* Value arc */}
        <circle cx={center} cy={center} r={radius}
          fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
          className="indoor-gauge-arc" />
        {/* Glow filter */}
        <defs>
          <filter id={`glow-${label}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <circle cx={center} cy={center} r={radius}
          fill="none" stroke={color} strokeWidth="10" opacity="0.3"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
          filter={`url(#glow-${label})`} />
      </svg>
      <div className="indoor-gauge-center">
        <span className="indoor-gauge-value" style={{ color }}>{Math.round(value)}</span>
        <span className="indoor-gauge-unit">µg/m³</span>
      </div>
      <div className="indoor-gauge-label">{label}</div>
      {sublabel && <div className="indoor-gauge-sublabel" style={{ color }}>{sublabel}</div>}
    </div>
  );
}

function IndoorAirSimulator() {
  const { homeProfile, setHomeProfile, location } = useUser();
  const { currentAqi, indoorData, loadIndoorSimulation, loadAqiData, loading } = useAqi();

  const [roomArea, setRoomArea] = useState(homeProfile.room_area_sqft);
  const [ceilingHeight, setCeilingHeight] = useState(homeProfile.ceiling_height_ft || 10);
  const [sealType, setSealType] = useState(homeProfile.window_seal_type);
  const [source, setSource] = useState(homeProfile.indoor_source);
  const [cadr, setCadr] = useState(homeProfile.purifier_cadr);
  const [showResults, setShowResults] = useState(false);
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
      runSimulation(currentAqi.pm25, true);
    }
  }, [currentAqi]); // eslint-disable-line

  const runSimulation = (pm25Override, isAutoRun = false) => {
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
    if (!isAutoRun) setShowResults(true);
  };

  const handleSimulate = () => runSimulation();

  const sim = indoorData?.simulation;
  const outdoorPM = currentAqi?.pm25 || 150;

  // Color helper for PM2.5
  const getColor = (pm) => {
    if (pm <= 12) return '#10B981';
    if (pm <= 35) return '#34D399';
    if (pm <= 55) return '#F59E0B';
    if (pm <= 150) return '#EF6C00';
    return '#DC2626';
  };

  const getLabel = (pm) => {
    if (pm <= 12) return 'Excellent';
    if (pm <= 35) return 'Safe';
    if (pm <= 55) return 'Moderate';
    if (pm <= 150) return 'Unhealthy';
    return 'Hazardous';
  };

  // Reduction percentage
  const reductionPct = sim ? Math.round(((outdoorPM - sim.indoor_pm25) / outdoorPM) * 100) : 0;
  const maxGauge = Math.max(outdoorPM, sim?.indoor_pm25 || 0, 100);

  return (
    <div className="indoor-panel">
      {/* ── Header ── */}
      <div className="indoor-panel-header">
        <div className="indoor-panel-title-row">
          <div className="indoor-panel-icon">🏠</div>
          <div>
            <h3 className="indoor-panel-title">Indoor Air Simulator</h3>
            <p className="indoor-panel-subtitle">Configure your room and see how indoor air quality compares</p>
          </div>
        </div>
        {currentAqi && (
          <div className="indoor-aqi-chip" style={{ borderColor: getColor(outdoorPM) + '60' }}>
            <span className="indoor-aqi-dot" style={{ background: getColor(outdoorPM) }} />
            Outdoor AQI: <strong style={{ color: getColor(outdoorPM) }}>{Math.round(outdoorPM)} µg/m³</strong>
          </div>
        )}
        {!currentAqi && location && (
          <div className="indoor-aqi-chip indoor-aqi-chip--loading">
            <span className="indoor-aqi-spinner" /> Fetching air quality...
          </div>
        )}
      </div>

      {/* ── Configuration Grid ── */}
      <div className="indoor-config">
        {/* Room Type */}
        <div className="indoor-config-section">
          <label className="indoor-config-label">🏠 Room Type</label>
          <div className="indoor-room-grid">
            {ROOM_PRESETS.map((r) => (
              <button key={r.key}
                className={`indoor-room-chip ${roomArea === r.area ? 'indoor-room-chip--active' : ''}`}
                onClick={() => setRoomArea(r.area)}>
                <span className="indoor-chip-icon">{r.icon}</span>
                <span className="indoor-chip-name">{r.label}</span>
                <span className="indoor-chip-meta">{r.area} ft²</span>
              </button>
            ))}
          </div>
        </div>

        {/* Two-column: Ceiling + Purifier sliders */}
        <div className="indoor-slider-row">
          <div className="indoor-config-section indoor-config-section--half">
            <label className="indoor-config-label">📐 Ceiling Height</label>
            <div className="indoor-slider-wrap">
              <input type="range" className="indoor-slider" min="8" max="14" step="1"
                value={ceilingHeight} onChange={(e) => setCeilingHeight(Number(e.target.value))} />
              <div className="indoor-slider-value">
                <span className="indoor-slider-num">{ceilingHeight}</span>
                <span className="indoor-slider-unit">ft</span>
              </div>
            </div>
          </div>

          <div className="indoor-config-section indoor-config-section--half">
            <label className="indoor-config-label">🌀 Purifier CADR</label>
            <div className="indoor-slider-wrap">
              <input type="range" className="indoor-slider indoor-slider--green" min="0" max="600" step="10"
                value={cadr} onChange={(e) => setCadr(Number(e.target.value))} />
              <div className="indoor-slider-value">
                <span className="indoor-slider-num" style={{ color: cadr > 0 ? '#10B981' : '#9CA3AF' }}>
                  {cadr > 0 ? cadr : '—'}
                </span>
                <span className="indoor-slider-unit">{cadr > 0 ? 'm³/h' : 'None'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Window Seal */}
        <div className="indoor-config-section">
          <label className="indoor-config-label">🪟 Window Seal Quality</label>
          <div className="indoor-seal-grid">
            {WINDOW_TYPES.map((w) => (
              <button key={w.key}
                className={`indoor-seal-chip ${sealType === w.key ? 'indoor-seal-chip--active' : ''}`}
                onClick={() => setSealType(w.key)}>
                <span className="indoor-chip-icon">{w.icon}</span>
                <span className="indoor-chip-name">{w.label}</span>
                <span className={`indoor-seal-quality indoor-seal-quality--${w.level}`}>{w.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Indoor Source */}
        <div className="indoor-config-section">
          <label className="indoor-config-label">🔥 Pollution Source</label>
          <div className="indoor-source-grid">
            {SOURCES.map((s) => (
              <button key={s.key}
                className={`indoor-source-chip ${source === s.key ? 'indoor-source-chip--active' : ''}`}
                onClick={() => setSource(s.key)}>
                <span className="indoor-chip-icon">{s.icon}</span>
                <span className="indoor-chip-name">{s.label}</span>
                {s.pm25 > 0 && <span className="indoor-source-pm">+{s.pm25}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Simulate Button */}
        <button className="indoor-simulate-btn" onClick={handleSimulate}
          disabled={!currentAqi && !location}>
          <span className="indoor-simulate-icon">🔬</span>
          <span>{sim ? 'Re-simulate' : 'Simulate Indoor Air'}</span>
        </button>
      </div>

      {/* ── 3D Results Panel — appears on Simulate ── */}
      {showResults && sim && (
        <div className="indoor-results-3d">
          {/* Gauges Row */}
          <div className="indoor-gauges-row">
            <CircularGauge
              value={outdoorPM} maxValue={maxGauge}
              label="Outdoor" sublabel={getLabel(outdoorPM)}
              color={getColor(outdoorPM)} size={150}
            />

            <div className="indoor-gauges-arrow">
              <div className="indoor-arrow-line" />
              <div className="indoor-arrow-badge">
                {reductionPct >= 0
                  ? <><span className="indoor-arrow-down">↓</span> {Math.abs(reductionPct)}%</>
                  : <><span className="indoor-arrow-up">↑</span> {Math.abs(reductionPct)}%</>
                }
              </div>
              <div className="indoor-arrow-line" />
            </div>

            <CircularGauge
              value={sim.indoor_pm25} maxValue={maxGauge}
              label="Indoor" sublabel={getLabel(sim.indoor_pm25)}
              color={getColor(sim.indoor_pm25)} size={150}
            />
          </div>

          {/* Stats Row */}
          <div className="indoor-stats-row">
            <div className="indoor-stat-card">
              <span className="indoor-stat-icon">📊</span>
              <span className="indoor-stat-label">I/O Ratio</span>
              <span className="indoor-stat-value">{sim.io_ratio_percent}%</span>
            </div>
            <div className="indoor-stat-card">
              <span className="indoor-stat-icon">🏠</span>
              <span className="indoor-stat-label">Indoor PM2.5</span>
              <span className="indoor-stat-value" style={{ color: getColor(sim.indoor_pm25) }}>
                {sim.indoor_pm25} µg/m³
              </span>
            </div>
            <div className="indoor-stat-card">
              <span className="indoor-stat-icon">🌍</span>
              <span className="indoor-stat-label">Outdoor PM2.5</span>
              <span className="indoor-stat-value" style={{ color: getColor(outdoorPM) }}>
                {Math.round(outdoorPM)} µg/m³
              </span>
            </div>
            {cadr > 0 && (
              <div className="indoor-stat-card">
                <span className="indoor-stat-icon">🌀</span>
                <span className="indoor-stat-label">Purifier Active</span>
                <span className="indoor-stat-value" style={{ color: '#10B981' }}>{cadr} m³/h</span>
              </div>
            )}
          </div>

          {/* Safety Banner */}
          {sim.is_safe && (
            <div className="indoor-safety-banner indoor-safety-banner--safe">
              <span className="indoor-safety-icon">✅</span>
              <div>
                <strong>Safe Air Quality</strong>
                <p>Indoor PM2.5 is below the WHO guideline of 35 µg/m³</p>
              </div>
            </div>
          )}
          {!sim.is_safe && sim.cadr_needed_for_safe > 0 && (
            <div className="indoor-safety-banner indoor-safety-banner--warn">
              <span className="indoor-safety-icon">⚠️</span>
              <div>
                <strong>Action Required</strong>
                <p>You need a purifier with <strong>{sim.cadr_needed_for_safe} m³/h CADR</strong> to reach safe PM2.5 levels</p>
              </div>
            </div>
          )}
          {!sim.is_safe && (!sim.cadr_needed_for_safe || sim.cadr_needed_for_safe <= 0) && (
            <div className="indoor-safety-banner indoor-safety-banner--warn">
              <span className="indoor-safety-icon">⚠️</span>
              <div>
                <strong>Unhealthy Indoor Air</strong>
                <p>Consider improving window seals and adding an air purifier</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Show auto-run results (before user clicks simulate) as a mini summary */}
      {!showResults && sim && (
        <div className="indoor-auto-hint" onClick={() => setShowResults(true)}>
          <span className="indoor-auto-hint-dot" style={{ background: getColor(sim.indoor_pm25) }} />
          Indoor PM2.5: <strong style={{ color: getColor(sim.indoor_pm25) }}>{sim.indoor_pm25} µg/m³</strong>
          <span className="indoor-auto-hint-action">— Click Simulate for full analysis ↗</span>
        </div>
      )}
    </div>
  );
}

export default IndoorAirSimulator;
