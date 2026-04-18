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

// ── Module state ownership ────────────────────────────────
// Each module declares which states it owns.
// When a new module is added, register its states here.
const MODULE_STATES = {
  booking: [
    'awaiting_clinic', 'awaiting_doctor', 'awaiting_service',
    'awaiting_date', 'awaiting_time', 'awaiting_confirm',
    'awaiting_cancel', 'awaiting_reschedule',
    'reschedule_awaiting_date', 'reschedule_awaiting_time',
    'awaiting_reschedule_response'
  ],
  // Future modules register here:
  // payment: ['awaiting_payment_method', 'awaiting_payment_confirm'],
};

// Build a reverse lookup: state → module name
const STATE_TO_MODULE = {};
for (const [mod, states] of Object.entries(MODULE_STATES)) {
  for (const s of states) STATE_TO_MODULE[s] = mod;
}

class MessageRouter {
  constructor(tenant, patient, waService) {
    this.tenant = tenant;
    this.patient = patient;
    this.wa = waService;
  }

  /** Build module handlers map for FlowEngine */
  _moduleHandlers() {
    return {
      booking: async () => {
        const engine = new BookingEngine(this.tenant, this.patient, this.wa);
        return await engine.startBookingFlow();
      },
      // Future: payment: async () => { ... }
    };
  }

  /** Get the right engine for a module name */
  _getModuleEngine(moduleName) {
    switch (moduleName) {
      case 'booking': return new BookingEngine(this.tenant, this.patient, this.wa);
      default: return null;
    }
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
      const flow = new FlowEngine(this.tenant, this.patient, this.wa, this._moduleHandlers());
      return await flow.showNode('start');
    }

    // ── MODULE STATES (dynamic lookup) ──
    // If the user is mid-module (booking, payment, etc.), route to that module
    const activeModule = STATE_TO_MODULE[currentState];
    if (activeModule) {
      // Let user escape back to flow menu
      if (this.tenant.flow_config && ['menu', 'home', 'start'].includes(msg)) {
        const flow = new FlowEngine(this.tenant, this.patient, this.wa, this._moduleHandlers());
        return await flow.showNode('start');
      }
      const engine = this._getModuleEngine(activeModule);
      if (engine) {
        return await engine.handleMessage(content, messageType, interactiveData);
      }
    }

    // ── AWAITING INPUT STATE ──
    // If the patient is in an input node, route to FlowEngine
    if (currentState === 'awaiting_input' && this.tenant.flow_config) {
      const flow = new FlowEngine(this.tenant, this.patient, this.wa, this._moduleHandlers());
      return await flow.handleMessage(content, messageType, interactiveData);
    }

    // ── AI CHAT STATE ──
    // If the patient is in AI chat mode, route to AI service
    if (currentState === 'ai_chat') {
      if (['menu', 'home', 'start', 'hi', 'hello'].includes(msg)) {
        // Exit AI mode → back to flow
        if (this.tenant.flow_config) {
          const flow = new FlowEngine(this.tenant, this.patient, this.wa, this._moduleHandlers());
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
      const flow = new FlowEngine(this.tenant, this.patient, this.wa, this._moduleHandlers());
      return await flow.handleMessage(content, messageType, interactiveData);
    }

    // ── DEFAULT: BOOKING ENGINE ──
    // No flow_config → original behavior (backward compatible)
    const engine = new BookingEngine(this.tenant, this.patient, this.wa);
    return await engine.handleMessage(content, messageType, interactiveData);
  }
}

module.exports = MessageRouter;
