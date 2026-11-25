// ============================================
// FamilyProfileList — Clickable Member Cards
// Clicking a member opens/focuses their personal plan.
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

  const handleAdd = (e) => {
    e.preventDefault();
    if (!name.trim() || !age) return;
    addFamilyMember({ name: name.trim(), age: parseInt(age, 10), health_condition: condition });
    setName('');
    setAge('');
    setCondition('NONE');
    setAdding(false);
  };

  const getCondInfo = (c) => CONDITIONS.find((x) => x.value === c) || CONDITIONS[0];

  return (
    <div className="card family-card">
      <div className="family-header">
        <div className="family-header-left">
          <h3 className="family-title">👨‍👩‍👧 Family Members</h3>
          <span className="family-count">{familyMembers.length} member{familyMembers.length !== 1 ? 's' : ''} · click any person for their plan</span>
        </div>
        <button className="family-add-toggle" onClick={() => setAdding(!adding)}>
          {adding ? '✕ Cancel' : '+ Add Member'}
        </button>
      </div>

      {/* ── Add Member Form ── */}
      {adding && (
        <form className="family-form" onSubmit={handleAdd}>
          <div className="family-form-row">
            <div className="family-form-field">
              <label className="family-form-label">Name</label>
              <input type="text" placeholder="e.g. Priya" value={name}
                onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="family-form-field family-form-field--small">
              <label className="family-form-label">Age</label>
              <input type="number" placeholder="25" min="0" max="120" value={age}
                onChange={(e) => setAge(e.target.value)} required />
            </div>
          </div>
          <div className="family-form-field">
            <label className="family-form-label">Health Condition</label>
            <div className="family-cond-grid">
              {CONDITIONS.map((c) => (
                <button key={c.value} type="button"
                  className={`family-cond-btn ${condition === c.value ? 'family-cond-btn--on' : ''}`}
                  style={condition === c.value ? { borderColor: c.color, background: c.bg } : {}}
                  onClick={() => setCondition(c.value)}>
                  <span>{c.emoji}</span>
                  <span className="family-cond-name">{c.label}</span>
                </button>
              ))}
            </div>
          </div>
          <button type="submit" className="family-form-submit">+ Add to Family</button>
        </form>
      )}

      {/* ── Clickable Member Cards Grid ── */}
      <div className="family-members-grid">
        {familyMembers.map((m) => {
          const cond = getCondInfo(m.health_condition);
          const ageGroup = getAgeGroup(m.age);
          const isVulnerable = m.health_condition !== 'NONE' || m.age < 6 || m.age > 65;
          const isSelected = selectedMemberId === m.id;
          return (
            <div
              key={m.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedMemberId(m.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedMemberId(m.id); }}
              className={`family-member-card ${isVulnerable ? 'family-member-card--vulnerable' : ''} ${isSelected ? 'family-member-card--selected' : ''}`}
              style={{ borderLeftColor: cond.color }}
            >
              <button
                type="button"
                className="family-member-remove"
                onClick={(e) => { e.stopPropagation(); removeFamilyMember(m.id); }}
                title="Remove member"
              >
                ✕
              </button>
              <div className="family-member-avatar" style={{ background: cond.bg }}>
                <span>{ageGroup.icon}</span>
              </div>
              <div className="family-member-info">
                <span className="family-member-name">{m.name}</span>
                <span className="family-member-age">{m.age} years · {ageGroup.label}</span>
              </div>
              <div className="family-member-cond" style={{ background: cond.bg, color: cond.color }}>
                {cond.emoji} {cond.label}
              </div>
              {isSelected ? (
                <span className="family-member-selected">✓ Viewing Plan</span>
              ) : isVulnerable ? (
                <span className="family-member-vuln">⚠️ Sensitive</span>
              ) : null}
            </div>
          );
        })}
      </div>

      {familyMembers.length === 0 && (
        <div className="family-empty">
          <span className="family-empty-icon">👨‍👩‍👧‍👦</span>
          <p>Add family members to get personalized air quality advice</p>
        </div>
      )}
    </div>
  );
}

export default FamilyProfileList;
