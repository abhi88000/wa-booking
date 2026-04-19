// ============================================================
// Tenant Routes — Barrel (mounts all sub-routers)
// ============================================================
// Every request here is scoped to the authenticated tenant.
// Sub-routers inherit authTenant + loadTenantContext middleware.

const express = require('express');
const router = express.Router();
const { authTenant } = require('../../middleware/auth');
const { loadTenantContext } = require('../../middleware/tenantContext');

// All tenant routes require auth + tenant context
router.use(authTenant, loadTenantContext);

// Mount domain routers
router.use(require('./dashboard'));
router.use(require('./appointments'));
router.use(require('./doctors'));
router.use(require('./services'));
router.use(require('./patients'));
router.use(require('./inbox'));
router.use(require('./settings'));
router.use(require('./team'));
router.use(require('./flow'));
router.use(require('./records'));

module.exports = router;
