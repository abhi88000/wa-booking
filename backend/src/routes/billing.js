// ============================================================
// Billing Routes — Subscription + Payment Gateway Webhooks
// ============================================================

const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authTenant } = require('../middleware/auth');
const logger = require('../utils/logger');

// ── Get Available Plans ───────────────────────────────────
router.get('/plans', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM plans WHERE is_active = true ORDER BY monthly_price'
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ── Get Current Subscription ──────────────────────────────
router.get('/subscription', authTenant, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.*, p.display_name as plan_name, p.monthly_price, p.yearly_price,
              p.max_doctors, p.max_appointments_month, p.max_services, p.features as plan_features
       FROM subscriptions s
       LEFT JOIN plans p ON p.name = s.plan
       WHERE s.tenant_id = $1
       ORDER BY s.created_at DESC LIMIT 1`,
      [req.tenantId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// ── Create Razorpay Subscription ──────────────────────────
router.post('/subscribe/razorpay', authTenant, async (req, res, next) => {
  try {
    const { planName, billingCycle = 'monthly' } = req.body;
    
    // Get plan details
    const { rows: plans } = await pool.query(
      'SELECT * FROM plans WHERE name = $1 AND is_active = true', [planName]
    );
    if (plans.length === 0) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const plan = plans[0];
    const amount = billingCycle === 'yearly' ? plan.yearly_price : plan.monthly_price;

    // TODO: Create Razorpay subscription via API
    // const Razorpay = require('razorpay');
    // const rz = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
    // const rzSub = await rz.subscriptions.create({ ... });

    // For now, return the plan info for frontend to handle
    res.json({
      plan: planName,
      amount,
      currency: 'INR',
      billingCycle,
      // razorpay_subscription_id: rzSub.id,  // Uncomment when Razorpay is configured
      message: 'Configure Razorpay keys to enable auto-billing'
    });
  } catch (err) {
    next(err);
  }
});

// ── Razorpay Webhook ──────────────────────────────────────
router.post('/webhook/razorpay', express.raw({ type: 'application/json' }), async (req, res, next) => {
  try {
    // TODO: Verify webhook signature
    // const crypto = require('crypto');
    // const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    //   .update(req.body).digest('hex');
    
    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    
    switch (event.event) {
      case 'subscription.activated':
        await handleSubscriptionActivated(event.payload);
        break;
      case 'subscription.charged':
        await handlePaymentSuccess(event.payload);
        break;
      case 'subscription.cancelled':
        await handleSubscriptionCancelled(event.payload);
        break;
      case 'payment.failed':
        await handlePaymentFailed(event.payload);
        break;
    }

    res.json({ status: 'ok' });
  } catch (err) {
    logger.error('Razorpay webhook error:', err);
    res.status(200).json({ status: 'error logged' }); // Always 200 to prevent retries
  }
});

// ── Billing Invoice History ───────────────────────────────
router.get('/invoices', authTenant, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM invoices WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 24`,
      [req.tenantId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ── Internal Handlers ─────────────────────────────────────

async function handleSubscriptionActivated(payload) {
  const subId = payload.subscription?.entity?.id;
  logger.info(`Subscription activated: ${subId}`);
  
  // Find tenant by gateway subscription ID and update status
  await pool.query(
    `UPDATE subscriptions SET status = 'active', updated_at = NOW()
     WHERE gateway_subscription_id = $1`,
    [subId]
  );
}

async function handlePaymentSuccess(payload) {
  const payment = payload.payment?.entity;
  const subId = payload.subscription?.entity?.id;
  
  logger.info(`Payment received: ${payment?.id} for sub ${subId}`);

  // Find subscription
  const { rows } = await pool.query(
    'SELECT * FROM subscriptions WHERE gateway_subscription_id = $1', [subId]
  );
  if (rows.length === 0) return;

  const sub = rows[0];

  // Create invoice
  await pool.query(
    `INSERT INTO invoices (tenant_id, subscription_id, amount, currency, status, gateway_invoice_id, paid_at, period_start, period_end)
     VALUES ($1, $2, $3, $4, 'paid', $5, NOW(), $6, $7)`,
    [
      sub.tenant_id, sub.id,
      (payment.amount / 100), // Razorpay amounts are in paise
      payment.currency,
      payment.id,
      sub.current_period_start,
      sub.current_period_end
    ]
  );

  // Update subscription period
  await pool.query(
    `UPDATE subscriptions SET status = 'active', updated_at = NOW(),
     current_period_start = NOW(),
     current_period_end = NOW() + INTERVAL '1 month'
     WHERE id = $1`,
    [sub.id]
  );
}

async function handleSubscriptionCancelled(payload) {
  const subId = payload.subscription?.entity?.id;
  logger.info(`Subscription cancelled: ${subId}`);
  
  await pool.query(
    `UPDATE subscriptions SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
     WHERE gateway_subscription_id = $1`,
    [subId]
  );
}

async function handlePaymentFailed(payload) {
  const subId = payload.subscription?.entity?.id;
  logger.info(`Payment failed for sub: ${subId}`);
  
  await pool.query(
    `UPDATE subscriptions SET status = 'past_due', updated_at = NOW()
     WHERE gateway_subscription_id = $1`,
    [subId]
  );
}

module.exports = router;
