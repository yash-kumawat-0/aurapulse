// ============================================
// DiyPurifierGuide — 3D Animated Purifier +
// Visual Step Stickers + Unified Needed Parts & Buy Links
// ============================================
import { useState, useEffect, useRef } from 'react';
import './DiyPurifierGuide.css';

function getMinimalSteps(isSingleFilter, beforePm, afterPm) {
  const dropUg = Math.max(0, Math.round((beforePm - afterPm) * 10) / 10);
  if (isSingleFilter) {
    return [
      {
        num: 1,
        icon: '🛒',
        title: 'Gather Parts',
        visualCue: '💨 Fan + 🧹 1 Filter + 🧻 Tape',
        hint: 'Lay flat on table',
      },
      {
        num: 2,
        icon: '➡️',
        title: 'Arrow Into Fan',
        visualCue: 'FILTER [➔ IN] 💨 FAN',
        hint: 'Match printed arrow toward fan back',
      },
      {
        num: 3,
        icon: '🔧',
        title: 'Tape 4 Edges',
        visualCue: '🧻 Seal All 4 Sides Tight',
        hint: 'Zero air gaps around grille',
      },
      {
        num: 4,
        icon: '📦',
        title: 'Stand Flat',
        visualCue: '⬆️ Steady Upright · Clear Space',
        hint: 'Front faces room openly',
      },
      {
        num: 5,
        icon: '✨',
        title: 'Run Medium/High',
        visualCue: `✨ −${dropUg} µg/m³ → ~${Math.round(afterPm)} µg/m³`,
        hint: 'Change filter when dark grey',
      },
    ];
  }

  return [
    {
      num: 1,
      icon: '🛒',
      title: 'Gather Parts',
      visualCue: '💨 Fan + 🧹 4 Filters + 🟫 Cardboard + 🧻 Tape',
      hint: 'High-CADR cube build',
    },
    {
      num: 2,
      icon: '➡️',
      title: 'Arrows Inward',
      visualCue: 'All 4 Filters [➔ INWARD ⬅]',
      hint: 'Arrows point inside the cube',
    },
    {
      num: 3,
      icon: '📦',
      title: 'Tape Cube Corners',
      visualCue: '🟨 4 Walls + 🧻 Airtight Seams',
      hint: 'Forces all air through filters',
    },
    {
      num: 4,
      icon: '🟫',
      title: 'Seal Bottom',
      visualCue: '🟫 Cardboard Base Sealed',
      hint: 'Blocks floor dust leakage',
    },
    {
      num: 5,
      icon: '🌬️',
      title: 'Fan Blows UP ⬆️',
      visualCue: `💨 Fan Top ⬆️ · −${dropUg} µg/m³ (~${Math.round(afterPm)})`,
      hint: 'Swap filters every 2–4 months',
    },
  ];
}

const STEP_VISUAL_CLASS = [0, 1, 3, 4, 6];

