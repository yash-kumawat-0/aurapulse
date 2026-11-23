// ============================================
// Family Controller
// ============================================
import supabase from '../config/db.js';
import { createApiError } from '../middleware/errorHandler.js';

/**
 * GET /api/v1/family?user_id=xxx
 * Returns all family members for a user.
 */
export async function getFamilyMembers(req, res, next) {
  try {
    const { user_id } = req.query;
    if (!user_id) throw createApiError('user_id query parameter is required.', 400);

    if (!supabase) {
      // Return mock data if no database configured
      return res.json({
        success: true,
        data: getMockFamilyMembers(),
      });
    }

    const { data, error } = await supabase
      .from('family_members')
      .select('*')
      .eq('user_id', user_id)
      .order('age', { ascending: true });

    if (error) throw createApiError(error.message, 500);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/family
 * Adds a new family member.
 */
export async function addFamilyMember(req, res, next) {
  try {
    const { user_id, name, age, health_condition } = req.body;
    if (!user_id || !name || !age) {
      throw createApiError('user_id, name, and age are required.', 400);
    }

    if (!supabase) {
      return res.json({
        success: true,
        data: { id: `mock-${Date.now()}`, user_id, name, age, health_condition: health_condition || 'NONE' },
      });
    }

    const { data, error } = await supabase
      .from('family_members')
      .insert([{ user_id, name, age, health_condition: health_condition || 'NONE' }])
      .select()
      .single();

    if (error) throw createApiError(error.message, 500);
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
    const { id } = req.params;

    if (!supabase) {
      return res.json({ success: true, message: 'Deleted (mock mode).' });
    }

    const { error } = await supabase.from('family_members').delete().eq('id', id);
    if (error) throw createApiError(error.message, 500);

    res.json({ success: true, message: 'Family member deleted.' });
  } catch (err) {
    next(err);
  }
}

/**
 * Returns mock family members for development without a database.
 */
function getMockFamilyMembers() {
  return [
    { id: 'mock-1', name: 'Rohan', age: 32, health_condition: 'NONE' },
    { id: 'mock-2', name: 'Ananya', age: 7, health_condition: 'ASTHMA' },
    { id: 'mock-3', name: 'Dadi Ma', age: 68, health_condition: 'HEART_CONDITION' },
  ];
}
