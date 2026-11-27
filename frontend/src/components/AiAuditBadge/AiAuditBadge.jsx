// ============================================
// AiAuditBadge — Honest Runtime AI Status +
// Collapsible Prompt & Structured Output Viewer
// ============================================
import { useState } from 'react';
import './AiAuditBadge.css';

function AiAuditBadge({
  aiPowered,
  model,
  keySlot,
  promptPreview,
  inputContext,
  outputData,
  fallbackReason,
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="aia-wrap">
      <div className="aia-bar">
        <span className={`aia-pill ${aiPowered ? 'aia-pill--live' : 'aia-pill--fallback'}`}>
          <span>{aiPowered ? '✨' : '⚙️'}</span>
          <span>
            {aiPowered
              ? `Gemini AI (${model || 'gemini-3.6-flash'})`
              : `Rule Engine Fallback (${model || 'offline'})`}
          </span>
          {aiPowered && keySlot && (
            <span className="aia-key-tag">· {keySlot === 'override' ? 'Custom Key' : 'Auto Key'}</span>
          )}
        </span>

        <button
          type="button"
          className="aia-toggle-btn"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          {open ? 'Hide Prompt & Output ▲' : '🔍 View Prompt & AI Output ▼'}
        </button>
      </div>

      {open && (
        <div className="aia-drawer">
          {promptPreview && (
            <div className="aia-block">
              <span className="aia-block-title">Prompt Summary</span>
              <p className="aia-summary-text">{promptPreview}</p>
            </div>
          )}

          {!aiPowered && fallbackReason && (
            <div className="aia-warn-note">
              Fallback note: {fallbackReason} (tap <strong>🔑 AI Key</strong> in top bar to switch key cleanly)
            </div>
          )}

          <div className="aia-grid">
            {inputContext && (
              <div className="aia-block">
                <span className="aia-block-title">Inputs Sent to Model</span>
                <pre className="aia-code">{JSON.stringify(inputContext, null, 2)}</pre>
              </div>
            )}
            {outputData && (
              <div className="aia-block">
                <span className="aia-block-title">Structured Response Output</span>
                <pre className="aia-code">{JSON.stringify(outputData, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AiAuditBadge;
