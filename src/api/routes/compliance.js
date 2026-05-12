const express = require('express');

function createComplianceRouter({ reportGeneratorHandler }) {
  const router = express.Router();

  router.post('/compliance/reports/generate', async (req, res) => {
    const event = { body: JSON.stringify(req.body || {}) };
    const result = await reportGeneratorHandler(event, {});
    return res.status(result.statusCode || 200).json(JSON.parse(result.body || '{}'));
  });

  return router;
}

module.exports = { createComplianceRouter };
