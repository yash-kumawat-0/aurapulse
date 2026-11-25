// ============================================
// FamilyAdviceCard — Proper Action Plan Layout
// ============================================
import { useUser } from '../../context/UserContext.jsx';
import { useAqi } from '../../context/AqiContext.jsx';
import { getRiskColor } from '../../utils/aqiColorMapper.js';
import './FamilyAdviceCard.css';

const RISK_INFO = {
  LOW: { label: 'Low Risk', icon: '🟢', desc: 'Normal activities OK' },
  MODERATE: { label: 'Moderate', icon: '🟡', desc: 'Sensitive groups take care' },
  HIGH: { label: 'High Risk', icon: '🟠', desc: 'Limit outdoor exposure' },
  SEVERE: { label: 'Severe', icon: '🔴', desc: 'Stay indoors' },
};

function FamilyAdviceCard() {
  const { location, familyMembers, homeProfile, language } = useUser();
  const { adviceData, currentAqi, loading, loadAdvice } = useAqi();

  const handleGenerate = () => {
    if (!location) return;
    loadAdvice({
      lat: location.lat,
      lng: location.lng,
      family_members: familyMembers,
      home_profile: homeProfile,
      language,
    });
  };

  const hasAdvice = adviceData?.advice;

  return (
    <div className="card advice-card">
      <div className="advice-header">
        <div className="advice-header-left">
          <h3 className="advice-title">🤖 AI Action Plan</h3>
          {hasAdvice && <span className="advice-ready-badge">✓ Generated</span>}
        </div>
        <button className="advice-gen-btn" onClick={handleGenerate}
          disabled={loading || !location || !currentAqi || familyMembers.length === 0}>
          {loading ? (
            <><span className="advice-spin" /> Generating...</>
          ) : hasAdvice ? (
            '🔄 Regenerate'
          ) : (
            '⚡ Generate Plan'
          )}
        </button>
      </div>

      {/* ── Empty / Prerequisite State ── */}
      {!hasAdvice && !loading && (
        <div className="advice-empty">
          {!currentAqi ? (
            <><span className="advice-empty-icon">📍</span><p>Detect your location first to get air quality data</p></>
          ) : familyMembers.length === 0 ? (
            <><span className="advice-empty-icon">👨‍👩‍👧</span><p>Add family members above, then generate a personalized plan</p></>
          ) : (
            <><span className="advice-empty-icon">🤖</span><p>Click <strong>Generate Plan</strong> to get personalized advice for each family member based on current air quality</p></>
          )}
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="advice-loading">
          <span className="advice-loading-icon">🤖</span>
          <p>Analyzing air quality and health profiles...</p>
        </div>
      )}

      {/* ── Results ── */}
      {hasAdvice && !loading && (
        <div className="advice-results">
          {/* Overall Summary */}
          {adviceData.advice.overall_summary && (
            <div className="advice-summary">
              <div className="advice-summary-icon">📋</div>
              <div className="advice-summary-text">
                <span className="advice-summary-label">Summary</span>
                <p>{adviceData.advice.overall_summary}</p>
              </div>
            </div>
          )}

          {/* Per-Member Advice Cards */}
          {adviceData.advice.family_advice && (
            <div className="advice-members">
              <span className="advice-section-title">Individual Action Plans</span>
              <div className="advice-members-grid">
                {adviceData.advice.family_advice.map((card, i) => {
                  const riskColor = getRiskColor(card.risk_level);
                  const riskInfo = RISK_INFO[card.risk_level] || RISK_INFO.MODERATE;
                  return (
                    <div key={i} className="advice-member-card"
                      style={{ borderTopColor: riskColor }}>
                      <div className="advice-member-top">
                        <div className="advice-member-identity">
                          <span className="advice-member-name">{card.member_name}</span>
                          {card.member_age && (
                            <span className="advice-member-age">{card.member_age} years</span>
                          )}
                        </div>
                        <div className="advice-member-risk"
                          style={{ background: `${riskColor}15`, color: riskColor, borderColor: `${riskColor}40` }}>
                          <span>{riskInfo.icon}</span>
                          <span>{riskInfo.label}</span>
                        </div>
                      </div>

                      <div className="advice-member-action">
                        <span className="advice-member-action-label">Primary Action</span>
                        <p>{card.primary_action}</p>
                      </div>

                      {card.secondary_actions && card.secondary_actions.length > 0 && (
                        <div className="advice-member-secondary">
                          {card.secondary_actions.map((action, j) => (
                            <div key={j} className="advice-member-tip">
                              <span className="advice-tip-dot" style={{ background: riskColor }} />
                              {action}
                            </div>
                          ))}
                        </div>
                      )}

                      {card.safe_window && (
                        <div className="advice-member-window">
                          <span>🕐</span> Safe outdoor window: <strong>{card.safe_window}</strong>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* General Tips */}
          {adviceData.advice.general_tips && adviceData.advice.general_tips.length > 0 && (
            <div className="advice-tips">
              <span className="advice-section-title">💡 General Tips</span>
              <div className="advice-tips-list">
                {adviceData.advice.general_tips.map((tip, i) => (
                  <div key={i} className="advice-tip-item">
                    <span className="advice-tip-num">{i + 1}</span>
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FamilyAdviceCard;
