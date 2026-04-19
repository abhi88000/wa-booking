// ============================================================
// Flow Config Routes — Visual Flow Builder API
// ============================================================
// 3 routes: get flow config, save flow config, save AI config.
// Flow config is a JSON tree of nodes (menu, input, condition, action)
// that the flow engine executes when customers message on WhatsApp.
// Save routes invalidate tenant cache for immediate effect.

const express = require('express');
const router = express.Router();
const pool = require('../../db/pool');
const tenantCache = require('../../services/tenantCache');

// Get flow config
router.get('/flow-config', async (req, res, next) => {
  try {
    res.json({
      flow_config: req.tenant.flow_config || null,
      ai_config: req.tenant.ai_config || null,
      labels: req.tenant.labels || { staff: 'Doctor', customer: 'Patient', booking: 'Appointment' },
      features: req.tenant.features || {}
    });
  } catch (err) {
    next(err);
  }
});

// Save flow config
router.put('/flow-config', async (req, res, next) => {
  try {
    const { flow_config, labels } = req.body;

    // Validate flow_config structure
    if (flow_config) {
      if (typeof flow_config !== 'object') {
        return res.status(400).json({ error: 'flow_config must be a JSON object' });
      }
      if (!flow_config.start && Object.keys(flow_config).length > 0) {
        return res.status(400).json({ error: 'flow_config must have a "start" node' });
      }

      const validTypes = ['menu', 'input', 'condition', 'action'];
      const validInputTypes = ['text', 'number', 'email', 'phone', 'date', 'rating', 'yes_no'];
      const validActionTypes = ['save_record', 'notify_admin', 'set_variable'];
      const validOperators = ['equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'is_empty', 'is_not_empty'];

      for (const [nodeId, node] of Object.entries(flow_config)) {
        if (nodeId === 'fallback') continue;

        const nodeType = node.type || 'menu';
        if (!validTypes.includes(nodeType)) {
          return res.status(400).json({ error: `Node "${nodeId}" has invalid type "${nodeType}"` });
        }

        if (!node.message && nodeType !== 'condition') {
          return res.status(400).json({ error: `Node "${nodeId}" must have a message` });
        }

        if (nodeType === 'menu') {
          if (node.buttons && node.buttons.length > 10) {
            return res.status(400).json({ error: `Node "${nodeId}" has more than 10 buttons (WhatsApp limit)` });
          }
          if (node.buttons) {
            for (const btn of node.buttons) {
              if (!btn.id || !btn.label) {
                return res.status(400).json({ error: `Each button in node "${nodeId}" must have id and label` });
              }
            }
          }
        }

        if (nodeType === 'input') {
          if (!node.variable) {
            return res.status(400).json({ error: `Input node "${nodeId}" must have a variable name` });
          }
          if (node.input_type && !validInputTypes.includes(node.input_type)) {
            return res.status(400).json({ error: `Input node "${nodeId}" has invalid input_type "${node.input_type}"` });
          }
        }

        if (nodeType === 'condition') {
          if (!node.variable) {
            return res.status(400).json({ error: `Condition node "${nodeId}" must have a variable to check` });
          }
          if (node.rules) {
            for (const rule of node.rules) {
              if (rule.operator && !validOperators.includes(rule.operator)) {
                return res.status(400).json({ error: `Condition node "${nodeId}" has invalid operator "${rule.operator}"` });
              }
            }
          }
        }

        if (nodeType === 'action') {
          if (node.action_type && !validActionTypes.includes(node.action_type)) {
            return res.status(400).json({ error: `Action node "${nodeId}" has invalid action_type "${node.action_type}"` });
          }
        }
      }
    }

    await pool.query(
      `UPDATE tenants SET flow_config = $1, labels = COALESCE($2, labels), updated_at = NOW() WHERE id = $3`,
      [flow_config ? JSON.stringify(flow_config) : null, labels ? JSON.stringify(labels) : null, req.tenantId]
    );

    // Invalidate cache so next inbound message uses the updated flow
    tenantCache.invalidate(req.tenantId);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Save AI config
router.put('/ai-config', async (req, res, next) => {
  try {
    const { ai_config } = req.body;
    await pool.query(
      `UPDATE tenants SET ai_config = $1, updated_at = NOW() WHERE id = $2`,
      [ai_config ? JSON.stringify(ai_config) : null, req.tenantId]
    );

    tenantCache.invalidate(req.tenantId);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
