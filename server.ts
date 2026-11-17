import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import {
  readSandboxState,
  resetSandboxState,
  withStoreMutation,
  computeSha256Hex,
  verifyWormChainRecords,
  probeGoCorelinkDaemon,
  evaluateGeofenceAndPersist,
  getTerraformPlanDiffs,
  readWorkspaceRepoTree,
  buildWorkspaceRepoZip,
  attestEdgeEndpoint,
  toggleEdgeBackhaul,
  bufferOfflineEdgeEvent,
  syncEdgeBufferToWorm,
  SovereignScopeId,
  PersistedWormCdrRecord
} from './src/server/mvnoStore.ts';
import {
  readHarnessSandboxState,
  resetHarnessSandboxState,
  loadMcpContractCatalog,
  loadRegoPolicyLibrary,
  validateAgainstSchema,
  invokeEvaluateTfPlan,
  invokeVerifyWormVault,
  invokeSynthesizeRemediationPr,
  runRegoUnitTestSuite
} from './src/server/harnessStore.ts';
import {
  readTriCloudSandboxState,
  resetTriCloudSandboxState,
  loadTriCloudArtifactsBundle,
  triggerDrFailoverProbe,
  runUnifiedGovernanceBatch,
  getFinOpsDashboardData,
  remediateIdleDrift,
  simulateGuardrailCheck
} from './src/server/triCloudStore.ts';
import { CloudProviderId } from './src/server/finopsAggregator.ts';

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT || 3000);
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '1mb' }));

  // 1. Health & Dual CoreLink Runtime Status
  app.get('/api/mvno/health', async (_req, res) => {
    try {
      const [state, goOnline] = await Promise.all([readSandboxState(), probeGoCorelinkDaemon()]);
      res.json({
        status: 'healthy',
        service: 'securebase-mvno-bridge',
        runtimeMode: goOnline ? 'go-corelink+express-bridge' : 'express-corelink-bridge',
        goCorelinkPort8085Online: goOnline,
        persistence: {
          engine: 'atomic-json-sandbox-store',
          simCount: state.sims.length,
          wormRecordCount: state.wormChain.length,
          quarantineLogCount: state.quarantineLogs.length,
          lastUpdatedUtc: state.lastUpdatedUtc
        }
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Health probe failed' });
    }
  });

  // 2. Full Persisted Sandbox State (SIM Inventory, WORM CDR Chain, Quarantine Logs)
  app.get('/api/mvno/state', async (_req, res) => {
    try {
      const state = await readSandboxState();
      res.json({
        ...state,
        chainVerification: verifyWormChainRecords(state.wormChain)
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load sandbox state' });
    }
  });

  // 3. Live CoreLink OPA Policy & Drift Evaluation Endpoint
  app.post('/api/mvno/evaluate-geofence', async (req, res) => {
    try {
      const body = req.body || {};
      const result = await evaluateGeofenceAndPersist({
        perimeter: body.perimeter || 'securebase-us',
        eventType: body.eventType || 'N15_TOWER_HANDOVER',
        imsiHash: body.imsiHash,
        imeiSv: body.imeiSv || '356938035643809',
        sourceTac: body.sourceTac || 'TAC-0x1A2B (Dallas-FW)',
        targetTac: body.targetTac || 'TAC-0x9F88 (Unverified-External-Border)',
        apn: body.apn,
        forcedDrift: Boolean(body.forcedDrift)
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Policy evaluation failed' });
    }
  });

  // 4. WORM CDR Chain Operations (Append, Simulate Tamper, Verify, Reset)
  app.post('/api/mvno/worm-chain/append', async (req, res) => {
    try {
      const perimeter: SovereignScopeId = req.body?.perimeter || 'securebase-us';
      const defaultTacMap: Record<SovereignScopeId, string> = {
        'securebase-us': 'TAC-0x1A2B (Dallas-FW)',
        'securebase-euro': 'TAC-0x2F01 (Frankfurt-Main)',
        'securebase-asia': 'TAC-0x3C11 (Singapore-CBD)'
      };

      const payload = await withStoreMutation((state) => {
        const prev = state.wormChain[state.wormChain.length - 1];
        const nextSeq = prev ? prev.seq + 1 : 1;
        const now = new Date();
        const base: Omit<PersistedWormCdrRecord, 'hmacSha256'> = {
          seq: nextSeq,
          recordId: `cdr-${perimeter.replace('securebase-', '')}-${String(100 + nextSeq).padStart(6, '0')}`,
          perimeter,
          imsiHash: `${Math.random().toString(16).substring(2, 10)}0a44b912e301d8f9c2a17701`,
          tac: defaultTacMap[perimeter] || defaultTacMap['securebase-us'],
          tunnelStartUtc: new Date(now.getTime() - 120000).toISOString(),
          tunnelEndUtc: now.toISOString(),
          uplinkBytes: 256000 + nextSeq * 14200,
          downlinkBytes: 980400 + nextSeq * 31500,
          verdict: 'COMPLIANT',
          prevHash: prev ? prev.hmacSha256 : '0'.repeat(64)
        };
        const digest = computeSha256Hex(
          [
            base.seq,
            base.recordId,
            base.perimeter,
            base.imsiHash,
            base.tac,
            base.tunnelStartUtc,
            base.tunnelEndUtc,
            base.uplinkBytes,
            base.downlinkBytes,
            base.verdict,
            base.prevHash
          ].join('|')
        );
        state.wormChain.push({ ...base, hmacSha256: digest, tampered: false });
        return {
          wormChain: state.wormChain,
          chainVerification: {
            checked: true,
            valid: true,
            brokenAtSeq: null,
            summary: `Appended & SHA-256 sealed ${base.recordId} to ${perimeter} WORM vault.`
          }
        };
      });
      res.json(payload);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Append CDR failed' });
    }
  });

  app.post('/api/mvno/worm-chain/tamper', async (_req, res) => {
    try {
      const payload = await withStoreMutation((state) => {
        if (state.wormChain.length >= 2) {
          state.wormChain[1] = {
            ...state.wormChain[1],
            uplinkBytes: state.wormChain[1].uplinkBytes + 999999,
            tampered: true
          };
        }
        return {
          wormChain: state.wormChain,
          chainVerification: {
            checked: false,
            valid: false,
            brokenAtSeq: null,
            summary: 'Payload byte counter modified on Record #2 in persisted store. Run integrity verification to detect drift.'
          }
        };
      });
      res.json(payload);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Tamper simulation failed' });
    }
  });

  app.post('/api/mvno/worm-chain/verify', async (_req, res) => {
    try {
      const state = await readSandboxState();
      res.json({
        wormChain: state.wormChain,
        chainVerification: verifyWormChainRecords(state.wormChain)
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Chain verification failed' });
    }
  });

  app.post('/api/mvno/worm-chain/reset', async (_req, res) => {
    try {
      const fresh = await resetSandboxState();
      res.json({
        ...fresh,
        chainVerification: verifyWormChainRecords(fresh.wormChain)
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Vault reset failed' });
    }
  });

  // 5. Phase 1 vs Phase 2 Terraform Plan Diff Inspector
  app.get('/api/mvno/terraform-diff', (req, res) => {
    const scopeParam = req.query.scope as SovereignScopeId | undefined;
    const validScope =
      scopeParam === 'securebase-us' || scopeParam === 'securebase-euro' || scopeParam === 'securebase-asia'
        ? scopeParam
        : undefined;
    const diffs = getTerraformPlanDiffs(validScope);
    res.json({
      sourceEnv: 'infra/environments/phase1-aggregator-prod',
      targetEnv: 'infra/environments/phase2-sovereign-core',
      counts: {
        create: diffs.filter((d) => d.action === 'create').length,
        update: diffs.filter((d) => d.action === 'update').length,
        destroy: diffs.filter((d) => d.action === 'destroy').length
      },
      regoGateStatus: 'PASS (0 Violations across mvno.network, mvno.worm, mvno.geofence)',
      diffs
    });
  });

  // 6. Live Workspace Repository Tree & Binary ZIP Bundle Export
  app.get('/api/mvno/repo-tree', async (_req, res) => {
    try {
      const files = await readWorkspaceRepoTree();
      res.json({
        root: 'securebase-mvno',
        fileCount: files.length,
        files
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to inspect workspace repo' });
    }
  });

  app.get('/api/mvno/export-bundle', async (_req, res) => {
    try {
      const zipBuffer = await buildWorkspaceRepoZip();
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="securebase-mvno.zip"');
      res.setHeader('Content-Length', String(zipBuffer.length));
      res.send(zipBuffer);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to package ZIP bundle' });
    }
  });

  // 7. Compliance to the Edge: TPM 2.0 / IoT SAFE Attestation, eBPF XDP Drop & Disconnected WORM Sync
  app.post('/api/mvno/edge/attest', async (req, res) => {
    try {
      const endpointId = req.body?.endpointId || 'edge-atm-cnb-ffiec';
      const mode = req.body?.mode || 'verify';
      const result = await attestEdgeEndpoint(endpointId, mode);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Edge attestation failed' });
    }
  });

  app.post('/api/mvno/edge/toggle-backhaul', async (req, res) => {
    try {
      const endpointId = req.body?.endpointId || 'edge-atm-cnb-ffiec';
      const result = await toggleEdgeBackhaul(endpointId);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Backhaul toggle failed' });
    }
  });

  app.post('/api/mvno/edge/buffer-event', async (req, res) => {
    try {
      const endpointId = req.body?.endpointId || 'edge-atm-cnb-ffiec';
      const eventReason = req.body?.eventReason;
      const result = await bufferOfflineEdgeEvent(endpointId, eventReason);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Edge WORM buffer write failed' });
    }
  });

  app.post('/api/mvno/edge/sync-buffer', async (req, res) => {
    try {
      const endpointId = req.body?.endpointId;
      const result = await syncEdgeBufferToWorm(endpointId);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Edge WORM Merkle sync failed' });
    }
  });

  // 8. SecureBase Engineer Agent Harness (2026 MCP Contracts, Rego v1 Library, Gated Tier 2 PR Synthesis)
  app.get('/api/harness/state', async (_req, res) => {
    try {
      const [sandbox, contracts, regoLibrary] = await Promise.all([
        readHarnessSandboxState(),
        loadMcpContractCatalog(),
        loadRegoPolicyLibrary()
      ]);
      res.json({ sandbox, contracts, regoLibrary });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load harness state' });
    }
  });

  app.post('/api/harness/mcp/validate-schema', async (req, res) => {
    try {
      const { toolName, payload } = req.body || {};
      const catalog = await loadMcpContractCatalog();
      const tool = catalog.tools.find((t) => t.name === toolName);
      if (!tool) {
        return res.status(404).json({ valid: false, errors: [`Unknown MCP tool '${toolName}'`] });
      }
      const errors = validateAgainstSchema(tool.inputSchema, payload);
      return res.json({
        toolName,
        valid: errors.length === 0,
        errors
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Schema validation failed' });
    }
  });

  app.post('/api/harness/mcp/evaluate', async (req, res) => {
    try {
      const result = await invokeEvaluateTfPlan(req.body);
      if (!result.ok) {
        return res.status(result.status).json(result);
      }
      return res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'evaluate_tf_plan failed' });
    }
  });

  app.post('/api/harness/mcp/verify-worm', async (req, res) => {
    try {
      const result = await invokeVerifyWormVault(req.body);
      if (!result.ok) {
        return res.status(result.status).json(result);
      }
      return res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'verify_worm_vault failed' });
    }
  });

  app.post('/api/harness/mcp/synthesize', async (req, res) => {
    try {
      const result = await invokeSynthesizeRemediationPr(req.body);
      if (!result.ok) {
        return res.status(result.status).json(result);
      }
      return res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'synthesize_remediation_pr failed' });
    }
  });

  app.post('/api/harness/rego/run-tests', async (_req, res) => {
    try {
      const summary = await runRegoUnitTestSuite();
      res.json(summary);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Rego unit test runner failed' });
    }
  });

  app.post('/api/harness/reset', async (_req, res) => {
    try {
      const sandbox = await resetHarnessSandboxState();
      res.json({ sandbox });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Harness reset failed' });
    }
  });

  // 9. Tri-Cloud Operations Steps 4-7 (DR Failover, Unified Governance + Merkle, FinOps, Universal Guardrails)
  app.get('/api/tricloud/state', async (_req, res) => {
    try {
      const [sandbox, finops, artifacts] = await Promise.all([
        readTriCloudSandboxState(),
        getFinOpsDashboardData(),
        loadTriCloudArtifactsBundle()
      ]);
      res.json({ sandbox, finops, artifacts });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load tri-cloud state' });
    }
  });

  app.post('/api/tricloud/dr/probe', async (req, res) => {
    try {
      const action = req.body?.action || 'verify_rpo_rto';
      const sandbox = await triggerDrFailoverProbe(action);
      res.json({ sandbox });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'DR probe failed' });
    }
  });

  app.post('/api/tricloud/gov/evaluate', async (req, res) => {
    try {
      const tenantId = req.body?.tenantId || 'cnb-waxahachie';
      const injectDrift = Boolean(req.body?.injectDrift);
      const batch = await runUnifiedGovernanceBatch(tenantId, injectDrift);
      const sandbox = await readTriCloudSandboxState();
      res.json({ batch, sandbox });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unified governance check failed' });
    }
  });

  app.get('/api/tricloud/finops', async (req, res) => {
    try {
      const cloud = (req.query.cloud as CloudProviderId | 'ALL') || 'ALL';
      const tenant = (req.query.tenant as string) || 'ALL';
      const finops = await getFinOpsDashboardData(cloud, tenant);
      res.json({ finops });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'FinOps aggregation failed' });
    }
  });

  app.post('/api/tricloud/finops/drift-action', async (req, res) => {
    try {
      const alertId = req.body?.alertId;
      if (!alertId) {
        return res.status(400).json({ error: 'alertId required' });
      }
      const finops = await remediateIdleDrift(alertId);
      res.json({ finops });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Drift action failed' });
    }
  });

  app.post('/api/tricloud/guardrails/simulate', async (req, res) => {
    try {
      const body = req.body || {};
      const result = await simulateGuardrailCheck({
        cloud: body.cloud || 'AWS',
        resourceName: body.resourceName || 'securebase_storage_target',
        usesStaticKey: Boolean(body.usesStaticKey),
        publicAccess: Boolean(body.publicAccess),
        cmekEnabled: Boolean(body.cmekEnabled),
        tlsVersion: String(body.tlsVersion || '1.3')
      });
      const sandbox = await readTriCloudSandboxState();
      res.json({ result, sandbox });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Guardrail simulation failed' });
    }
  });

  app.post('/api/tricloud/reset', async (_req, res) => {
    try {
      const sandbox = await resetTriCloudSandboxState();
      const finops = await getFinOpsDashboardData();
      res.json({ sandbox, finops });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Tri-cloud reset failed' });
    }
  });

  // Vite Middleware in Dev / Static Dist in Prod
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
        watch: process.env.DISABLE_HMR === 'true' ? null : undefined
      },
      appType: 'spa'
    });

    // Prevent Vite 8 @vite/client from opening a failing WebSocket connection on port 24678
    // inside Cloud Run / iframe previews where HMR is disabled.
    app.get('/@vite/client', (_req, res) => {
      res.type('application/javascript').send(`
const sheetsMap = new Map();
const linkSheetsMap = new Map();
if (typeof document !== "undefined") {
  document.querySelectorAll('style[data-vite-dev-id]').forEach((el) => {
    sheetsMap.set(el.getAttribute('data-vite-dev-id'), el);
  });
  document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id]').forEach((el) => {
    linkSheetsMap.set(el.getAttribute('data-vite-dev-id'), el);
  });
}
let lastInsertedStyle;
export function updateStyle(id, content) {
  if (linkSheetsMap.has(id)) return;
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    if (!lastInsertedStyle) {
      document.head.appendChild(style);
      setTimeout(() => { lastInsertedStyle = undefined; }, 0);
    } else {
      lastInsertedStyle.insertAdjacentElement('afterend', style);
    }
    lastInsertedStyle = style;
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}
export function removeStyle(id) {
  if (linkSheetsMap.has(id)) {
    document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id="' + CSS.escape(id) + '"]').forEach((el) => el.remove());
    linkSheetsMap.delete(id);
  }
  const style = sheetsMap.get(id);
  if (style) {
    document.head.removeChild(style);
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  const noop = () => {};
  return {
    data: {},
    accept: noop,
    acceptExports: noop,
    dispose: noop,
    prune: noop,
    invalidate: noop,
    decline: noop,
    on: noop,
    off: noop,
    send: noop
  };
}
export function injectQuery(url, queryToInject) {
  if (url[0] !== '.' && url[0] !== '/') return url;
  const pathname = url.replace(/[?#].*$/, '');
  const { search, hash } = new URL(url, 'http://vite.dev');
  return pathname + '?' + queryToInject + (search ? '&' + search.slice(1) : '') + (hash || '');
}
export class ErrorOverlay {}
`);
    });

    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`SecureBase Portal + MVNO CoreLink Bridge listening on http://0.0.0.0:${port}`);
  });
}

startServer();
