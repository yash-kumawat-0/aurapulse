// ============================================
// FamilyAdviceCard — Compact Advice Cards
// ============================================
import { useUser } from '../../context/UserContext.jsx';
import { useAqi } from '../../context/AqiContext.jsx';
import { getRiskColor } from '../../utils/aqiColorMapper.js';
import './FamilyAdviceCard.css';

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

  return (
    <div className="card advice-section">
      <button
        className="advice-btn"
        onClick={handleGenerate}
        disabled={loading || !location || !currentAqi}
      >
        {loading ? '🤖 Generating...' : '🤖 Generate AI Action Plan'}
      </button>

      {adviceData?.advice?.overall_summary && (
        <div className="advice-summary">
          {adviceData.advice.overall_summary}
        </div>
      )}

      {adviceData?.advice?.family_advice && (
        <div className="advice-grid">
          {adviceData.advice.family_advice.map((card, i) => {
            const riskColor = getRiskColor(card.risk_level);
            return (
              <div key={i} className="advice-item">
                <div className="advice-item-top">
                  <span className="advice-name">{card.member_name}</span>
                  <span className="advice-risk" style={{ background: `${riskColor}18`, color: riskColor }}>
                    {card.risk_level}
                  </span>
                </div>
                <p className="advice-action">{card.primary_action}</p>
              </div>
            );
          })}
        </div>
      )}

      {!adviceData && !loading && currentAqi && (
        <p className="advice-hint">Generate personalized advice for your family using Gemini AI.</p>
      )}
    </div>
  );
}

export default FamilyAdviceCard;
