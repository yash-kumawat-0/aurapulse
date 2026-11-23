// ============================================
// AQI Color Mapper — Maps AQI to accessible colors
// ============================================

/**
 * Returns the appropriate color and label for a given AQI value.
 * Uses CPCB (India) AQI breakpoints.
 */
export function getAqiInfo(aqi) {
  if (aqi <= 50) return { color: '#4CAF50', bg: '#E8F5E9', label: 'Good', emoji: '😊' };
  if (aqi <= 100) return { color: '#8BC34A', bg: '#F1F8E9', label: 'Satisfactory', emoji: '🙂' };
  if (aqi <= 200) return { color: '#FF9800', bg: '#FFF3E0', label: 'Moderate', emoji: '😐' };
  if (aqi <= 300) return { color: '#F44336', bg: '#FFEBEE', label: 'Poor', emoji: '😷' };
  if (aqi <= 400) return { color: '#9C27B0', bg: '#F3E5F5', label: 'Very Poor', emoji: '🤢' };
  return { color: '#880E4F', bg: '#FCE4EC', label: 'Severe', emoji: '☠️' };
}

/**
 * Returns color for PM2.5 safety classification.
 */
export function getPm25SafetyColor(pm25) {
  if (pm25 <= 30) return '#4CAF50';   // Excellent
  if (pm25 <= 60) return '#8BC34A';   // Good
  if (pm25 <= 90) return '#FFEB3B';   // Moderate
  if (pm25 <= 120) return '#FF9800';  // Unhealthy for sensitive
  if (pm25 <= 250) return '#F44336';  // Unhealthy
  return '#880E4F';                   // Hazardous
}

/**
 * Returns the color for a risk level badge.
 */
export function getRiskColor(level) {
  const colors = {
    LOW: '#4CAF50',
    MODERATE: '#FF9800',
    HIGH: '#F44336',
    SEVERE: '#880E4F',
  };
  return colors[level] || '#94A3B8';
}
