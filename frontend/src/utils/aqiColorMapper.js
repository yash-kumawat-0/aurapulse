// ============================================
// AQI Color Mapper — WCAG AA Contrast Colors
// ============================================

/**
 * Returns accessible colors and CPCB category labels for a given AQI value.
 */
export function getAqiInfo(aqi) {
  if (aqi <= 50) return { color: '#15803D', bg: '#E8F5E9', label: 'Good', emoji: '😊' };
  if (aqi <= 100) return { color: '#3F6212', bg: '#F1F8E9', label: 'Satisfactory', emoji: '🙂' };
  if (aqi <= 200) return { color: '#B45309', bg: '#FFF3E0', label: 'Moderate', emoji: '😐' };
  if (aqi <= 300) return { color: '#C62828', bg: '#FFEBEE', label: 'Poor', emoji: '😷' };
  if (aqi <= 400) return { color: '#6A1B9A', bg: '#F3E5F5', label: 'Very Poor', emoji: '🤢' };
  return { color: '#880E4F', bg: '#FCE4EC', label: 'Severe', emoji: '☠️' };
}

/**
 * Returns bar fill color for PM2.5 safety classification.
 */
export function getPm25SafetyColor(pm25) {
  if (pm25 <= 30) return '#4CAF50';
  if (pm25 <= 60) return '#8BC34A';
  if (pm25 <= 90) return '#FFEB3B';
  if (pm25 <= 120) return '#FF9800';
  if (pm25 <= 250) return '#F44336';
  return '#880E4F';
}

/**
 * Returns high-contrast color for a risk level badge.
 */
export function getRiskColor(level) {
  const colors = {
    LOW: '#15803D',
    MODERATE: '#B45309',
    HIGH: '#C62828',
    SEVERE: '#880E4F',
  };
  return colors[level] || '#64748B';
}
