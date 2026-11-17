package mvno.edge

import rego.v1

# Enforces GSMA IoT SAFE hardware identity + TPM 2.0 PCR0/PCR7 measurements prior to eBPF XDP_PASS

default decision := {
  "action": "XDP_DROP_AND_PFCP_DELETE",
  "allowed": false,
  "ulcl_state": "PFCP_FAR_DROP",
  "reason": "Edge hardware posture failed mandatory zero-trust verification",
}

decision := {
  "action": "XDP_PASS_AND_MEC_STEER",
  "allowed": true,
  "ulcl_state": "MEC_LOCAL_STEER",
  "reason": "GSMA IoT SAFE signature and TPM 2.0 PCR0/PCR7 measurements verified; N6 public egress disabled",
} if {
  input.public_breakout == false
  input.tunnel_state == "UP"
  input.iot_safe_sig_valid == true
  input.reported_pcr0 == input.expected_pcr0
  input.reported_pcr7 == input.expected_pcr7
  input.mcc in {"310", "311", "312", "313", "316"}
}

deny contains msg if {
  input.reported_pcr7 != input.expected_pcr7
  msg := sprintf(
    "CRITICAL [TPM 2.0 PCR7 DRIFT]: Edge endpoint '%s' PCR7 mismatch (expected=%s, got=%s) -> evicting UE IP via XDP_DROP.",
    [input.endpoint_id, input.expected_pcr7, input.reported_pcr7]
  )
}

deny contains msg if {
  input.iot_safe_sig_valid != true
  msg := sprintf(
    "CRITICAL [GSMA IoT SAFE]: Edge endpoint '%s' SIM applet signature invalid -> triggering PFCP Session Deletion.",
    [input.endpoint_id]
  )
}
