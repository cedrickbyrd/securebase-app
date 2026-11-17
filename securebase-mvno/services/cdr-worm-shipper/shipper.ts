// Zero-Custody CDR Extractor: Strips payload, hashes IMSI, appends WORM block
export interface ZeroCustodyCdr {
  seq: number;
  recordId: string;
  perimeter: 'securebase-us' | 'securebase-euro' | 'securebase-asia';
  imsiHash: string;
  tac: string;
  tunnelStartUtc: string;
  tunnelEndUtc: string;
  uplinkBytes: number;
  downlinkBytes: number;
  verdict: 'COMPLIANT' | 'QUARANTINED';
  prevHash: string;
  hmacSha256: string;
}

export function serializeCdrDigestInput(cdr: Omit<ZeroCustodyCdr, 'hmacSha256'>): string {
  return [
    cdr.seq,
    cdr.recordId,
    cdr.perimeter,
    cdr.imsiHash,
    cdr.tac,
    cdr.tunnelStartUtc,
    cdr.tunnelEndUtc,
    cdr.uplinkBytes,
    cdr.downlinkBytes,
    cdr.verdict,
    cdr.prevHash
  ].join('|');
}
