// ============================================================
// Flow Engine — Tenant-Configurable Workflow Engine
// ============================================================
// Processes a tenant's flow_config (JSONB tree of nodes).
// Supports:
//   - Menu nodes: message + buttons (navigate, booking, AI, text)
//   - Input nodes: ask question → validate → store variable → next
//   - Condition nodes: if variable == value → branch A, else → branch B
//   - Action nodes: save record, notify admin, set variable
//
// BACKWARD COMPATIBLE: Existing flow_configs with only menu nodes
// work exactly as before. New node types are additive.

const pool = require('../db/pool');
const logger = require('../utils/logger');

// ── Input Validators ────────────────────────────────────
const VALIDATORS = {
  text: (v) => v && v.trim().length > 0 ? v.trim() : null,
  number: (v) => { const n = Number(v); return !isNaN(n) ? n : null; },
  email: (v) => {
    const m = (v || '').trim().match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    return m ? v.trim().toLowerCase() : null;
  },
  phone: (v) => {
    const cleaned = (v || '').replace(/[\s\-()]/g, '');
    return /^\+?\d{7,15}$/.test(cleaned) ? cleaned : null;
  },
  date: (v) => {
    // Accept dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd
    const s = (v || '').trim();
    let d = new Date(s);
    if (isNaN(d)) {
      const parts = s.split(/[\/\-\.]/);
      if (parts.length === 3) d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    }
    return !isNaN(d) && d.getFullYear() > 2000 ? d.toISOString().split('T')[0] : null;
  },
  rating: (v) => {
    const n = Number(v);
    return n >= 1 && n <= 5 ? n : null;
  },
  yes_no: (v) => {
    const s = (v || '').toLowerCase().trim();
    if (['yes', 'y', 'ha', 'haan', '1'].includes(s)) return 'yes';
    if (['no', 'n', 'nahi', 'nhi', '0'].includes(s)) return 'no';
    return null;
  }
};

class FlowEngine {
  constructor(tenant, patient, waService, moduleHandlers = {}) {
    this.tenant = tenant;
    this.patient = patient;
    this.wa = waService;
    this.tenantId = tenant.id;
    this.phone = patient.phone;
    this.flow = tenant.flow_config || {};
    this.modules = moduleHandlers; // { booking: fn, payment: fn, ... }
  }

