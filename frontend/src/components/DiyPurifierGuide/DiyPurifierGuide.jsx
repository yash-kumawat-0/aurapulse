// ============================================
// DiyPurifierGuide — Minimal & Clean 3D Animated
// DIY Purifier Guide (All Ages Friendly)
// 5 crisp steps, drag-to-rotate 3D model, Play movie
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
        title: 'Gather Items',
        instruction: 'Get 1 Box Fan, 1 HEPA/MERV-13 filter (same size as fan), and 1 roll of duct tape.',
        tip: 'Lay them out on any flat table.',
        callout: 'Fan + 1 Filter + Tape',
      },
      {
        num: 2,
        icon: '➡️',
        title: 'Point Arrow In',
        instruction: 'Find the printed arrow (➔) on the filter edge and point it INTO the back of the fan.',
        tip: 'Air must flow in the arrow direction.',
        callout: 'Arrow ➔ points INTO fan',
      },
      {
        num: 3,
        icon: '🔧',
        title: 'Tape All 4 Sides',
        instruction: 'Place the filter flush against the back grille and tape all 4 edges tightly with zero gaps.',
        tip: 'No air cracks means 100% filtration.',
        callout: 'Seal all 4 filter edges',
      },
      {
        num: 4,
        icon: '📦',
        title: 'Stand Steady',
        instruction: 'Check that the fan sits flat and stable upright with the front blowing toward the room.',
        tip: 'Keep safe away from curtains.',
        callout: 'Front blows clean air out',
      },
      {
        num: 5,
        icon: '✨',
        title: 'Switch On',
        instruction: `Turn on Medium/High speed. Lowers room PM2.5 by −${dropUg} µg/m³ (down to ~${Math.round(afterPm)} µg/m³).`,
        tip: 'Replace filter when it turns dark grey.',
        callout: `Clean Air: ${Math.round(beforePm)} ➔ ${Math.round(afterPm)} µg/m³`,
      },
    ];
  }

  return [
    {
      num: 1,
      icon: '🛒',
      title: 'Gather Items',
      instruction: 'Get 1 Box Fan (20"), 4 MERV-13/HEPA filters, 1 cardboard square, and duct tape.',
      tip: 'Beats ₹15,000+ store purifiers for ~₹1,500.',
      callout: 'Fan + 4 Filters + Cardboard + Tape',
    },
    {
      num: 2,
      icon: '➡️',
      title: 'Arrows Inward',
      instruction: 'Check the edge of each filter: point every printed arrow (➔) INWARD toward the inside of the box.',
      tip: 'All 4 sides will pull room air inside.',
      callout: 'All 4 Arrows ➔ point INWARD',
    },
    {
      num: 3,
      icon: '📦',
      title: 'Form & Tape Cube',
      instruction: 'Stand the 4 filters in a square wall and tape every vertical corner seam airtight.',
      tip: 'Zero cracks forces all smog through filters.',
      callout: '4 filters taped at 90° corners',
    },
    {
      num: 4,
      icon: '🟫',
      title: 'Seal Bottom',
      instruction: 'Tape the cardboard square cleanly onto the bottom of the filter cube.',
      tip: 'Blocks dust from lifting off the floor.',
      callout: 'Cardboard sealed underneath',
    },
    {
      num: 5,
      icon: '🌬️',
      title: 'Fan Top & Run',
      instruction: `Lay fan flat on top blowing UP ⬆️, tape edges, and run! Drops room by −${dropUg} µg/m³ (to ~${Math.round(afterPm)}).`,
      tip: 'Replace filters every 2–4 months.',
      callout: `Fan Blows UP ⬆️ · ${Math.round(beforePm)} ➔ ${Math.round(afterPm)} µg/m³`,
    },
  ];
}

// Maps 5 minimal steps cleanly to our 3D assembly visual keyframes (0, 1, 3, 4, 6)
const STEP_VISUAL_CLASS = [0, 1, 3, 4, 6];

