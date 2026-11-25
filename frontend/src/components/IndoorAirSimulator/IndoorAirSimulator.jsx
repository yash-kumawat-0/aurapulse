// ============================================
// IndoorAirSimulator — Minimal 3 Inputs → Simulate
// On Simulate:
//   1) Concise Verdict + 4-Metric Corner Card
//   2) Short 1-Line Preventive Actions
//   3) Clean 3D Animated DIY Purifier Builder
// ============================================
import { useState, useEffect } from 'react';
import { useUser } from '../../context/UserContext.jsx';
import { useAqi } from '../../context/AqiContext.jsx';
import DiyPurifierGuide from '../DiyPurifierGuide/DiyPurifierGuide.jsx';
import './IndoorAirSimulator.css';

// ── 1. Room Type & Volume Presets ──
const ROOMS = [
  { key: 'small', label: 'Small Room', area: 100, height: 9, icon: '🛏️' },
  { key: 'bedroom', label: 'Bedroom', area: 150, height: 10, icon: '🛌' },
  { key: 'living', label: 'Living Room', area: 200, height: 10, icon: '🛋️' },
  { key: 'hall', label: 'Hall', area: 300, height: 12, icon: '🏠' },
];

// ── 2. Window Seal Presets ──
const SEALS = [
  { key: 'leaky_wood', label: 'Old Wood', desc: 'High leaks', icon: '🪟', color: '#DC2626' },
  { key: 'standard_aluminum', label: 'Aluminum', desc: 'Standard fit', icon: '🔲', color: '#D97706' },
  { key: 'sealed_upvc', label: 'UPVC Sealed', desc: 'Airtight', icon: '✨', color: '#059669' },
];

