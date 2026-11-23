// ============================================
// API Service — Backend Communication Layer
// ============================================
const API_BASE = '/api/v1';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  };

  const response = await fetch(url, config);
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error?.message || `API request failed: ${response.status}`);
  }

  return data;
}

// --- AQI Endpoints ---
export function fetchCurrentAqi(lat, lng) {
  return request(`/aqi/current?lat=${lat}&lng=${lng}`);
}

export function fetchDiurnal(lat, lng) {
  return request(`/aqi/diurnal?lat=${lat}&lng=${lng}`);
}

// --- Indoor Air Endpoint ---
export function fetchIndoorSimulation(params) {
  return request('/indoor/simulate', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// --- Commute Endpoints ---
export function fetchCommuteComparison(params) {
  return request('/commute/compare', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function fetchMultiCommuteComparison(params) {
  return request('/commute/multi-compare', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// --- Gemini Advice Endpoint ---
export function fetchAdvice(params) {
  return request('/advice/generate', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}
