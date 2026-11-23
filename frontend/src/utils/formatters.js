// ============================================
// Formatters — Date, Time, and Unit helpers
// ============================================

/**
 * Formats hour (0-23) to 12-hour display string.
 */
export function formatHour(h) {
  const period = h >= 12 ? 'PM' : 'AM';
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayHour}:00 ${period}`;
}

/**
 * Formats a number with units.
 */
export function formatPM25(value) {
  return `${Math.round(value)} µg/m³`;
}

/**
 * Formats time ago from ISO timestamp.
 */
export function timeAgo(isoString) {
  const now = new Date();
  const then = new Date(isoString);
  const diffMin = Math.round((now - then) / 60000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffMin < 1440) return `${Math.round(diffMin / 60)} hr ago`;
  return `${Math.round(diffMin / 1440)} days ago`;
}

/**
 * Formats CO2 value with appropriate unit.
 */
export function formatCO2(kg) {
  if (kg < 1) return `${Math.round(kg * 1000)} g CO₂`;
  return `${kg.toFixed(1)} kg CO₂`;
}
