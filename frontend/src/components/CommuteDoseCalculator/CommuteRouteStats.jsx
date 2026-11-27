// ============================================
// CommuteRouteStats — Per-Leg Pollution & Route Telemetry Card
// ============================================
import { Fragment } from 'react';
import { MODE_CONFIG } from '../../utils/routingService.js';
import { estimateLegDoseUg } from './CommuteMapLayers.jsx';

function CommuteRouteStats({
  curRoute,
  curMode,
  selectedMode,
  selectedMetroLineIdx,
  metroLinesToRender,
  isMetroMode,
  doseByMode,
  safestMode,
  basePM25,
  aiAnalysis,
  getRiskTier,
}) {
  if (!curRoute) return null;

  const modeEval = doseByMode[selectedMode];
  const isInterchangeSel = isMetroMode && selectedMetroLineIdx === 'interchange' && curRoute?.interchangePlan;
  const selectedLineObj =
    isMetroMode && typeof selectedMetroLineIdx === 'number' ? metroLinesToRender[selectedMetroLineIdx] : null;
  const isDefaultPlan = selectedMetroLineIdx === curRoute?.defaultActiveLineIndex;
  const activeLegs = isInterchangeSel
    ? isDefaultPlan && modeEval?.legs?.length
      ? modeEval.legs
      : curRoute.interchangePlan.legs
    : isDefaultPlan && modeEval?.legs?.length
      ? modeEval.legs
      : selectedLineObj?.autoPlan?.legs || curRoute?.autoPlan?.legs;

  const computedLineDose =
    !isDefaultPlan && activeLegs?.length
      ? Math.round(activeLegs.reduce((sum, leg) => sum + estimateLegDoseUg(leg, basePM25), 0) * 100) / 100
      : null;
  const curDose = computedLineDose ?? modeEval?.dose_ug ?? curRoute.estimatedDose;
  const curRisk = getRiskTier(curDose);

  let safeTip = aiAnalysis?.safe_tip_sticker || null;
  if (
    !safeTip &&
    safestMode &&
    safestMode !== selectedMode &&
    doseByMode[safestMode]?.dose_ug < curDose - 0.5
  ) {
    const alt = doseByMode[safestMode];
    const saved = Math.round((curDose - alt.dose_ug) * 10) / 10;
    safeTip = `Switch to ${MODE_CONFIG[safestMode]?.label} (${alt.dose_ug} µg) to inhale −${saved} µg less pollution.`;
  }

  const headerTitle = isInterchangeSel
    ? `${curRoute.interchangePlan.lineAName} ⇄ ${curRoute.interchangePlan.lineBName}`
    : selectedLineObj
      ? selectedLineObj.name.split('(')[0].trim()
      : curRoute.altLabel;

  const activePlanMeta = isInterchangeSel ? curRoute.interchangePlan : selectedLineObj?.autoPlan;

  return (
    <section className="card cdc-stats cdc-stats--compact" aria-live="polite">
      <div className="cdc-stats-header">
        <span style={{ color: curMode?.color, fontSize: '1.2rem' }} aria-hidden="true">
          {curMode?.icon}
        </span>
        <h2>
          {curMode?.label} — {headerTitle}
        </h2>
        {modeEval?.health_status && (
          <span className="cdc-health-chip" style={{ color: curRisk.color }}>
            {modeEval.health_status.label}
          </span>
        )}
        <span className="cdc-safe-pill" style={{ background: curRisk.pillBg, color: curRisk.color }}>
          {curRisk.icon} {curRisk.label}
        </span>
      </div>

      {isMetroMode && activeLegs?.length > 0 && (
        <div className="cdc-est-highlight">
          <div className="cdc-est-top">
            <span className="cdc-est-label">⚡ Estimated Pollution Breakdown</span>
            <span className="cdc-est-total" style={{ color: curRisk.color }}>
              Total Inhaled: <strong>{curDose} µg</strong>
            </span>
          </div>
          <div className="cdc-chain-pills">
            {activeLegs.map((leg, i) => {
              const isXfer = leg.mode === 'TRANSFER';
              const icon = isXfer ? '🔄' : MODE_CONFIG[leg.mode]?.icon || '🚆';
              const name = isXfer
                ? 'Interchange'
                : leg.line_name
                  ? leg.line_name.split('(')[0].trim()
                  : MODE_CONFIG[leg.mode]?.label || leg.mode;
              const legDose = estimateLegDoseUg(leg, basePM25);
              return (
                <Fragment key={i}>
                  {i > 0 && (
                    <span className="cdc-chain-arrow" aria-hidden="true">
                      ➔
                    </span>
                  )}
                  <span
                    className={`cdc-chain-pill ${leg.mode === 'METRO' ? 'cdc-chain-pill--metro' : ''} ${isXfer ? 'cdc-chain-pill--xfer' : ''}`}
                  >
                    <span>
                      {icon} {name}
                      {!isXfer ? ` ${leg.distance_km} km` : ` ${leg.duration_min}m`}
                    </span>
                    {leg.coverage_pct && <span className="cdc-chain-cov">({leg.coverage_pct}%)</span>}
                    <strong className="cdc-chain-ug">{legDose} µg</strong>
                  </span>
                </Fragment>
              );
            })}
          </div>
        </div>
      )}

      <div className="cdc-stats-grid">
        <div className="cdc-stat-box" style={{ background: curRisk.bg, borderColor: curRisk.border }}>
          <span className="cdc-stat-num" style={{ color: curRisk.color }}>
            {curDose} <small>µg</small>
          </span>
          <span className="cdc-stat-unit">total inhaled</span>
        </div>
        <div className="cdc-stat-box">
          <span className="cdc-stat-num">{modeEval?.estimated_aqi ?? Math.round(basePM25)}</span>
          <span className="cdc-stat-unit">est. trip AQI</span>
        </div>
        <div className="cdc-stat-box">
          <span className="cdc-stat-num">
            {activePlanMeta?.totalDurationMin || curRoute.durationMin} <small>min</small>
          </span>
          <span className="cdc-stat-unit">time</span>
        </div>
        <div className="cdc-stat-box">
          <span className="cdc-stat-num">
            {activePlanMeta?.totalKm || curRoute.distanceKm} <small>km</small>
          </span>
          <span className="cdc-stat-unit">distance</span>
        </div>
      </div>

      {safeTip && (
        <div className="cdc-safe-suggest">
          <span aria-hidden="true">🛡️</span>
          <span>{safeTip}</span>
        </div>
      )}
    </section>
  );
}

export default CommuteRouteStats;