function DiyPurifierGuide({ sim, diySimulation, diyRec, purifierRec, isUrgent }) {
  const [step, setStep] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);
  const [buildStyle, setBuildStyle] = useState(
    diyRec?.build_key === 'basic_single' ? 'single' : 'cube'
  );
  const [rotX, setRotX] = useState(-18);
  const [rotY, setRotY] = useState(-32);
  const [autoSpin, setAutoSpin] = useState(false);

  const dragRef = useRef({ active: false, startX: 0, startY: 0, baseRotX: -18, baseRotY: -32 });

  useEffect(() => {
    if (diyRec?.build_key) {
      setBuildStyle(diyRec.build_key === 'basic_single' ? 'single' : 'cube');
    }
  }, [diyRec?.build_key]);

  const isSingle = buildStyle === 'single';
  const beforePm = sim?.indoor_pm25 ?? 120;
  const activeCadr = isSingle ? 180 : (diyRec?.estimated_cadr || 350) * (diyRec?.units_needed || 1);
  const roomVol = sim?.room_volume_m3 || 42.5;
  const backendAfter = diySimulation?.indoor_pm25;
  const afterPm = (!isSingle && backendAfter !== undefined)
    ? backendAfter
    : Math.max(
        5,
        Math.round(
          (((sim?.indoor_pm25 || 120) * ((sim?.ach_rate || 1.5) + 0.3)) /
            ((sim?.ach_rate || 1.5) + 0.3 + activeCadr / Math.max(roomVol, 10))) *
            10
        ) / 10
      );

  const units = diyRec?.units_needed || 1;
  const estCost = isSingle ? 800 * units : (diyRec?.total_estimated_cost_inr || 1500);
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
    }, 3200);
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

  const handlePointerUp = () => {
    dragRef.current.active = false;
  };

  const togglePlayMovie = () => {
    if (!autoPlay && step >= steps.length - 1) setStep(0);
    setAutoPlay((p) => !p);
  };

  const filterQty = isSingle ? units : (diyRec?.build_key === 'large_cube' ? 5 : 4) * units;

  return (
    <div className={`diy3d-wrap ${isUrgent ? 'diy3d-wrap--urgent' : 'diy3d-wrap--optional'}`}>
      {/* ── Minimal Header ── */}
      <div className="diy3d-header">
        <div className="diy3d-header-left">
          <div className="diy3d-title-row">
            <h4 className="diy3d-title">🛠️ DIY Purifier Maker (3D Guide)</h4>
            <span className="diy3d-impact-pill">
              {Math.round(beforePm)} ➔ <strong>{Math.round(afterPm)} µg/m³</strong> · ~₹{estCost}
            </span>
          </div>
          <p className="diy3d-subtitle">
            {purifierRec?.diy_box_sufficient
              ? `1 DIY unit (${activeCadr} m³/h) cleans your ${roomVol} m³ room easily.`
              : `Room needs ${purifierRec?.recommended_cadr_m3h || Math.round(roomVol * 5)} m³/h CADR.`}
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

      {/* ── Studio: 3D Stage Left + Clean 5 Steps Right ── */}
      <div className="diy3d-studio">
        <div className="diy3d-viewport-col">
          <div className="diy3d-stage-toolbar">
            <span className="diy3d-drag-hint">✋ Drag to rotate 3D</span>
            <div className="diy3d-cam-btns">
              <button type="button" className="diy3d-cam-btn" onClick={() => applyPreset('iso')}>📐 3D</button>
              <button type="button" className="diy3d-cam-btn" onClick={() => applyPreset('front')}>👀 Front</button>
              <button type="button" className="diy3d-cam-btn" onClick={() => applyPreset('top')}>⬆️ Top</button>
              <button
                type="button"
                className={`diy3d-cam-btn ${autoSpin ? 'diy3d-cam-btn--on' : ''}`}
                onClick={() => applyPreset('spin')}
              >
                🔄 Spin
              </button>
            </div>
          </div>

          <div
            className="diy3d-stage"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <div className="diy3d-stage-callout">
              <span>{currentStep.icon}</span>
              <strong>Step {currentStep.num}:</strong> {currentStep.callout}
            </div>

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
                      <span className="d3-part-tag">FAN</span>
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
                      <span className="d3-arrow-in">➔ IN</span>
                    </div>
                  </div>

                  <div className="d3-single-tape">
                    <span className="d3-tape-bar d3-tape-top" />
                    <span className="d3-tape-bar d3-tape-bottom" />
                    <span className="d3-tape-bar d3-tape-left" />
                    <span className="d3-tape-bar d3-tape-right" />
                  </div>

                  <div className="d3-airflow-single">
                    <div className="d3-smog-in">
                      <span className="d3-air-lbl d3-air-lbl--smog">Smog IN</span>
                    </div>
                    <div className="d3-clean-out">
                      <span className="d3-clean-wave">Clean Air ➔</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="d3-wall d3-wall-front">
                    <div className="d3-filter-panel">
                      <div className="d3-pleats" />
                      <span className="d3-filter-badge">FILTER 1</span>
                      <span className="d3-arrow-in">➔ IN</span>
                    </div>
                  </div>
                  <div className="d3-wall d3-wall-back">
                    <div className="d3-filter-panel">
                      <div className="d3-pleats" />
                      <span className="d3-filter-badge">FILTER 2</span>
                      <span className="d3-arrow-in">➔ IN</span>
                    </div>
                  </div>
                  <div className="d3-wall d3-wall-left">
                    <div className="d3-filter-panel">
                      <div className="d3-pleats" />
                      <span className="d3-filter-badge">FILTER 3</span>
                      <span className="d3-arrow-in">➔ IN</span>
                    </div>
                  </div>
                  <div className="d3-wall d3-wall-right">
                    <div className="d3-filter-panel">
                      <div className="d3-pleats" />
                      <span className="d3-filter-badge">FILTER 4</span>
                      <span className="d3-arrow-in">➔ IN</span>
                    </div>
                  </div>

                  <div className="d3-corner-tape d3-ct-fl" />
                  <div className="d3-corner-tape d3-ct-fr" />
                  <div className="d3-corner-tape d3-ct-bl" />
                  <div className="d3-corner-tape d3-ct-br" />

                  <div className="d3-cardboard">
                    <span className="d3-cardboard-lbl">CARDBOARD BASE</span>
                  </div>

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
                      <span className="d3-fan-up-badge">BLOWS UP ⬆️</span>
                    </div>
                    <div className="d3-fan-rim-tape" />
                  </div>

                  <div className="d3-cube-airflow">
                    <span className="d3-smog-stream d3-smog-l">💨 Smog ➔</span>
                    <span className="d3-smog-stream d3-smog-r">⬅ Smog 💨</span>
                    <div className="d3-clean-plume">
                      <span className="d3-plume-arrow">⬆️ Clean Air</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="diy3d-player">
            <button
              type="button"
              className={`diy3d-play-btn ${autoPlay ? 'diy3d-play-btn--playing' : ''}`}
              onClick={togglePlayMovie}
            >
              {autoPlay ? '⏸ Pause' : '▶ Watch Animation'}
            </button>

            <div className="diy3d-prev-next">
              <button
                type="button"
                className="diy3d-nav-btn"
                disabled={step === 0}
                onClick={() => { setAutoPlay(false); setStep((s) => Math.max(0, s - 1)); }}
              >
                ← Back
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
        </div>

        {/* RIGHT: Clean 5-Step Pills + Clear Single Card + Minimal Items Chips */}
        <div className="diy3d-steps-col">
          {/* 5 Step Stepper */}
          <div className="diy3d-stepper">
            {steps.map((s, idx) => (
              <button
                key={s.num}
                type="button"
                className={`diy3d-step-pill ${idx === step ? 'diy3d-step-pill--active' : ''} ${idx < step ? 'diy3d-step-pill--done' : ''}`}
                onClick={() => { setAutoPlay(false); setStep(idx); }}
              >
                <span className="diy3d-tl-badge">{idx < step ? '✓' : s.num}</span>
                <span>{s.title}</span>
              </button>
            ))}
          </div>

          {/* Focused Easy-to-Read Card */}
          <div className="diy3d-focus-card">
            <div className="diy3d-focus-head">
              <span className="diy3d-focus-num">Step {currentStep.num}</span>
              <h5 className="diy3d-focus-title">{currentStep.icon} {currentStep.title}</h5>
            </div>
            <p className="diy3d-focus-text">{currentStep.instruction}</p>
            <div className="diy3d-focus-why">
              💡 {currentStep.tip}
            </div>
          </div>

          {/* Minimal Items Chip Bar */}
          <div className="diy3d-items-bar">
            <span className="diy3d-items-label">Items Needed:</span>
            <div className="diy3d-items-chips">
              <span className="diy3d-item-chip">💨 {units}× Box Fan</span>
              <span className="diy3d-item-chip">🧹 {filterQty}× HEPA Filter</span>
              {!isSingle && <span className="diy3d-item-chip">📦 {units}× Cardboard</span>}
              <span className="diy3d-item-chip">🧻 Duct Tape</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DiyPurifierGuide;
