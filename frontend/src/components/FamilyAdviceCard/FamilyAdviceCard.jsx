// ============================================
// FamilyAdviceCard — Visual Stickers & Separate Plan Per Person
// ============================================
import { useEffect } from 'react';
import { useUser } from '../../context/UserContext.jsx';
import { useAqi } from '../../context/AqiContext.jsx';
import { getRiskColor } from '../../utils/aqiColorMapper.js';
import './FamilyAdviceCard.css';

const RISK_INFO = {
  LOW: { label: 'Safe', icon: '🟢', tint: '#F0FDF4' },
  MODERATE: { label: 'Moderate Care', icon: '🟡', tint: '#FFFBEB' },
  HIGH: { label: 'High Risk', icon: '🟠', tint: '#FFF7ED' },
  SEVERE: { label: 'Stay Indoors', icon: '🔴', tint: '#FEF2F2' },
};

function getMemberIcon(age) {
  if (age <= 5) return '👶';
  if (age <= 12) return '🧒';
  if (age > 60) return '👴';
  return '🧑';
}

function FamilyAdviceCard() {
  const {
    location,
    familyMembers,
    homeProfile,
    language,
    selectedMemberId,
    setSelectedMemberId,
  } = useUser();
  const { adviceData, currentAqi, commuteData, loading, loadAdvice } = useAqi();

  useEffect(() => {
    if (familyMembers.length > 0 && !familyMembers.some((m) => m.id === selectedMemberId)) {
      setSelectedMemberId(familyMembers[0].id);
    }
  }, [familyMembers, selectedMemberId, setSelectedMemberId]);

  const handleGenerate = () => {
    if (!location) return;
    loadAdvice({
      lat: location.lat,
      lng: location.lng,
      location_label: location.label,
      family_members: familyMembers,
      home_profile: homeProfile,
      commute_comparison: commuteData,
      language,
    });
  };

  const hasAdvice = adviceData?.advice;
  const memberPlans = hasAdvice?.family_advice || [];
  const selectedMember = familyMembers.find((m) => m.id === selectedMemberId) || familyMembers[0];

  const activePlan = selectedMember
    ? memberPlans.find((c) => c.member_name?.toLowerCase() === selectedMember.name?.toLowerCase()) ||
      memberPlans[familyMembers.findIndex((m) => m.id === selectedMember.id)] ||
      memberPlans[0]
    : memberPlans[0];

  const tips = activePlan?.detailed_tips || activePlan?.secondary_actions || [];
  const riskColor = activePlan ? getRiskColor(activePlan.risk_level) : '#64748B';
  const riskInfo = activePlan ? (RISK_INFO[activePlan.risk_level] || RISK_INFO.MODERATE) : RISK_INFO.MODERATE;
  const cleanestWindow = adviceData?.calculated_data?.cleanest_window;
  const cleanestLabel = cleanestWindow?.start_label
    ? `${cleanestWindow.start_label}–${cleanestWindow.end_label}`
    : activePlan?.safe_window || null;

  return (
    <div className="card advice-card">
      <div className="advice-header">
        <div className="advice-header-left">
          <h3 className="advice-title">🤖 Family Air Shield</h3>
          {hasAdvice && (
            <span className={`advice-ai-tag ${adviceData?.ai_powered ? 'advice-ai-tag--live' : ''}`}>
              {adviceData?.ai_powered ? '✨ Gemini AI' : '✓ Ready'}
            </span>
          )}
        </div>
        <button
          className="advice-gen-btn"
          onClick={handleGenerate}
          disabled={loading || !location || !currentAqi || familyMembers.length === 0}
        >
          {loading ? (
            <><span className="advice-spin" /> Analyzing...</>
          ) : hasAdvice ? (
            '🔄 Refresh AI Plan'
          ) : (
            '⚡ Generate AI Plan'
          )}
        </button>
      </div>

      {!hasAdvice && !loading && (
        <div className="advice-empty">
          {!currentAqi ? (
            <><span className="advice-empty-icon advice-float-icon">📍</span><p>Pick a city first</p></>
          ) : familyMembers.length === 0 ? (
            <><span className="advice-empty-icon advice-float-icon">👨‍👩‍👧</span><p>Add a family member above</p></>
          ) : (
            <><span className="advice-empty-icon advice-float-icon">🛡️</span><p>Tap <strong>Generate AI Plan</strong> for instant visual cards</p></>
          )}
        </div>
      )}

      {loading && (
        <div className="advice-loading">
          <span className="advice-loading-icon">✨</span>
          <p>Building personal air shields...</p>
        </div>
      )}

      {hasAdvice && !loading && (
        <div className="advice-results">
          {/* Quick Visual Stickers Strip instead of dense prose */}
          <div className="advice-sticker-bar">
            {cleanestLabel && (
              <span className="advice-sticker advice-sticker--good">🕒 Outside: {cleanestLabel}</span>
            )}
            {hasAdvice.ventilation_advice && (
              <span className="advice-sticker">🪟 {hasAdvice.ventilation_advice}</span>
            )}
            {hasAdvice.commute_advice && (
              <span className="advice-sticker">🚇 {hasAdvice.commute_advice}</span>
            )}
          </div>

          {familyMembers.length > 0 && (
            <div className="advice-person-tabs" role="tablist" aria-label="Select family member plan">
              {familyMembers.map((m, idx) => {
                const plan = memberPlans.find((c) => c.member_name?.toLowerCase() === m.name?.toLowerCase()) || memberPlans[idx];
                const pColor = plan ? getRiskColor(plan.risk_level) : '#94A3B8';
                const active = selectedMember?.id === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`advice-person-tab ${active ? 'advice-person-tab--active' : ''}`}
                    style={active ? { borderColor: pColor, background: `${pColor}14` } : undefined}
                    onClick={() => setSelectedMemberId(m.id)}
                  >
                    <span className="advice-person-emoji">{getMemberIcon(m.age)}</span>
                    <span className="advice-person-tab-name">{m.name}</span>
                    <span className="advice-person-dot" style={{ background: pColor }} />
                  </button>
                );
              })}
            </div>
          )}

          {activePlan && (
            <div className="advice-single-card" style={{ borderColor: riskColor, borderTopColor: riskColor }}>
              <div className="advice-single-head">
                <div className="advice-single-who">
                  <span className="advice-single-avatar" style={{ background: `${riskColor}18` }}>
                    {getMemberIcon(selectedMember?.age || 30)}
                  </span>
                  <div>
                    <h4 className="advice-single-name">{activePlan.member_name || selectedMember?.name}</h4>
                    <span className="advice-single-sub">
                      {selectedMember ? `${selectedMember.age} yrs` : ''}
                      {selectedMember?.health_condition === 'OTHER' && selectedMember?.custom_issue
                        ? ` · ${selectedMember.custom_issue}`
                        : selectedMember?.health_condition && selectedMember.health_condition !== 'NONE'
                          ? ` · ${selectedMember.health_condition.replace(/_/g, ' ')}`
                          : ''}
                    </span>
                  </div>
                </div>

                <div
                  className="advice-single-risk"
                  style={{ background: riskInfo.tint, color: riskColor, borderColor: `${riskColor}50` }}
                >
                  <span>{riskInfo.icon}</span>
                  <span>{riskInfo.label}</span>
                </div>
              </div>

              <div className="advice-single-main" style={{ background: riskInfo.tint }}>
                <span className="advice-single-label">⚡ Priority Shield</span>
                <p>{activePlan.primary_action}</p>
              </div>

              {tips.length > 0 && (
                <div className="advice-chip-actions">
                  {tips.map((tip, idx) => (
                    <span key={idx} className="advice-action-chip">
                      <span className="advice-chip-num" style={{ background: riskColor }}>{idx + 1}</span>
                      <span>{tip}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FamilyAdviceCard;
