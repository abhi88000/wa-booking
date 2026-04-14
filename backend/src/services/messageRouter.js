// ============================================================
// Message Router
// ============================================================
// Routes incoming WhatsApp messages to the BookingEngine.
// Currently only the booking module is active.
// When new modules (payments, AI chatbot) are added, this router
// will detect which module to use based on conversation state
// and tenant feature flags.

const BookingEngine = require('./bookingEngine');

class MessageRouter {
  constructor(tenant, patient, waService) {
    this.tenant = tenant;
    this.patient = patient;
    this.wa = waService;
  }

  /**
   * Route an incoming message to the appropriate engine.
   * Currently all messages go to BookingEngine.
   */
  async handleMessage(content, messageType, interactiveData) {
    const engine = new BookingEngine(this.tenant, this.patient, this.wa);
    return await engine.handleMessage(content, messageType, interactiveData);
  }
}

module.exports = MessageRouter;
