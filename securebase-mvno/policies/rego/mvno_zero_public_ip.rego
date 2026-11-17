package mvno.network

import rego.v1

# Deny any UPF N6 / Private APN pool that allocates publicly routable IPv4 ranges
deny contains msg if {
  some resource in input.planned_values.root_module.resources
  resource.type == "securebase_mvno_apn_pool"
  cidr := resource.values.ue_cidr_block
  not is_private_or_cgnat(cidr)
  msg := sprintf(
    "CRITICAL [NIST SC-7 / HIPAA 164.312(e)(1)]: APN pool '%s' (%s) must use RFC 1918 or RFC 6598 (100.64.0.0/10) non-routable space.",
    [resource.values.apn_name, cidr]
  )
}

deny contains msg if {
  some resource in input.planned_values.root_module.resources
  resource.type == "securebase_mvno_breakout"
  resource.values.allow_internet_egress == true
  msg := sprintf(
    "CRITICAL [FFIEC AIO II.C]: Tenant breakout '%s' must terminate strictly via AWS PrivateLink or GCP PSC with zero public egress.",
    [resource.values.tenant_id]
  )
}

is_private_or_cgnat(cidr) if {
  net.cidr_contains("100.64.0.0/10", cidr)
}

is_private_or_cgnat(cidr) if {
  net.cidr_contains("10.0.0.0/8", cidr)
}

is_private_or_cgnat(cidr) if {
  net.cidr_contains("172.16.0.0/12", cidr)
}
