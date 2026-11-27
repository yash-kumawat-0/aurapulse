// ============================================
// IndoorAirSimulator — Minimal 3 Inputs (+ Other)
// Visual Animated Results + Safe Range Scale +
// 3D DIY Purifier Guide with Integrated Store Links
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

function PmRangeRow({ label, value, maxRange }) {
  const safeVal = 35;
  const pct = Math.min(Math.max((value / maxRange) * 100, 3), 100);
  const safePct = Math.min(Math.max((safeVal / maxRange) * 100, 8), 90);
  const color = getPmColor(value);

  return (
    <div className="ia-range-item">
      <div className="ia-range-top">
        <span className="ia-range-name">{label}</span>
        <span className="ia-range-pill" style={{ color, background: `${color}16` }}>
          <strong>{Math.round(value)}</strong> µg/m³ · {getPmLabel(value)}
        </span>
      </div>
      <div className="ia-range-track">
        <div className="ia-range-fill" style={{ width: `${pct}%`, background: color }} />
        <div className="ia-range-thumb" style={{ left: `${pct}%`, borderColor: color }} />
        <div className="ia-range-safe-line" style={{ left: `${safePct}%` }} title="Safe Limit: 35 µg/m³" />
      </div>
      <div className="ia-range-scale-foot">
        <span>0</span>
        <span className="ia-safe-foot-lbl">Safe ≤ 35 µg/m³</span>
        <span>{Math.round(maxRange)}</span>
      </div>
    </div>
  );
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
  const effectiveCadrNeed = sim ? Math.max(sim.cadr_needed_for_safe, autoTargetCadr) : autoTargetCadr;
  const maxRange = Math.max(outdoorPM, sim?.indoor_pm25 || 0, 120);

  const diyAfterPm = diySimulation?.indoor_pm25 ?? Math.max(12, Math.round((sim?.indoor_pm25 || 120) * 0.25));
  const diyTotalCadr = (diyRec?.estimated_cadr || 350) * (diyRec?.units_needed || 1);
  const cadrMax = Math.max(effectiveCadrNeed, diyTotalCadr, 450);
  const cadrNeedPct = Math.min(Math.max(((sim?.cadr_needed_for_safe || 0) / cadrMax) * 100, 6), 92);
  const dropPct = sim?.indoor_pm25 > 0
    ? Math.max(0, Math.round(((sim.indoor_pm25 - diyAfterPm) / sim.indoor_pm25) * 100))
    : 0;

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
              ? '⏳ Calculating + Checking Local Prices...'
              : hasSimulated
                ? needsRefresh
                  ? '🔄 Update Simulation'
                  : '🔬 Re-simulate Room'
                : '🔬 Simulate Indoor Air'}
          </button>
          {needsRefresh && (
            <span className="ia-stale-hint">Changed — tap Update</span>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          PART 2: VISUAL ANIMATED RESULTS
          ══════════════════════════════════════════ */}
      {hasSimulated && sim && (
        <div ref={resultsRef} id="ia-results" className="ia-results-container">
          {/* Animated Visual Room Transformation + Stickers */}
          <div className={`ia-visual-hero ${isUrgent ? 'ia-visual-hero--warn' : 'ia-visual-hero--safe'}`}>
            <div className="ia-flow-strip">
              <div className="ia-flow-node">
                <span className="ia-flow-emoji">🏠</span>
                <div>
                  <span className="ia-flow-lbl">Now</span>
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
                {aiGuidance?.ai_powered && (
                  <span className="ia-sticker-pill ia-sticker-pill--ai">✨ Gemini AI</span>
                )}
              </div>
            )}
          </div>

          {/* Key Numbers Container — Visual Safe Scale Bars */}
          <div className="ia-ranges-panel" aria-label="Air Quality Ranges and Safe Limit Marker">
            <div className="ia-ranges-head">
              <span>📊 Live Room Ranges</span>
              <span className="ia-ranges-vol">{volumeM3} m³</span>
            </div>

            <div className="ia-ranges-grid">
              <PmRangeRow label="🌍 Outdoor Air" value={outdoorPM} maxRange={maxRange} />
              <PmRangeRow label="🏠 Room Now" value={sim.indoor_pm25} maxRange={maxRange} />
              <PmRangeRow label="✨ With DIY Purifier" value={diyAfterPm} maxRange={maxRange} />

              <div className="ia-range-item">
                <div className="ia-range-top">
                  <span className="ia-range-name">🌀 Purifier Output</span>
                  <span className="ia-range-pill" style={{ color: '#1D4ED8', background: '#EFF6FF' }}>
                    DIY <strong>{diyTotalCadr}</strong> m³/h
                  </span>
                </div>
                <div className="ia-range-track">
                  <div
                    className="ia-range-fill"
                    style={{
                      width: `${Math.min(Math.max((diyTotalCadr / cadrMax) * 100, 6), 100)}%`,
                      background: '#2563EB',
                    }}
                  />
                  <div
                    className="ia-range-safe-line"
                    style={{ left: `${cadrNeedPct}%` }}
                    title={`Needed CADR: ${sim.cadr_needed_for_safe} m³/h`}
                  />
                </div>
                <div className="ia-range-scale-foot">
                  <span>0</span>
                  <span className="ia-safe-foot-lbl ia-safe-foot-lbl--blue">
                    Need {sim.cadr_needed_for_safe} m³/h
                  </span>
                  <span>{cadrMax}</span>
                </div>
              </div>
            </div>
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
