// ============================================
// IndoorAirSimulator — Redesigned v3
// 3 simple inputs → Simulate →
//   1) Outdoor/Indoor comparison (separate area)
//   2) DIY Purifier with animated steps
// ============================================
import { useState, useEffect, useRef } from 'react';
import { useUser } from '../../context/UserContext.jsx';
import { useAqi } from '../../context/AqiContext.jsx';
import './IndoorAirSimulator.css';

// ── Room presets (combined type + size) ──
const ROOMS = [
  { key: 'small', label: 'Small Room', area: 100, height: 9, icon: '🛏️', desc: '~100 ft² · 900 ft³' },
  { key: 'bedroom', label: 'Bedroom', area: 150, height: 10, icon: '🛌', desc: '~150 ft² · 1500 ft³' },
  { key: 'living', label: 'Living Room', area: 200, height: 10, icon: '🛋️', desc: '~200 ft² · 2000 ft³' },
  { key: 'hall', label: 'Hall', area: 300, height: 12, icon: '🏠', desc: '~300 ft² · 3600 ft³' },
];

// ── Window seal types ──
const SEALS = [
  { key: 'leaky_wood', label: 'Old Wood', desc: 'Gaps & leaks', icon: '🪟', level: 'bad', color: '#EF4444' },
  { key: 'standard_aluminum', label: 'Aluminum', desc: 'Standard fit', icon: '🔲', level: 'ok', color: '#F59E0B' },
  { key: 'sealed_upvc', label: 'UPVC Sealed', desc: 'Airtight', icon: '✨', level: 'good', color: '#10B981' },
];

// ── Pollution sources ──
const SOURCES = [
  { key: 'none', label: 'None', icon: '✅', pm25: 0 },
  { key: 'incense', label: 'Incense', icon: '🪔', pm25: 80 },
  { key: 'mosquito_coil', label: 'Mosquito Coil', icon: '🦟', pm25: 150 },
  { key: 'cooking_frying', label: 'Cooking', icon: '🍳', pm25: 120 },
  { key: 'smoking', label: 'Smoking', icon: '🚬', pm25: 200 },
];

// ── DIY Purifier Steps ──
const DIY_STEPS = [
  {
    num: 1,
    title: 'Get Materials',
    desc: 'A box fan (₹800-1500), a MERV-13 or HEPA furnace filter (₹500-1000), and duct tape.',
    visual: 'materials',
  },
  {
    num: 2,
    title: 'Attach Filter to Fan',
    desc: 'Place the filter flat against the back (intake side) of the box fan. The arrow on the filter should point toward the fan.',
    visual: 'attach',
  },
  {
    num: 3,
    title: 'Seal the Edges',
    desc: 'Use duct tape to seal all four edges where the filter meets the fan. No gaps = more clean air.',
    visual: 'seal',
  },
  {
    num: 4,
    title: 'Power On & Place',
    desc: 'Turn on the fan. Place it in the room you want to clean. Run it for 30-60 mins for best results.',
    visual: 'run',
  },
];

