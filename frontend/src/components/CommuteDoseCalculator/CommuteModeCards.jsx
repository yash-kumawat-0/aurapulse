// ============================================
// CommuteModeCards — Transport Comparison Grid
// ============================================
function CommuteModeCards({
  allModes,
  selectedMode,
  safestMode,
  doseByMode,
  aiAnalysis,
  maxDose,
  getRiskTier,
  onSelectMode,
}) {
  if (!allModes.length) return null;

  return (
    <div className="cdc-modes">
      {allModes.map((m) => {
        const active = m.mode === selectedMode;
        const safest = m.mode === safestMode;
        const dose = doseByMode[m.mode];
        const doseVal = dose?.dose_ug ?? m.routes[0]?.estimatedDose;
        const risk = getRiskTier(doseVal);
        const modeNote = aiAnalysis?.mode_notes?.find((n) => n.mode === m.mode);
        const rangePct =
          doseVal != null
            ? Math.min(100, Math.max(8, Math.round((doseVal / Math.max(maxDose, 1)) * 100)))
            : 0;

        return (
          <button
            key={m.mode}
            type="button"
            aria-pressed={active}
            className={`cdc-mode ${active ? 'cdc-mode--on' : ''}`}
            onClick={() => onSelectMode(m.mode)}
            style={{
              background: risk.bg,
              borderColor: active ? risk.color : risk.border,
              borderLeftColor: risk.color,
              boxShadow: active ? `0 0 0 2px ${risk.color}35, 0 8px 20px rgba(15,23,42,0.1)` : undefined,
            }}
          >
            <div className="cdc-mode-top">
              <span className="cdc-mode-icon" aria-hidden="true">
                {m.icon}
              </span>
              <span className="cdc-mode-name">{m.label}</span>
              {safest && <span className="cdc-mode-safest-tag">BEST</span>}
            </div>

            <div className="cdc-mode-mid">
              <span className="cdc-mode-dose" style={{ color: risk.color }}>
                {doseVal ?? '—'} <small>µg</small>
              </span>
              <span className="cdc-mode-risk-pill" style={{ background: risk.pillBg, color: risk.color }}>
                {risk.icon} {risk.label}
              </span>
            </div>

            {modeNote && (
              <div className="cdc-mode-ai-note">
                <span aria-hidden="true">{modeNote.emoji || '📊'}</span>
                <span>{modeNote.note}</span>
              </div>
            )}

            <div className="cdc-mode-foot">
              <span>⏱️ {m.routes[0]?.durationMin || '—'} min</span>
              <span>• {m.routes[0]?.distanceKm || '—'} km</span>
            </div>

            <div
              className="cdc-mode-range-track"
              title={`Relative exposure: ${rangePct}% of highest-dose mode`}
            >
              <div
                className="cdc-mode-range-fill"
                style={{ width: `${rangePct}%`, background: risk.color }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default CommuteModeCards;
