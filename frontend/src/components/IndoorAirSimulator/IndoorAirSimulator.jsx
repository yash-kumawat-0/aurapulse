// ============================================
// IndoorAirSimulator — Minimal 3 Inputs (+ Other)
// Delegates 3D Room Chamber to Room3dTwin & 3D DIY Guide
// ============================================
import { useState, useEffect, useRef } from 'react';
import { useUser } from '../../context/UserContext.jsx';
import { useAqi } from '../../context/AqiContext.jsx';
import Room3dTwin from './Room3dTwin.jsx';
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
  { key: 'standard_aluminum', label: 'Aluminum', desc: 'Standard fit', icon: '🔲', color: '#B45309' },
  { key: 'sealed_upvc', label: 'UPVC Sealed', desc: 'Airtight', icon: '✨', color: '#15803D' },
  { key: 'other', label: 'Other', desc: 'Custom fit', icon: '✏️', color: '#0369A1' },
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
  if (pm <= 35) return '#15803D';
  if (pm <= 55) return '#B45309';
  if (pm <= 150) return '#C2410C';
  return '#B91C1C';
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

  const volumeM3 = Math.round(roomArea * 0.0929 * ceilingHeight * 0.3048 * 10) / 10;
  const autoTargetCadr = Math.round(volumeM3 * 5);

  const sim = indoorData?.simulation;
  const diySimulation = indoorData?.diy_simulation;
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

  return (
    <div className="ia-shell">
      <div className="ia-setup-card">
        <div className="ia-setup-header">
          <div className="ia-setup-title-wrap">
            <span className="ia-setup-icon" aria-hidden="true">🏠</span>
            <h2 className="ia-setup-title">Indoor Air Planner</h2>
          </div>
          <div className="ia-volume-pill">
            Room: <strong>{volumeM3} m³</strong> · Target: <strong>{autoTargetCadr} m³/h</strong>
          </div>
        </div>

        <div className="ia-three-inputs">
          <div className="ia-input-box">
            <div className="ia-box-top">
              <span className="ia-step-badge" aria-hidden="true">1</span>
              <span className="ia-box-label">Room Size</span>
              <button
                type="button"
                className="ia-size-toggle"
                aria-expanded={showCustomSize}
                onClick={() => setShowCustomSize((s) => !s)}
              >
                {showCustomSize ? 'Done' : 'Custom size'}
              </button>
            </div>

            <div className="ia-room-grid" role="group" aria-label="Room Size Presets">
              {ROOMS.map((r) => {
                const active = roomKey === r.key && roomArea === r.area && ceilingHeight === r.height;
                const vol = r.area * r.height;
                return (
                  <button
                    key={r.key}
                    type="button"
                    aria-pressed={active}
                    className={`ia-choice-card ${active ? 'ia-choice-card--active' : ''}`}
                    onClick={() => handleSelectRoom(r)}
                  >
                    <span className="ia-choice-emoji" aria-hidden="true">{r.icon}</span>
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

          <div className="ia-input-box">
            <div className="ia-box-top">
              <span className="ia-step-badge" aria-hidden="true">2</span>
              <span className="ia-box-label">Window Type</span>
            </div>
            <div className="ia-seal-grid" role="group" aria-label="Window Type Presets">
              {SEALS.map((s) => {
                const active = sealType === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    aria-pressed={active}
                    className={`ia-choice-card ${active ? 'ia-choice-card--active' : ''}`}
                    onClick={() => { setSealType(s.key); if (hasSimulated) setNeedsRefresh(true); }}
                    style={active ? { borderColor: s.color, background: `${s.color}12` } : undefined}
                  >
                    <span className="ia-choice-emoji" aria-hidden="true">{s.icon}</span>
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
                aria-label="Describe custom window setup"
                placeholder="Describe window setup (e.g. Balcony gap, Exhaust open, Cracked frame)..."
                value={customWindowDesc}
                onChange={(e) => { setCustomWindowDesc(e.target.value); if (hasSimulated) setNeedsRefresh(true); }}
              />
            )}
          </div>

          <div className="ia-input-box">
            <div className="ia-box-top">
              <span className="ia-step-badge" aria-hidden="true">3</span>
              <span className="ia-box-label">Indoor Smoke / Dust</span>
            </div>
            <div className="ia-source-grid" role="group" aria-label="Indoor Smoke or Dust Sources">
              {SOURCES.map((s) => {
                const active = source === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    aria-pressed={active}
                    className={`ia-choice-card ia-choice-card--compact ${active ? 'ia-choice-card--active' : ''}`}
                    onClick={() => { setSource(s.key); if (hasSimulated) setNeedsRefresh(true); }}
                  >
                    <span className="ia-choice-emoji" aria-hidden="true">{s.icon}</span>
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
                aria-label="Describe custom indoor smoke or dust source"
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
          {needsRefresh && <span className="ia-stale-hint">Changed — tap Update</span>}
        </div>
      </div>

      {hasSimulated && sim && (
        <div ref={resultsRef} id="ia-results" className="ia-results-container" aria-live="polite">
          <div className={`ia-visual-hero ${isUrgent ? 'ia-visual-hero--warn' : 'ia-visual-hero--safe'}`}>
            <div className="ia-flow-strip">
              <div className="ia-flow-node">
                <span className="ia-flow-emoji" aria-hidden="true">🏠</span>
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
                <span className="ia-flow-emoji ia-sparkle-float" aria-hidden="true">✨</span>
                <div>
                  <span className="ia-flow-lbl">With DIY</span>
                  <strong className="ia-flow-val" style={{ color: '#15803D' }}>
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

          <Room3dTwin
            fanPreviewOn={fanPreviewOn}
            setFanPreviewOn={setFanPreviewOn}
            displayedPm={displayedPm}
            diyTotalCadr={diyTotalCadr}
            outdoorPM={outdoorPM}
            sealType={sealType}
            source={source}
            customSourceDesc={customSourceDesc}
            econ={aiGuidance?.economics}
            hacks={Array.isArray(aiGuidance?.zero_cost_hacks) ? aiGuidance.zero_cost_hacks : []}
          />

          <DiyPurifierGuide
            sim={sim}
            diySimulation={diySimulation}
            diyRec={diyRec}
            isUrgent={isUrgent}
            roomVolumeM3={volumeM3}
            aiGuidance={aiGuidance}
          />
        </div>
      )}
    </div>
  );
}

export default IndoorAirSimulator;
