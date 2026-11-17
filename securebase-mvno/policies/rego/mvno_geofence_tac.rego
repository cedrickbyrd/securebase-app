package mvno.geofence

import rego.v1

# Sovereign Tracking Area Code (TAC) allowlists by tenant perimeter
allowed_tacs := {
  "securebase-us": {"TAC-0x1A2B", "TAC-0x1A2C", "TAC-0x4E10"},
  "securebase-euro": {"TAC-0x2F01", "TAC-0x2F09"},
  "securebase-asia": {"TAC-0x3C11", "TAC-0x3C44"},
}

default decision := {
  "action": "SMF_PDU_SESSION_RELEASE",
  "allowed": false,
  "reason": "Target TAC outside authorized sovereign geofence",
}

decision := {
  "action": "ALLOW",
  "allowed": true,
  "reason": "Verified TAC & eUICC IMEI-SV baseline",
} if {
  input.event_type in {"N7_PDU_SESSION_ESTABLISH", "N15_TOWER_HANDOVER"}
  tac_prefix := split(input.target_tac, " ")[0]
  tac_prefix in allowed_tacs[input.sovereign_scope]
  input.imei_sv_verified == true
}

decision := {
  "action": "PCF_QOS_THROTTLE",
  "allowed": false,
  "throttle_kbps": 64,
  "reason": "IMEI-SV baseband mismatch detected - dynamic quarantine slice applied",
} if {
  tac_prefix := split(input.target_tac, " ")[0]
  tac_prefix in allowed_tacs[input.sovereign_scope]
  input.imei_sv_verified == false
}