  // ── Main Entry ──────────────────────────────────────────
  async handleMessage(content, messageType, interactiveData) {
    try {
      const state = this.patient.wa_conversation_state || {};
      const currentNode = state.flow_node || null;
      const msg = (content || '').toLowerCase().trim();

      // Global resets: "hi", "hello", "menu", "start" → back to root
      if (['hi', 'hello', 'hey', 'menu', 'start', 'home'].includes(msg)) {
        return await this.showNode('start', true);
      }

      // If awaiting input, process the user's typed answer
      if (state.state === 'awaiting_input' && currentNode) {
        return await this.handleInput(content, currentNode);
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

  // ── Show a Node ─────────────────────────────────────────
  // Handles menu, input, condition, and action node types
  async showNode(nodeId, resetVars = false) {
    const node = this.flow[nodeId];
    if (!node) {
      if (nodeId !== 'start') return await this.showNode('start');
      await this.wa.sendText(this.phone,
        `Welcome to ${this.tenant.business_name}! Please contact us for assistance.`
      );
      return;
    }

    const nodeType = node.type || 'menu'; // default = menu (backward compat)

    // Clear variables on reset (fresh conversation)
    if (resetVars) {
      await this.setVariables({});
    }

    switch (nodeType) {
      case 'menu':
        return await this.showMenuNode(nodeId, node);
      case 'input':
        return await this.showInputNode(nodeId, node);
      case 'condition':
        return await this.evaluateCondition(nodeId, node);
      case 'action':
        return await this.executeActionNode(nodeId, node);
      default:
        return await this.showMenuNode(nodeId, node);
    }
  }

  // ── Menu Node (original behavior) ──────────────────────
  async showMenuNode(nodeId, node) {
    const buttons = node.buttons || [];
    const message = this.interpolate(node.message || 'How can I help you?');

    if (buttons.length === 0) {
      await this.wa.sendText(this.phone, message);
      await this.setFlowNode(nodeId);
      return;
    }

    if (buttons.length <= 3) {
      await this.wa.sendButtons(this.phone, {
        bodyText: message,
        buttons: buttons.map(b => ({
          id: b.id,
          title: (b.label || '').substring(0, 20)
        }))
      });
    } else {
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

  // ── Input Node — Ask question, wait for answer ─────────
  async showInputNode(nodeId, node) {
    const message = this.interpolate(node.message || 'Please provide your answer:');
    await this.wa.sendText(this.phone, message);

    // Set state to awaiting_input — next message from user is the answer
    const currentState = this.patient.wa_conversation_state || {};
    await this.setState({
      ...currentState,
      state: 'awaiting_input',
      flow_node: nodeId,
      variables: currentState.variables || {}
    });
  }

  // ── Handle typed input from user ───────────────────────
  async handleInput(content, nodeId) {
    const node = this.flow[nodeId];
    if (!node) return await this.showNode('start');

    const inputType = node.input_type || 'text';
    const varName = node.variable || 'input';
    const validator = VALIDATORS[inputType] || VALIDATORS.text;

    const validated = validator(content);

    if (validated === null) {
      // Validation failed — send error message and ask again
      const errorMsg = node.error_message || this.getDefaultError(inputType);
      await this.wa.sendText(this.phone, errorMsg);
      return; // Stay in awaiting_input state, same node
    }

    // Store the variable
    await this.setVariable(varName, validated);

    // Move to next node
    const nextNode = node.next;
    if (nextNode) {
      return await this.showNode(nextNode);
    }

    // No next node — show back to menu
    await this.wa.sendButtons(this.phone, {
      bodyText: this.interpolate('Thank you! What else can I help with?'),
      buttons: [{ id: 'flow_home', title: 'Main Menu' }]
    });
  }

  // ── Condition Node — If/else branching ─────────────────
  async evaluateCondition(nodeId, node) {
    const varName = node.variable || '';
    const variables = this.getVariables();
    const value = variables[varName];
    const rules = node.rules || [];

    // Evaluate rules in order — first match wins
    for (const rule of rules) {
      const matched = this.matchRule(value, rule.operator, rule.value);
      if (matched && rule.next) {
        return await this.showNode(rule.next);
      }
    }

    // No rule matched — use default/else branch
    if (node.else_next) {
      return await this.showNode(node.else_next);
    }

    // No else either — show menu
    await this.wa.sendButtons(this.phone, {
      bodyText: 'What else can I help with?',
      buttons: [{ id: 'flow_home', title: 'Main Menu' }]
    });
  }

  // ── Action Node — Do something, then proceed ──────────
  async executeActionNode(nodeId, node) {
    const actionType = node.action_type || 'save_record';
    const variables = this.getVariables();

    try {
      switch (actionType) {
        case 'save_record': {
          // Save collected variables as a tenant_record
          const recordType = node.record_type || 'lead';
          const data = {};
          const fieldsToSave = node.save_fields || Object.keys(variables);
          for (const f of fieldsToSave) {
            if (variables[f] !== undefined) data[f] = variables[f];
          }

          await pool.query(
            `INSERT INTO tenant_records (tenant_id, record_type, phone, data, status)
             VALUES ($1, $2, $3, $4, $5)`,
            [this.tenantId, recordType, this.phone, JSON.stringify(data), 'new']
          );
          logger.info('Flow action: saved record', {
            tenantId: this.tenantId, recordType, phone: this.phone
          });
          break;
        }

        case 'notify_admin': {
          // Send WhatsApp message to business owner/admin
          const tenantPhone = this.tenant.wa_phone_number || this.tenant.phone;
          if (tenantPhone) {
            const notifMsg = this.interpolate(
              node.notify_message || 'New inquiry from {{phone}}'
            );
            // Use tenant's own WA to send to their own number won't work (can't message yourself)
            // Instead, log to audit for now — admin sees it in dashboard
            await pool.query(
              `INSERT INTO audit_log (tenant_id, event, data) VALUES ($1, $2, $3)`,
              [this.tenantId, 'flow_notification', JSON.stringify({
                message: notifMsg,
                phone: this.phone,
                variables,
                timestamp: new Date().toISOString()
              })]
            );
          }
          logger.info('Flow action: admin notified', {
            tenantId: this.tenantId, phone: this.phone
          });
          break;
        }

        case 'set_variable': {
          // Set a variable to a fixed value
          if (node.set_var && node.set_value !== undefined) {
            await this.setVariable(node.set_var, node.set_value);
          }
          break;
        }

        case 'send_followup': {
          // Schedule a follow-up message to be sent later
          const ScheduledMessageService = require('./scheduledMessages');
          const delayMinutes = parseInt(node.delay_minutes) || 60;
          const sendAt = new Date(Date.now() + delayMinutes * 60 * 1000);
          const body = this.interpolate(node.followup_message || 'Hi {{customer_name}}, just following up!');
          
          await ScheduledMessageService.schedule({
            tenantId: this.tenantId,
            phone: this.phone,
            patientId: this.patient.id,
            body,
            sendAt,
            triggerType: 'followup',
            source: 'flow_action',
            metadata: { flow_node: nodeId, variables }
          });

          logger.info('Flow action: follow-up scheduled', {
            tenantId: this.tenantId, phone: this.phone, sendAt: sendAt.toISOString()
          });
          break;
        }
      }
    } catch (err) {
      logger.error('Flow action error:', {
        error: err.message,
        tenantId: this.tenantId,
        actionType
      });
      // Don't crash the flow — continue to next node
    }

    // Send confirmation message if configured
    if (node.message) {
      await this.wa.sendText(this.phone, this.interpolate(node.message));
    }

    // Proceed to next node
    if (node.next) {
      return await this.showNode(node.next);
    }

    await this.wa.sendButtons(this.phone, {
      bodyText: 'What else can I help with?',
      buttons: [{ id: 'flow_home', title: 'Main Menu' }]
    });
  }

  // ── Execute a Button Action (ORIGINAL — untouched) ─────
  async executeAction(button) {
    const action = button.action || 'next';

    switch (action) {
      case 'next':
        if (!button.next) {
          await this.wa.sendText(this.phone, 'This option is not configured yet.');
          return;
        }
        return await this.showNode(button.next);

      case 'booking_flow':
      case 'booking_status':
      case 'booking_cancel': {
        if (this.modules.booking) {
          await this.setState({ state: 'idle' });
          const intentMap = { booking_flow: 'book', booking_status: 'status', booking_cancel: 'cancel' };
          const intent = button.booking_intent || intentMap[action] || 'book';
          return await this.modules.booking(intent);
        }
        await this.wa.sendText(this.phone, 'Booking is not set up yet.');
        return;
      }

      case 'text':
        if (button.response) {
          await this.wa.sendText(this.phone, this.interpolate(button.response));
        }
        await this.wa.sendButtons(this.phone, {
          bodyText: 'What else can I help with?',
          buttons: [{ id: 'flow_home', title: 'Main Menu' }]
        });
        return;

      case 'ai':
        if (!this.tenant.features?.ai_chatbot) {
          await this.wa.sendText(this.phone, 'This feature is not available yet.');
          return;
        }
        await this.setState({ state: 'ai_chat', flow_node: this.patient.wa_conversation_state?.flow_node });
        await this.wa.sendText(this.phone, 'You can now ask me anything. Type "menu" to go back.');
        return;

      default:
        await this.wa.sendText(this.phone, 'This option is not configured yet.');
    }
  }

  // ── Variable helpers ────────────────────────────────────
  getVariables() {
    const state = this.patient.wa_conversation_state || {};
    return state.variables || {};
  }

  async setVariable(key, value) {
    const state = this.patient.wa_conversation_state || {};
    const variables = { ...(state.variables || {}), [key]: value };
    await this.setState({ ...state, variables });
  }

  async setVariables(vars) {
    const state = this.patient.wa_conversation_state || {};
    await this.setState({ ...state, variables: vars });
  }

  // ── Interpolate {{variables}} in messages ──────────────
  interpolate(message) {
    if (!message) return message;
    const variables = this.getVariables();
    // Add built-in variables
    variables.phone = this.phone;
    variables.business_name = this.tenant.business_name;
    variables.customer_name = this.patient.name || '';

    return message.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] !== undefined ? String(variables[key]) : match;
    });
  }

  // ── Rule matcher for condition nodes ───────────────────
  matchRule(value, operator, ruleValue) {
    if (value === undefined || value === null) return operator === 'is_empty';

    const v = String(value).toLowerCase();
    const rv = String(ruleValue).toLowerCase();

    switch (operator) {
      case 'equals': return v === rv;
      case 'not_equals': return v !== rv;
      case 'contains': return v.includes(rv);
      case 'greater_than': return Number(value) > Number(ruleValue);
      case 'less_than': return Number(value) < Number(ruleValue);
      case 'is_empty': return !value || String(value).trim() === '';
      case 'is_not_empty': return value && String(value).trim() !== '';
      default: return v === rv;
    }
  }

  // ── Default validation error messages ──────────────────
  getDefaultError(inputType) {
    const errors = {
      text: 'Please type a valid answer.',
      number: 'Please enter a valid number.',
      email: 'Please enter a valid email address (e.g. name@example.com).',
      phone: 'Please enter a valid phone number.',
      date: 'Please enter a valid date (DD/MM/YYYY).',
      rating: 'Please enter a number from 1 to 5.',
      yes_no: 'Please reply with Yes or No.'
    };
    return errors[inputType] || errors.text;
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
