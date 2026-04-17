// ============================================================
// Flow Engine — Tenant-Configurable Decision Tree
// ============================================================
// Processes a tenant's flow_config (JSONB tree of nodes).
// Each node has a message + buttons. Each button either navigates
// to another node or triggers a special action (booking, AI, text).
//
// BACKWARD COMPATIBLE: If tenant has no flow_config, this engine
// is never invoked — MessageRouter falls back to BookingEngine.

const pool = require('../db/pool');
const logger = require('../utils/logger');

class FlowEngine {
  constructor(tenant, patient, waService) {
    this.tenant = tenant;
    this.patient = patient;
    this.wa = waService;
    this.tenantId = tenant.id;
    this.phone = patient.phone;
    this.flow = tenant.flow_config || {};
  }

  // ── Main Entry ──────────────────────────────────────────
  async handleMessage(content, messageType, interactiveData) {
    try {
      const state = this.patient.wa_conversation_state || {};
      const currentNode = state.flow_node || null;
      const msg = (content || '').toLowerCase().trim();

      // Global resets: "hi", "hello", "menu", "start" → back to root
      if (['hi', 'hello', 'hey', 'menu', 'start', 'home'].includes(msg)) {
        return await this.showNode('start');
      }

      // If no current node, show the start node
      if (!currentNode) {
        return await this.showNode('start');
      }

      // Find which button was pressed in current node
      const node = this.flow[currentNode];
      if (!node) {
        return await this.showNode('start');
      }

      const buttons = node.buttons || [];
      const matched = buttons.find(b => 
        b.id === content || 
        b.label?.toLowerCase() === msg
      );

      if (!matched) {
        // No button matched — show fallback + re-show current node
        const fallback = this.flow.fallback || 'Please pick an option from the menu.';
        await this.wa.sendText(this.phone, fallback);
        return await this.showNode(currentNode);
      }

      // Execute the button's action
      return await this.executeAction(matched);

    } catch (err) {
      logger.error('FlowEngine error:', {
        error: err.message,
        stack: err.stack,
        tenantId: this.tenantId,
        phone: this.phone
      });
      await this.wa.sendText(this.phone,
        'Sorry, something went wrong. Type "hi" to start over.'
      );
      await this.setFlowNode(null);
    }
  }

  // ── Show a Node (message + buttons) ─────────────────────
  async showNode(nodeId) {
    const node = this.flow[nodeId];
    if (!node) {
      // Node not found — show start or a generic message
      if (nodeId !== 'start') {
        return await this.showNode('start');
      }
      // Even start node missing — tenant hasn't configured flow
      await this.wa.sendText(this.phone,
        `Welcome to ${this.tenant.business_name}! Please contact us for assistance.`
      );
      return;
    }

    const buttons = node.buttons || [];
    const message = node.message || 'How can I help you?';

    if (buttons.length === 0) {
      // Leaf node — just send the message
      await this.wa.sendText(this.phone, message);
      await this.setFlowNode(nodeId);
      return;
    }

    if (buttons.length <= 3) {
      // Use WhatsApp buttons (max 3)
      await this.wa.sendButtons(this.phone, {
        bodyText: message,
        buttons: buttons.map(b => ({
          id: b.id,
          title: (b.label || '').substring(0, 20)
        }))
      });
    } else {
      // Use WhatsApp list (max 10 items)
      await this.wa.sendList(this.phone, {
        headerText: this.tenant.business_name,
        bodyText: message,
        buttonText: 'View Options',
        sections: [{
          title: 'Options',
          rows: buttons.slice(0, 10).map(b => ({
            id: b.id,
            title: (b.label || '').substring(0, 24),
            description: (b.description || '').substring(0, 72)
          }))
        }]
      });
    }

    await this.setFlowNode(nodeId);
  }

  // ── Execute a Button Action ─────────────────────────────
  async executeAction(button) {
    const action = button.action || 'next';

    switch (action) {
      case 'next':
        // Navigate to another node
        if (!button.next) {
          await this.wa.sendText(this.phone, 'This option is not configured yet.');
          return;
        }
        return await this.showNode(button.next);

      case 'booking_flow':
        // Hand off to BookingEngine — clear flow node, set booking state
        await this.setState({ state: 'idle' });
        // The MessageRouter will detect booking state and route accordingly
        const BookingEngine = require('./bookingEngine');
        const engine = new BookingEngine(this.tenant, this.patient, this.wa);
        return await engine.startBookingFlow();

      case 'text':
        // Send a static text reply
        if (button.response) {
          await this.wa.sendText(this.phone, button.response);
        }
        // Show a "back to menu" option
        await this.wa.sendButtons(this.phone, {
          bodyText: 'What else can I help with?',
          buttons: [{ id: 'flow_home', title: 'Main Menu' }]
        });
        return;

      case 'ai':
        // Hand off to AI service (if enabled)
        if (!this.tenant.features?.ai_chatbot) {
          await this.wa.sendText(this.phone, 'This feature is not available yet.');
          return;
        }
        // Set state to AI mode — MessageRouter handles the rest
        await this.setState({ state: 'ai_chat', flow_node: this.patient.wa_conversation_state?.flow_node });
        await this.wa.sendText(this.phone, 'You can now ask me anything. Type "menu" to go back.');
        return;

      default:
        await this.wa.sendText(this.phone, 'This option is not configured yet.');
    }
  }

  // ── State helpers ───────────────────────────────────────
  async setFlowNode(nodeId) {
    const currentState = this.patient.wa_conversation_state || {};
    const newState = { ...currentState, state: 'flow', flow_node: nodeId };
    await this.setState(newState);
  }

  async setState(newState) {
    this.patient.wa_conversation_state = newState;
    await pool.query(
      `UPDATE patients SET wa_conversation_state = $1, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3`,
      [JSON.stringify(newState), this.patient.id, this.tenantId]
    );
  }
}

module.exports = FlowEngine;