// ── 3. Indoor Pollution Sources (matches backend massBalanceModel.js) ──
const SOURCES = [
  { key: 'none', label: 'None', icon: '✅', rate: '0 µg/h' },
  { key: 'incense', label: 'Incense', icon: '🪔', rate: '+800 µg/h' },
  { key: 'cooking_frying', label: 'Cooking', icon: '🍳', rate: '+1,200 µg/h' },
  { key: 'smoking_cigarette', label: 'Smoking', icon: '🚬', rate: '+1,500 µg/h' },
  { key: 'mosquito_coil', label: 'Mosquito Coil', icon: '🦟', rate: '+2,000 µg/h' },
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

function IndoorAirSimulator() {
  const { homeProfile, setHomeProfile, location } = useUser();
  const { currentAqi, diurnalData, indoorData, loadIndoorSimulation, loadAqiData, loading } = useAqi();

  const [roomKey, setRoomKey] = useState('bedroom');
  const [roomArea, setRoomArea] = useState(homeProfile.room_area_sqft || 150);
  const [ceilingHeight, setCeilingHeight] = useState(homeProfile.ceiling_height_ft || 10);
  const [showCustomSize, setShowCustomSize] = useState(false);

  const [sealType, setSealType] = useState(homeProfile.window_seal_type || 'standard_aluminum');
  const [source, setSource] = useState(homeProfile.indoor_source || 'none');

  const [hasSimulated, setHasSimulated] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [checkedActions, setCheckedActions] = useState(new Set());

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
      purifier_cadr: 0,
      indoor_source: source,
    };
    setHomeProfile({ ...homeProfile, ...params });
    await loadIndoorSimulation(params);
    setSimulating(false);
    setHasSimulated(true);
    setNeedsRefresh(false);
    setCheckedActions(new Set());
  };

  const toggleAction = (id) => {
    setCheckedActions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const volumeCuFt = roomArea * ceilingHeight;
  const volumeM3 = Math.round(roomArea * 0.0929 * ceilingHeight * 0.3048 * 10) / 10;

  const sim = indoorData?.simulation;
  const diySimulation = indoorData?.diy_simulation;
  const sourceFreeSim = indoorData?.source_free_simulation;
  const purifierRec = indoorData?.purifier_recommendation;
  const diyRec = indoorData?.diy_purifier;

  const outdoorPM = sim?.outdoor_pm25 ?? currentAqi?.pm25 ?? 150;
  const excessAboveSafe = sim ? Math.max(0, Math.round((sim.indoor_pm25 - 35) * 10) / 10) : 0;
  const isUrgent = sim ? !sim.is_safe || sim.cadr_needed_for_safe > 0 : true;

  // Concise 1-line preventive steps (only essential tips)
  const actions = [];
  if (sim) {
    if (isUrgent) {
      actions.push({
        id: 'purify',
        icon: '🌀',
        text: `Clean −${excessAboveSafe} µg/m³ using a ${sim.cadr_needed_for_safe} m³/h purifier (or DIY build below)`,
      });
    } else {
      actions.push({
        id: 'safe',
        icon: '✅',
        text: `Indoor air is safe (${sim.indoor_pm25} µg/m³). Keep windows closed during peak smog.`,
      });
    }

    if (source !== 'none') {
      const saved = sourceFreeSim
        ? Math.max(0, Math.round((sim.indoor_pm25 - sourceFreeSim.indoor_pm25) * 10) / 10)
        : 0;
      const srcName = SOURCES.find((s) => s.key === source)?.label || 'smoke';
      actions.push({
        id: 'source',
        icon: '🚫',
        text: `Stop indoor ${srcName.toLowerCase()} for an instant −${saved} µg/m³ drop`,
      });
    }

    if (sealType === 'leaky_wood') {
      actions.push({
        id: 'seal',
        icon: '🩹',
        text: 'Seal wooden window cracks with ₹150 foam tape to cut smog drafts',
      });
    } else {
      const bestWindow = diurnalData?.diurnal?.cleanest_window;
      actions.push({
        id: 'vent',
        icon: '🕒',
        text: bestWindow
          ? `Open windows only during cleanest hours: ${bestWindow.start_label} – ${bestWindow.end_label}`
          : 'Avoid opening windows between 6 AM – 9 AM',
      });
    }
  }

  return (
    <div className="ia-shell">
      {/* ══════════════════════════════════════════
          PART 1: 3 CLEAN INPUTS
          ══════════════════════════════════════════ */}
      <div className="ia-setup-card">
        <div className="ia-setup-header">
          <div className="ia-setup-title-wrap">
            <span className="ia-setup-icon">🏠</span>
            <div>
              <h3 className="ia-setup-title">Indoor Air Planner</h3>
              <p className="ia-setup-sub">Choose your room setup and tap Simulate for a clear plan.</p>
            </div>
          </div>
          <div className="ia-volume-pill">
            Volume: <strong>{volumeCuFt.toLocaleString()} ft³</strong> ({volumeM3} m³)
          </div>
        </div>

        <div className="ia-three-inputs">
          {/* 1. Room Type & Size [Overall Room Volume] */}
          <div className="ia-input-box">
            <div className="ia-box-top">
              <span className="ia-step-badge">1</span>
              <span className="ia-box-label">Room Type &amp; Size (Volume)</span>
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

          {/* 2. Window Seal Quality */}
          <div className="ia-input-box">
            <div className="ia-box-top">
              <span className="ia-step-badge">2</span>
              <span className="ia-box-label">Window Seal Quality</span>
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
          </div>

          {/* 3. Pollution Source */}
          <div className="ia-input-box">
            <div className="ia-box-top">
              <span className="ia-step-badge">3</span>
              <span className="ia-box-label">Indoor Pollution Source</span>
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
              ? '⏳ Simulating...'
              : hasSimulated
                ? needsRefresh
                  ? '🔄 Update Simulation'
                  : '🔬 Re-simulate Room'
                : '🔬 Simulate Indoor Air'}
          </button>
          {needsRefresh && (
            <span className="ia-stale-hint">Click Simulate to refresh results</span>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          PART 2: MINIMAL RESULTS CONTAINER
          ══════════════════════════════════════════ */}
      {hasSimulated && sim && (
        <div className="ia-results-container">
          <div className="ia-results-top">
            {/* LEFT: Clean Verdict + Short What-To-Do List */}
            <div className="ia-action-main">
              <div className={`ia-verdict-banner ${isUrgent ? 'ia-verdict-banner--warn' : 'ia-verdict-banner--safe'}`}>
                <span className="ia-verdict-icon">{isUrgent ? '⚠️' : '✅'}</span>
                <div className="ia-verdict-copy">
                  <h4>
                    {isUrgent
                      ? `Need −${excessAboveSafe} µg/m³ reduction (${sim.cadr_needed_for_safe} m³/h CADR)`
                      : `Room Air Is Safe (${sim.indoor_pm25} µg/m³)`}
                  </h4>
                  <p>
                    {isUrgent
                      ? `Indoor air reaches ${sim.indoor_pm25} µg/m³ (${getPmLabel(sim.indoor_pm25)}). Safe WHO limit is 35 µg/m³.`
                      : 'Safely under the 35 µg/m³ limit. Keep following the checklist below.'}
                  </p>
                </div>
              </div>

              <div className="ia-prevent-section">
                <h4 className="ia-prevent-title">🛡️ What To Do</h4>
                <div className="ia-prevent-list">
                  {actions.map((act) => {
                    const done = checkedActions.has(act.id);
                    return (
                      <button
                        key={act.id}
                        type="button"
                        className={`ia-prevent-item ${done ? 'ia-prevent-item--done' : ''}`}
                        onClick={() => toggleAction(act.id)}
                      >
                        <span className="ia-prevent-check">{done ? '☑' : '☐'}</span>
                        <span className="ia-prevent-icon">{act.icon}</span>
                        <span className="ia-prevent-text">{act.text}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* SMALL CORNER: Strictly 4 Important Outdoor & Indoor Numbers */}
            <aside className="ia-corner-stats" aria-label="Key Outdoor and Indoor Metrics">
              <div className="ia-corner-head">
                <span>📋 Key Numbers</span>
                <span
                  className="ia-corner-pill"
                  style={{ color: getPmColor(sim.indoor_pm25), background: `${getPmColor(sim.indoor_pm25)}18` }}
                >
                  {getPmLabel(sim.indoor_pm25)}
                </span>
              </div>

              <div className="ia-corner-grid">
                <div className="ia-metric">
                  <span>Outdoor</span>
                  <strong style={{ color: getPmColor(outdoorPM) }}>{Math.round(outdoorPM)} µg/m³</strong>
                </div>
                <div className="ia-metric">
                  <span>Indoor</span>
                  <strong style={{ color: getPmColor(sim.indoor_pm25) }}>{sim.indoor_pm25} µg/m³</strong>
                </div>
                <div className="ia-metric">
                  <span>Need To Drop</span>
                  <strong style={{ color: excessAboveSafe > 0 ? '#DC2626' : '#059669' }}>
                    {excessAboveSafe > 0 ? `−${excessAboveSafe} µg/m³` : 'Safe ✓'}
                  </strong>
                </div>
                <div className="ia-metric">
                  <span>Purifier Needed</span>
                  <strong style={{ color: '#2563EB' }}>
                    {sim.cadr_needed_for_safe} m³/h
                  </strong>
                </div>
              </div>
            </aside>
          </div>

          {/* ── Minimal Interactive 3D DIY Purifier Builder ── */}
          <DiyPurifierGuide
            sim={sim}
            diySimulation={diySimulation}
            diyRec={diyRec}
            purifierRec={purifierRec}
            isUrgent={isUrgent}
          />
        </div>
      )}
    </div>
  );
}

export default IndoorAirSimulator;
