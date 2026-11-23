// ============================================
// FamilyProfileList — Minimal Tags + Inline Form
// ============================================
import { useState } from 'react';
import { useUser } from '../../context/UserContext.jsx';
import './FamilyProfileList.css';

const CONDITIONS = [
  { value: 'NONE', label: 'Healthy', emoji: '💪' },
  { value: 'ASTHMA', label: 'Asthma', emoji: '🫁' },
  { value: 'COPD', label: 'COPD', emoji: '🫁' },
  { value: 'HEART_CONDITION', label: 'Heart', emoji: '❤️' },
  { value: 'PREGNANT', label: 'Pregnant', emoji: '🤰' },
  { value: 'INFANT', label: 'Infant', emoji: '👶' },
];

function FamilyProfileList() {
  const { familyMembers, addFamilyMember, removeFamilyMember } = useUser();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [condition, setCondition] = useState('NONE');

  const handleAdd = (e) => {
    e.preventDefault();
    if (!name.trim() || !age) return;
    addFamilyMember({ name: name.trim(), age: parseInt(age), health_condition: condition });
    setName('');
    setAge('');
    setCondition('NONE');
    setAdding(false);
  };

  const getEmoji = (c) => CONDITIONS.find((x) => x.value === c)?.emoji || '👤';
  const getLabel = (c) => CONDITIONS.find((x) => x.value === c)?.label || '';

  return (
    <div className="card family-card">
      <div className="family-header">
        <h3 className="family-title">Family Members</h3>
        <button className="family-add-toggle" onClick={() => setAdding(!adding)}>
          {adding ? '✕' : '+ Add'}
        </button>
      </div>

      <div className="family-tags">
        {familyMembers.map((m) => (
          <div key={m.id} className="family-tag">
            <span>{getEmoji(m.health_condition)}</span>
            <span className="family-tag-name">{m.name}</span>
            <span className="family-tag-meta">
              {m.age}y{m.health_condition !== 'NONE' ? ` · ${getLabel(m.health_condition)}` : ''}
            </span>
            <button className="family-tag-x" onClick={() => removeFamilyMember(m.id)}>✕</button>
          </div>
        ))}
      </div>

      {adding && (
        <form className="family-form" onSubmit={handleAdd}>
          <input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input type="number" placeholder="Age" min="0" max="120" value={age} onChange={(e) => setAge(e.target.value)} required style={{ width: '70px' }} />
          <select value={condition} onChange={(e) => setCondition(e.target.value)}>
            {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
          </select>
          <button type="submit" className="family-form-btn">Add</button>
        </form>
      )}
    </div>
  );
}

export default FamilyProfileList;
