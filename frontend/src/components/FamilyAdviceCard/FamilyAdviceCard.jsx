// ============================================
// FamilyAdviceCard — 3D Shield Diorama, Safe Budget & Symptom Panel
// ============================================
import { useEffect, useState } from 'react';
import { useUser } from '../../context/UserContext.jsx';
import { useAqi } from '../../context/AqiContext.jsx';
import { getRiskColor } from '../../utils/aqiColorMapper.js';
import SymptomDetectivePanel from './SymptomDetectivePanel.jsx';
import './FamilyAdviceCard.css';

const RISK_INFO = {
  LOW: { label: 'Safe', icon: '🟢', tint: '#F0FDF4' },
  MODERATE: { label: 'Moderate Care', icon: '🟡', tint: '#FFFBEB' },
  HIGH: { label: 'High Risk', icon: '🟠', tint: '#FFF7ED' },
  SEVERE: { label: 'Stay Indoors', icon: '🔴', tint: '#FEF2F2' },
};

const SCENE_CONFIG = {
  STAY_INDOORS_SEALED: {
    mainEmoji: '🏠',
    badgeEmoji: '🪟🔒',
    label: 'Keep Windows Shut',
    bg: 'linear-gradient(135deg, #DBEAFE 0%, #EFF6FF 100%)',
    particleClass: 'adv-diorama--calm',
  },
  MASK_UP_OUTSIDE: {
    mainEmoji: '😷',
    badgeEmoji: '🛡️',
    label: 'Wear Sealed N95',
    bg: 'linear-gradient(135deg, #FEF3C7 0%, #FFFBEB 100%)',
    particleClass: 'adv-diorama--warn',
  },
  SAFE_GREEN_WALK: {
    mainEmoji: '🌳',
    badgeEmoji: '☀️',
    label: 'Safe Fresh Breeze',
    bg: 'linear-gradient(135deg, #DCFCE7 0%, #F0FDF4 100%)',
    particleClass: 'adv-diorama--clean',
  },
  RUN_AIR_PURIFIER: {
    mainEmoji: '🌀',
    badgeEmoji: '✨',
    label: 'Purify Room Air',
    bg: 'linear-gradient(135deg, #E0F2FE 0%, #F0FDF4 100%)',
    particleClass: 'adv-diorama--clean',
  },
  KEEP_INHALER_READY: {
    mainEmoji: '🚨',
    badgeEmoji: '💊',
    label: 'Inhaler Ready · Indoors',
    bg: 'linear-gradient(135deg, #FEE2E2 0%, #FFF7ED 100%)',
    particleClass: 'adv-diorama--danger',
  },
};

function getMemberIcon(age) {
  if (age <= 5) return '👶';
  if (age <= 12) return '🧒';
  if (age > 60) return '👴';
  return '🧑';
}

