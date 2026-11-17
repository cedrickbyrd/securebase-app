# USPTO Provisional Patent Specification (TxImhotep LLC)

- **Title:** System and Method for Policy-Before-Packet Kernel-Space Cellular Data Plane Quarantine and Cryptographic Merkle-Chained Write-Once-Read-Many (WORM) Compliance Attestation
- **Inventor:** Cedrick Jurone Byrd (Waxahachie, Texas)
- **Assignee:** TxImhotep LLC (Texas Limited Liability Company)
- **Filing Type:** Provisional Utility Patent Application (35 U.S.C. § 111(b))
- **PDF Reference:** `/assets/aistudio/USPTO_Provisional_Patent_Application___TxImhotep_LLC-1_43ee34cf.pdf`

## Architectural Alignment with `securebase-mvno`

1. **User-Space Go Session Gatekeeper (`services/corelink-mcp-server`)**: Exchanges ephemeral short-lived tokens (`<= 3,600s` TTL), validates `VerifySovereignBoundary()` (`useInternetGateway == false`), and evaluates normalized `OverlayInput` (`iccid`, `imsi`, `imei`, `assigned_private_ip`, `apn`, `mcc`, `public_breakout`, `tunnel_state`) against compiled OPA Rego v1 policies (`policies/rego/`).
2. **Kernel-Space eBPF XDP Packet Filter (`packet-core/user-plane/upf-ebpf`)**:
   - **Phase 1**: Enforces `xdp.PermitIP` (`XDP_PASS`) vs `xdp.DropIP` (`XDP_DROP` prior to kernel `sk_buff` allocation) + out-of-band `SuspendSession` / RFC 5176 RADIUS CoA Disconnect.
   - **Phase 2 (5G SA Thick Core)**: Parses outer 3GPP N3 GTP-U and inner UE IP headers in XDP prior to decapsulation, binds customer-controlled HSM `Ki`/`OPc` in AUSF/UDM, triggers N4 PFCP Session Deletion / FAR=DROP on violation, and enforces Uplink Classifier (`UL CL`) steering with N6 public internet block.
3. **SHA-256 Merkle-Chained 7-Year WORM Vault (`infra/modules/worm-telemetry-vault`, `services/cdr-worm-shipper`)**:
   - `H(N) = SHA-256(H(N-1) || CanonicalJSON(Record_N))`
   - Committed with `ChecksumAlgorithm: SHA256` to 2,555-day `COMPLIANCE` mode Object Lock with KMS CMEK and explicit IAM delete denies.

## Claims Coverage (Claims 1-12)
- **Claims 1-5**: Zero-trust cellular-to-cloud compliance enforcement system (eBPF XDP map gating, VPG `public_breakout == false` check, IMEI/APN/MCC guardrails, `<= 3,600s` ephemeral auth, GSMA IoT SAFE + TPM 2.0 PCR quote).
- **Claims 6-7**: Computer-implemented method & non-transitory CRM for policy-before-packet quarantine and SHA-256 Merkle-chained WORM attestation.
- **Claims 8-12**: Phase 2 5G SA N3 GTP-U XDP inspection, customer-HSM 5G-AKA (`AUSF`/`UDM`), N4 PFCP Session Deletion/FAR=DROP, dynamic Phase 1 -> Phase 2 tenant migration preserving unified ICCID Merkle ledger, and `UL CL` MEC steering.