function IndoorAirSimulator() {
  const { homeProfile, setHomeProfile, location } = useUser();
  const { currentAqi, indoorData, loadIndoorSimulation, loadAqiData, loading } = useAqi();

  const [selectedRoom, setSelectedRoom] = useState('bedroom');
  const [sealType, setSealType] = useState(homeProfile.window_seal_type || 'standard_aluminum');
  const [source, setSource] = useState(homeProfile.indoor_source || 'none');
  const [showResults, setShowResults] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const hasAutoRun = useRef(false);

  const room = ROOMS.find(r => r.key === selectedRoom) || ROOMS[1];

  // Auto-fetch AQI
  useEffect(() => {
    if (location && !currentAqi && !loading) {
      loadAqiData(location.lat, location.lng);
    }
  }, [location, currentAqi, loading, loadAqiData]);

  // Auto-run simulation once AQI arrives
  useEffect(() => {
    if (currentAqi && !hasAutoRun.current) {
      hasAutoRun.current = true;
      doSimulate(currentAqi.pm25, true);
    }
  }, [currentAqi]); // eslint-disable-line

  const doSimulate = (pm25Override, isAuto = false) => {
    const params = {
      outdoor_pm25: pm25Override ?? currentAqi?.pm25 ?? 150,
      room_area_sqft: room.area,
      ceiling_height_ft: room.height,
      window_seal_type: sealType,
      purifier_cadr: 0,
      indoor_source: source,
    };
    setHomeProfile({ ...homeProfile, ...params });
    loadIndoorSimulation(params);
    if (!isAuto) {
      setShowResults(true);
      setActiveStep(0);
    }
  };

  const sim = indoorData?.simulation;
  const outdoorPM = currentAqi?.pm25 || 150;

  const getColor = (pm) => {
    if (pm <= 12) return '#10B981';
    if (pm <= 35) return '#34D399';
    if (pm <= 55) return '#F59E0B';
    if (pm <= 150) return '#EF6C00';
    return '#DC2626';
  };
  const getLabel = (pm) => {
    if (pm <= 12) return 'Excellent';
    if (pm <= 35) return 'Good';
    if (pm <= 55) return 'Moderate';
    if (pm <= 150) return 'Unhealthy';
    return 'Hazardous';
  };

  const maxBar = Math.max(outdoorPM, sim?.indoor_pm25 || 0, 50);

  return (
    <div className="ia-panel">
      {/* ═══ HEADER ═══ */}
      <div className="ia-header">
        <h3 className="ia-title">
          <span className="ia-title-icon">🏠</span>
          Indoor Air Simulator
        </h3>
        {currentAqi && (
          <div className="ia-outdoor-pill">
            <span className="ia-pill-dot" style={{ background: getColor(outdoorPM) }} />
            Outdoor: <strong>{Math.round(outdoorPM)}</strong> µg/m³
          </div>
        )}
        {!currentAqi && location && (
          <div className="ia-outdoor-pill ia-outdoor-pill--loading">
            <span className="ia-spinner" /> Fetching...
          </div>
        )}
      </div>

      {/* ═══ 3 INPUT CARDS ═══ */}
      <div className="ia-inputs">
        {/* 1. Room Type & Size */}
        <div className="ia-input-card">
          <div className="ia-input-num">1</div>
          <label className="ia-input-label">Room Type & Size</label>
          <div className="ia-room-options">
            {ROOMS.map(r => (
              <button key={r.key}
                className={`ia-room-btn ${selectedRoom === r.key ? 'ia-room-btn--active' : ''}`}
                onClick={() => setSelectedRoom(r.key)}>
                <span className="ia-room-emoji">{r.icon}</span>
                <span className="ia-room-name">{r.label}</span>
                <span className="ia-room-vol">{r.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 2. Window Seal */}
        <div className="ia-input-card">
          <div className="ia-input-num">2</div>
          <label className="ia-input-label">Window Seal Quality</label>
          <div className="ia-seal-options">
            {SEALS.map(s => (
              <button key={s.key}
                className={`ia-seal-btn ${sealType === s.key ? 'ia-seal-btn--active' : ''}`}
                onClick={() => setSealType(s.key)}
                style={sealType === s.key ? { borderColor: s.color, background: s.color + '10' } : {}}>
                <span className="ia-seal-emoji">{s.icon}</span>
                <span className="ia-seal-name">{s.label}</span>
                <span className="ia-seal-desc" style={{ color: s.color }}>{s.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 3. Pollution Source */}
        <div className="ia-input-card">
          <div className="ia-input-num">3</div>
          <label className="ia-input-label">Indoor Pollution Source</label>
          <div className="ia-source-options">
            {SOURCES.map(s => (
              <button key={s.key}
                className={`ia-src-btn ${source === s.key ? 'ia-src-btn--active' : ''}`}
                onClick={() => setSource(s.key)}>
                <span className="ia-src-emoji">{s.icon}</span>
                <span className="ia-src-name">{s.label}</span>
                {s.pm25 > 0 && <span className="ia-src-pm">+{s.pm25} µg</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ SIMULATE BUTTON ═══ */}
      <button className="ia-simulate-btn" onClick={() => doSimulate()}
        disabled={!currentAqi && !location}>
        🔬 Simulate Indoor Air
      </button>

      {/* ═══ RESULTS — Separate sections ═══ */}
      {showResults && sim && (
        <>
          {/* ── Section 1: Outdoor vs Indoor Comparison ── */}
          <div className="ia-compare">
            <h4 className="ia-compare-title">Air Quality Comparison</h4>
            <div className="ia-compare-cols">
              {/* Outdoor */}
              <div className="ia-compare-col">
                <div className="ia-compare-icon-wrap" style={{ background: getColor(outdoorPM) + '15' }}>
                  <span className="ia-compare-icon">🌍</span>
                </div>
                <span className="ia-compare-label">Outdoor</span>
                <span className="ia-compare-value" style={{ color: getColor(outdoorPM) }}>
                  {Math.round(outdoorPM)}
                </span>
                <span className="ia-compare-unit">µg/m³</span>
                <div className="ia-compare-bar-track">
                  <div className="ia-compare-bar-fill" style={{
                    width: `${(outdoorPM / maxBar) * 100}%`,
                    background: `linear-gradient(90deg, ${getColor(outdoorPM)}80, ${getColor(outdoorPM)})`,
                  }} />
                </div>
                <span className="ia-compare-tag" style={{ color: getColor(outdoorPM), background: getColor(outdoorPM) + '15' }}>
                  {getLabel(outdoorPM)}
                </span>
              </div>

              {/* Arrow */}
              <div className="ia-compare-arrow">
                <div className="ia-compare-arrow-line" />
                <div className="ia-compare-arrow-badge">
                  {sim.indoor_pm25 <= outdoorPM
                    ? <><span style={{ color: '#10B981' }}>↓</span> {Math.round(((outdoorPM - sim.indoor_pm25) / outdoorPM) * 100)}%</>
                    : <><span style={{ color: '#DC2626' }}>↑</span> {Math.round(((sim.indoor_pm25 - outdoorPM) / outdoorPM) * 100)}%</>
                  }
                </div>
                <div className="ia-compare-arrow-line" />
              </div>

              {/* Indoor */}
              <div className="ia-compare-col">
                <div className="ia-compare-icon-wrap" style={{ background: getColor(sim.indoor_pm25) + '15' }}>
                  <span className="ia-compare-icon">🏠</span>
                </div>
                <span className="ia-compare-label">Indoor</span>
                <span className="ia-compare-value" style={{ color: getColor(sim.indoor_pm25) }}>
                  {sim.indoor_pm25}
                </span>
                <span className="ia-compare-unit">µg/m³</span>
                <div className="ia-compare-bar-track">
                  <div className="ia-compare-bar-fill" style={{
                    width: `${(sim.indoor_pm25 / maxBar) * 100}%`,
                    background: `linear-gradient(90deg, ${getColor(sim.indoor_pm25)}80, ${getColor(sim.indoor_pm25)})`,
                  }} />
                </div>
                <span className="ia-compare-tag" style={{ color: getColor(sim.indoor_pm25), background: getColor(sim.indoor_pm25) + '15' }}>
                  {getLabel(sim.indoor_pm25)}
                </span>
              </div>
            </div>

            {/* Safety note */}
            {sim.is_safe ? (
              <div className="ia-safety ia-safety--safe">
                ✅ <strong>Safe</strong> — below WHO guideline (35 µg/m³)
              </div>
            ) : (
              <div className="ia-safety ia-safety--warn">
                ⚠️ <strong>Above safe levels</strong> — consider a DIY purifier below
              </div>
            )}
          </div>

          {/* ── Section 2: DIY Purifier Builder ── */}
          <div className="ia-diy">
            <div className="ia-diy-header">
              <h4 className="ia-diy-title">🛠️ Build a DIY Air Purifier</h4>
              <p className="ia-diy-subtitle">A simple fan-filter combo that actually works. ~₹1500 total cost.</p>
            </div>

            {/* 3D Animated Visual */}
            <div className="ia-diy-scene">
              <div className={`ia-diy-model ia-diy-model--step${activeStep}`}>
                {/* Fan body */}
                <div className="ia-model-fan">
                  <div className="ia-model-fan-face">
                    <div className="ia-model-blade ia-model-blade--1" />
                    <div className="ia-model-blade ia-model-blade--2" />
                    <div className="ia-model-blade ia-model-blade--3" />
                    <div className="ia-model-hub" />
                  </div>
                  <div className="ia-model-fan-side" />
                </div>
                {/* Filter */}
                <div className={`ia-model-filter ${activeStep >= 1 ? 'ia-model-filter--attached' : ''}`}>
                  <div className="ia-model-filter-face">
                    <div className="ia-model-filter-grid" />
                    <span className="ia-model-filter-label">HEPA</span>
                  </div>
                </div>
                {/* Tape strips */}
                <div className={`ia-model-tape ${activeStep >= 2 ? 'ia-model-tape--visible' : ''}`}>
                  <div className="ia-model-tape-strip ia-model-tape-strip--top" />
                  <div className="ia-model-tape-strip ia-model-tape-strip--bottom" />
                  <div className="ia-model-tape-strip ia-model-tape-strip--left" />
                  <div className="ia-model-tape-strip ia-model-tape-strip--right" />
                </div>
                {/* Air flow arrows */}
                <div className={`ia-model-airflow ${activeStep >= 3 ? 'ia-model-airflow--active' : ''}`}>
                  <span className="ia-model-air-arrow">→</span>
                  <span className="ia-model-air-arrow">→</span>
                  <span className="ia-model-air-arrow">→</span>
                </div>
              </div>
            </div>

            {/* Step cards */}
            <div className="ia-diy-steps">
              {DIY_STEPS.map((step, i) => (
                <button key={i}
                  className={`ia-diy-step ${activeStep === i ? 'ia-diy-step--active' : ''} ${i < activeStep ? 'ia-diy-step--done' : ''}`}
                  onClick={() => setActiveStep(i)}>
                  <div className="ia-step-num-wrap">
                    <span className={`ia-step-num ${i < activeStep ? 'ia-step-num--done' : ''}`}>
                      {i < activeStep ? '✓' : step.num}
                    </span>
                    {i < DIY_STEPS.length - 1 && <div className={`ia-step-connector ${i < activeStep ? 'ia-step-connector--done' : ''}`} />}
                  </div>
                  <div className="ia-step-content">
                    <span className="ia-step-title">{step.title}</span>
                    {activeStep === i && (
                      <p className="ia-step-desc">{step.desc}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Nav buttons */}
            <div className="ia-diy-nav">
              <button className="ia-diy-nav-btn" disabled={activeStep === 0}
                onClick={() => setActiveStep(p => p - 1)}>
                ← Previous
              </button>
              <span className="ia-diy-nav-dots">
                {DIY_STEPS.map((_, i) => (
                  <span key={i}
                    className={`ia-diy-dot ${activeStep === i ? 'ia-diy-dot--active' : ''}`}
                    onClick={() => setActiveStep(i)} />
                ))}
              </span>
              <button className="ia-diy-nav-btn ia-diy-nav-btn--next"
                disabled={activeStep === DIY_STEPS.length - 1}
                onClick={() => setActiveStep(p => p + 1)}>
                Next →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default IndoorAirSimulator;
