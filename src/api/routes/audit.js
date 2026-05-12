const express = require('express');

function createAuditRouter({ queryAuditLogs }) {
  const router = express.Router();

  router.get('/audit/logs', async (req, res) => {
    const { tenant_id: tenantId, start, end, event_type: eventType } = req.query;
    if (!tenantId || !start || !end) {
      return res.status(400).json({ error: 'tenant_id, start, and end are required' });
    }

    const logs = await queryAuditLogs({ tenantId, start, end, eventType });
    return res.status(200).json({ logs, count: logs.length });
  });

  return router;
}

module.exports = { createAuditRouter };
