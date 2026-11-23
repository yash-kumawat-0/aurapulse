// ============================================
// Google Maps Platform API Client Config
// ============================================

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

if (!GOOGLE_MAPS_API_KEY) {
  console.warn('⚠️  GOOGLE_MAPS_API_KEY not set. Air Quality and Routes features will be unavailable.');
}

// --- Air Quality API Endpoints ---
export const AIR_QUALITY_BASE_URL = 'https://airquality.googleapis.com/v1';

export const AIR_QUALITY_ENDPOINTS = {
  currentConditions: `${AIR_QUALITY_BASE_URL}/currentConditions:lookup`,
  forecast: `${AIR_QUALITY_BASE_URL}/forecast:lookup`,
  history: `${AIR_QUALITY_BASE_URL}/history:lookup`,
};

// --- Routes API Endpoints ---
export const ROUTES_BASE_URL = 'https://routes.googleapis.com';

export const ROUTES_ENDPOINTS = {
  computeRoutes: `${ROUTES_BASE_URL}/directions/v2:computeRoutes`,
};

/**
 * Returns headers required for Google Maps Platform API calls.
 */
export function getGoogleHeaders(fieldMask) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
  };
  if (fieldMask) {
    headers['X-Goog-FieldMask'] = fieldMask;
  }
  return headers;
}

export { GOOGLE_MAPS_API_KEY };