function DiyPurifierGuide({ sim, diySimulation, diyRec, isUrgent, roomVolumeM3, aiGuidance }) {
  const detectedVolM3 = roomVolumeM3 ?? sim?.room_volume_m3 ?? 42.5;
  const autoNeedCadr = Math.max(sim?.cadr_needed_for_safe || 0, Math.round(detectedVolM3 * 5));
  const autoRecommendedStyle = detectedVolM3 < 30 && autoNeedCadr <= 180 ? 'single' : 'cube';

  const [step, setStep] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);
  const [userBuildStyle, setBuildStyle] = useState(null);
  const [rotX, setRotX] = useState(-18);
  const [rotY, setRotY] = useState(-32);
  const [autoSpin, setAutoSpin] = useState(false);

  const dragRef = useRef({ active: false, startX: 0, startY: 0, baseRotX: -18, baseRotY: -32 });
  const buildStyle = userBuildStyle ?? autoRecommendedStyle;

  const isSingle = buildStyle === 'single';
  const beforePm = sim?.indoor_pm25 ?? 120;
  const unitCadr = isSingle ? 180 : detectedVolM3 > 75 ? 450 : 350;
  const autoUnits = Math.max(1, Math.ceil(autoNeedCadr / unitCadr));
  const activeCadr = unitCadr * autoUnits;

  const backendAfter = diySimulation?.indoor_pm25;
  const afterPm =
    !isSingle && backendAfter !== undefined && autoUnits === (diyRec?.units_needed || 1)
      ? backendAfter
      : Math.max(
          5,
          Math.round(
            (((sim?.indoor_pm25 || 120) * ((sim?.ach_rate || 1.5) + 0.3)) /
              ((sim?.ach_rate || 1.5) + 0.3 + activeCadr / Math.max(detectedVolM3, 10))) *
              10,
          ) / 10,
        );

  const steps = getMinimalSteps(isSingle, beforePm, afterPm);
  const currentStep = steps[step] || steps[0];
  const visualStep = STEP_VISUAL_CLASS[step] ?? 0;

  useEffect(() => {
    if (!autoPlay) return undefined;
    const id = setInterval(() => {
      setStep((prev) => {
        if (prev >= steps.length - 1) {
          setAutoPlay(false);
          return prev;
        }
        return prev + 1;
      });
    }, 2800);
    return () => clearInterval(id);
  }, [autoPlay, steps.length]);

  const applyPreset = (preset) => {
    setAutoSpin(false);
    if (preset === 'iso') {
      setRotX(-18);
      setRotY(-32);
    } else if (preset === 'front') {
      setRotX(-4);
      setRotY(0);
    } else if (preset === 'top') {
      setRotX(-62);
      setRotY(-15);
    } else if (preset === 'spin') {
      setAutoSpin((s) => !s);
    }
  };

  const handlePointerDown = (e) => {
    setAutoSpin(false);
    dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, baseRotX: rotX, baseRotY: rotY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setRotY(dragRef.current.baseRotY + dx * 0.55);
    setRotX(Math.max(-75, Math.min(25, dragRef.current.baseRotX - dy * 0.45)));
  };

  const handlePointerUp = () => {
    dragRef.current.active = false;
  };

  const togglePlayMovie = () => {
    if (!autoPlay && step >= steps.length - 1) setStep(0);
    setAutoPlay((p) => !p);
  };

  const filterQty = isSingle ? autoUnits : (detectedVolM3 > 75 ? 5 : 4) * autoUnits;
  const aiParts = Array.isArray(aiGuidance?.diy_parts) ? aiGuidance.diy_parts : null;

  return (
    <section
      className={`diy3d-wrap ${isUrgent ? 'diy3d-wrap--urgent' : 'diy3d-wrap--optional'}`}
      aria-label="3D DIY Purifier Builder"
    >
      {/* ── Minimal Visual Header ── */}
      <div className="diy3d-header">
        <div className="diy3d-header-left">
          <h3 className="diy3d-title">🛠️ DIY Purifier 3D Builder</h3>
          <span className="diy3d-mini-stat">
            {autoUnits}× {isSingle ? '1-Filter Fan' : '4-Filter Cube'} · <strong>{activeCadr} m³/h</strong>
          </span>
        </div>

        <div className="diy3d-mode-switch" role="group" aria-label="DIY Build Style">
          <button
            type="button"
            className={`diy3d-mode-btn ${!isSingle ? 'diy3d-mode-btn--active' : ''}`}
            onClick={() => {
              setBuildStyle('cube');
              setStep(0);
              setAutoPlay(false);
            }}
          >
            📦 4-Filter Cube
          </button>
          <button
            type="button"
            className={`diy3d-mode-btn ${isSingle ? 'diy3d-mode-btn--active' : ''}`}
            onClick={() => {
              setBuildStyle('single');
              setStep(0);
              setAutoPlay(false);
            }}
          >
            💨 1-Filter Fan
          </button>
        </div>
      </div>

      {/* ── Main 3D Model + Visual Step Stickers ── */}
      <div className="diy3d-studio">
        <div className="diy3d-viewport-col">
          <div
            className="diy3d-stage"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <div className="diy3d-stage-pill">
              <span className="diy3d-step-bounce">{currentStep.icon}</span>
              <span>
                Step {currentStep.num}/{steps.length} · {currentStep.title}
              </span>
            </div>

            <div className="diy3d-cam-overlay" onPointerDown={(e) => e.stopPropagation()}>
              <button type="button" className="diy3d-cam-btn" onClick={() => applyPreset('iso')}>
                3D
              </button>
              <button type="button" className="diy3d-cam-btn" onClick={() => applyPreset('front')}>
                Front
              </button>
              <button type="button" className="diy3d-cam-btn" onClick={() => applyPreset('top')}>
                Top
              </button>
              <button
                type="button"
                className={`diy3d-cam-btn ${autoSpin ? 'diy3d-cam-btn--on' : ''}`}
                onClick={() => applyPreset('spin')}
              >
                Spin
              </button>
            </div>

            <div className="diy3d-scale-wrap">
              <div
                className={`diy3d-assembly diy3d-step-${visualStep} ${isSingle ? 'diy3d-mode-single' : 'diy3d-mode-cube'} ${autoSpin ? 'diy3d-autospin' : ''}`}
                style={!autoSpin ? { transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)` } : undefined}
              >
                <div className="diy3d-floor-shadow" />

                {isSingle ? (
                  <>
                    <div className="d3-single-fan">
                      <div className="d3-box-face d3-box-front">
                        <div className="d3-grille">
                          <div className="d3-blades">
                            <span className="d3-blade d3-b1" />
                            <span className="d3-blade d3-b2" />
                            <span className="d3-blade d3-b3" />
                            <span className="d3-hub" />
                          </div>
                        </div>
                      </div>
                      <div className="d3-box-face d3-box-back" />
                      <div className="d3-box-face d3-box-top" />
                      <div className="d3-box-face d3-box-bottom" />
                      <div className="d3-box-face d3-box-left" />
                      <div className="d3-box-face d3-box-right" />
                    </div>

                    <div className="d3-single-filter">
                      <div className="d3-filter-panel">
                        <div className="d3-pleats" />
                        <span className="d3-filter-badge">HEPA</span>
                      </div>
                    </div>

                    <div className="d3-single-tape">
                      <span className="d3-tape-bar d3-tape-top" />
                      <span className="d3-tape-bar d3-tape-bottom" />
                      <span className="d3-tape-bar d3-tape-left" />
                      <span className="d3-tape-bar d3-tape-right" />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="d3-wall d3-wall-front">
                      <div className="d3-filter-panel">
                        <div className="d3-pleats" />
                        <span className="d3-filter-badge">FILTER</span>
                      </div>
                    </div>
                    <div className="d3-wall d3-wall-back">
                      <div className="d3-filter-panel">
                        <div className="d3-pleats" />
                      </div>
                    </div>
                    <div className="d3-wall d3-wall-left">
                      <div className="d3-filter-panel">
                        <div className="d3-pleats" />
                      </div>
                    </div>
                    <div className="d3-wall d3-wall-right">
                      <div className="d3-filter-panel">
                        <div className="d3-pleats" />
                      </div>
                    </div>

                    <div className="d3-corner-tape d3-ct-fl" />
                    <div className="d3-corner-tape d3-ct-fr" />
                    <div className="d3-corner-tape d3-ct-bl" />
                    <div className="d3-corner-tape d3-ct-br" />

                    <div className="d3-cardboard" />

                    <div className="d3-top-fan">
                      <div className="d3-fan-frame">
                        <div className="d3-fan-ring">
                          <div className="d3-blades">
                            <span className="d3-blade d3-b1" />
                            <span className="d3-blade d3-b2" />
                            <span className="d3-blade d3-b3" />
                            <span className="d3-hub" />
                          </div>
                        </div>
                      </div>
                      <div className="d3-fan-rim-tape" />
                    </div>
                  </>
                )}
              </div>
            </div>

            {visualStep === 6 && (
              <div className="diy3d-clean-badge">✨ Clean · ~{Math.round(afterPm)} µg/m³</div>
            )}
          </div>
        </div>

        {/* Visual Sticker Step Cards */}
        <div className="diy3d-steps-col">
          <div className="diy3d-step-top">
            <div className="diy3d-stepper" role="tablist" aria-label="Assembly steps">
              {steps.map((s, idx) => (
                <button
                  key={s.num}
                  type="button"
                  role="tab"
                  aria-selected={idx === step}
                  className={`diy3d-step-pill ${idx === step ? 'diy3d-step-pill--active' : ''} ${idx < step ? 'diy3d-step-pill--done' : ''}`}
                  onClick={() => {
                    setAutoPlay(false);
                    setStep(idx);
                  }}
                >
                  <span className="diy3d-tl-badge">{idx < step ? '✓' : s.num}</span>
                  <span className="diy3d-step-name">{s.title}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              className={`diy3d-play-btn ${autoPlay ? 'diy3d-play-btn--playing' : ''}`}
              onClick={togglePlayMovie}
            >
              {autoPlay ? '⏸ Pause' : '▶ Play'}
            </button>
          </div>

          <div className="diy3d-focus-card">
            <div className="diy3d-focus-visual">
              <span className="diy3d-focus-big-icon">{currentStep.icon}</span>
              <div>
                <h4 className="diy3d-focus-title">
                  Step {currentStep.num}: {currentStep.title}
                </h4>
                <div className="diy3d-cue-chip">{currentStep.visualCue}</div>
              </div>
            </div>

            <div className="diy3d-focus-why">💡 {currentStep.hint}</div>

            <div className="diy3d-card-nav">
              <button
                type="button"
                className="diy3d-nav-btn"
                disabled={step === 0}
                onClick={() => {
                  setAutoPlay(false);
                  setStep((s) => Math.max(0, s - 1));
                }}
              >
                ← Prev
              </button>
              <span className="diy3d-step-counter">
                <strong>{step + 1}</strong> / {steps.length}
              </span>
              <button
                type="button"
                className="diy3d-nav-btn diy3d-nav-btn--next"
                disabled={step === steps.length - 1}
                onClick={() => {
                  setAutoPlay(false);
                  setStep((s) => Math.min(steps.length - 1, s + 1));
                }}
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Unified Needed Parts + Regional Prices + Online Store Buy Links ── */}
      <div className="diy3d-parts-unified">
        <div className="diy3d-parts-head">
          <span className="diy3d-parts-title">
            🧰 Needed Parts {aiGuidance?.location_detected ? `· 📍 ${aiGuidance.location_detected}` : ''}
          </span>
          <div className="diy3d-parts-badges">
            {aiGuidance?.total_diy_estimate && (
              <span className="diy3d-parts-total">Est: {aiGuidance.total_diy_estimate}</span>
            )}
            {aiGuidance?.ai_powered && <span className="diy3d-parts-ai">✨ Gemini AI Prices</span>}
          </div>
        </div>

        {aiParts && aiParts.length > 0 ? (
          <div className="diy3d-parts-grid">
            {aiParts.map((part, idx) => {
              const icon = part.part_type === 'fan' ? '💨' : part.part_type === 'filter' ? '🧹' : '🧻';
              return (
                <div key={idx} className="diy3d-part-tile">
                  <div className="diy3d-part-top">
                    <span className="diy3d-part-name">
                      {icon} {part.title}
                    </span>
                    <span className="diy3d-part-price">{part.estimated_price}</span>
                  </div>
                  <div className="diy3d-part-links">
                    {(part.platform_links || []).map((link, lIdx) => (
                      <a
                        key={lIdx}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="diy3d-store-btn"
                        title={`Buy ${part.title} on ${link.platform_name}`}
                      >
                        <span>{link.platform_name}</span>
                        {link.estimated_price && <small>{link.estimated_price}</small>}
                        <span>↗</span>
                      </a>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="diy3d-items-chips">
            <span className="diy3d-item-chip">💨 {autoUnits}× Box Fan</span>
            <span className="diy3d-item-chip">🧹 {filterQty}× HEPA Filter</span>
            {!isSingle && <span className="diy3d-item-chip">📦 {autoUnits}× Cardboard</span>}
            <span className="diy3d-item-chip">🧻 Duct Tape</span>
          </div>
        )}
      </div>
    </section>
  );
}

export default DiyPurifierGuide;
