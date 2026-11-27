// ============================================
// DiyPurifierGuide — Clean Uncluttered 3D Purifier
// Simple layout, crisp centered stage, unified controls
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
        instruction: 'Keep 1 box fan, 1 same-size HEPA/MERV-13 filter, and duct tape ready on a flat table.',
        tip: 'Simplest quick setup for smaller rooms.',
      },
      {
        num: 2,
        icon: '➡️',
        title: 'Point Arrow In',
        instruction: 'Check the printed airflow arrow on the filter frame so it points INTO the back of the fan.',
        tip: 'Air must travel in the same direction as the arrow.',
      },
      {
        num: 3,
        icon: '🔧',
        title: 'Tape All 4 Sides',
        instruction: 'Press the filter flat against the back grille and tape all 4 edges with zero air gaps.',
        tip: 'Taping tightly forces all smog through the filter media.',
      },
      {
        num: 4,
        icon: '📦',
        title: 'Stand Upright',
        instruction: 'Place the unit on a sturdy flat surface with the front blowing unobstructed into the room.',
        tip: 'Leave space behind the intake for smooth airflow.',
      },
      {
        num: 5,
        icon: '✨',
        title: 'Switch On',
        instruction: `Run on Medium/High speed to cut PM2.5 by −${dropUg} µg/m³ (down to ~${Math.round(afterPm)} µg/m³).`,
        tip: 'Replace the filter once it turns dark grey.',
      },
    ];
  }

  return [
    {
      num: 1,
      icon: '🛒',
      title: 'Gather Parts',
      instruction: 'Prepare 1 box fan (20"), 4 MERV-13/HEPA filters, 1 square cardboard base, and duct tape.',
      tip: 'Performs like a ₹15,000 purifier for around ₹1,500.',
    },
    {
      num: 2,
      icon: '➡️',
      title: 'Arrows Inward',
      instruction: 'Point the airflow arrow on all 4 filter edges INWARD toward the center of the cube.',
      tip: 'All four sides pull polluted room air into the box.',
    },
    {
      num: 3,
      icon: '📦',
      title: 'Tape 4 Corners',
      instruction: 'Stand the 4 filters into a square ring and tape every vertical corner seam airtight.',
      tip: 'Sealed corners stop polluted air from bypassing filters.',
    },
    {
      num: 4,
      icon: '🟫',
      title: 'Seal Bottom',
      instruction: 'Tape the square cardboard sheet flat across the bottom of the filter cube.',
      tip: 'Keeps floor dust out and completes the chamber.',
    },
    {
      num: 5,
      icon: '🌬️',
      title: 'Fan Top & Run',
      instruction: `Set the fan on top blowing UP ⬆️, seal the rim, and run! Cuts PM2.5 by −${dropUg} µg/m³ (to ~${Math.round(afterPm)}).`,
      tip: 'Swap filters every 2–4 months depending on smog.',
    },
  ];
}

const STEP_VISUAL_CLASS = [0, 1, 3, 4, 6];

