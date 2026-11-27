// ============================================
// Request Input Validation & Sanitization Middleware
// ============================================
import { createApiError } from './errorHandler.js';

/**
 * Validates geographic latitude and longitude values.
 *
 * @param {unknown} rawLat - Candidate latitude value.
 * @param {unknown} rawLng - Candidate longitude value.
 * @returns {{ lat: number, lng: number }} Validated numeric coordinates.
 */
export function parseValidCoordinates(rawLat, rawLng) {
  const lat = parseFloat(rawLat);
  const lng = parseFloat(rawLng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw createApiError('lat must be a valid finite number between -90 and 90.', 400);
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw createApiError('lng must be a valid finite number between -180 and 180.', 400);
  }
  return { lat, lng };
}

/**
 * Sanitizes freeform user strings to bounded plain text.
 *
 * @param {unknown} value - Raw user input string.
 * @param {number} maxLen - Maximum allowed characters.
 * @returns {string}
 */
export function sanitizeTextInput(value, maxLen = 120) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLen);
}

/**
 * Validates GET /api/v1/aqi/* coordinate query parameters.
 */
export function validateAqiQuery(req, _res, next) {
  try {
    const { lat, lng } = parseValidCoordinates(req.query?.lat, req.query?.lng);
    req.query.lat = String(lat);
    req.query.lng = String(lng);
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Validates POST /api/v1/indoor/simulate body bounds.
 */
export function validateIndoorBody(req, _res, next) {
  try {
    const body = req.body || {};
    const outPm = parseFloat(body.outdoor_pm25);
    if (!Number.isFinite(outPm) || outPm < 0 || outPm > 2000) {
      throw createApiError('outdoor_pm25 must be a finite number between 0 and 2000.', 400);
    }
    if (body.room_area_sqft !== undefined) {
      const area = Number(body.room_area_sqft);
      if (!Number.isFinite(area) || area < 20 || area > 10000) {
        throw createApiError('room_area_sqft must be between 20 and 10000.', 400);
      }
    }
    if (body.lat !== undefined && body.lng !== undefined) {
      parseValidCoordinates(body.lat, body.lng);
    }
    if (body.custom_window_desc !== undefined) {
      body.custom_window_desc = sanitizeTextInput(body.custom_window_desc, 140);
    }
    if (body.custom_source_desc !== undefined) {
      body.custom_source_desc = sanitizeTextInput(body.custom_source_desc, 140);
    }
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Validates POST /api/v1/advice/generate and /symptom-check coordinates & lists.
 */
export function validateAdviceBody(req, _res, next) {
  try {
    const body = req.body || {};
    parseValidCoordinates(body.lat, body.lng);
    if (req.path.endsWith('/generate')) {
      if (!Array.isArray(body.family_members) || body.family_members.length === 0) {
        throw createApiError('At least one family member is required.', 400);
      }
      if (body.family_members.length > 20) {
        throw createApiError('Maximum 20 family members allowed per plan.', 400);
      }
    }
    if (req.path.endsWith('/symptom-check')) {
      const sym = sanitizeTextInput(body.symptom, 80);
      const customSym = sanitizeTextInput(body.custom_symptom, 120);
      if (!sym && !customSym) {
        throw createApiError('symptom or custom_symptom is required.', 400);
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Validates POST /api/v1/commute/location-brief body coordinates.
 */
export function validateLocationBriefBody(req, _res, next) {
  try {
    const body = req.body || {};
    parseValidCoordinates(body.lat, body.lng);
    if (body.origin_label !== undefined) {
      body.origin_label = sanitizeTextInput(body.origin_label, 140);
    }
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Validates /compare, /multi-compare, and /multi-leg commute payloads cleanly.
 */
export function validateCommutePayload(req, _res, next) {
  try {
    const body = req.body || {};
    if (req.path.endsWith('/multi-leg')) {
      if (!Array.isArray(body.legs) || body.legs.length === 0 || body.legs.length > 20) {
        throw createApiError('legs must contain between 1 and 20 commute segments.', 400);
      }
      if (body.origin?.latitude !== undefined && body.origin?.longitude !== undefined) {
        parseValidCoordinates(body.origin.latitude, body.origin.longitude);
      }
      return next();
    }

    if (!body.origin) {
      throw createApiError('origin coordinates are required.', 400);
    }
    parseValidCoordinates(body.origin.latitude, body.origin.longitude);

    if (req.path.endsWith('/compare')) {
      if (!body.destination) {
        throw createApiError('destination coordinates are required.', 400);
      }
      parseValidCoordinates(body.destination.latitude, body.destination.longitude);
    } else if (!Array.isArray(body.routes) || body.routes.length === 0 || body.routes.length > 10) {
      throw createApiError('routes must contain between 1 and 10 options.', 400);
    }
    return next();
  } catch (err) {
    return next(err);
  }
}
