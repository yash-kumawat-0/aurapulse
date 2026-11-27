// ============================================
// API Service — Backend Communication Layer
// ============================================
const RAW_API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const API_BASE = `${RAW_API_URL}/api/v1`;

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  };

  const response = await fetch(url, config);
  const rawBody = await response.text();
  let data = {};

  if (rawBody) {
    try {
      data = JSON.parse(rawBody);
    } catch {
      throw new Error(`Unexpected API response (${response.status})`);
    }
  }

  if (!response.ok || data.success === false) {
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

export function fetchMultiLegCommute(params) {
  return request('/commute/multi-leg', {
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
