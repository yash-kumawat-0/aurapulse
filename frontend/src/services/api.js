// ============================================
// API Service — Backend Communication Layer
// Supports optional backup Gemini key header & safe JSON parsing
// ============================================
const RAW_API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const API_BASE = `${RAW_API_URL}/api/v1`;
const BACKUP_KEY_STORAGE = 'aurapulse_backup_gemini_key';

export function getBackupGeminiKey() {
  try {
    return sessionStorage.getItem(BACKUP_KEY_STORAGE) || '';
  } catch {
    return '';
  }
}

export function setBackupGeminiKey(key) {
  try {
    const clean = (key || '').trim();
    if (clean) sessionStorage.setItem(BACKUP_KEY_STORAGE, clean);
    else sessionStorage.removeItem(BACKUP_KEY_STORAGE);
  } catch {
    /* ignore storage limits */
  }
}

async function requestUrl(fullUrl, options = {}) {
  const backupKey = getBackupGeminiKey();
  const headers = {
    'Content-Type': 'application/json',
    ...(backupKey ? { 'X-Gemini-Api-Key': backupKey } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(fullUrl, {
    ...options,
    headers,
  });

  const rawBody = await response.text();
  let data = {};

  if (rawBody) {
    try {
      data = JSON.parse(rawBody);
    } catch {
      throw new Error(`Unexpected API response (${response.status})`);
    }
  }

  if (!response.ok || (data.success === false)) {
    throw new Error(data.error?.message || `API request failed: ${response.status}`);
  }

  return data;
}

function request(endpoint, options = {}) {
  return requestUrl(`${API_BASE}${endpoint}`, options);
}

// --- Health & AI Runtime Status ---
export function fetchHealthStatus() {
  return requestUrl(`${RAW_API_URL}/api/health`);
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