function DiyPurifierGuide({
  sim,
  diySimulation,
  diyRec,
  purifierRec,
  isUrgent,
  roomVolumeM3,
}) {
  const detectedVolM3 = roomVolumeM3 ?? sim?.room_volume_m3 ?? 42.5;
  const autoNeedCadr = Math.max(sim?.cadr_needed_for_safe || 0, Math.round(detectedVolM3 * 5));
  const autoRecommendedStyle = (detectedVolM3 < 30 && autoNeedCadr <= 180) ? 'single' : 'cube';

  const [step, setStep] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);
  const [buildStyle, setBuildStyle] = useState(autoRecommendedStyle);
  const [rotX, setRotX] = useState(-18);
  const [rotY, setRotY] = useState(-32);
  const [autoSpin, setAutoSpin] = useState(false);

  const dragRef = useRef({ active: false, startX: 0, startY: 0, baseRotX: -18, baseRotY: -32 });

  useEffect(() => {
    setBuildStyle(autoRecommendedStyle);
  }, [autoRecommendedStyle, detectedVolM3]);

  const isSingle = buildStyle === 'single';
  const beforePm = sim?.indoor_pm25 ?? 120;
  const unitCadr = isSingle ? 180 : (detectedVolM3 > 75 ? 450 : 350);
  const autoUnits = Math.max(1, Math.ceil(autoNeedCadr / unitCadr));
  const activeCadr = unitCadr * autoUnits;

  const backendAfter = diySimulation?.indoor_pm25;
  const afterPm = (!isSingle && backendAfter !== undefined && autoUnits === (diyRec?.units_needed || 1))
    ? backendAfter
    : Math.max(
        5,
        Math.round(
          (((sim?.indoor_pm25 || 120) * ((sim?.ach_rate || 1.5) + 0.3)) /
            ((sim?.ach_rate || 1.5) + 0.3 + activeCadr / Math.max(detectedVolM3, 10))) *
            10,
        ) / 10,
      );

  const estCost = (isSingle ? 800 : (detectedVolM3 > 75 ? 2200 : 1500)) * autoUnits;
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
    }, 3000);
    return () => clearInterval(id);
  }, [autoPlay, steps.length]);

  const applyPreset = (preset) => {
    setAutoSpin(false);
    if (preset === 'iso') { setRotX(-18); setRotY(-32); }
    else if (preset === 'front') { setRotX(-4); setRotY(0); }
    else if (preset === 'top') { setRotX(-62); setRotY(-15); }
    else if (preset === 'spin') { setAutoSpin((s) => !s); }
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

  const handlePointerUp = () => { dragRef.current.active = false; };

  const togglePlayMovie = () => {
    if (!autoPlay && step >= steps.length - 1) setStep(0);
    setAutoPlay((p) => !p);
  };

  const filterQty = isSingle ? autoUnits : (detectedVolM3 > 75 ? 5 : 4) * autoUnits;

  return (
    <section className={`diy3d-wrap ${isUrgent ? 'diy3d-wrap--urgent' : 'diy3d-wrap--optional'}`} aria-label="DIY Purifier Guide">
      {/* ── Clean Compact Header ── */}
      <div className="diy3d-header">
        <div className="diy3d-header-left">
          <h4 className="diy3d-title">🛠️ DIY Purifier Guide</h4>
          <p className="diy3d-subtitle">
            {purifierRec?.diy_box_sufficient
              ? `1× ${isSingle ? '1-Filter Fan' : '4-Filter Cube'} (${activeCadr} m³/h · ~₹${estCost}) lowers indoor air to ~${Math.round(afterPm)} µg/m³.`
              : `Recommended: ${autoUnits}× ${isSingle ? '1-Filter Fan' : '4-Filter Cube'} (${activeCadr} m³/h · ~₹${estCost}) → ~${Math.round(afterPm)} µg/m³.`}
          </p>
        </div>

        <div className="diy3d-mode-switch" role="group" aria-label="DIY Build Style">
          <button
            type="button"
            className={`diy3d-mode-btn ${!isSingle ? 'diy3d-mode-btn--active' : ''}`}
            onClick={() => { setBuildStyle('cube'); setStep(0); setAutoPlay(false); }}
          >
            📦 4-Filter Cube
          </button>
          <button
            type="button"
            className={`diy3d-mode-btn ${isSingle ? 'diy3d-mode-btn--active' : ''}`}
            onClick={() => { setBuildStyle('single'); setStep(0); setAutoPlay(false); }}
          >
            💨 1-Filter Fan
          </button>
        </div>
      </div>

      {/* ── Main Interactive Studio: 3D Preview + Clean Step Guide ── */}
      <div className="diy3d-studio">
        {/* Clean 3D Stage */}
        <div className="diy3d-viewport-col">
          <div
            className="diy3d-stage"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <div className="diy3d-stage-pill">
              {currentStep.icon} Step {currentStep.num}/{steps.length} · {currentStep.title}
            </div>

            <div className="diy3d-cam-overlay" onPointerDown={(e) => e.stopPropagation()}>
              <button type="button" className="diy3d-cam-btn" onClick={() => applyPreset('iso')}>3D</button>
              <button type="button" className="diy3d-cam-btn" onClick={() => applyPreset('front')}>Front</button>
              <button type="button" className="diy3d-cam-btn" onClick={() => applyPreset('top')}>Top</button>
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
              <div className="diy3d-clean-badge">
                ✨ Clean Air · ~{Math.round(afterPm)} µg/m³
              </div>
            )}
          </div>
        </div>

        {/* Clean Step Guide & Unified Controls */}
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
                  onClick={() => { setAutoPlay(false); setStep(idx); }}
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
            <h5 className="diy3d-focus-title">{currentStep.icon} Step {currentStep.num}: {currentStep.title}</h5>
            <p className="diy3d-focus-text">{currentStep.instruction}</p>
            <div className="diy3d-focus-why">
              💡 {currentStep.tip}
            </div>

            <div className="diy3d-card-nav">
              <button
                type="button"
                className="diy3d-nav-btn"
                disabled={step === 0}
                onClick={() => { setAutoPlay(false); setStep((s) => Math.max(0, s - 1)); }}
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
                onClick={() => { setAutoPlay(false); setStep((s) => Math.min(steps.length - 1, s + 1)); }}
              >
                Next →
              </button>
            </div>
          </div>

          <div className="diy3d-items-bar">
            <span className="diy3d-items-label">Needed:</span>
            <div className="diy3d-items-chips">
              <span className="diy3d-item-chip">💨 {autoUnits}× Box Fan</span>
              <span className="diy3d-item-chip">🧹 {filterQty}× HEPA Filter</span>
              {!isSingle && <span className="diy3d-item-chip">📦 {autoUnits}× Cardboard</span>}
              <span className="diy3d-item-chip">🧻 Duct Tape</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default DiyPurifierGuide;
