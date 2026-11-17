// eUICC / SIM Lifecycle Controller (GSMA SGP.22 / SGP.32 Posture Binding)
export type SimPduState = 'PROVISIONED' | 'ACTIVE' | 'THROTTLED_64KBPS' | 'RELEASED_QUARANTINED';

export interface SimInventoryRecord {
  imsi: string;
  eid: string;
  imeiSv: string;
  apn: string;
  tenantId: string;
  sovereignScope: 'securebase-us' | 'securebase-euro' | 'securebase-asia';
  pduState: SimPduState;
  lastTac: string;
  updatedAtUtc: string;
}

export function canActivateSim(record: SimInventoryRecord): boolean {
  return record.imsi.length === 15 && record.eid.length === 32 && record.apn.endsWith('.securebase.internal');
}
