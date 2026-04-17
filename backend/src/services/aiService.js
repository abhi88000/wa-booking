// ============================================================
// AI Service — Stub (Off by Default)
// ============================================================
// Provides AI-powered responses using tenant's business context.
// Only invoked when tenant.features.ai_chatbot === true.
//
// Currently a stub that prepares the architecture.
// When activated: calls Gemini/OpenAI with tenant's system prompt
// + conversation history + customer message.

const logger = require('../utils/logger');

class AIService {
  constructor(tenant, patient, waService) {
    this.tenant = tenant;
    this.patient = patient;
    this.wa = waService;
    this.config = tenant.ai_config || {};
  }

  /**
   * Handle a free-form message using AI.
   * Returns true if handled, false if not available.
   */
  async handleMessage(content) {
    if (!this.tenant.features?.ai_chatbot) {
      return false;
    }

    const systemPrompt = this.config.system_prompt;
    if (!systemPrompt) {
      // AI enabled but not configured — send generic fallback
      await this.wa.sendText(this.patient.phone,
        this.config.fallback_message || 'Sorry, I can\'t help with that right now. Type "menu" to see available options.'
      );
      return true;
    }

    try {
      // Build conversation history from last N messages
      const history = await this._getConversationHistory(5);

      // Call AI provider
      const reply = await this._callAI(systemPrompt, history, content);

      if (reply) {
        await this.wa.sendText(this.patient.phone, reply);
      } else {
        await this.wa.sendText(this.patient.phone,
          this.config.fallback_message || 'Sorry, I couldn\'t process that. Type "menu" for options.'
        );
      }

      return true;
    } catch (err) {
      logger.error('AIService error:', {
        error: err.message,
        tenantId: this.tenant.id,
        phone: this.patient.phone
      });
      await this.wa.sendText(this.patient.phone,
        this.config.fallback_message || 'Sorry, something went wrong. Type "menu" for options.'
      );
      return true;
    }
  }

  /**
   * Call the AI provider API.
   * TODO: Implement when AI module is activated.
   * Supports: gemini, openai
   */
  async _callAI(systemPrompt, history, userMessage) {
    const provider = this.config.provider || 'gemini';

    // ── Gemini ──
    if (provider === 'gemini') {
      // Requires GEMINI_API_KEY in env
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        logger.warn('GEMINI_API_KEY not set — AI service unavailable');
        return null;
      }

      const axios = require('axios');
      const model = this.config.model || 'gemini-2.0-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const contents = [];

      // Add system instruction
      contents.push({
        role: 'user',
        parts: [{ text: `System: ${systemPrompt}` }]
      });
      contents.push({
        role: 'model',
        parts: [{ text: 'Understood. I will follow these instructions.' }]
      });

      // Add conversation history
      for (const msg of history) {
        contents.push({
          role: msg.direction === 'inbound' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        });
      }

      // Add current message
      contents.push({
        role: 'user',
        parts: [{ text: userMessage }]
      });

      const response = await axios.post(url, {
        contents,
        generationConfig: {
          temperature: this.config.temperature || 0.7,
          maxOutputTokens: this.config.max_tokens || 300
        }
      }, { timeout: 15000 });

      const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      return text || null;
    }

    // ── OpenAI ──
    if (provider === 'openai') {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        logger.warn('OPENAI_API_KEY not set — AI service unavailable');
        return null;
      }

      const axios = require('axios');
      const model = this.config.model || 'gpt-4o-mini';

      const messages = [
        { role: 'system', content: systemPrompt }
      ];

      for (const msg of history) {
        messages.push({
          role: msg.direction === 'inbound' ? 'user' : 'assistant',
          content: msg.content
        });
      }

      messages.push({ role: 'user', content: userMessage });

      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model,
        messages,
        temperature: this.config.temperature || 0.7,
        max_tokens: this.config.max_tokens || 300
      }, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        timeout: 15000
      });

      return response.data?.choices?.[0]?.message?.content || null;
    }

    logger.warn(`Unknown AI provider: ${provider}`);
    return null;
  }

  /**
   * Get last N messages for conversation context.
   */
  async _getConversationHistory(limit = 5) {
    const pool = require('../db/pool');
    const { rows } = await pool.query(
      `SELECT direction, content FROM chat_messages
       WHERE tenant_id = $1 AND phone = $2 AND content IS NOT NULL AND content != ''
       ORDER BY created_at DESC LIMIT $3`,
      [this.tenant.id, this.patient.phone, limit]
    );
    return rows.reverse(); // oldest first
  }
}

module.exports = AIService;
