// ============================================
// DiyPurifierGuide — Interactive Step-by-Step
// Visual checklist with expandable materials,
// interactive cost calculator, and progress bar.
// ============================================
import { useState } from 'react';
import { useAqi } from '../../context/AqiContext.jsx';
import './DiyPurifierGuide.css';

const DEFAULT_DIY = {
  recommended_build: 'Standard Cube: 1 Fan + 4 Filters',
  estimated_cadr: 350,
  total_estimated_cost_inr: 1500,
  materials_list: [
    { item: 'Box fan (20″)', quantity: 1, cost: 500, icon: '💨' },
    { item: 'MERV-13 / HEPA filter panel', quantity: 4, cost: 200, icon: '🧹' },
    { item: 'Cardboard for sealing', quantity: 1, cost: 50, icon: '📦' },
    { item: 'Duct tape', quantity: 1, cost: 150, icon: '🔧' },
  ],
  assembly_steps: [
    { text: 'Arrange 4 filter panels in a square (media facing inward).', tip: 'Arrow on filter should point inward' },
    { text: 'Tape edges tightly — no air gaps.', tip: 'Even small gaps reduce efficiency by 30%' },
    { text: 'Seal bottom with cardboard.', tip: 'Cut to exact size for a flush fit' },
    { text: 'Place fan on top (blowing upward).', tip: 'Fan label should face up' },
    { text: 'Tape fan to filter cube.', tip: 'Wrap tape around all 4 edges' },
    { text: 'Run on medium/high speed.', tip: 'Medium = quieter, High = max CADR' },
    { text: 'Replace filters every 2-3 months.', tip: 'Check color — dark grey = time to replace' },
  ],
};

function DiyPurifierGuide() {
  const { indoorData } = useAqi();
  const rawDiy = indoorData?.diy_purifier || DEFAULT_DIY;
  // Normalize: ensure materials have icons/cost and steps have tips
  const diy = {
    ...DEFAULT_DIY,
    ...rawDiy,
    materials_list: rawDiy.materials_list?.map((m, i) => ({
      ...DEFAULT_DIY.materials_list[i],
      ...m,
    })) || DEFAULT_DIY.materials_list,
    assembly_steps: (rawDiy.assembly_steps || DEFAULT_DIY.assembly_steps).map((s, i) => {
      if (typeof s === 'string') return DEFAULT_DIY.assembly_steps[i] || { text: s, tip: '' };
      return { ...DEFAULT_DIY.assembly_steps[i], ...s };
    }),
  };

  const [expanded, setExpanded] = useState(false);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [fanCount, setFanCount] = useState(1);
  const [filterCount, setFilterCount] = useState(4);

  const toggleStep = (idx) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const progress = diy.assembly_steps.length > 0
    ? Math.round((completedSteps.size / diy.assembly_steps.length) * 100) : 0;

  const totalCost = (diy.materials_list[0]?.cost || 500) * fanCount
    + (diy.materials_list[1]?.cost || 200) * filterCount
    + (diy.materials_list[2]?.cost || 50) + (diy.materials_list[3]?.cost || 150);

  const estimatedCadr = Math.round(fanCount * filterCount * 85);

  return (
    <div className="card diy-card">
      <button className="diy-toggle" onClick={() => setExpanded(!expanded)}>
        <div className="diy-toggle-left">
          <span className="diy-toggle-icon">🛠️</span>
          <div className="diy-toggle-info">
            <span className="diy-toggle-title">Build a DIY Air Purifier</span>
            <span className="diy-toggle-sub">₹{totalCost} · {estimatedCadr} m³/h CADR · Beats ₹15K+ purifiers</span>
          </div>
        </div>
        <span className="diy-chevron">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="diy-body">
          {/* ── Interactive Config ── */}
          <div className="diy-config">
            <div className="diy-config-item">
              <label className="diy-config-label">Fans</label>
              <div className="diy-counter">
                <button className="diy-counter-btn" onClick={() => setFanCount(Math.max(1, fanCount - 1))}>−</button>
                <span className="diy-counter-val">{fanCount}</span>
                <button className="diy-counter-btn" onClick={() => setFanCount(Math.min(4, fanCount + 1))}>+</button>
              </div>
            </div>
            <div className="diy-config-item">
              <label className="diy-config-label">Filters</label>
              <div className="diy-counter">
                <button className="diy-counter-btn" onClick={() => setFilterCount(Math.max(2, filterCount - 1))}>−</button>
                <span className="diy-counter-val">{filterCount}</span>
                <button className="diy-counter-btn" onClick={() => setFilterCount(Math.min(8, filterCount + 1))}>+</button>
              </div>
            </div>
            <div className="diy-config-result">
              <div className="diy-config-stat">
                <span className="diy-config-stat-num" style={{ color: '#2E7D32' }}>{estimatedCadr}</span>
                <span className="diy-config-stat-label">m³/h CADR</span>
              </div>
              <div className="diy-config-stat">
                <span className="diy-config-stat-num" style={{ color: 'var(--color-secondary)' }}>₹{totalCost}</span>
                <span className="diy-config-stat-label">Total Cost</span>
              </div>
            </div>
          </div>

          {/* ── Materials Checklist ── */}
          <div className="diy-section">
            <strong className="diy-section-title">📦 Materials</strong>
            <div className="diy-materials">
              {diy.materials_list.map((m, i) => (
                <div key={i} className="diy-material">
                  <span className="diy-material-icon">{m.icon || '📦'}</span>
                  <div className="diy-material-info">
                    <span className="diy-material-name">{m.item}</span>
                    <span className="diy-material-meta">
                      ×{i === 0 ? fanCount : i === 1 ? filterCount : m.quantity}
                      {m.cost ? ` · ₹${m.cost * (i === 0 ? fanCount : i === 1 ? filterCount : m.quantity)}` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Assembly Steps with Progress ── */}
          <div className="diy-section">
            <div className="diy-steps-header">
              <strong className="diy-section-title">📋 Assembly Steps</strong>
              <span className="diy-progress-text">{completedSteps.size}/{diy.assembly_steps.length} done</span>
            </div>
            <div className="diy-progress-bar">
              <div className="diy-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="diy-steps">
              {diy.assembly_steps.map((step, i) => {
                const done = completedSteps.has(i);
                return (
                  <button key={i} className={`diy-step ${done ? 'diy-step--done' : ''}`}
                    onClick={() => toggleStep(i)}>
                    <span className={`diy-step-check ${done ? 'diy-step-check--done' : ''}`}>
                      {done ? '✓' : i + 1}
                    </span>
                    <div className="diy-step-content">
                      <span className={`diy-step-text ${done ? 'diy-step-text--done' : ''}`}>{step.text}</span>
                      {step.tip && <span className="diy-step-tip">💡 {step.tip}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {progress === 100 && (
            <div className="diy-complete">🎉 Purifier complete! Run it and check your Indoor Air Simulator results.</div>
          )}
        </div>
      )}
    </div>
  );
}

export default DiyPurifierGuide;
