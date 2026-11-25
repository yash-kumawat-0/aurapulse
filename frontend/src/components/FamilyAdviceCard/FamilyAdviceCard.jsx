// ============================================
// FamilyAdviceCard — Separate Plan Per Person
// Click any person tab (or card above) to view
// ONLY their clear, uncluttered personal plan.
// ============================================
import { useEffect } from 'react';
import { useUser } from '../../context/UserContext.jsx';
import { useAqi } from '../../context/AqiContext.jsx';
import { getRiskColor } from '../../utils/aqiColorMapper.js';
import './FamilyAdviceCard.css';

const RISK_INFO = {
  LOW: { label: 'Low Risk · Safe', icon: '🟢', tint: '#F0FDF4' },
  MODERATE: { label: 'Moderate · Take Care', icon: '🟡', tint: '#FFFBEB' },
  HIGH: { label: 'High Risk · Limit Outdoor', icon: '🟠', tint: '#FFF7ED' },
  SEVERE: { label: 'Severe · Stay Indoors', icon: '🔴', tint: '#FEF2F2' },
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
  const { adviceData, currentAqi, loading, loadAdvice } = useAqi();

  // Keep selectedMemberId valid if members list changes
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
      family_members: familyMembers,
      home_profile: homeProfile,
      language,
    });
  };

  const hasAdvice = adviceData?.advice;
  const memberPlans = hasAdvice?.family_advice || [];
  const selectedMember = familyMembers.find((m) => m.id === selectedMemberId) || familyMembers[0];

  // Match advice entry by name (case-insensitive) or fallback index
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
    ? `${cleanestWindow.start_label} – ${cleanestWindow.end_label}`
    : activePlan?.safe_window || null;

  return (
    <div className="card advice-card">
      <div className="advice-header">
        <div className="advice-header-left">
          <h3 className="advice-title">🤖 Personal Action Plan</h3>
          {hasAdvice && <span className="advice-ready-badge">✓ Ready</span>}
        </div>
        <button className="advice-gen-btn" onClick={handleGenerate}
          disabled={loading || !location || !currentAqi || familyMembers.length === 0}>
          {loading ? (
            <><span className="advice-spin" /> Generating...</>
          ) : hasAdvice ? (
            '🔄 Update Plan'
          ) : (
            '⚡ Generate Plan'
          )}
        </button>
      </div>

      {/* ── Empty / Prerequisite State ── */}
      {!hasAdvice && !loading && (
        <div className="advice-empty">
          {!currentAqi ? (
            <><span className="advice-empty-icon">📍</span><p>Detect your location first to load air quality data</p></>
          ) : familyMembers.length === 0 ? (
            <><span className="advice-empty-icon">👨‍👩‍👧</span><p>Add family members above to build personalized plans</p></>
          ) : (
            <><span className="advice-empty-icon">🤖</span><p>Click <strong>Generate Plan</strong>, then tap any person to read their simple step-by-step plan.</p></>
          )}
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="advice-loading">
          <span className="advice-loading-icon">🤖</span>
          <p>Preparing each person&apos;s plan...</p>
        </div>
      )}

      {/* ── Focused Separate View Per Person ── */}
      {hasAdvice && !loading && (
        <div className="advice-results">
          {/* Concise Overall Line */}
          {hasAdvice.overall_summary && (
            <div className="advice-summary">
              <span className="advice-summary-icon">📋</span>
              <p>{hasAdvice.overall_summary}</p>
            </div>
          )}

          {/* Clickable Person Selector Pills */}
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

          {/* Selected Person's Dedicated Clear Plan */}
          {activePlan && (
            <div
              className="advice-single-card"
              style={{ borderColor: riskColor, borderTopColor: riskColor }}
            >
              <div className="advice-single-head">
                <div className="advice-single-who">
                  <span className="advice-single-avatar" style={{ background: `${riskColor}18` }}>
                    {getMemberIcon(selectedMember?.age || 30)}
                  </span>
                  <div>
                    <h4 className="advice-single-name">{activePlan.member_name || selectedMember?.name}</h4>
                    <span className="advice-single-sub">
                      {selectedMember ? `${selectedMember.age} years` : ''}
                      {selectedMember?.health_condition && selectedMember.health_condition !== 'NONE'
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

              {/* Primary Action Callout */}
              <div className="advice-single-main" style={{ background: riskInfo.tint }}>
                <span className="advice-single-label">What To Do Today</span>
                <p>{activePlan.primary_action}</p>
              </div>

              {/* Clear Bullet Steps */}
              {tips.length > 0 && (
                <div className="advice-single-tips">
                  <span className="advice-single-label">Simple Steps</span>
                  <ul className="advice-single-list">
                    {tips.map((tip, idx) => (
                      <li key={idx}>
                        <span className="advice-single-num" style={{ background: riskColor }}>{idx + 1}</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Bottom Concise Window + Home/Travel Note */}
              <div className="advice-single-foot">
                {cleanestLabel && (
                  <div className="advice-foot-chip advice-foot-chip--time">
                    🕒 Safe Outdoor Time: <strong>{cleanestLabel}</strong>
                  </div>
                )}
                {hasAdvice.ventilation_advice && (
                  <div className="advice-foot-chip">
                    🪟 {hasAdvice.ventilation_advice}
                  </div>
                )}
                {hasAdvice.commute_advice && (
                  <div className="advice-foot-chip">
                    🚗 {hasAdvice.commute_advice}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FamilyAdviceCard;
