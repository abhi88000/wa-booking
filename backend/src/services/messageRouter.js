// ============================================================
// Message Router (Multi-Module, Feature-Gated)
// ============================================================
// Routes incoming WhatsApp messages to the appropriate engine
// based on tenant features and conversation context.
//
// Modules:
//   - booking    → BookingEngine (appointment scheduling)
//   - payments   → (planned)
//   - ai_chatbot → (planned)
//   - broadcast  → (outbound only, no inbound handling)

const BookingEngine = require('./bookingEngine');
const logger = require('../utils/logger');

// Feature flag keys → module names
const MODULE_MAP = {
  booking: 'booking',
  payment_collection: 'payments',
  ai_chatbot: 'ai_chatbot',
  broadcast: 'broadcast'
};

class MessageRouter {
  constructor(tenant, patient, waService) {
    this.tenant = tenant;
    this.patient = patient;
    this.wa = waService;
    this.features = tenant.features || {};
  }

  // Check if a module is enabled for this tenant
  isEnabled(moduleKey) {
    return this.features[moduleKey] === true;
  }

  // Get list of enabled modules (for building the main menu)
  getEnabledModules() {
    const modules = [];
    if (this.isEnabled('booking')) modules.push('booking');
    if (this.isEnabled('payment_collection')) modules.push('payments');
    if (this.isEnabled('ai_chatbot')) modules.push('ai_chatbot');
    if (this.isEnabled('broadcast')) modules.push('broadcast');
    return modules;
  }

  // Route incoming message to the right engine
  async handleMessage(content, messageType, interactiveData) {
    const state = this.patient.wa_conversation_state || { state: 'new' };
    const msg = (content || '').toLowerCase().trim();

    // If patient is mid-conversation in a module, route there
    if (state.module) {
      return await this._routeToModule(state.module, content, messageType, interactiveData);
    }

    // Check if content matches a module trigger
    const moduleChoice = this._detectModuleChoice(msg, content);
    if (moduleChoice) {
      if (!this.isEnabled(moduleChoice)) {
        await this.wa.sendText(this.patient.phone,
          'This feature is not available on your current plan. Contact support to enable it.'
        );
        return;
      }
      return await this._routeToModule(moduleChoice, content, messageType, interactiveData);
    }

    // Default: show the main menu with available modules
    return await this.showMainMenu();
  }

  // Detect which module the user wants based on message content
  _detectModuleChoice(msg, rawContent) {
    // Button/list IDs
    if (rawContent === 'mod_booking' || msg === 'book' || msg === 'book appointment' || msg.includes('appointment') || msg.includes('book')) {
      return 'booking';
    }
    if (rawContent === 'mod_payments' || msg === 'pay' || msg === 'payment' || msg.includes('pay') || msg.includes('invoice')) {
      return 'payment_collection';
    }
    if (rawContent === 'mod_ai' || msg === 'chat' || msg === 'help' || msg === 'question') {
      return 'ai_chatbot';
    }

    // If only one module is enabled, route there by default for any message
    const enabled = this.getEnabledModules();
    if (enabled.length === 1) {
      return Object.keys(MODULE_MAP).find(k => MODULE_MAP[k] === enabled[0]);
    }

    return null;
  }

  // Route to a specific module's engine
  async _routeToModule(moduleKey, content, messageType, interactiveData) {
    switch (moduleKey) {
      case 'booking': {
        const engine = new BookingEngine(this.tenant, this.patient, this.wa);
        return await engine.handleMessage(content, messageType, interactiveData);
      }

      case 'payment_collection': {
        // TODO: PaymentEngine
        await this.wa.sendText(this.patient.phone,
          'Payment features are coming soon. Stay tuned!'
        );
        return;
      }

      case 'ai_chatbot': {
        // TODO: ChatbotEngine
        await this.wa.sendText(this.patient.phone,
          'AI assistant is coming soon. For now, type "book" to schedule an appointment.'
        );
        return;
      }

      default:
        return await this.showMainMenu();
    }
  }

  // Show the main menu with only enabled modules
  async showMainMenu() {
    const enabled = this.getEnabledModules();
    const settings = this.tenant.settings || {};
    const welcome = settings.welcome_message ||
      `Welcome to ${this.tenant.business_name}! How can I help you today?`;

    // If only booking is enabled, go straight to booking engine
    if (enabled.length === 1 && enabled[0] === 'booking') {
      const engine = new BookingEngine(this.tenant, this.patient, this.wa);
      return await engine.handleMessage('hi', 'text', null);
    }

    // Build buttons for enabled modules (max 3 for WhatsApp)
    const buttons = [];
    if (this.isEnabled('booking')) {
      buttons.push({ id: 'mod_booking', title: 'Book Appointment' });
    }
    if (this.isEnabled('payment_collection')) {
      buttons.push({ id: 'mod_payments', title: 'Payments' });
    }
    if (this.isEnabled('ai_chatbot')) {
      buttons.push({ id: 'mod_ai', title: 'Chat with Us' });
    }

    // WhatsApp allows max 3 buttons
    if (buttons.length === 0) {
      await this.wa.sendText(this.patient.phone,
        'No services are currently available. Please contact us directly.'
      );
      return;
    }

    await this.wa.sendButtons(this.patient.phone, {
      bodyText: welcome,
      buttons: buttons.slice(0, 3)
    });
  }
}

module.exports = MessageRouter;
