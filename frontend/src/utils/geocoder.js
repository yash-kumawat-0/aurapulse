// ============================================
// Geocoder Utility — OpenStreetMap Nominatim
// Free geocoding for place name → coordinates
// ============================================

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

/**
 * Search for a place name and return matching results.
 * @param {string} query - Place name to search for
 * @returns {Promise<Array<{label: string, lat: number, lng: number}>>}
 */
export async function searchPlace(query) {
  if (!query || query.trim().length < 2) return [];

  try {
    const url = `${NOMINATIM_BASE}/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`;
    const response = await fetch(url);
    if (!response.ok) return [];

    const results = await response.json();
    return results.map((r) => ({
      label: r.display_name.split(',').slice(0, 3).join(', '),
      fullLabel: r.display_name,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
    }));
  } catch {
    return [];
  }
}

/**
 * Reverse geocode coordinates to a place name.
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<string>}
 */
export async function reverseGeocode(lat, lng) {
  try {
    const url = `${NOMINATIM_BASE}/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`;
    const response = await fetch(url);
    if (!response.ok) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

    const result = await response.json();
    if (result.display_name) {
      return result.display_name.split(',').slice(0, 3).join(', ');
    }
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}
