// ============================================
// DiyPurifierGuide — Interactive 3D Animated
// Corsi-Rosenthal Purifier Builder (All Ages)
// Supports drag-to-rotate 3D model, camera presets,
// Auto-Play step movie, and both 4-Filter Cube
// and 1-Filter Mini Fan layouts.
// ============================================
import { useState, useEffect, useRef } from 'react';
import './DiyPurifierGuide.css';

// Build step blueprints — clear, elder & kid friendly
function getSteps(isSingleFilter, roomVolumeM3, beforePm, afterPm) {
  const dropUg = Math.max(0, Math.round((beforePm - afterPm) * 10) / 10);
  if (isSingleFilter) {
    return [
      {
        num: 1,
        icon: '🛒',
        title: 'Gather 3 Simple Items',
        short: 'Items',
        instruction: 'Place 1 Box Fan, 1 HEPA/MERV-13 filter panel (same size as fan), and 1 roll of wide duct tape on a table.',
        why: 'A single 16" box fan + filter removes ~180 m³ of dirty air every hour for under ₹900.',
        callout: 'Lay parts side-by-side on a flat table',
      },
      {
        num: 2,
        icon: '➡️',
        title: 'Check the Air Flow Arrow',
        short: 'Arrows',
        instruction: 'Look on the cardboard frame of the filter for a printed arrow (➔). Point that arrow INTO the back of the fan.',
        why: 'Air must travel in the arrow direction through the filter pleats so dust gets trapped inside.',
        callout: 'Printed Arrow ➔ must point INTO the Fan',
      },
      {
        num: 3,
        icon: '🧩',
        title: 'Place Filter Behind the Fan',
        short: 'Attach',
        instruction: 'Rest the filter flush against the back (intake) grille of the standing box fan. Make sure all 4 edges line up.',
        why: 'The fan pulls dirty room air through the filter first, then pushes clean air out the front.',
        callout: 'Filter sits flat on back intake side',
      },
      {
        num: 4,
        icon: '🔧',
        title: 'Tape All 4 Sides Tightly',
        short: 'Tape',
        instruction: 'Run duct tape all the way around all 4 edges connecting the filter frame to the fan casing. Leave zero open cracks!',
        why: 'Air is lazy — if there is even a small gap, smog sneaks around the filter instead of going through it.',
        callout: 'Seal Top, Bottom, Left & Right seams',
      },
      {
        num: 5,
        icon: '📦',
        title: 'Add a Small Cardboard Stand',
        short: 'Stabilize',
        instruction: 'Tape a thin cardboard lip at the bottom feet if needed so the fan stays sturdy and balanced upright.',
        why: 'Keeps the DIY purifier safe around kids and pets with zero wobbling.',
        callout: 'Check fan sits steady on floor or table',
      },
      {
        num: 6,
        icon: '🌀',
        title: 'Check Fan Air Direction',
        short: 'Direction',
        instruction: 'Before turning on, verify the back pulls air IN through the filter and the front blows clean air OUT into your room.',
        why: 'Correct airflow ensures continuous mixing across all corners of your room.',
        callout: 'Dirty air IN back ➔ Clean air OUT front',
      },
      {
        num: 7,
        icon: '✨',
        title: 'Switch On & Breathe Clean Air',
        short: 'Run It',
        instruction: `Turn fan to Medium/High. Your ${roomVolumeM3} m³ room drops by ${dropUg} µg/m³ (down to ~${Math.round(afterPm)} µg/m³). Replace filter when dark grey.`,
        why: 'Running it continuously during high-smog hours protects lungs for a fraction of a commercial unit cost.',
        callout: `Clean Room: ${Math.round(beforePm)} ➔ ${Math.round(afterPm)} µg/m³`,
      },
    ];
  }

  return [
    {
      num: 1,
      icon: '🛒',
      title: 'Gather 4 Simple Items',
      short: 'Items',
      instruction: 'Put 1 Box Fan (20"), 4 MERV-13/HEPA Filters (20"×20"), 1 Cardboard square, and 1 roll of strong Duct Tape on the floor.',
      why: 'Together these form a Corsi-Rosenthal Cube — tested by scientists to clean air as fast as ₹25,000 purifiers!',
      callout: '4 Filters + 1 Box Fan + Cardboard + Tape',
    },
    {
      num: 2,
      icon: '➡️',
      title: 'Point Every Filter Arrow INWARD',
      short: 'Arrows',
      instruction: 'Find the printed arrow (➔) on the edge of all 4 filters. Always point the arrows INWARD toward the inside of the box.',
      why: 'The fan sits on top and sucks room air from the outside IN through all 4 walls. Wrong arrow = clogged filter faster.',
      callout: 'All 4 Arrows ➔ point INSIDE the Cube',
    },
    {
      num: 3,
      icon: '📦',
      title: 'Stand the 4 Filters in a Square',
      short: 'Form Cube',
      instruction: 'Stand all 4 filters upright edge-to-edge so they make a sturdy 4-sided square box with open top and bottom.',
      why: 'Using 4 walls gives huge surface area so the fan does not strain and lasts for years.',
      callout: '4 filter walls join at 90° corners',
    },
    {
      num: 4,
      icon: '🔧',
      title: 'Tape Every Corner Seam Tightly',
      short: 'Tape Sides',
      instruction: 'Press wide duct tape smoothly along all 4 vertical corners inside and outside so zero dirty air can sneak through cracks.',
      why: 'Airtight corners force 100% of dirty air directly through the micro-fiber filter media.',
      callout: 'Zero air gaps at the 4 corners!',
    },
    {
      num: 5,
      icon: '🟫',
      title: 'Seal the Bottom with Cardboard',
      short: 'Base Seal',
      instruction: 'Place the square box onto your cardboard sheet, trace/cut to fit, and tape all 4 bottom edges closed.',
      why: 'Blocks dust from being pulled off the floor and gives the cube a strong bottom base.',
      callout: 'Bottom cardboard sealed tight',
    },
    {
      num: 6,
      icon: '🌬️',
      title: 'Place Fan on Top (Blowing UP ⬆️)',
      short: 'Add Fan',
      instruction: 'Lay the box fan flat on the open top facing UPWARD (blowing air toward the ceiling). Tape the fan corners to the box rim.',
      why: 'Blowing clean air UP pushes pure air around the entire ceiling and walls without kicking floor dust.',
      callout: 'Fan on TOP · Blows UP ⬆️ to ceiling',
    },
    {
      num: 7,
      icon: '✨',
      title: 'Plug In & Clean Your Room!',
      short: 'Run It',
      instruction: `Run on Medium/High! Smog enters the 4 sides and pure air streams up — dropping your ${roomVolumeM3} m³ room by ${dropUg} µg/m³ (to ~${Math.round(afterPm)} µg/m³).`,
      why: 'Filters typically last 2 to 4 months — just swap them out when they look dark grey.',
      callout: `Clean Air Active: ${Math.round(beforePm)} ➔ ${Math.round(afterPm)} µg/m³`,
    },
  ];
}

