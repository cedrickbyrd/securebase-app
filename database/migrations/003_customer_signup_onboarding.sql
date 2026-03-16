-- ============================================================
-- Migration: 003_customer_signup_onboarding.sql
-- SecureBase – self-service signup & onboarding schema
-- ============================================================
-- Idempotent (IF NOT EXISTS).  Apply after 001 and 002.
-- Tables:
--   customers          – extended with onboarding fields
--   onboarding_jobs    – one job per customer provisioning run
--   onboarding_steps   – individual provisioning steps per job
--   onboarding_events  – append-only audit log of step transitions
-- ============================================================

-- ── Extensions (idempotent) ────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Enum types ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE onboarding_job_status AS ENUM (
    'pending',
    'waiting_for_email',
    'in_progress',
    'complete',
    'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE onboarding_step_status AS ENUM (
    'pending',
    'in_progress',
    'complete',
    'failed',
    'skipped'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── customers table (extended) ─────────────────────────────
-- If the table already exists from schema.sql (Phase 2) we ADD
-- the new columns; otherwise we create the full table.

CREATE TABLE IF NOT EXISTS customers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- PII – handle with care
  first_name        TEXT NOT NULL,
  last_name         TEXT NOT NULL,
  email             TEXT NOT NULL UNIQUE,
  company_name      TEXT NOT NULL,
  company_size      TEXT,
  industry          TEXT,
  phone             TEXT,   -- optional

  -- Account configuration
  tier              TEXT NOT NULL DEFAULT 'standard',
  aws_region        TEXT NOT NULL DEFAULT 'us-east-1',
  mfa_required      BOOLEAN NOT NULL DEFAULT TRUE,

  -- AWS linkage (populated during provisioning)
  aws_account_id    TEXT UNIQUE,

  -- Lifecycle
  status            TEXT NOT NULL DEFAULT 'pending_verification',
  email_verified    BOOLEAN NOT NULL DEFAULT FALSE,

  -- Timestamps
  created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE
);

-- Add new columns if the table already existed (Phase 2 schema)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS first_name     TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_name      TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_size   TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS industry       TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone          TEXT;
-- Nullable first, then set default to avoid failure on existing rows
ALTER TABLE customers ADD COLUMN IF NOT EXISTS aws_region     TEXT;
UPDATE customers SET aws_region = 'us-east-1' WHERE aws_region IS NULL;
ALTER TABLE customers ALTER COLUMN aws_region SET DEFAULT 'us-east-1';
ALTER TABLE customers ALTER COLUMN aws_region SET NOT NULL;
-- Same two-step for mfa_required
ALTER TABLE customers ADD COLUMN IF NOT EXISTS mfa_required   BOOLEAN;
UPDATE customers SET mfa_required = TRUE WHERE mfa_required IS NULL;
ALTER TABLE customers ALTER COLUMN mfa_required SET DEFAULT TRUE;
ALTER TABLE customers ALTER COLUMN mfa_required SET NOT NULL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS aws_account_id TEXT;
-- email_verified: default false, backfill, then enforce NOT NULL
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email_verified BOOLEAN;
UPDATE customers SET email_verified = FALSE WHERE email_verified IS NULL;
ALTER TABLE customers ALTER COLUMN email_verified SET DEFAULT FALSE;
ALTER TABLE customers ALTER COLUMN email_verified SET NOT NULL;

-- ── onboarding_jobs ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS onboarding_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  status        onboarding_job_status NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_onboarding_jobs_customer
  ON onboarding_jobs (customer_id);

-- ── onboarding_steps ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS onboarding_steps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id        UUID NOT NULL REFERENCES onboarding_jobs(id) ON DELETE CASCADE,

  -- Canonical step identifier (must match STEP_KEYS in account_provisioner.py)
  step_key      TEXT NOT NULL,
  status        onboarding_step_status NOT NULL DEFAULT 'pending',
  error_message TEXT,

  started_at    TIMESTAMP WITH TIME ZONE,
  completed_at  TIMESTAMP WITH TIME ZONE,
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE,

  CONSTRAINT uq_job_step UNIQUE (job_id, step_key)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_steps_job
  ON onboarding_steps (job_id);

-- ── onboarding_events (append-only audit log) ─────────────
CREATE TABLE IF NOT EXISTS onboarding_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id        UUID NOT NULL REFERENCES onboarding_jobs(id) ON DELETE CASCADE,
  step_key      TEXT NOT NULL,

  -- e.g. "step_in_progress", "step_complete", "step_failed"
  event_type    TEXT NOT NULL,
  detail        JSONB NOT NULL DEFAULT '{}',

  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_events_job
  ON onboarding_events (job_id);

-- Prevent deletes and updates on the audit log
CREATE OR REPLACE RULE onboarding_events_no_delete AS
  ON DELETE TO onboarding_events DO INSTEAD NOTHING;

CREATE OR REPLACE RULE onboarding_events_no_update AS
  ON UPDATE TO onboarding_events DO INSTEAD NOTHING;

-- ── updated_at triggers ────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_onboarding_jobs_updated_at
    BEFORE UPDATE ON onboarding_jobs
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_onboarding_steps_updated_at
    BEFORE UPDATE ON onboarding_steps
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Row-Level Security stubs ───────────────────────────────
-- Enable RLS on all new tables.  Policies enforce that
-- app.current_customer_id matches the customer_id column.
-- (Mirrors the existing RLS approach from schema.sql Phase 2)

ALTER TABLE onboarding_jobs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_events ENABLE ROW LEVEL SECURITY;

-- onboarding_jobs: customers see only their own job
CREATE POLICY IF NOT EXISTS onboarding_jobs_customer_isolation
  ON onboarding_jobs
  USING (
    customer_id = current_setting('app.current_customer_id', TRUE)::UUID
  );

-- onboarding_steps: via job → customer
CREATE POLICY IF NOT EXISTS onboarding_steps_customer_isolation
  ON onboarding_steps
  USING (
    job_id IN (
      SELECT id FROM onboarding_jobs
      WHERE customer_id = current_setting('app.current_customer_id', TRUE)::UUID
    )
  );

-- onboarding_events: via job → customer (read-only for customer)
CREATE POLICY IF NOT EXISTS onboarding_events_customer_isolation
  ON onboarding_events
  FOR SELECT
  USING (
    job_id IN (
      SELECT id FROM onboarding_jobs
      WHERE customer_id = current_setting('app.current_customer_id', TRUE)::UUID
    )
  );

-- ── Indexes for performance ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_customers_email
  ON customers (email);

CREATE INDEX IF NOT EXISTS idx_customers_status
  ON customers (status);

CREATE INDEX IF NOT EXISTS idx_customers_aws_account
  ON customers (aws_account_id);

-- ============================================================
-- End of migration 003
-- ============================================================
