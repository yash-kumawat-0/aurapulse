// ============================================
// IndoorAirSimulator — Minimal 3 Inputs (+ Other)
// Interactive 3D Air-Flow Room Chamber + Live Toggle,
// Economics/Filter Countdown, ₹0 Instant Hacks & 3D DIY Store Guide
// ============================================
import { useState, useEffect, useRef } from 'react';
import { useUser } from '../../context/UserContext.jsx';
import { useAqi } from '../../context/AqiContext.jsx';
import DiyPurifierGuide from '../DiyPurifierGuide/DiyPurifierGuide.jsx';
import './IndoorAirSimulator.css';

const ROOMS = [
  { key: 'small', label: 'Small Room', area: 100, height: 9, icon: '🛏️' },
  { key: 'bedroom', label: 'Bedroom', area: 150, height: 10, icon: '🛌' },
  { key: 'living', label: 'Living Room', area: 200, height: 10, icon: '🛋️' },
  { key: 'hall', label: 'Hall', area: 300, height: 12, icon: '🏠' },
];

const SEALS = [
  { key: 'leaky_wood', label: 'Old Wood', desc: 'High leaks', icon: '🪟', color: '#DC2626' },
  { key: 'standard_aluminum', label: 'Aluminum', desc: 'Standard fit', icon: '🔲', color: '#D97706' },
  { key: 'sealed_upvc', label: 'UPVC Sealed', desc: 'Airtight', icon: '✨', color: '#059669' },
  { key: 'other', label: 'Other', desc: 'Custom fit', icon: '✏️', color: '#0284C7' },
];

const SOURCES = [
  { key: 'none', label: 'None', icon: '✅', rate: '0 µg/h' },
  { key: 'incense', label: 'Incense', icon: '🪔', rate: '+800 µg/h' },
  { key: 'cooking_frying', label: 'Cooking', icon: '🍳', rate: '+1,200 µg/h' },
  { key: 'smoking_cigarette', label: 'Smoking', icon: '🚬', rate: '+1,500 µg/h' },
  { key: 'mosquito_coil', label: 'Coil', icon: '🦟', rate: '+2,000 µg/h' },
  { key: 'other', label: 'Other', icon: '✏️', rate: 'Custom' },
];

const PARTICLES = [
  { x: 14, y: 22, d: '0s', s: 7 },
  { x: 26, y: 58, d: '0.4s', s: 9 },
  { x: 38, y: 34, d: '0.8s', s: 6 },
  { x: 48, y: 74, d: '1.1s', s: 8 },
  { x: 56, y: 18, d: '0.2s', s: 7 },
  { x: 64, y: 48, d: '1.4s', s: 9 },
  { x: 74, y: 28, d: '0.6s', s: 6 },
  { x: 82, y: 66, d: '0.9s', s: 8 },
  { x: 20, y: 80, d: '1.3s', s: 7 },
  { x: 42, y: 14, d: '0.5s', s: 6 },
  { x: 68, y: 78, d: '0.7s', s: 7 },
  { x: 86, y: 40, d: '1.2s', s: 6 },
];

function getPmColor(pm) {
  if (pm <= 12) return '#10B981';
  if (pm <= 35) return '#22C55E';
  if (pm <= 55) return '#F59E0B';
  if (pm <= 150) return '#EA580C';
  return '#DC2626';
}

function getPmLabel(pm) {
  if (pm <= 12) return 'Excellent';
  if (pm <= 35) return 'Safe';
  if (pm <= 55) return 'Moderate';
  if (pm <= 150) return 'Unhealthy';
  return 'Hazardous';
}

function getSourceIcon(src) {
  return SOURCES.find((s) => s.key === src)?.icon || '💨';
}

