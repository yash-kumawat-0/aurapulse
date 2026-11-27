// ============================================
// Room3dTwin — Interactive 3D Air-Flow Chamber,
// Live Fan Toggle, Filter Countdown, Savings & ₹0 Hacks
// ============================================

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

const SOURCE_ICONS = {
  incense: '🪔',
  cooking_frying: '🍳',
  smoking_cigarette: '🚬',
  mosquito_coil: '🦟',
  other: '✏️',
};

function getPmColor(pm) {
  if (pm <= 12) return '#15803D';
  if (pm <= 35) return '#15803D';
  if (pm <= 55) return '#B45309';
  if (pm <= 150) return '#C2410C';
  return '#B91C1C';
}

function getPmLabel(pm) {
  if (pm <= 12) return 'Excellent';
  if (pm <= 35) return 'Safe';
  if (pm <= 55) return 'Moderate';
  if (pm <= 150) return 'Unhealthy';
  return 'Hazardous';
}

function Room3dTwin({
  fanPreviewOn,
  setFanPreviewOn,
  displayedPm,
  diyTotalCadr,
  outdoorPM,
  sealType,
  source,
  customSourceDesc,
  econ,
  hacks,
}) {
  const activeColor = getPmColor(displayedPm);
  const isLeaky = sealType === 'leaky_wood' || sealType === 'other';

  return (
    <div className="ia-room3d-card">
      <div className="ia-room3d-top">
        <div className="ia-room3d-title">
          <h3>🧊 3D Room Air Twin</h3>
          <span className="ia-room3d-pill" style={{ color: activeColor, background: `${activeColor}18` }}>
            {Math.round(displayedPm)} µg/m³ · {getPmLabel(displayedPm)}
          </span>
        </div>

        <div className="ia-room3d-toggle" role="group" aria-label="Toggle 3D room purifier preview">
          <button
            type="button"
            aria-pressed={!fanPreviewOn}
            className={`ia-toggle-btn ${!fanPreviewOn ? 'ia-toggle-btn--off' : ''}`}
            onClick={() => setFanPreviewOn(false)}
          >
            🌫️ Fan OFF
          </button>
          <button
            type="button"
            aria-pressed={fanPreviewOn}
            className={`ia-toggle-btn ${fanPreviewOn ? 'ia-toggle-btn--on' : ''}`}
            onClick={() => setFanPreviewOn(true)}
          >
            ✨ DIY ON ({diyTotalCadr} m³/h)
          </button>
        </div>
      </div>

      <div
        className={`ia-room3d-stage ${fanPreviewOn ? 'ia-room3d-stage--clean' : 'ia-room3d-stage--smog'}`}
        aria-label={`3D room visualization: ${fanPreviewOn ? 'purifier active' : 'purifier off'}, ${Math.round(displayedPm)} µg/m³`}
      >
        <div className="ia-r3d-perspective">
          <div className="ia-r3d-wall-back" />
          <div className="ia-r3d-floor" />

          <div className={`ia-r3d-window ${isLeaky ? 'ia-r3d-window--leaky' : 'ia-r3d-window--tight'}`}>
            <span>{sealType === 'sealed_upvc' ? '✨ Sealed' : '🪟 Draft'}</span>
            <span className="ia-r3d-out">Out: {Math.round(outdoorPM)}</span>
          </div>

          {source !== 'none' && (
            <div className="ia-r3d-source">
              <span className="ia-r3d-src-icon" aria-hidden="true">{SOURCE_ICONS[source] || '💨'}</span>
              <span className="ia-r3d-src-lbl">
                {source === 'other' && customSourceDesc ? customSourceDesc.slice(0, 14) : source}
              </span>
            </div>
          )}

          {PARTICLES.map((pt, idx) => (
            <span
              key={idx}
              aria-hidden="true"
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

          <div className={`ia-r3d-purifier ${fanPreviewOn ? 'ia-r3d-purifier--spin' : ''}`}>
            <div className="ia-r3d-fan-face">
              <span className="ia-r3d-fan-icon" aria-hidden="true">🌀</span>
            </div>
            <span className="ia-r3d-fan-lbl">{fanPreviewOn ? 'ON · Cleaning' : 'OFF'}</span>
          </div>
        </div>
      </div>

      {econ && (
        <div className="ia-econ-strip">
          <div className="ia-econ-card">
            <span className="ia-econ-icon" aria-hidden="true">🗓️</span>
            <div>
              <span className="ia-econ-lbl">Filter Life</span>
              <strong>~{econ.filter_life_days} Days</strong>
            </div>
          </div>
          <div className="ia-econ-card ia-econ-card--save">
            <span className="ia-econ-icon" aria-hidden="true">💰</span>
            <div>
              <span className="ia-econ-lbl">Saved vs Commercial</span>
              <strong>{econ.yearly_savings_estimate}</strong>
            </div>
          </div>
          <div className="ia-econ-card">
            <span className="ia-econ-icon" aria-hidden="true">⚡</span>
            <div>
              <span className="ia-econ-lbl">Monthly Power</span>
              <strong>{econ.monthly_electricity_cost}</strong>
            </div>
          </div>
        </div>
      )}

      {hacks.length > 0 && (
        <div className="ia-zero-hacks">
          <span className="ia-zero-title">₹0 Immediate Fixes:</span>
          {hacks.map((h, idx) => (
            <span key={idx} className="ia-zero-pill">{h.emoji} {h.label}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export default Room3dTwin;
