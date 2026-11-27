// ============================================
// FamilyProfileList — Accessible Clickable Member Cards
// Includes custom "Other" health issue field
// ============================================
import { useState } from 'react';
import { useUser } from '../../context/UserContext.jsx';
import './FamilyProfileList.css';

const CONDITIONS = [
  { value: 'NONE', label: 'Healthy', emoji: '💪', color: '#4CAF50', bg: '#E8F5E9' },
  { value: 'ASTHMA', label: 'Asthma', emoji: '🫁', color: '#FF9800', bg: '#FFF3E0' },
  { value: 'COPD', label: 'COPD', emoji: '🫁', color: '#F44336', bg: '#FFEBEE' },
  { value: 'HEART_CONDITION', label: 'Heart', emoji: '❤️', color: '#E91E63', bg: '#FCE4EC' },
  { value: 'PREGNANT', label: 'Pregnant', emoji: '🤰', color: '#9C27B0', bg: '#F3E5F5' },
  { value: 'INFANT', label: 'Infant', emoji: '👶', color: '#2196F3', bg: '#E3F2FD' },
  { value: 'OTHER', label: 'Other', emoji: '📝', color: '#0284C7', bg: '#E0F2FE' },
];

function getAgeGroup(age) {
  if (age <= 5) return { label: 'Toddler', icon: '👶' };
  if (age <= 12) return { label: 'Child', icon: '🧒' };
  if (age <= 17) return { label: 'Teen', icon: '🧑' };
  if (age <= 60) return { label: 'Adult', icon: '🧑' };
  return { label: 'Senior', icon: '👴' };
}

function FamilyProfileList() {
  const {
    familyMembers,
    addFamilyMember,
    removeFamilyMember,
    selectedMemberId,
    setSelectedMemberId,
  } = useUser();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [condition, setCondition] = useState('NONE');
  const [customIssue, setCustomIssue] = useState('');

  const handleAdd = (e) => {
    e.preventDefault();
    if (!name.trim() || !age) return;
    if (condition === 'OTHER' && !customIssue.trim()) return;
    addFamilyMember({
      name: name.trim(),
      age: parseInt(age, 10),
      health_condition: condition,
      custom_issue: condition === 'OTHER' ? customIssue.trim() : '',
    });
    setName('');
    setAge('');
    setCondition('NONE');
    setCustomIssue('');
    setAdding(false);
  };

  const getCondInfo = (c) => CONDITIONS.find((x) => x.value === c) || CONDITIONS[0];

  return (
    <div className="card family-card">
      <div className="family-header">
        <div className="family-header-left">
          <h3 className="family-title">👨‍👩‍👧 Family Members</h3>
          <span className="family-count">
            {familyMembers.length} member{familyMembers.length !== 1 ? 's' : ''} · tap for plan
          </span>
        </div>
        <button
          type="button"
          className="family-add-toggle"
          aria-expanded={adding}
          onClick={() => setAdding(!adding)}
        >
          {adding ? '✕ Cancel' : '+ Add Member'}
        </button>
      </div>

      {adding && (
        <form className="family-form" onSubmit={handleAdd}>
          <div className="family-form-row">
            <div className="family-form-field">
              <label className="family-form-label" htmlFor="member-name-input">Name</label>
              <input
                id="member-name-input"
                type="text"
                placeholder="e.g. Priya"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="family-form-field family-form-field--small">
              <label className="family-form-label" htmlFor="member-age-input">Age</label>
              <input
                id="member-age-input"
                type="number"
                placeholder="25"
                min="0"
                max="120"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="family-form-field">
            <span className="family-form-label">Health Condition</span>
            <div className="family-cond-grid" role="group" aria-label="Health Condition">
              {CONDITIONS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  aria-pressed={condition === c.value}
                  className={`family-cond-btn ${condition === c.value ? 'family-cond-btn--on' : ''}`}
                  style={condition === c.value ? { borderColor: c.color, background: c.bg } : {}}
                  onClick={() => setCondition(c.value)}
                >
                  <span aria-hidden="true">{c.emoji}</span>
                  <span className="family-cond-name">{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          {condition === 'OTHER' && (
            <div className="family-form-field">
              <label className="family-form-label" htmlFor="member-custom-issue-input">
                Specify Other Health Issue
              </label>
              <input
                id="member-custom-issue-input"
                type="text"
                placeholder="e.g. Dust allergy, Sinusitis, Bronchitis, Migraine..."
                value={customIssue}
                onChange={(e) => setCustomIssue(e.target.value)}
                required
                autoFocus
              />
            </div>
          )}

          <button type="submit" className="family-form-submit">+ Add to Family</button>
        </form>
      )}

      <div className="family-members-grid">
        {familyMembers.map((m) => {
          const cond = getCondInfo(m.health_condition);
          const ageGroup = getAgeGroup(m.age);
          const isVulnerable = m.health_condition !== 'NONE' || m.age < 6 || m.age > 65;
          const isSelected = selectedMemberId === m.id;
          const badgeLabel = m.health_condition === 'OTHER' && m.custom_issue
            ? m.custom_issue
            : cond.label;

          return (
            <article
              key={m.id}
              className={`family-member-card ${isVulnerable ? 'family-member-card--vulnerable' : ''} ${isSelected ? 'family-member-card--selected' : ''}`}
              style={{ borderLeftColor: cond.color }}
            >
              <button
                type="button"
                className="family-member-select-btn"
                aria-pressed={isSelected}
                onClick={() => setSelectedMemberId(m.id)}
              >
                <div className="family-member-avatar" style={{ background: cond.bg }}>
                  <span aria-hidden="true">{ageGroup.icon}</span>
                </div>
                <div className="family-member-info">
                  <span className="family-member-name">{m.name}</span>
                  <span className="family-member-age">{m.age} yrs · {ageGroup.label}</span>
                </div>
                <div className="family-member-cond" style={{ background: cond.bg, color: cond.color }}>
                  <span aria-hidden="true">{cond.emoji}</span> {badgeLabel}
                </div>
                {isSelected ? (
                  <span className="family-member-selected">✓ Viewing Plan</span>
                ) : isVulnerable ? (
                  <span className="family-member-vuln">⚠️ Sensitive</span>
                ) : null}
              </button>
              <button
                type="button"
                className="family-member-remove"
                onClick={() => removeFamilyMember(m.id)}
                aria-label={`Remove ${m.name}`}
                title={`Remove ${m.name}`}
              >
                ✕
              </button>
            </article>
          );
        })}
      </div>

      {familyMembers.length === 0 && (
        <div className="family-empty">
          <span className="family-empty-icon" aria-hidden="true">👨‍👩‍👧‍👦</span>
          <p>Add family members for personalized plans</p>
        </div>
      )}
    </div>
  );
}

export default FamilyProfileList;
