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
const { validateFlowConfig } = require('../../utils/flowConfig');

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
      const { errors } = validateFlowConfig(flow_config);
      if (errors.length > 0) {
        return res.status(400).json({ error: errors[0], errors });
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