function DiyPurifierGuide({ sim, diySimulation, diyRec, purifierRec, isUrgent }) {
  const [step, setStep] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);
  const [buildStyle, setBuildStyle] = useState(
    diyRec?.build_key === 'basic_single' ? 'single' : 'cube'
  );
  // 3D camera rotation angles (degrees)
  const [rotX, setRotX] = useState(-18);
  const [rotY, setRotY] = useState(-32);
  const [autoSpin, setAutoSpin] = useState(false);
  const [checkedMaterials, setCheckedMaterials] = useState(new Set());

  const dragRef = useRef({ active: false, startX: 0, startY: 0, baseRotX: -18, baseRotY: -32 });

  // Sync recommended build style when new simulation arrives
  useEffect(() => {
    if (diyRec?.build_key) {
      setBuildStyle(diyRec.build_key === 'basic_single' ? 'single' : 'cube');
    }
  }, [diyRec?.build_key]);

  const isSingle = buildStyle === 'single';
  const beforePm = sim?.indoor_pm25 ?? 120;
  const activeCadr = isSingle ? 180 : (diyRec?.estimated_cadr || 350) * (diyRec?.units_needed || 1);
  // Calculate realistic post-purifier PM2.5 when user switches buildStyle pill
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

  const dropUg = Math.max(0, Math.round((beforePm - afterPm) * 10) / 10);
  const dropPct = beforePm > 0 ? Math.max(0, Math.round(((beforePm - afterPm) / beforePm) * 100)) : 0;
  const cleanMinutes = Math.max(15, Math.round((roomVol * 3 / Math.max(activeCadr, 50)) * 60));

  const steps = getSteps(isSingle, roomVol, beforePm, afterPm);
  const currentStep = steps[step] || steps[0];

  // Auto-play step-by-step animation loop
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

  // Smooth camera auto-angle hint per step (only if not actively dragging)
  const applyPreset = (preset) => {
    setAutoSpin(false);
    if (preset === 'iso') { setRotX(-18); setRotY(-32); }
    else if (preset === 'front') { setRotX(-4); setRotY(0); }
    else if (preset === 'top') { setRotX(-62); setRotY(-15); }
    else if (preset === 'spin') { setAutoSpin((s) => !s); }
  };

  // Drag handlers for interactive 3D rotation
  const handlePointerDown = (e) => {
    setAutoSpin(false);
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      baseRotX: rotX,
      baseRotY: rotY,
    };
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
    if (!autoPlay && step >= steps.length - 1) {
      setStep(0);
    }
    setAutoPlay((p) => !p);
  };

  const toggleMaterial = (idx) => {
    setCheckedMaterials((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  // Tailored materials list
  const units = diyRec?.units_needed || 1;
  const estCost = isSingle ? 800 * units : (diyRec?.total_estimated_cost_inr || 1500);
  const materials = isSingle
    ? [
        { name: 'Box Fan (16" / 40cm)', qty: `${units}×`, cost: `~₹${500 * units}`, icon: '💨' },
        { name: 'HEPA / MERV-13 Filter (16"×16")', qty: `${units}×`, cost: `~₹${200 * units}`, icon: '🧹' },
        { name: 'Wide Duct Tape Roll', qty: '1×', cost: '~₹100', icon: '🧻' },
      ]
    : [
        { name: `Box Fan (${diyRec?.build_key === 'large_cube' ? '24"' : '20"'})`, qty: `${units}×`, cost: `~₹${550 * units}`, icon: '💨' },
        { name: 'MERV-13 / HEPA Filter (20"×20")', qty: `${(diyRec?.build_key === 'large_cube' ? 5 : 4) * units}×`, cost: `~₹${800 * units}`, icon: '🧹' },
        { name: 'Cardboard Base Sheet', qty: `${units}×`, cost: '~₹50 (or old box)', icon: '📦' },
        { name: 'Wide Duct Tape Roll', qty: '1×', cost: '~₹150', icon: '🧻' },
      ];

  return (
    <div className={`diy3d-wrap ${isUrgent ? 'diy3d-wrap--urgent' : 'diy3d-wrap--optional'}`}>
      {/* ── Top Banner ── */}
      <div className="diy3d-header">
        <div className="diy3d-header-left">
          <span className={`diy3d-badge ${isUrgent ? 'diy3d-badge--urgent' : 'diy3d-badge--safe'}`}>
            {isUrgent ? '🛠️ Recommended Action: Build DIY Air Purifier' : '🛡️ Optional Backup Purifier Guide'}
          </span>
          <h4 className="diy3d-title">
            Interactive 3D DIY Purifier Builder ({isSingle ? 'Compact 1-Filter' : '4-Filter Cube'})
          </h4>
          <p className="diy3d-subtitle">
            Step-by-step 3D visual guide made easy for kids, parents, and seniors. Costs ~₹{estCost} vs ₹15,000+ store purifiers.
          </p>
        </div>

        {/* Toggle Cube vs Single Filter */}
        <div className="diy3d-mode-switch" role="group" aria-label="DIY Build Style">
          <button
            type="button"
            className={`diy3d-mode-btn ${!isSingle ? 'diy3d-mode-btn--active' : ''}`}
            onClick={() => { setBuildStyle('cube'); setStep(0); setAutoPlay(false); }}
          >
            📦 4-Filter Cube ({diyRec?.estimated_cadr || 350} m³/h)
          </button>
          <button
            type="button"
            className={`diy3d-mode-btn ${isSingle ? 'diy3d-mode-btn--active' : ''}`}
            onClick={() => { setBuildStyle('single'); setStep(0); setAutoPlay(false); }}
          >
            💨 1-Filter Fan (180 m³/h)
          </button>
        </div>
      </div>

      {/* ── Room Impact Numbers Strip ── */}
      <div className="diy3d-impact-grid">
        <div className="diy3d-impact-card">
          <span className="diy3d-impact-lbl">Your Room Needs</span>
          <strong className="diy3d-impact-val">
            {purifierRec?.recommended_cadr_m3h || Math.round(roomVol * 5)} m³/h
          </strong>
          <span className="diy3d-impact-sub">for {roomVol} m³ volume (5× clean/hr)</span>
        </div>
        <div className="diy3d-impact-card diy3d-impact-card--highlight">
          <span className="diy3d-impact-lbl">DIY Purifier Removes</span>
          <strong className="diy3d-impact-val" style={{ color: '#059669' }}>
            −{dropUg} µg/m³ ({dropPct}%)
          </strong>
          <span className="diy3d-impact-sub">
            {Math.round(beforePm)} ➔ <strong>{Math.round(afterPm)} µg/m³</strong> indoors
          </span>
        </div>
        <div className="diy3d-impact-card">
          <span className="diy3d-impact-lbl">Clean Time & Cost</span>
          <strong className="diy3d-impact-val" style={{ color: '#2563EB' }}>
            ~{cleanMinutes} min · ₹{estCost}
          </strong>
          <span className="diy3d-impact-sub">{activeCadr} m³/h CADR ({units} unit{units > 1 ? 's' : ''})</span>
        </div>
      </div>

      {/* ── Main 3D Interactive Studio: Viewport Left + Steps Right ── */}
      <div className="diy3d-studio">
        {/* LEFT: Interactive 3D Viewport */}
        <div className="diy3d-viewport-col">
          <div className="diy3d-stage-toolbar">
            <span className="diy3d-drag-hint">✋ Drag to rotate 3D model</span>
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

          {/* 3D Interactive Stage */}
          <div
            className="diy3d-stage"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {/* Floating Callout Banner */}
            <div className="diy3d-stage-callout">
              <span>{currentStep.icon}</span>
              <strong>Step {currentStep.num}:</strong> {currentStep.callout}
            </div>

            {/* 3D Scene Container */}
            <div
              className={`diy3d-assembly diy3d-step-${step} ${isSingle ? 'diy3d-mode-single' : 'diy3d-mode-cube'} ${autoSpin ? 'diy3d-autospin' : ''}`}
              style={!autoSpin ? { transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)` } : undefined}
            >
              {/* Floor Shadow */}
              <div className="diy3d-floor-shadow" />

              {isSingle ? (
                /* ═══ 1-FILTER FAN 3D ASSEMBLY ═══ */
                <>
                  {/* Standing Box Fan */}
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
                      <span className="d3-part-tag">BOX FAN</span>
                    </div>
                    <div className="d3-box-face d3-box-back" />
                    <div className="d3-box-face d3-box-top" />
                    <div className="d3-box-face d3-box-bottom" />
                    <div className="d3-box-face d3-box-left" />
                    <div className="d3-box-face d3-box-right" />
                  </div>

                  {/* Single Rear HEPA Filter */}
                  <div className="d3-single-filter">
                    <div className="d3-filter-panel">
                      <div className="d3-pleats" />
                      <span className="d3-filter-badge">MERV-13 / HEPA</span>
                      <span className="d3-arrow-in">➔ IN TO FAN</span>
                    </div>
                  </div>

                  {/* Duct Tape Seal around Single Filter */}
                  <div className="d3-single-tape">
                    <span className="d3-tape-bar d3-tape-top" />
                    <span className="d3-tape-bar d3-tape-bottom" />
                    <span className="d3-tape-bar d3-tape-left" />
                    <span className="d3-tape-bar d3-tape-right" />
                  </div>

                  {/* Airflow particles */}
                  <div className="d3-airflow-single">
                    <div className="d3-smog-in">
                      <span className="d3-smog-dot" />
                      <span className="d3-smog-dot" />
                      <span className="d3-smog-dot" />
                      <span className="d3-air-lbl d3-air-lbl--smog">Smog IN</span>
                    </div>
                    <div className="d3-clean-out">
                      <span className="d3-clean-wave">Clean Air ➔</span>
                      <span className="d3-clean-wave">Fresh ➔</span>
                    </div>
                  </div>
                </>
              ) : (
                /* ═══ 4-FILTER CORSI-ROSENTHAL CUBE 3D ASSEMBLY ═══ */
                <>
                  {/* 4 Filter Walls (Front, Back, Left, Right) */}
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

                  {/* 4 Vertical Corner Duct Tape Seals */}
                  <div className="d3-corner-tape d3-ct-fl" />
                  <div className="d3-corner-tape d3-ct-fr" />
                  <div className="d3-corner-tape d3-ct-bl" />
                  <div className="d3-corner-tape d3-ct-br" />

                  {/* Corrugated Cardboard Bottom */}
                  <div className="d3-cardboard">
                    <span className="d3-cardboard-lbl">📦 CARDBOARD BASE</span>
                  </div>

                  {/* Top Box Fan Assembly */}
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

                  {/* Smog Particles Inward + Clean Air Upward (Step 7) */}
                  <div className="d3-cube-airflow">
                    <span className="d3-smog-stream d3-smog-l">💨 Smog ➔</span>
                    <span className="d3-smog-stream d3-smog-r">⬅ Smog 💨</span>
                    <div className="d3-clean-plume">
                      <span className="d3-plume-arrow">⬆️ Clean Air</span>
                      <span className="d3-plume-arrow">⬆️ Pure O₂</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Auto-Play & Step Navigation Controls ── */}
          <div className="diy3d-player">
            <button
              type="button"
              className={`diy3d-play-btn ${autoPlay ? 'diy3d-play-btn--playing' : ''}`}
              onClick={togglePlayMovie}
            >
              {autoPlay ? '⏸ Pause Assembly' : '▶ Watch Assembly Animation'}
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
                Step <strong>{step + 1}</strong> / {steps.length}
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

        {/* RIGHT: Clear Step Instructions & Checklist */}
        <div className="diy3d-steps-col">
          {/* Active Step Big Focus Card (great for seniors/kids!) */}
          <div className="diy3d-focus-card">
            <div className="diy3d-focus-head">
              <span className="diy3d-focus-num">Step {currentStep.num}</span>
              <h5 className="diy3d-focus-title">{currentStep.icon} {currentStep.title}</h5>
            </div>
            <p className="diy3d-focus-text">{currentStep.instruction}</p>
            <div className="diy3d-focus-why">
              <strong>💡 Why this matters:</strong> {currentStep.why}
            </div>
          </div>

          {/* Clickable Visual Timeline */}
          <div className="diy3d-timeline">
            {steps.map((s, idx) => (
              <button
                key={s.num}
                type="button"
                className={`diy3d-tl-item ${idx === step ? 'diy3d-tl-item--active' : ''} ${idx < step ? 'diy3d-tl-item--done' : ''}`}
                onClick={() => { setAutoPlay(false); setStep(idx); }}
              >
                <span className="diy3d-tl-badge">{idx < step ? '✓' : s.num}</span>
                <span className="diy3d-tl-label">{s.icon} {s.title}</span>
              </button>
            ))}
          </div>

          {/* Checkable Shopping List */}
          <div className="diy3d-checklist">
            <div className="diy3d-checklist-head">
              <strong>🛒 Shopping Checklist ({checkedMaterials.size}/{materials.length} ready)</strong>
              <span>Est. ₹{estCost}</span>
            </div>
            <div className="diy3d-materials-list">
              {materials.map((m, idx) => {
                const done = checkedMaterials.has(idx);
                return (
                  <button
                    key={m.name}
                    type="button"
                    className={`diy3d-mat-item ${done ? 'diy3d-mat-item--done' : ''}`}
                    onClick={() => toggleMaterial(idx)}
                  >
                    <span className="diy3d-mat-check">{done ? '☑' : '☐'}</span>
                    <span className="diy3d-mat-icon">{m.icon}</span>
                    <span className="diy3d-mat-name">{m.name}</span>
                    <span className="diy3d-mat-qty">{m.qty}</span>
                    <span className="diy3d-mat-cost">{m.cost}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DiyPurifierGuide;