function FamilyAdviceCard() {
  const { location, familyMembers, homeProfile, language, selectedMemberId, setSelectedMemberId } = useUser();
  const {
    adviceData,
    currentAqi,
    indoorData,
    commuteData,
    symptomResult,
    loading,
    loadAdvice,
    checkSymptom,
  } = useAqi();

  const [symLoading, setSymLoading] = useState(false);

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

  const handleSymptomCheck = async (symLabel, customTxt) => {
    if (!location) return;
    setSymLoading(true);
    await checkSymptom({
      lat: location.lat,
      lng: location.lng,
      location_label: location.label,
      member: selectedMember,
      symptom: symLabel,
      custom_symptom: customTxt,
      home_profile: homeProfile,
      commute_comparison: commuteData,
      language,
    });
    setSymLoading(false);
  };

  const tips = activePlan?.detailed_tips || activePlan?.secondary_actions || [];
  const stickers = activePlan?.sticker_badges || [];
  const riskColor = activePlan ? getRiskColor(activePlan.risk_level) : '#64748B';
  const riskInfo = activePlan ? RISK_INFO[activePlan.risk_level] || RISK_INFO.MODERATE : RISK_INFO.MODERATE;
  const sceneKey = activePlan?.action_visual_scene || 'STAY_INDOORS_SEALED';
  const scene = SCENE_CONFIG[sceneKey] || SCENE_CONFIG.STAY_INDOORS_SEALED;

  const cleanestWindow = adviceData?.calculated_data?.cleanest_window;
  const cleanestLabel =
    activePlan?.best_outdoor_time ||
    (cleanestWindow?.start_label ? `${cleanestWindow.start_label}–${cleanestWindow.end_label}` : null);

  const safeBudgetUg = activePlan?.safe_budget_ug || 100;
  const roomPm =
    indoorData?.diy_simulation?.indoor_pm25 ??
    adviceData?.calculated_data?.indoor_pm25 ??
    currentAqi?.pm25 ??
    60;
  const commuteDose = commuteData?.safest_route_summary?.dose_ug ?? 0;
  const estDailyDose = Math.round(commuteDose + roomPm * 0.45);
  const budgetPct = Math.min(100, Math.round((estDailyDose / Math.max(safeBudgetUg, 1)) * 100));
  const overBudget = estDailyDose > safeBudgetUg;

  return (
    <div className="card advice-card">
      <div className="advice-header">
        <div className="advice-header-left">
          <h2 className="advice-title">🤖 Family 3D Air Shield</h2>
          {hasAdvice && (
            <span className={`advice-ai-tag ${adviceData?.ai_powered ? 'advice-ai-tag--live' : ''}`}>
              {adviceData?.ai_powered ? '✨ Gemini AI' : '✓ Ready'}
            </span>
          )}
        </div>
        <button
          type="button"
          className="advice-gen-btn"
          onClick={handleGenerate}
          disabled={loading || !location || !currentAqi || familyMembers.length === 0}
        >
          {loading ? (
            <>
              <span className="advice-spin" aria-hidden="true" /> Analyzing...
            </>
          ) : hasAdvice ? (
            '🔄 Refresh AI Shield'
          ) : (
            '⚡ Generate 3D Shield Plan'
          )}
        </button>
      </div>

      {!hasAdvice && !loading && (
        <div className="advice-empty">
          {!currentAqi ? (
            <>
              <span className="advice-empty-icon advice-float-icon" aria-hidden="true">
                📍
              </span>
              <p>Pick a city first</p>
            </>
          ) : familyMembers.length === 0 ? (
            <>
              <span className="advice-empty-icon advice-float-icon" aria-hidden="true">
                👨‍👩‍👧
              </span>
              <p>Add a family member above</p>
            </>
          ) : (
            <>
              <span className="advice-empty-icon advice-float-icon" aria-hidden="true">
                🛡️
              </span>
              <p>
                Tap <strong>Generate 3D Shield Plan</strong> for live shields &amp; safe daily lung budget
              </p>
            </>
          )}
        </div>
      )}

      {loading && (
        <div className="advice-loading" role="status">
          <span className="advice-loading-icon" aria-hidden="true">
            ✨
          </span>
          <p>Building 3D personal air shields &amp; budgets...</p>
        </div>
      )}

      {hasAdvice && !loading && (
        <div className="advice-results" aria-live="polite">
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
                const plan =
                  memberPlans.find((c) => c.member_name?.toLowerCase() === m.name?.toLowerCase()) ||
                  memberPlans[idx];
                const pColor = plan ? getRiskColor(plan.risk_level) : '#64748B';
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
                    <span className="advice-person-emoji" aria-hidden="true">
                      {getMemberIcon(m.age)}
                    </span>
                    <span className="advice-person-tab-name">{m.name}</span>
                    <span className="advice-person-dot" style={{ background: pColor }} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          )}

          {activePlan && (
            <div className="advice-single-card" style={{ borderColor: riskColor, borderTopColor: riskColor }}>
              <div className="advice-single-head">
                <div className="advice-single-who">
                  <span
                    className="advice-single-avatar"
                    style={{ background: `${riskColor}18` }}
                    aria-hidden="true"
                  >
                    {getMemberIcon(selectedMember?.age || 30)}
                  </span>
                  <div>
                    <h3 className="advice-single-name">{activePlan.member_name || selectedMember?.name}</h3>
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
                  <span aria-hidden="true">{riskInfo.icon}</span>
                  <span>{riskInfo.label}</span>
                </div>
              </div>

              <div className="advice-visual-stage">
                <div className={`adv-diorama ${scene.particleClass}`} style={{ background: scene.bg }}>
                  <div
                    className="adv-diorama-ring"
                    style={{ borderColor: `${riskColor}66` }}
                    aria-hidden="true"
                  />
                  <div className="adv-diorama-core" aria-hidden="true">
                    <span className="adv-diorama-main">{scene.mainEmoji}</span>
                    <span className="adv-diorama-badge">{scene.badgeEmoji}</span>
                  </div>
                  <div className="adv-diorama-caption" style={{ color: riskColor }}>
                    {scene.label}
                  </div>
                </div>

                <div className="adv-budget-box">
                  <div className="adv-budget-top">
                    <span>🫁 Daily Lung Budget</span>
                    <strong style={{ color: overBudget ? '#B91C1C' : '#15803D' }}>
                      {estDailyDose} / {safeBudgetUg} µg
                    </strong>
                  </div>
                  <div className="adv-budget-track">
                    <div
                      className="adv-budget-fill"
                      style={{
                        width: `${budgetPct}%`,
                        background: overBudget ? '#EF4444' : '#10B981',
                      }}
                    />
                  </div>
                  <div className="adv-budget-foot">
                    <span>
                      {overBudget ? '🚨 Exceeds limit — purify/mask!' : '🛡️ Within safe daily lung quota'}
                    </span>
                    {cleanestLabel && <strong>⏰ {cleanestLabel}</strong>}
                  </div>
                </div>
              </div>

              <div className="advice-single-main" style={{ background: riskInfo.tint }}>
                <span className="advice-single-label">⚡ Instant Action</span>
                <p>{activePlan.primary_action}</p>
              </div>

              {stickers.length > 0 && (
                <div className="advice-visual-stickers">
                  {stickers.map((st, sIdx) => (
                    <span key={sIdx} className="advice-vsticker">
                      <span className="advice-vsticker-emoji" aria-hidden="true">
                        {st.emoji}
                      </span>
                      <span>{st.tag}</span>
                    </span>
                  ))}
                </div>
              )}

              {tips.length > 0 && (
                <div className="advice-chip-actions">
                  {tips.map((tip, idx) => (
                    <span key={idx} className="advice-action-chip">
                      <span className="advice-chip-num" style={{ background: riskColor }}>
                        {idx + 1}
                      </span>
                      <span>{tip}</span>
                    </span>
                  ))}
                </div>
              )}

              <SymptomDetectivePanel
                onCheckSymptom={handleSymptomCheck}
                symptomResult={symptomResult}
                loading={symLoading}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FamilyAdviceCard;
