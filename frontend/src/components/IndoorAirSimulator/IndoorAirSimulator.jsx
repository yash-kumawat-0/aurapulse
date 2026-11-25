// ============================================
// IndoorAirSimulator — Minimal 3 Inputs → Simulate
// On Simulate:
//   1) ONE Big Clear Summary Line (auto-volume + action)
//   2) Key Numbers Range Container with Safe 35 Marker
//   3) Big Window 3D DIY Purifier Animation (auto volume)
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

// ── 3. Indoor Pollution Sources ──
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

// Reusable visual PM2.5 Range Bar with WHO Safe 35 µg/m³ Marker
function PmRangeRow({ label, value, maxRange }) {
  const safeVal = 35;
  const pct = Math.min(Math.max((value / maxRange) * 100, 3), 100);
  const safePct = Math.min((safeVal / maxRange) * 100, 92);
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
        <div
          className="ia-range-safe-line"
          style={{ left: `${safePct}%` }}
          title="WHO Safe Limit: 35 µg/m³"
        >
          <span className="ia-range-safe-tag">Safe 35</span>
        </div>
      </div>
    </div>
  );
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
  };

  // Auto-detected live volume & target CADR
  const volumeCuFt = roomArea * ceilingHeight;
  const volumeM3 = Math.round(roomArea * 0.0929 * ceilingHeight * 0.3048 * 10) / 10;
  const autoTargetCadr = Math.round(volumeM3 * 5);

  const sim = indoorData?.simulation;
  const diySimulation = indoorData?.diy_simulation;
  const purifierRec = indoorData?.purifier_recommendation;
  const diyRec = indoorData?.diy_purifier;

  const outdoorPM = sim?.outdoor_pm25 ?? currentAqi?.pm25 ?? 150;
  const excessAboveSafe = sim ? Math.max(0, Math.round((sim.indoor_pm25 - 35) * 10) / 10) : 0;
  const isUrgent = sim ? !sim.is_safe || sim.cadr_needed_for_safe > 0 : true;
  const effectiveCadrNeed = sim ? Math.max(sim.cadr_needed_for_safe, autoTargetCadr) : autoTargetCadr;
  const maxRange = Math.max(outdoorPM, sim?.indoor_pm25 || 0, 120);

  // Build ONE crisp readable big summary line
  const oneBigLine = (() => {
    if (!sim) return '';
    const extraTips = [];
    if (source !== 'none') {
      const srcLabel = SOURCES.find((s) => s.key === source)?.label || 'smoke';
      extraTips.push(`turn off ${srcLabel.toLowerCase()}`);
    }
    if (sealType === 'leaky_wood') {
      extraTips.push('seal window cracks');
    } else if (diurnalData?.diurnal?.cleanest_window?.start_label) {
      extraTips.push(`air out ${diurnalData.diurnal.cleanest_window.start_label}–${diurnalData.diurnal.cleanest_window.end_label}`);
    }

    if (isUrgent) {
      const tipTail = extraTips.length ? ` • Also ${extraTips.join(' & ')}` : '';
      return `${volumeM3} m³ room needs a ${sim.cadr_needed_for_safe} m³/h purifier (−${excessAboveSafe} µg/m³ to reach safe 35)${tipTail}`;
    }
    return `${volumeM3} m³ room is Safe at ${sim.indoor_pm25} µg/m³ (below 35 limit)${extraTips.length ? ` • Tip: ${extraTips.join(' & ')}` : ''}`;
  })();

  const diyAfterPm = diySimulation?.indoor_pm25 ?? Math.max(12, Math.round((sim?.indoor_pm25 || 120) * 0.25));
  const cadrMax = Math.max(effectiveCadrNeed, diyRec?.estimated_cadr || 350, 450);

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
              <p className="ia-setup-sub">Pick 3 room details — volume &amp; purifier size are detected automatically.</p>
            </div>
          </div>
          <div className="ia-volume-pill">
            Auto Volume: <strong>{volumeCuFt.toLocaleString()} ft³ ({volumeM3} m³)</strong> · Target: <strong>{autoTargetCadr} m³/h</strong>
          </div>
        </div>

        <div className="ia-three-inputs">
          {/* 1. Room Type & Size [Overall Room Volume] */}
          <div className="ia-input-box">
            <div className="ia-box-top">
              <span className="ia-step-badge">1</span>
              <span className="ia-box-label">Room Type &amp; Size (Auto Volume)</span>
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
            <span className="ia-stale-hint">Inputs changed — click Simulate to refresh</span>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          PART 2: CLEAN SIMULATE CONTAINER
          1 Big Line + Range Chart + Big 3D DIY Window
          ══════════════════════════════════════════ */}
      {hasSimulated && sim && (
        <div className="ia-results-container">
          {/* ONE BIG LINE Summary */}
          <div className={`ia-one-line ${isUrgent ? 'ia-one-line--warn' : 'ia-one-line--safe'}`}>
            <span className="ia-one-line-icon">{isUrgent ? '⚠️' : '✅'}</span>
            <span className="ia-one-line-text">{oneBigLine}</span>
          </div>

          {/* Key Numbers Container — Ranges with Safe Marker (35 µg/m³) */}
          <div className="ia-ranges-panel" aria-label="Air Quality Ranges and Safe Limit Marker">
            <div className="ia-ranges-head">
              <span>📊 Key Numbers &amp; Safe Range (Safe ≤ 35 µg/m³)</span>
              <span className="ia-ranges-vol">Detected Volume: <strong>{volumeM3} m³</strong></span>
            </div>

            <div className="ia-ranges-grid">
              <PmRangeRow label="🌍 Outdoor Air" value={outdoorPM} maxRange={maxRange} />
              <PmRangeRow label="🏠 Current Indoor Air" value={sim.indoor_pm25} maxRange={maxRange} />
              <PmRangeRow label="✨ With DIY Purifier" value={diyAfterPm} maxRange={maxRange} />

              <div className="ia-range-item">
                <div className="ia-range-top">
                  <span className="ia-range-name">🌀 Purifier CADR (Room: {volumeM3} m³)</span>
                  <span className="ia-range-pill" style={{ color: '#1D4ED8', background: '#EFF6FF' }}>
                    Need <strong>{sim.cadr_needed_for_safe}</strong> / DIY <strong>{(diyRec?.estimated_cadr || 350) * (diyRec?.units_needed || 1)} m³/h</strong>
                  </span>
                </div>
                <div className="ia-range-track">
                  <div
                    className="ia-range-fill"
                    style={{
                      width: `${Math.min(((diyRec?.estimated_cadr || 350) * (diyRec?.units_needed || 1) / cadrMax) * 100, 100)}%`,
                      background: '#2563EB',
                    }}
                  />
                  <div
                    className="ia-range-safe-line"
                    style={{ left: `${Math.min((sim.cadr_needed_for_safe / cadrMax) * 100, 94)}%` }}
                    title={`Needed CADR: ${sim.cadr_needed_for_safe} m³/h`}
                  >
                    <span className="ia-range-safe-tag ia-range-safe-tag--blue">Need {sim.cadr_needed_for_safe}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Big Interactive 3D DIY Purifier Window (auto-detects room volume) */}
          <DiyPurifierGuide
            sim={sim}
            diySimulation={diySimulation}
            diyRec={diyRec}
            purifierRec={purifierRec}
            isUrgent={isUrgent}
            roomVolumeM3={volumeM3}
            roomVolumeCuFt={volumeCuFt}
          />
        </div>
      )}
    </div>
  );
}

export default IndoorAirSimulator;
