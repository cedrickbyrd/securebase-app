// pcf-mcp-bridge/session_interceptor.ts
// Sub-15ms 3GPP N7/N15 Policy Evaluation Bridge

export interface N7SessionEvent {
  sovereignScope: 'securebase-us' | 'securebase-euro' | 'securebase-asia';
  imsiSha256: string; // Zero-Custody: cleartext IMSI never leaves UDM
  imeiSv: string;
  targetTac: string;
  pduSessionId: number;
}

export async function triggerSmfSessionRelease(pduSessionId: number, reason: string): Promise<void> {
  await fetch(`http://free5gc-smf.securebase-packet-core.svc:8000/nsmf-pdusession/v1/sm-contexts/${pduSessionId}/release`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cause: 'CORELINK_POLICY_DRIFT', reason })
  });
}

export async function evaluateSessionWithMcp(evt: N7SessionEvent) {
  const start = performance.now();
  const opaRes = await fetch('http://opa-local.securebase-system.svc:8181/v1/data/mvno/geofence/decision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: evt })
  });

  const { result } = await opaRes.json();
  const elapsedMs = performance.now() - start;

  if (!result.allowed && result.action === 'SMF_PDU_SESSION_RELEASE') {
    await triggerSmfSessionRelease(evt.pduSessionId, result.reason);
  }
  return { ...result, elapsedMs };
}
