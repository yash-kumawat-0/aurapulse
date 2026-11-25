// ============================================
// User Context — Location & Preferences
// Auto-detects location on page load.
// ============================================
import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [location, setLocation] = useState(null); // { lat, lng, label }
  const [language, setLanguage] = useState('English');
  const [familyMembers, setFamilyMembers] = useState([
    { id: '1', name: 'Rohan', age: 32, health_condition: 'NONE' },
    { id: '2', name: 'Ananya', age: 7, health_condition: 'ASTHMA' },
    { id: '3', name: 'Dadi Ma', age: 68, health_condition: 'HEART_CONDITION' },
  ]);
  const [selectedMemberId, setSelectedMemberId] = useState('1');
  const [homeProfile, setHomeProfile] = useState({
    room_area_sqft: 150,
    ceiling_height_ft: 10,
    window_seal_type: 'standard_aluminum',
    purifier_cadr: 0,
    indoor_source: 'none',
  });

  const detectLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`,
        });
      },
      (err) => console.error('Geolocation error:', err.message),
    );
  }, []);

  // ── Auto-detect location on first load ──
  useEffect(() => {
    if (!location) {
      detectLocation();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addFamilyMember = useCallback((member) => {
    const newId = `${Date.now()}`;
    setFamilyMembers((prev) => [...prev, { ...member, id: newId }]);
    setSelectedMemberId(newId);
  }, []);

  const removeFamilyMember = useCallback((id) => {
    setFamilyMembers((prev) => {
      const next = prev.filter((m) => m.id !== id);
      setSelectedMemberId((cur) => (cur === id ? next[0]?.id || null : cur));
      return next;
    });
  }, []);

  return (
    <UserContext.Provider
      value={{
        location, setLocation,
        language, setLanguage,
        familyMembers, addFamilyMember, removeFamilyMember,
        selectedMemberId, setSelectedMemberId,
        homeProfile, setHomeProfile,
        detectLocation,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}
