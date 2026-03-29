// ============================================================
// AI Service — Intent Detection (Tenant-Scoped)
// ============================================================

const OpenAI = require('openai');
const logger = require('../utils/logger');

class AIService {
  constructor(tenant) {
    this.tenant = tenant;
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  // ── Detect Intent from User Message ─────────────────────
  async detectIntent(message) {
    try {
      const completion = await this.client.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 100,
        messages: [
          {
            role: 'system',
            content: `You are an intent classifier for ${this.tenant.business_name} (a ${this.tenant.business_type}).
Classify the user's message into one of these intents:
- greeting: Hi, hello, hey, good morning, etc.
- start_booking: Book appointment, schedule, I'd like to see doctor, etc.
- check_status: Check my appointment, status, upcoming, when is my...
- cancel: Cancel appointment, cancel booking, don't want to come
- reschedule: Reschedule, change time, move appointment, different date
- help: Help, what can you do, options, menu

Respond with ONLY a JSON object: {"action": "<intent>"}
If unsure, use "greeting".`
          },
          {
            role: 'user',
            content: message
          }
        ]
      });

      const response = completion.choices[0]?.message?.content?.trim();
      
      try {
        return JSON.parse(response);
      } catch {
        // Extract action from response if not valid JSON
        const actions = ['greeting', 'start_booking', 'check_status', 'cancel', 'reschedule', 'help'];
        for (const action of actions) {
          if (response.toLowerCase().includes(action)) {
            return { action };
          }
        }
        return { action: 'greeting' };
      }
    } catch (err) {
      logger.error('AI intent detection error:', err.message);
      // Fallback to keyword matching
      return this.keywordFallback(message);
    }
  }

  // ── Keyword Fallback (when AI is unavailable) ───────────
  keywordFallback(message) {
    const lower = message.toLowerCase().trim();

    if (/\b(book|appointment|schedule|visit)\b/.test(lower)) {
      return { action: 'start_booking' };
    }
    if (/\b(status|check|upcoming|my appointment)\b/.test(lower)) {
      return { action: 'check_status' };
    }
    if (/\b(cancel|remove|delete)\b/.test(lower)) {
      return { action: 'cancel' };
    }
    if (/\b(reschedule|change|move|different)\b/.test(lower)) {
      return { action: 'reschedule' };
    }
    if (/\b(help|menu|option|what can)\b/.test(lower)) {
      return { action: 'help' };
    }
    return { action: 'greeting' };
  }
}

module.exports = AIService;
