# SecureBase MVNO (`securebase-mvno`)

Enterprise zero-trust cellular transport and compliance governance engine built by **TxImhotep LLC**.

## Commercial Stack
- **SecureBase Sovereign Connect:** End-to-end zero-trust enterprise mobility and out-of-band branch failover.
- **SecureBase Private APN:** Dedicated carrier-grade APN routing cellular packet traffic directly into client VPCs via IPsec/Direct Connect/PrivateLink/PSC.
- **SecureBase CoreLink:** `securebase-mcp` governance bridge enforcing continuous FFIEC/HIPAA/DORA/MAS TRM posture gates and S3/GCS WORM evidence anchoring.

## Sovereign Perimeters
- `securebase-us`: `us-central1` / `us-east4` (FFIEC AIO, HIPAA 164.312(e)(1), NIST SP 800-53 SC-7)
- `securebase-euro`: `europe-west3` / `europe-west4` (EU DORA, GDPR Art. 32, BSI C5)
- `securebase-asia`: `asia-southeast1` / `asia-northeast1` (Singapore MAS TRM, Japan ISMAP)

## Rollout Phases
1. **Phase 1 (Light MVNO / Aggregator Breakout):** Low-CapEx Private APN termination into isolated transit VPCs (Clients 5-9).
2. **Phase 2 (Thick MVNO Packet Core):** Cloud-native 5G/LTE SBA core (AMF, SMF, UDM/AUSF, eBPF UPF) triggered at 10 paying enterprise clients.
