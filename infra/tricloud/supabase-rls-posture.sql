-- SecureBase Step 5: Supabase RLS Posture & Merkle WORM Attestation Schema
-- Ensures tenant isolation via Row-Level Security and anchors every batch Merkle root.

CREATE TABLE IF NOT EXISTS public.tricloud_merkle_batches (
  batch_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  collected_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  merkle_root_sha256 CHAR(64) NOT NULL,
  leaf_count INTEGER NOT NULL CHECK (leaf_count > 0),
  worm_vault_urn TEXT NOT NULL,
  retention_mode TEXT NOT NULL CHECK (retention_mode = 'COMPLIANCE'),
  retention_days INTEGER NOT NULL CHECK (retention_days >= 2555),
  posture_status TEXT NOT NULL CHECK (posture_status IN ('COMPLIANT', 'DRIFT_DETECTED')),
  violations_json JSONB NOT NULL DEFAULT '[]'::jsonb
);

ALTER TABLE public.tricloud_merkle_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_select
  ON public.tricloud_merkle_batches
  FOR SELECT
  USING (tenant_id = current_setting('request.jwt.claims', true)::jsonb->>'tenant_id');

CREATE POLICY oidc_service_insert_only
  ON public.tricloud_merkle_batches
  FOR INSERT
  WITH CHECK (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'securebase_oidc_ingestor');
