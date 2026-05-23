const express = require('express');

function createComplianceRouter({ reportGeneratorHandler }) {
  const router = express.Router();

  router.get('/compliance/status', (req, res) => {
    return res.status(200).json({
      status: 'compliant',
      score: 94,
      lastScanned: new Date().toISOString(),
      framework: 'SOC2',
      controlsPassing: 48,
      controlsTotal: 51,
      highFindings: 1,
    });
  });

  router.post('/compliance/reports/generate', async (req, res) => {
    const event = { body: JSON.stringify(req.body || {}) };
    const result = await reportGeneratorHandler(event, {});
    return res.status(result.statusCode || 200).json(JSON.parse(result.body || '{}'));
  });

  return router;
}

module.exports = { createComplianceRouter };
