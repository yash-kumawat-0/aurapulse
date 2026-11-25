// ============================================
// IndoorAirSimulator — 3 Clean Inputs → Simulate
// On Simulate:
//   1) Compact "Every Single Metric" Corner Card
//   2) Personalized "What To Do To Prevent" Plan
//   3) Interactive 3D Animated DIY Purifier Builder
// Note: Live Outdoor vs Indoor Graph sits beside
// the main search bar (auto-updated without clicking).
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
  { key: 'leaky_wood', label: 'Old Wood', desc: 'High leaks · 2.5 ACH', icon: '🪟', color: '#DC2626', penetration: 90 },
  { key: 'standard_aluminum', label: 'Aluminum', desc: 'Standard · 1.5 ACH', icon: '🔲', color: '#D97706', penetration: 85 },
  { key: 'sealed_upvc', label: 'UPVC Sealed', desc: 'Airtight · 0.5 ACH', icon: '✨', color: '#059669', penetration: 70 },
];

// ── 3. Indoor Pollution Sources (keys match backend massBalanceModel.js) ──
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

  // Auto-fetch AQI if missing
  useEffect(() => {
    if (location && !currentAqi && !loading) {
      loadAqiData(location.lat, location.lng);
    }
  }, [location, currentAqi, loading, loadAqiData]);

  // Select room preset & update overall area + ceiling volume
  const handleSelectRoom = (preset) => {
    setRoomKey(preset.key);
    setRoomArea(preset.area);
    setCeilingHeight(preset.height);
    if (hasSimulated) setNeedsRefresh(true);
  };

  const handleSealChange = (key) => {
    setSealType(key);
    if (hasSimulated) setNeedsRefresh(true);
  };

  const handleSourceChange = (key) => {
    setSource(key);
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
  const sealInfo = SEALS.find((s) => s.key === sealType) || SEALS[1];
  const excessAboveSafe = sim ? Math.max(0, Math.round((sim.indoor_pm25 - 35) * 10) / 10) : 0;
  const isUrgent = sim ? !sim.is_safe || sim.cadr_needed_for_safe > 0 : true;

  // Build plain-English prevention actions tailored to room + weather
  const preventionActions = [];
  if (sim) {
    if (isUrgent) {
      preventionActions.push({
        id: 'purify',
        icon: '🌀',
        priority: 'High Priority',
        title: `Clean ${excessAboveSafe} µg/m³ out of your air`,
        detail: `Your ${volumeM3} m³ room reaches ${sim.indoor_pm25} µg/m³ (safe limit is 35). Use a purifier rated for at least ${sim.cadr_needed_for_safe} m³/h CADR — or build the DIY Purifier below (${diyRec?.estimated_cadr || 350} m³/h for ~₹${diyRec?.total_estimated_cost_inr || 1500}).`,
      });
    } else {
      preventionActions.push({
        id: 'keep-clean',
        icon: '✅',
        priority: 'Maintain',
        title: 'Keep current air clean below 35 µg/m³',
        detail: `Right now your indoor PM2.5 (${sim.indoor_pm25} µg/m³) is safe! Keep your room volume ventilated only during clean hours.`,
      });
    }

    if (source !== 'none') {
      const savedByStopping = sourceFreeSim
        ? Math.max(0, Math.round((sim.indoor_pm25 - sourceFreeSim.indoor_pm25) * 10) / 10)
        : 0;
      const sourceSwaps = {
        mosquito_coil: 'Replace burning mosquito coil with an electric liquid vaporizer or mosquito net.',
        incense: 'Burn agarbatti/incense near an open exhaust fan or outdoors instead of a closed room.',
        cooking_frying: 'Run your kitchen chimney/exhaust fan on High while frying and for 15 mins after.',
        smoking_cigarette: 'Keep smoking strictly outdoors — indoor smoke adds 1,500 µg/h and lingers for hours.',
      };
      preventionActions.push({
        id: 'source',
        icon: '🚫',
        priority: 'Immediate Drop',
        title: `Turn off indoor smoke source (−${savedByStopping} µg/m³ instantly)`,
        detail: `${sourceSwaps[source] || 'Remove indoor smoke source.'} Doing this alone lowers room PM2.5 from ${sim.indoor_pm25} to ${sourceFreeSim?.indoor_pm25 ?? 'lower'} µg/m³.`,
      });
    }

    if (sealType === 'leaky_wood') {
      preventionActions.push({
        id: 'seal',
        icon: '🩹',
        priority: 'Quick Fix (~₹150)',
        title: 'Seal window & door gaps to block outdoor smog',
        detail: 'Old wooden frames leak 2.5 room volumes every hour. Stick ₹150 foam weather-stripping tape around frames and place a rolled towel under door gaps.',
      });
    } else if (sealType === 'standard_aluminum') {
      preventionActions.push({
        id: 'seal',
        icon: '🪟',
        priority: 'Seal Tip',
        title: 'Latch sliding tracks tightly during smog spikes',
        detail: 'Keep heavy curtains drawn across aluminum windows when outdoor PM2.5 rises above 100 µg/m³ to reduce drafts.',
      });
    } else {
      preventionActions.push({
        id: 'seal',
        icon: '✨',
        priority: 'Sealed Well',
        title: 'UPVC seal blocks ~90% faster leakage',
        detail: 'Your tight UPVC seal keeps air exchange down to 0.5/hr. Just remember to refresh the room briefly when outdoor air is cleanest.',
      });
    }

    const bestWindow = diurnalData?.diurnal?.cleanest_window;
    preventionActions.push({
      id: 'vent',
      icon: '🕒',
      priority: 'Timing',
      title: bestWindow
        ? `Best window to open doors: ${bestWindow.start_label} – ${bestWindow.end_label}`
        : 'Avoid early-morning outdoor ventilation (6 AM – 9 AM)',
      detail: bestWindow
        ? `Outdoor smog drops to ~${bestWindow.avg_pm25} µg/m³ then. Open windows for 15–20 mins to bring fresh oxygen in.`
        : 'Morning temperature inversions trap heavy smog close to ground level; air out rooms mid-afternoon instead.',
    });
  }

  return (
    <div className="ia-shell">
      {/* ══════════════════════════════════════════
          PART 1: STRICTLY 3 CLEAN INPUTS
          ══════════════════════════════════════════ */}
      <div className="ia-setup-card">
        <div className="ia-setup-header">
          <div className="ia-setup-title-wrap">
            <span className="ia-setup-icon">🏠</span>
            <div>
              <h3 className="ia-setup-title">Indoor Air Planner</h3>
              <p className="ia-setup-sub">
                Pick 3 simple details about your room and tap <strong>Simulate</strong> for your custom prevention &amp; 3D DIY purifier guide.
              </p>
            </div>
          </div>
          <div className="ia-volume-pill">
            Room Volume: <strong>{volumeCuFt.toLocaleString()} ft³</strong> ({volumeM3} m³)
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
                {showCustomSize ? 'Done' : 'Adjust size'}
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
                    onClick={() => handleSealChange(s.key)}
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
                    onClick={() => handleSourceChange(s.key)}
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

        {/* Simulate Button Row */}
        <div className="ia-sim-action-row">
          <button
            type="button"
            className="ia-simulate-cta"
            onClick={handleSimulate}
            disabled={simulating || (!currentAqi && !location)}
          >
            {simulating
              ? '⏳ Calculating room plan...'
              : hasSimulated
                ? needsRefresh
                  ? '🔄 Re-simulate Updated Room'
                  : '🔬 Re-simulate Room'
                : '🔬 Simulate Indoor Air & Action Plan'}
          </button>
          {needsRefresh && (
            <span className="ia-stale-hint">Inputs changed — click Simulate to update your plan</span>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          PART 2: SIMULATION RESULTS CONTAINER
          Appears when user clicks Simulate!
          ══════════════════════════════════════════ */}
      {hasSimulated && sim && (
        <div className="ia-results-container">
          {/* ── Top Split: Left Verdict + Target | Right Small Corner (Every Metric) ── */}
          <div className="ia-results-top">
            {/* LEFT: Main Verdict + Required µg/m³ & Prevention Checklist */}
            <div className="ia-action-main">
              <div className={`ia-verdict-banner ${isUrgent ? 'ia-verdict-banner--warn' : 'ia-verdict-banner--safe'}`}>
                <span className="ia-verdict-icon">{isUrgent ? '⚠️' : '✅'}</span>
                <div className="ia-verdict-copy">
                  <h4>
                    {isUrgent
                      ? `Action Needed: Reduce Room PM2.5 by ${excessAboveSafe} µg/m³`
                      : `Your Room Is Safe (${sim.indoor_pm25} µg/m³)`}
                  </h4>
                  <p>
                    {isUrgent
                      ? `Your ${volumeM3} m³ room reaches ${sim.indoor_pm25} µg/m³ (${getPmLabel(sim.indoor_pm25)}). To hit the WHO safe target of 35 µg/m³, you need ${sim.cadr_needed_for_safe} m³/h of clean-air power (CADR).`
                      : `Indoor air (${sim.indoor_pm25} µg/m³) is safely under the WHO 35 µg/m³ guideline. Keep windows sealed during smog peaks.`}
                  </p>
                </div>
              </div>

              {/* Prevention Checklist ("What things we should need to do") */}
              <div className="ia-prevent-section">
                <h4 className="ia-prevent-title">🛡️ What To Do To Prevent &amp; Fix This</h4>
                <div className="ia-prevent-list">
                  {preventionActions.map((act) => {
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
                        <div className="ia-prevent-body">
                          <div className="ia-prevent-head">
                            <strong>{act.title}</strong>
                            <span className="ia-prevent-tag">{act.priority}</span>
                          </div>
                          <p>{act.detail}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* RIGHT SMALL CORNER: Every Single Outdoor & Indoor Metric */}
            <aside className="ia-corner-stats" aria-label="Complete Outdoor and Indoor Telemetry">
              <div className="ia-corner-head">
                <span>📋 All Room Metrics</span>
                <span
                  className="ia-corner-pill"
                  style={{ color: getPmColor(sim.indoor_pm25), background: `${getPmColor(sim.indoor_pm25)}18` }}
                >
                  {getPmLabel(sim.indoor_pm25)}
                </span>
              </div>

              <div className="ia-corner-grid">
                <div className="ia-metric">
                  <span>Outdoor PM2.5</span>
                  <strong style={{ color: getPmColor(outdoorPM) }}>{Math.round(outdoorPM)} µg/m³</strong>
                </div>
                <div className="ia-metric">
                  <span>Indoor PM2.5</span>
                  <strong style={{ color: getPmColor(sim.indoor_pm25) }}>{sim.indoor_pm25} µg/m³</strong>
                </div>
                <div className="ia-metric">
                  <span>Outdoor AQI</span>
                  <strong>{currentAqi?.aqi ?? '—'}</strong>
                </div>
                <div className="ia-metric">
                  <span>I/O Ratio</span>
                  <strong>{sim.io_ratio_percent}% of outside</strong>
                </div>
                <div className="ia-metric">
                  <span>WHO Safe Limit</span>
                  <strong>35 µg/m³</strong>
                </div>
                <div className="ia-metric">
                  <span>Need To Remove</span>
                  <strong style={{ color: excessAboveSafe > 0 ? '#DC2626' : '#059669' }}>
                    {excessAboveSafe > 0 ? `${excessAboveSafe} µg/m³` : '0 µg/m³'}
                  </strong>
                </div>
                <div className="ia-metric">
                  <span>Room Volume</span>
                  <strong>{sim.room_volume_m3} m³ ({volumeCuFt.toLocaleString()} ft³)</strong>
                </div>
                <div className="ia-metric">
                  <span>Air Leak Rate</span>
                  <strong>{sim.ach_rate} ACH ({sealInfo.penetration}% P)</strong>
                </div>
                <div className="ia-metric">
                  <span>Indoor Smoke</span>
                  <strong>{sim.indoor_source_ugph > 0 ? `+${sim.indoor_source_ugph} µg/h` : '0 µg/h'}</strong>
                </div>
                <div className="ia-metric">
                  <span>Steady Time</span>
                  <strong>{sim.time_to_equilibrium_hours} hrs</strong>
                </div>
                <div className="ia-metric ia-metric--wide">
                  <span>Required Purifier CADR (for safe 35 µg/m³)</span>
                  <strong style={{ color: '#2563EB' }}>
                    {sim.cadr_needed_for_safe} m³/h (Ideal 5×: {purifierRec?.recommended_cadr_m3h || Math.round(sim.room_volume_m3 * 5)} m³/h)
                  </strong>
                </div>
              </div>
            </aside>
          </div>

          {/* ── Interactive 3D Animated DIY Purifier Builder ── */}
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
