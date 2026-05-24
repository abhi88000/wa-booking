// Assigns a stable id to every request for log correlation.
// Honors upstream X-Request-Id (Nginx, load balancer) when present.
const crypto = require('crypto');

module.exports = function requestId() {
  return (req, res, next) => {
    const incoming = req.get('x-request-id');
    req.id = (incoming && /^[A-Za-z0-9_-]{8,128}$/.test(incoming))
      ? incoming
      : crypto.randomBytes(8).toString('hex');
    res.setHeader('X-Request-Id', req.id);
    next();
  };
};
