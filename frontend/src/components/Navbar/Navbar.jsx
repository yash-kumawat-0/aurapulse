// ============================================
// Navbar Component — Language + Backup AI Key Modal
// ============================================
import { useState, useEffect } from 'react';
import { useUser } from '../../context/UserContext.jsx';
import {
  fetchHealthStatus,
  getBackupGeminiKey,
  setBackupGeminiKey,
} from '../../services/api.js';
import './Navbar.css';

function Navbar() {
  const { language, setLanguage } = useUser();
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyInput, setKeyInput] = useState(getBackupGeminiKey());
  const [aiStatus, setAiStatus] = useState(null);
  const [savedMsg, setSavedMsg] = useState('');

  const hasCustomKey = Boolean(getBackupGeminiKey());

  useEffect(() => {
    fetchHealthStatus()
      .then((res) => setAiStatus(res.ai || null))
      .catch(() => {});
  }, [showKeyModal]);

  const handleSaveKey = (e) => {
    e.preventDefault();
    setBackupGeminiKey(keyInput);
    setSavedMsg(keyInput.trim() ? 'Backup key activated cleanly for this session.' : 'Reverted to default server keys.');
    fetchHealthStatus()
      .then((res) => setAiStatus(res.ai || null))
      .catch(() => {});
    setTimeout(() => setSavedMsg(''), 2500);
  };

  const handleClearKey = () => {
    setKeyInput('');
    setBackupGeminiKey('');
    setSavedMsg('Cleared backup key — using default server keys.');
    fetchHealthStatus()
      .then((res) => setAiStatus(res.ai || null))
      .catch(() => {});
    setTimeout(() => setSavedMsg(''), 2500);
  };

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <a href="#" className="navbar-brand">
          <span className="navbar-brand-icon">🍃</span>
          AuraPulse
        </a>

        <div className="navbar-actions">
          <button
            type="button"
            className={`navbar-key-btn ${hasCustomKey || aiStatus?.configured ? 'navbar-key-btn--ok' : ''}`}
            onClick={() => setShowKeyModal(true)}
            title="Manage Gemini AI API key / failover"
          >
            <span>🔑</span>
            <span className="navbar-key-label">{hasCustomKey ? 'Custom Key' : 'AI Key'}</span>
          </button>

          <select
            className="navbar-lang-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            aria-label="Select Language"
          >
            <option value="English">EN</option>
            <option value="Hindi">हिं</option>
            <option value="Telugu">తె</option>
          </select>
        </div>
      </div>

      {showKeyModal && (
        <div className="navkey-overlay" onClick={() => setShowKeyModal(false)}>
          <div className="navkey-modal" onClick={(e) => e.stopPropagation()}>
            <div className="navkey-head">
              <h4>🔑 Gemini AI Failover Key</h4>
              <button
                type="button"
                className="navkey-close"
                onClick={() => setShowKeyModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="navkey-status">
              <span>
                Status:{' '}
                <strong>
                  {aiStatus?.configured
                    ? `Active (${aiStatus.healthy_key_count}/${aiStatus.key_count} key ready · ${aiStatus.preferred_model})`
                    : 'No key active (Rule fallback)'}
                </strong>
              </span>
            </div>

            <p className="navkey-desc">
              AuraPulse automatically switches across configured Gemini models and backup keys if one hits quota. Paste a fresh Gemini API key below anytime for instant hassle-free switching.
            </p>

            <form className="navkey-form" onSubmit={handleSaveKey}>
              <input
                type="password"
                className="navkey-input"
                placeholder="Paste backup Gemini API key (e.g. AQ... or AIza...)"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                autoComplete="off"
              />
              {savedMsg && <span className="navkey-saved">{savedMsg}</span>}
              <div className="navkey-btns">
                <button type="submit" className="navkey-save-btn">
                  Activate Key
                </button>
                {hasCustomKey && (
                  <button type="button" className="navkey-clear-btn" onClick={handleClearKey}>
                    Reset to Default
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </nav>
  );
}

export default Navbar;
