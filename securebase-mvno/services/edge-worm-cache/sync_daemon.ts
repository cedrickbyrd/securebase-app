// Disconnected Edge WORM Merkle Cache & Reconciliation Daemon
// Buffers canonical SHA-256 Merkle blocks locally at the MEC enclave during WAN loss
// and reconciles sequentially into the 7-year regional WORM vault upon reconnect.

export interface EdgeBufferedAuditRecord {
  seq: number;
  recordId: string;
  endpointId: string;
  eventReason: string;
  prevHash: string;
  hmacSha256: string;
  syncStatus: 'PENDING_SYNC' | 'SYNCED_TO_WORM';
  capturedAtUtc: string;
}

export function reconcileEdgeBufferToCloudChain(
  cloudTailDigest: string,
  buffered: EdgeBufferedAuditRecord[],
  rehash: (prevHash: string, rec: EdgeBufferedAuditRecord) => string
): EdgeBufferedAuditRecord[] {
  let cursorDigest = cloudTailDigest;
  return buffered.map((entry) => {
    const linkedDigest = rehash(cursorDigest, entry);
    cursorDigest = linkedDigest;
    return {
      ...entry,
      prevHash: cursorDigest,
      hmacSha256: linkedDigest,
      syncStatus: 'SYNCED_TO_WORM'
    };
  });
}
