// ============================================
// SymptomDetectivePanel — 1-Tap AI Root-Cause Trigger Detective
// ============================================
import { useState } from 'react';

const QUICK_SYMPTOMS = [
  { id: 'wheezing', emoji: '😮‍💨', label: 'Wheeze / Cough' },
  { id: 'eye_burn', emoji: '👁️', label: 'Eye Burn' },
  { id: 'sinus', emoji: '🤧', label: 'Sinus / Nose' },
  { id: 'fatigue', emoji: '🤕', label: 'Headache' },
];

function SymptomDetectivePanel({ onCheckSymptom, symptomResult, loading }) {
  const [customSymptom, setCustomSymptom] = useState('');
  const [copiedNote, setCopiedNote] = useState(false);

  const handleTap = async (symLabel) => {
    setCopiedNote(false);
    await onCheckSymptom(symLabel, symLabel === 'custom' ? customSymptom : '');
  };

  const handleCopyDoctorNote = () => {
    if (!symptomResult?.doctor_summary) return;
    navigator.clipboard?.writeText(symptomResult.doctor_summary);
    setCopiedNote(true);
    setTimeout(() => setCopiedNote(false), 2200);
  };

  return (
    <div className="advice-symptom-detective">
      <div className="advice-sym-head">
        <span>🩺 Feeling symptoms right now? Tap 1 icon — AI finds today&apos;s trigger:</span>
      </div>
      <div className="advice-sym-btns">
        {QUICK_SYMPTOMS.map((s) => (
          <button
            key={s.id}
            type="button"
            className="advice-sym-btn"
            disabled={loading}
            onClick={() => handleTap(s.label)}
          >
            <span aria-hidden="true">{s.emoji}</span>
            <span>{s.label}</span>
          </button>
        ))}
        <div className="advice-sym-custom">
          <input
            type="text"
            className="advice-sym-input"
            aria-label="Describe custom symptom"
            placeholder="Other symptom..."
            value={customSymptom}
            onChange={(e) => setCustomSymptom(e.target.value)}
          />
          {customSymptom.trim() && (
            <button
              type="button"
              className="advice-sym-go"
              disabled={loading}
              onClick={() => handleTap('custom')}
            >
              Go
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="advice-sym-loading" role="status">
          ✨ Correlating AQI spikes, home &amp; commute dose...
        </div>
      )}

      {symptomResult && !loading && (
        <div className="advice-sym-result" aria-live="polite">
          <div className="advice-sym-res-top">
            <span className="advice-sym-trigger-icon" aria-hidden="true">
              {symptomResult.trigger_emoji}
            </span>
            <div>
              <strong>{symptomResult.likely_trigger}</strong>
              <span className="advice-sym-conf">{symptomResult.confidence_pct}% match</span>
            </div>
          </div>
          <div className="advice-sym-rescue">
            {(symptomResult.rescue_stickers || []).map((r, rIdx) => (
              <span key={rIdx} className="advice-sym-rchip">
                {r.emoji} {r.action}
              </span>
            ))}
          </div>
          <div className="advice-sym-doc-row">
            <span className="advice-sym-doc-text">📋 {symptomResult.doctor_summary}</span>
            <button type="button" className="advice-sym-copy" onClick={handleCopyDoctorNote}>
              {copiedNote ? '✓ Copied!' : 'Copy Doctor Note'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SymptomDetectivePanel;
