// ============================================
// Family Controller (Validated & Sanitized)
// ============================================
import supabase from '../config/db.js';
import { createApiError } from '../middleware/errorHandler.js';
import { sanitizeTextInput } from '../middleware/validateRequest.js';

/**
 * GET /api/v1/family?user_id=xxx
 * Returns all family members for a user.
 */
export async function getFamilyMembers(req, res, next) {
  try {
    const userId = sanitizeTextInput(req.query?.user_id, 64);
    if (!userId) throw createApiError('user_id query parameter is required.', 400);

    if (!supabase) {
      return res.json({
        success: true,
        data: getMockFamilyMembers(),
      });
    }

    const { data, error } = await supabase
      .from('family_members')
      .select('*')
      .eq('user_id', userId)
      .order('age', { ascending: true });

    if (error) throw createApiError('Unable to load family members.', 500);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/family
 * Adds a validated new family member.
 */
export async function addFamilyMember(req, res, next) {
  try {
    const userId = sanitizeTextInput(req.body?.user_id, 64);
    const cleanName = sanitizeTextInput(req.body?.name, 60);
    const parsedAge = parseInt(req.body?.age, 10);
    const cleanCond = sanitizeTextInput(req.body?.health_condition || 'NONE', 40).toUpperCase();

    if (!userId || !cleanName || !Number.isFinite(parsedAge) || parsedAge < 0 || parsedAge > 120) {
      throw createApiError('Valid user_id, name, and age (0-120) are required.', 400);
    }

    if (!supabase) {
      return res.status(201).json({
        success: true,
        data: {
          id: `mock-${Date.now()}`,
          user_id: userId,
          name: cleanName,
          age: parsedAge,
          health_condition: cleanCond,
        },
      });
    }

    const { data, error } = await supabase
      .from('family_members')
      .insert([{ user_id: userId, name: cleanName, age: parsedAge, health_condition: cleanCond }])
      .select()
      .single();

    if (error) throw createApiError('Unable to save family member.', 500);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/family/:id
 * Removes a family member.
 */
export async function deleteFamilyMember(req, res, next) {
  try {
    const cleanId = sanitizeTextInput(req.params?.id, 64);
    if (!cleanId) throw createApiError('Member id is required.', 400);

    if (!supabase) {
      return res.json({ success: true, message: 'Deleted (mock mode).' });
    }

    const { error } = await supabase.from('family_members').delete().eq('id', cleanId);
    if (error) throw createApiError('Unable to delete family member.', 500);

    res.json({ success: true, message: 'Family member deleted.' });
  } catch (err) {
    next(err);
  }
}

function getMockFamilyMembers() {
  return [
    { id: 'mock-1', name: 'Rohan', age: 32, health_condition: 'NONE' },
    { id: 'mock-2', name: 'Ananya', age: 7, health_condition: 'ASTHMA' },
    { id: 'mock-3', name: 'Dadi Ma', age: 68, health_condition: 'HEART_CONDITION' },
  ];
}
