package securebase.tricloud.governance

import rego.v1

# SecureBase Step 5: Unified Tri-Cloud Governance (AWS + GCP + Azure)
# Maps normalized CloudTrail/Config, Cloud Audit/SCC, and Azure Activity/Defender
# telemetry into FFIEC, HIPAA 164.312, SOC 2 Type II, and NIST 800-53 violations.

violations["NIST_800_53"] contains finding if {
  some evt in input.events
  evt.authMethod in {"STATIC_KEY", "CLIENT_SECRET"}
  finding := {
    "finding_id": sprintf("tricloud-auth-%s", [evt.eventId]),
    "cloud": evt.cloud,
    "framework": "NIST_800_53",
    "control": "NIST SP 800-53 IA-5 / Zero Static Credentials",
    "resource_id": evt.resourceId,
    "severity": "CRITICAL",
    "reason": sprintf("[%s] Non-OIDC static auth '%s' detected on '%s'; WIF/OIDC required.", [evt.cloud, evt.authMethod, evt.actorIdentity]),
  }
}

violations["HIPAA_164_312"] contains finding if {
  some evt in input.events
  evt.encryptionCmek == false
  finding := {
    "finding_id": sprintf("tricloud-cmek-%s", [evt.eventId]),
    "cloud": evt.cloud,
    "framework": "HIPAA_164_312",
    "control": "HIPAA 45 CFR 164.312(a)(2)(iv) (CMEK Encryption)",
    "resource_id": evt.resourceId,
    "severity": "CRITICAL",
    "reason": sprintf("[%s] Resource '%s' missing customer-managed KMS/KeyVault CMEK.", [evt.cloud, evt.resourceId]),
  }
}

violations["HIPAA_164_312"] contains finding if {
  some evt in input.events
  evt.tlsVersion != "1.3"
  finding := {
    "finding_id": sprintf("tricloud-tls-%s", [evt.eventId]),
    "cloud": evt.cloud,
    "framework": "HIPAA_164_312",
    "control": "HIPAA 45 CFR 164.312(e)(1) (TLS 1.3 In-Transit)",
    "resource_id": evt.resourceId,
    "severity": "HIGH",
    "reason": sprintf("[%s] Endpoint '%s' negotiated TLS '%s'; TLS 1.3 is mandatory.", [evt.cloud, evt.resourceId, evt.tlsVersion]),
  }
}

violations["SOC2_TYPE_II"] contains finding if {
  some evt in input.events
  evt.publicExposure == true
  finding := {
    "finding_id": sprintf("tricloud-public-%s", [evt.eventId]),
    "cloud": evt.cloud,
    "framework": "SOC2_TYPE_II",
    "control": "SOC 2 CC6.1 / CC6.6 Logical Boundary Isolation",
    "resource_id": evt.resourceId,
    "severity": "CRITICAL",
    "reason": sprintf("[%s] Public storage or ingress exposure enabled on '%s'.", [evt.cloud, evt.resourceId]),
  }
}

violations["FFIEC_AIO"] contains finding if {
  some evt in input.events
  evt.resourceType == "WORM_EVIDENCE_VAULT"
  evt.objectLockMode != "COMPLIANCE"
  finding := {
    "finding_id": sprintf("tricloud-worm-%s", [evt.eventId]),
    "cloud": evt.cloud,
    "framework": "FFIEC_AIO",
    "control": "FFIEC AIO II.C / 7-Year COMPLIANCE WORM Lock",
    "resource_id": evt.resourceId,
    "severity": "CRITICAL",
    "reason": sprintf("[%s] WORM vault '%s' lock mode is '%s'; must be COMPLIANCE.", [evt.cloud, evt.resourceId, evt.objectLockMode]),
  }
}
