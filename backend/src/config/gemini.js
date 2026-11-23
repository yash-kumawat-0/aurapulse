// ============================================
// Google Gemini AI Client Config
// ============================================
import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn('⚠️  GEMINI_API_KEY not set. AI-generated advice will be unavailable.');
}

export const genAI = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

// Default model for structured advice generation
export const GEMINI_MODEL = 'gemini-2.5-flash';

/**
 * The strict JSON response schema that Gemini must follow.
 * This ensures zero hallucination of numerical values — Gemini
 * only fills in textual explanations and behavioral suggestions.
 */
export const ADVICE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    overall_summary: {
      type: 'string',
      description: 'A 2-3 sentence plain-language summary of today\'s air quality situation for this location.',
    },
    family_advice: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          member_name: { type: 'string' },
          risk_level: { type: 'string', enum: ['LOW', 'MODERATE', 'HIGH', 'SEVERE'] },
          primary_action: {
            type: 'string',
            description: 'The single most important thing this person should do today.',
          },
          detailed_tips: {
            type: 'array',
            items: { type: 'string' },
            description: 'Two to three additional specific, actionable tips.',
          },
        },
        required: ['member_name', 'risk_level', 'primary_action', 'detailed_tips'],
      },
    },
    ventilation_advice: {
      type: 'string',
      description: 'When to open windows today and for how long, based on the calculated clean window.',
    },
    commute_advice: {
      type: 'string',
      description: 'Which commute option is safer and why, explained simply.',
    },
  },
  required: ['overall_summary', 'family_advice', 'ventilation_advice', 'commute_advice'],
};

export default genAI;
