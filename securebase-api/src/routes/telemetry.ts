import { Router, Request, Response } from 'express';
import { sendSalesAlert, SalesAlertMetadata } from '../services/alertService.js';
import { supabase } from '../server.js';

const router = Router();

router.post('/beacon', (req: Request, res: Response): void => {
  const body = req.body || {};

  // Support both demoBeacon.ts ({ event, payload }) and flat ({ eventType, provider, domain, metadata }) schemas
  const eventType: string | undefined = body.event || body.eventType;
  const nestedPayload: SalesAlertMetadata =
    body.payload && typeof body.payload === 'object' ? body.payload : {};
  const flatMetadata: SalesAlertMetadata =
    body.metadata && typeof body.metadata === 'object' ? body.metadata : {};

  const mergedMetadata: SalesAlertMetadata = {
    ...flatMetadata,
    ...nestedPayload,
  };

  const provider = String(mergedMetadata.provider || body.provider || 'aws').toLowerCase();
  const domain = String(mergedMetadata.domain || body.domain || 'enterprise-prospect').trim();
  const timestamp = typeof body.timestamp === 'string' ? body.timestamp : new Date().toISOString();

  if (!eventType || typeof eventType !== 'string') {
    res.status(400).json({ error: 'Missing required event identifier' });
    return;
  }

  // Acknowledge immediately (<10ms) so browser keepalive beacons never block
  res.status(200).json({
    status: 'queued',
    event: eventType,
    provider,
    receivedAt: timestamp,
  });

  // Non-blocking downstream webhook & Supabase audit fan-out
  setImmediate(async () => {
    try {
      await sendSalesAlert(domain, eventType, provider, mergedMetadata);
    } catch (err) {
      console.error('[Telemetry] Sales alert dispatch error:', err);
    }

    if (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY) {
      try {
        await supabase.from('demo_telemetry_events').insert({
          domain,
          provider,
          event_type: eventType,
          metadata: mergedMetadata,
          created_at: timestamp,
        });
      } catch {
        // Non-blocking: never fail if telemetry table is not yet provisioned
      }
    }
  });
});

export default router;
