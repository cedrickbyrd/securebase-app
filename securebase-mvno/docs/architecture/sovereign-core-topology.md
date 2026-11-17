# SecureBase MVNO Sovereign Core Topology

## Four Deterministic Layers
1. **Cloud-Native 5G/4G Packet Core (`free5GC R17+ / eBPF UPF`)**: Stateless AMF, SMF, AUSF, UDM, UDR, NRF, PCF control plane paired with Linux kernel `gtp5g` / eBPF XDP user plane and Multus CNI separation across N2, N3, N4, and N6 interfaces.
2. **Sovereign VPC Breakout & Private APN Routing**: Allocates RFC 6598 (`100.64.0.0/16`) / RFC 1918 non-routable IP pools per tenant (`apn.<tenant>.<scope>.securebase.internal`), terminating directly into customer VPCs via AWS PrivateLink / TGW VPN or GCP Private Service Connect / HA Cloud VPN.
3. **Policy-as-Code Integration (`CoreLink MCP Bridge`)**: Intercepts 3GPP N7/N15 session establishment and cell handover events, evaluating salted IMSI, IMEI-SV, and Tracking Area Code (TAC) geofences in `< 15 ms` before issuing `ALLOW`, `PCF_QOS_THROTTLE`, or `SMF_PDU_SESSION_RELEASE`.
4. **Immutable CDR & Telemetry Vaulting**: Zero-payload metadata extraction chained via SHA-256 HMAC and committed to 7-year (2,555-day) S3/GCS Object Lock COMPLIANCE vaults.
