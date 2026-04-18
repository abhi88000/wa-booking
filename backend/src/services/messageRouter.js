// ============================================================
// Message Router — Intelligent Multi-Module Routing
// ============================================================
// Routes incoming WhatsApp messages to the correct engine:
//
//  1. FlowEngine    — if tenant has flow_config (decision tree)
//  2. BookingEngine  — default fallback / booking_flow action
//  3. AIService      — if tenant has ai_chatbot enabled + unmatched input
//
// BACKWARD COMPATIBLE: Tenants without flow_config get the
// existing BookingEngine behavior — zero change for them.

const BookingEngine = require('./bookingEngine');
const FlowEngine = require('./flowEngine');
const AIService = require('./aiService');
const logger = require('../utils/logger');

class MessageRouter {
  constructor(tenant, patient, waService) {
    this.tenant = tenant;
    this.patient = patient;
    this.wa = waService;
  }

  /**
   * Route an incoming message to the appropriate engine.
   */
  async handleMessage(content, messageType, interactiveData) {
    const state = this.patient.wa_conversation_state || {};
    const currentState = state.state || 'new';
    const msg = (content || '').toLowerCase().trim();

    // ── Global reset: "flow_home" button → back to flow start ──
    if (content === 'flow_home' && this.tenant.flow_config) {
      const flow = new FlowEngine(this.tenant, this.patient, this.wa);
      return await flow.showNode('start');
    }

    // ── BOOKING ENGINE STATES ──
    // If the patient is mid-booking (awaiting_doctor, awaiting_time, etc.)
    // always route to BookingEngine regardless of flow_config.
    const bookingStates = [
      'awaiting_clinic', 'awaiting_doctor', 'awaiting_service',
      'awaiting_date', 'awaiting_time', 'awaiting_confirm',
      'awaiting_cancel', 'awaiting_reschedule',
      'reschedule_awaiting_date', 'reschedule_awaiting_time',
      'awaiting_reschedule_response'
    ];

    if (bookingStates.includes(currentState)) {
      // Let user escape back to flow menu
      if (this.tenant.flow_config && ['menu', 'home', 'start'].includes(msg)) {
        const flow = new FlowEngine(this.tenant, this.patient, this.wa);
        return await flow.showNode('start');
      }
      const engine = new BookingEngine(this.tenant, this.patient, this.wa);
      return await engine.handleMessage(content, messageType, interactiveData);
    }

    // ── AWAITING INPUT STATE ──
    // If the patient is in an input node, route to FlowEngine
    if (currentState === 'awaiting_input' && this.tenant.flow_config) {
      const flow = new FlowEngine(this.tenant, this.patient, this.wa);
      return await flow.handleMessage(content, messageType, interactiveData);
    }

    // ── AI CHAT STATE ──
    // If the patient is in AI chat mode, route to AI service
    if (currentState === 'ai_chat') {
      if (['menu', 'home', 'start', 'hi', 'hello'].includes(msg)) {
        // Exit AI mode → back to flow
        if (this.tenant.flow_config) {
          const flow = new FlowEngine(this.tenant, this.patient, this.wa);
          return await flow.showNode('start');
        }
        // No flow config → booking engine
        const engine = new BookingEngine(this.tenant, this.patient, this.wa);
        return await engine.handleMessage(content, messageType, interactiveData);
      }
      const ai = new AIService(this.tenant, this.patient, this.wa);
      const handled = await ai.handleMessage(content);
      if (handled) return;
      // AI couldn't handle → fall through to flow/booking
    }

    // ── FLOW ENGINE ──
    // If tenant has a flow_config, use the FlowEngine
    if (this.tenant.flow_config && Object.keys(this.tenant.flow_config).length > 0) {
      const flow = new FlowEngine(this.tenant, this.patient, this.wa);
      return await flow.handleMessage(content, messageType, interactiveData);
    }

    // ── DEFAULT: BOOKING ENGINE ──
    // No flow_config → original behavior (backward compatible)
    const engine = new BookingEngine(this.tenant, this.patient, this.wa);
    return await engine.handleMessage(content, messageType, interactiveData);
  }
}

module.exports = MessageRouter;