function IndoorAirSimulator() {
  const { homeProfile, setHomeProfile, location, language } = useUser();
  const { currentAqi, indoorData, loadIndoorSimulation, loadAqiData, loading } = useAqi();

  const [roomKey, setRoomKey] = useState('bedroom');
  const [roomArea, setRoomArea] = useState(homeProfile.room_area_sqft || 150);
  const [ceilingHeight, setCeilingHeight] = useState(homeProfile.ceiling_height_ft || 10);
  const [showCustomSize, setShowCustomSize] = useState(false);

  const [sealType, setSealType] = useState(homeProfile.window_seal_type || 'standard_aluminum');
  const [customWindowDesc, setCustomWindowDesc] = useState(homeProfile.custom_window_desc || '');

  const [source, setSource] = useState(homeProfile.indoor_source || 'none');
  const [customSourceDesc, setCustomSourceDesc] = useState(homeProfile.custom_source_desc || '');

  const [hasSimulated, setHasSimulated] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [fanPreviewOn, setFanPreviewOn] = useState(true);

  const resultsRef = useRef(null);

  useEffect(() => {
    if (location && !currentAqi && !loading) {
      loadAqiData(location.lat, location.lng);
    }
  }, [location, currentAqi, loading, loadAqiData]);

  const handleSelectRoom = (preset) => {
    setRoomKey(preset.key);
    setRoomArea(preset.area);
    setCeilingHeight(preset.height);
    if (hasSimulated) setNeedsRefresh(true);
  };

  const handleSimulate = async () => {
    setSimulating(true);
    const params = {
      outdoor_pm25: currentAqi?.pm25 ?? 150,
      room_area_sqft: roomArea,
      ceiling_height_ft: ceilingHeight,
      window_seal_type: sealType,
      custom_window_desc: sealType === 'other' ? customWindowDesc.trim() : '',
      purifier_cadr: 0,
      indoor_source: source,
      custom_source_desc: source === 'other' ? customSourceDesc.trim() : '',
      location_label: location?.label || 'Local City',
      lat: location?.lat,
      lng: location?.lng,
      language,
      skip_ai: false,
    };
    setHomeProfile({ ...homeProfile, ...params });
    await loadIndoorSimulation(params);
    setSimulating(false);
    setHasSimulated(true);
    setFanPreviewOn(true);
    setNeedsRefresh(false);
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  const volumeCuFt = roomArea * ceilingHeight;
  const volumeM3 = Math.round(roomArea * 0.0929 * ceilingHeight * 0.3048 * 10) / 10;
  const autoTargetCadr = Math.round(volumeM3 * 5);

  const sim = indoorData?.simulation;
  const diySimulation = indoorData?.diy_simulation;
  const purifierRec = indoorData?.purifier_recommendation;
  const diyRec = indoorData?.diy_purifier;
  const aiGuidance = indoorData?.ai_indoor_guidance;

  const outdoorPM = sim?.outdoor_pm25 ?? currentAqi?.pm25 ?? 150;
  const isUrgent = sim ? !sim.is_safe || sim.cadr_needed_for_safe > 0 : true;
  const diyAfterPm = diySimulation?.indoor_pm25 ?? Math.max(12, Math.round((sim?.indoor_pm25 || 120) * 0.25));
  const diyTotalCadr = (diyRec?.estimated_cadr || 350) * (diyRec?.units_needed || 1);
  const dropPct = sim?.indoor_pm25 > 0
    ? Math.max(0, Math.round(((sim.indoor_pm25 - diyAfterPm) / sim.indoor_pm25) * 100))
    : 0;

  const displayedPm = fanPreviewOn ? diyAfterPm : (sim?.indoor_pm25 ?? outdoorPM);
  const activeColor = getPmColor(displayedPm);
  const isLeaky = sealType === 'leaky_wood' || sealType === 'other';
  const econ = aiGuidance?.economics;
  const hacks = Array.isArray(aiGuidance?.zero_cost_hacks) ? aiGuidance.zero_cost_hacks : [];

  return (
    <div className="ia-shell">
      {/* ══════════════════════════════════════════
          PART 1: 3 CLEAN INPUTS (+ CUSTOM OTHER)
          ══════════════════════════════════════════ */}
      <div className="ia-setup-card">
        <div className="ia-setup-header">
          <div className="ia-setup-title-wrap">
            <span className="ia-setup-icon">🏠</span>
            <div>
              <h3 className="ia-setup-title">Indoor Air Planner</h3>
            </div>
          </div>
          <div className="ia-volume-pill">
            Room: <strong>{volumeM3} m³</strong> · Target: <strong>{autoTargetCadr} m³/h</strong>
          </div>
        </div>

        <div className="ia-three-inputs">
          {/* 1. Room Type & Size */}
          <div className="ia-input-box">
            <div className="ia-box-top">
              <span className="ia-step-badge">1</span>
              <span className="ia-box-label">Room Size</span>
              <button
                type="button"
                className="ia-size-toggle"
                onClick={() => setShowCustomSize((s) => !s)}
              >
                {showCustomSize ? 'Done' : 'Custom size'}
              </button>
            </div>

            <div className="ia-room-grid">
              {ROOMS.map((r) => {
                const active = roomKey === r.key && roomArea === r.area && ceilingHeight === r.height;
                const vol = r.area * r.height;
                return (
                  <button
                    key={r.key}
                    type="button"
                    className={`ia-choice-card ${active ? 'ia-choice-card--active' : ''}`}
                    onClick={() => handleSelectRoom(r)}
                  >
                    <span className="ia-choice-emoji">{r.icon}</span>
                    <span className="ia-choice-name">{r.label}</span>
                    <span className="ia-choice-meta">{r.area} ft² · {vol.toLocaleString()} ft³</span>
                  </button>
                );
              })}
            </div>

            {showCustomSize && (
              <div className="ia-custom-size">
                <label className="ia-mini-slider">
                  <span>Floor Area: <strong>{roomArea} sq ft</strong></span>
                  <input
                    type="range"
                    min="60"
                    max="500"
                    step="10"
                    value={roomArea}
                    onChange={(e) => {
                      setRoomArea(Number(e.target.value));
                      setRoomKey('custom');
                      if (hasSimulated) setNeedsRefresh(true);
                    }}
                  />
                </label>
                <label className="ia-mini-slider">
                  <span>Ceiling Height: <strong>{ceilingHeight} ft</strong></span>
                  <input
                    type="range"
                    min="8"
                    max="16"
                    step="1"
                    value={ceilingHeight}
                    onChange={(e) => {
                      setCeilingHeight(Number(e.target.value));
                      setRoomKey('custom');
                      if (hasSimulated) setNeedsRefresh(true);
                    }}
                  />
                </label>
              </div>
            )}
          </div>

          {/* 2. Window Seal Quality (+ Other) */}
          <div className="ia-input-box">
            <div className="ia-box-top">
              <span className="ia-step-badge">2</span>
              <span className="ia-box-label">Window Type</span>
            </div>
            <div className="ia-seal-grid">
              {SEALS.map((s) => {
                const active = sealType === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    className={`ia-choice-card ${active ? 'ia-choice-card--active' : ''}`}
                    onClick={() => { setSealType(s.key); if (hasSimulated) setNeedsRefresh(true); }}
                    style={active ? { borderColor: s.color, background: `${s.color}12` } : undefined}
                  >
                    <span className="ia-choice-emoji">{s.icon}</span>
                    <span className="ia-choice-name">{s.label}</span>
                    <span className="ia-choice-meta" style={{ color: s.color, fontWeight: 700 }}>{s.desc}</span>
                  </button>
                );
              })}
            </div>

            {sealType === 'other' && (
              <input
                type="text"
                className="ia-other-input"
                placeholder="Describe window setup (e.g. Balcony gap, Exhaust open, Cracked frame)..."
                value={customWindowDesc}
                onChange={(e) => { setCustomWindowDesc(e.target.value); if (hasSimulated) setNeedsRefresh(true); }}
              />
            )}
          </div>

          {/* 3. Pollution Source (+ Other) */}
          <div className="ia-input-box">
            <div className="ia-box-top">
              <span className="ia-step-badge">3</span>
              <span className="ia-box-label">Indoor Smoke / Dust</span>
            </div>
            <div className="ia-source-grid">
              {SOURCES.map((s) => {
                const active = source === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    className={`ia-choice-card ia-choice-card--compact ${active ? 'ia-choice-card--active' : ''}`}
                    onClick={() => { setSource(s.key); if (hasSimulated) setNeedsRefresh(true); }}
                  >
                    <span className="ia-choice-emoji">{s.icon}</span>
                    <span className="ia-choice-name">{s.label}</span>
                    <span className="ia-choice-meta">{s.rate}</span>
                  </button>
                );
              })}
            </div>

            {source === 'other' && (
              <input
                type="text"
                className="ia-other-input"
                placeholder="Describe indoor source (e.g. Candles, Paint fumes, Renovation dust, Heater)..."
                value={customSourceDesc}
                onChange={(e) => { setCustomSourceDesc(e.target.value); if (hasSimulated) setNeedsRefresh(true); }}
              />
            )}
          </div>
        </div>

        <div className="ia-sim-action-row">
          <button
            type="button"
            className="ia-simulate-cta"
            onClick={handleSimulate}
            disabled={simulating || (!currentAqi && !location)}
          >
            {simulating
              ? '⏳ Calibrating 3D Room + AI Prices...'
              : hasSimulated
                ? needsRefresh
                  ? '🔄 Update 3D Simulation'
                  : '🔬 Re-simulate Room'
                : '🔬 Simulate Indoor Air'}
          </button>
          {needsRefresh && (
            <span className="ia-stale-hint">Changed — tap Update</span>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          PART 2: INTERACTIVE 3D ROOM + FILTER ECONOMICS
          ══════════════════════════════════════════ */}
      {hasSimulated && sim && (
        <div ref={resultsRef} id="ia-results" className="ia-results-container">
          {/* Animated Before -> DIY Transformation Strip + Gemini Stickers */}
          <div className={`ia-visual-hero ${isUrgent ? 'ia-visual-hero--warn' : 'ia-visual-hero--safe'}`}>
            <div className="ia-flow-strip">
              <div className="ia-flow-node">
                <span className="ia-flow-emoji">🏠</span>
                <div>
                  <span className="ia-flow-lbl">Room Now</span>
                  <strong className="ia-flow-val" style={{ color: getPmColor(sim.indoor_pm25) }}>
                    {Math.round(sim.indoor_pm25)} µg/m³
                  </strong>
                </div>
              </div>

              <div className="ia-flow-mid">
                <span className="ia-flow-fan" aria-hidden="true">🌀</span>
                <span className="ia-flow-drop">−{dropPct}%</span>
              </div>

              <div className="ia-flow-node ia-flow-node--clean">
                <span className="ia-flow-emoji ia-sparkle-float">✨</span>
                <div>
                  <span className="ia-flow-lbl">With DIY</span>
                  <strong className="ia-flow-val" style={{ color: '#059669' }}>
                    {Math.round(diyAfterPm)} µg/m³
                  </strong>
                </div>
              </div>
            </div>

            {Array.isArray(aiGuidance?.visual_badges) && aiGuidance.visual_badges.length > 0 && (
              <div className="ia-stickers-row">
                {aiGuidance.visual_badges.map((b, idx) => (
                  <span key={idx} className="ia-sticker-pill">{b.icon} {b.label}</span>
                ))}
                {sim.ai_calibrated && (
                  <span className="ia-sticker-pill ia-sticker-pill--ai">
                    ✨ AI Calibrated{sim.ai_seal_note ? ` · ${sim.ai_seal_note}` : ''}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Interactive 3D Clean-Room Twin Chamber */}
          <div className="ia-room3d-card">
            <div className="ia-room3d-top">
              <div className="ia-room3d-title">
                <span>🧊 3D Room Air Twin</span>
                <span className="ia-room3d-pill" style={{ color: activeColor, background: `${activeColor}18` }}>
                  {Math.round(displayedPm)} µg/m³ · {getPmLabel(displayedPm)}
                </span>
              </div>

              <div className="ia-room3d-toggle" role="group" aria-label="Toggle 3D room purifier">
                <button
                  type="button"
                  className={`ia-toggle-btn ${!fanPreviewOn ? 'ia-toggle-btn--off' : ''}`}
                  onClick={() => setFanPreviewOn(false)}
                >
                  🌫️ Fan OFF
                </button>
                <button
                  type="button"
                  className={`ia-toggle-btn ${fanPreviewOn ? 'ia-toggle-btn--on' : ''}`}
                  onClick={() => setFanPreviewOn(true)}
                >
                  ✨ DIY ON ({diyTotalCadr} m³/h)
                </button>
              </div>
            </div>

            <div className={`ia-room3d-stage ${fanPreviewOn ? 'ia-room3d-stage--clean' : 'ia-room3d-stage--smog'}`}>
              <div className="ia-r3d-perspective">
                <div className="ia-r3d-wall-back" />
                <div className="ia-r3d-floor" />

                {/* Left Window Leak Visualization */}
                <div className={`ia-r3d-window ${isLeaky ? 'ia-r3d-window--leaky' : 'ia-r3d-window--tight'}`}>
                  <span>{sealType === 'sealed_upvc' ? '✨ Sealed' : '🪟 Draft'}</span>
                  <span className="ia-r3d-out">Out: {Math.round(outdoorPM)}</span>
                </div>

                {/* Indoor Smoke / Candle / Coil Source */}
                {source !== 'none' && (
                  <div className="ia-r3d-source">
                    <span className="ia-r3d-src-icon">{getSourceIcon(source)}</span>
                    <span className="ia-r3d-src-lbl">{source === 'other' && customSourceDesc ? customSourceDesc.slice(0, 14) : source}</span>
                  </div>
                )}

                {/* Animated Airborne Particles Clearing Live */}
                {PARTICLES.map((pt, idx) => (
                  <span
                    key={idx}
                    className={`ia-dust-speck ${fanPreviewOn ? 'ia-dust-speck--clean' : 'ia-dust-speck--dirty'}`}
                    style={{
                      left: `${pt.x}%`,
                      top: `${pt.y}%`,
                      width: `${fanPreviewOn ? Math.max(4, pt.s - 3) : pt.s + 2}px`,
                      height: `${fanPreviewOn ? Math.max(4, pt.s - 3) : pt.s + 2}px`,
                      animationDelay: pt.d,
                    }}
                  />
                ))}

                {/* Corner 3D Purifier Fan Spinning */}
                <div className={`ia-r3d-purifier ${fanPreviewOn ? 'ia-r3d-purifier--spin' : ''}`}>
                  <div className="ia-r3d-fan-face">
                    <span className="ia-r3d-fan-icon">🌀</span>
                  </div>
                  <span className="ia-r3d-fan-lbl">{fanPreviewOn ? 'ON · Cleaning' : 'OFF'}</span>
                </div>
              </div>
            </div>

            {/* Filter Clock + Exact Money Saved Economics Strip */}
            {econ && (
              <div className="ia-econ-strip">
                <div className="ia-econ-card">
                  <span className="ia-econ-icon">🗓️</span>
                  <div>
                    <span className="ia-econ-lbl">Filter Life</span>
                    <strong>~{econ.filter_life_days} Days</strong>
                  </div>
                </div>
                <div className="ia-econ-card ia-econ-card--save">
                  <span className="ia-econ-icon">💰</span>
                  <div>
                    <span className="ia-econ-lbl">Saved vs Commercial</span>
                    <strong>{econ.yearly_savings_estimate}</strong>
                  </div>
                </div>
                <div className="ia-econ-card">
                  <span className="ia-econ-icon">⚡</span>
                  <div>
                    <span className="ia-econ-lbl">Monthly Power</span>
                    <strong>{econ.monthly_electricity_cost}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Instant Zero-Cost Hacks */}
            {hacks.length > 0 && (
              <div className="ia-zero-hacks">
                <span className="ia-zero-title">₹0 Immediate Fixes:</span>
                {hacks.map((h, idx) => (
                  <span key={idx} className="ia-zero-pill">{h.emoji} {h.label}</span>
                ))}
              </div>
            )}
          </div>

          {/* 3D DIY Purifier Builder WITH Integrated Needed Parts, Local Prices & Store Links */}
          <DiyPurifierGuide
            sim={sim}
            diySimulation={diySimulation}
            diyRec={diyRec}
            purifierRec={purifierRec}
            isUrgent={isUrgent}
            roomVolumeM3={volumeM3}
            roomVolumeCuFt={volumeCuFt}
            aiGuidance={aiGuidance}
          />
        </div>
      )}
    </div>
  );
}

export default IndoorAirSimulator;
