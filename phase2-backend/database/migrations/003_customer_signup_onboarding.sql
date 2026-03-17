-- SecureBase: Customer Self-Service & Onboarding Schema
-- Migration: 003_customer_signup_onboarding.sql
-- NOTE: Uses 'signup_requests' table (not 'customers') to avoid conflict with the
-- Phase 2 schema.sql 'customers' table which has a different structure.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS signup_requests (
    id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    email               VARCHAR(320)    NOT NULL,
    first_name          VARCHAR(100)    NOT NULL,
    last_name           VARCHAR(100)    NOT NULL,
    org_name            VARCHAR(200)    NOT NULL,
    org_size            VARCHAR(20)     NOT NULL,
    industry            VARCHAR(50)     NOT NULL,
    aws_account_id      VARCHAR(12),
    aws_region          VARCHAR(25)     NOT NULL DEFAULT 'us-east-1',
    mfa_enabled         BOOLEAN         NOT NULL DEFAULT TRUE,
    guardrails_level    VARCHAR(20)     NOT NULL DEFAULT 'standard' CHECK (guardrails_level IN ('standard','enhanced','sovereign')),
    onboarding_status   VARCHAR(30)     NOT NULL DEFAULT 'pending' CHECK (onboarding_status IN ('pending','in_progress','completed','failed')),
    email_verified      BOOLEAN         NOT NULL DEFAULT FALSE,
    email_verified_at   TIMESTAMPTZ,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_signup_requests_email ON signup_requests (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_signup_requests_aws_account ON signup_requests (aws_account_id);
CREATE INDEX IF NOT EXISTS idx_signup_requests_onboarding_status ON signup_requests (onboarding_status);

CREATE TABLE IF NOT EXISTS onboarding_jobs (
    id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id         UUID            NOT NULL REFERENCES signup_requests(id) ON DELETE CASCADE,
    overall_status      VARCHAR(20)     NOT NULL DEFAULT 'pending' CHECK (overall_status IN ('pending','in_progress','completed','failed')),
    aws_account_id      VARCHAR(12),
    codebuild_build_id  VARCHAR(200),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_onboarding_jobs_customer ON onboarding_jobs (customer_id);

CREATE TABLE IF NOT EXISTS onboarding_steps (
    id              SERIAL          PRIMARY KEY,
    job_id          UUID            NOT NULL REFERENCES onboarding_jobs(id) ON DELETE CASCADE,
    step_key        VARCHAR(50)     NOT NULL,
    status          VARCHAR(20)     NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','failed')),
    error_message   TEXT,
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_onboarding_step ON onboarding_steps (job_id, step_key);

CREATE TABLE IF NOT EXISTS onboarding_events (
    id              BIGSERIAL       PRIMARY KEY,
    job_id          UUID            NOT NULL REFERENCES onboarding_jobs(id),
    customer_id     UUID            NOT NULL REFERENCES signup_requests(id),
    event_type      VARCHAR(50)     NOT NULL,
    step_key        VARCHAR(50),
    payload         JSONB           DEFAULT '{}',
    severity        VARCHAR(10)     NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warn','error')),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_events_job_id ON onboarding_events (job_id);
CREATE INDEX IF NOT EXISTS idx_events_customer_id ON onboarding_events (customer_id);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at=NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_signup_requests_updated_at') THEN CREATE TRIGGER trg_signup_requests_updated_at BEFORE UPDATE ON signup_requests FOR EACH ROW EXECUTE FUNCTION set_updated_at(); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_onboarding_jobs_updated_at') THEN CREATE TRIGGER trg_onboarding_jobs_updated_at BEFORE UPDATE ON onboarding_jobs FOR EACH ROW EXECUTE FUNCTION set_updated_at(); END IF;
END $$;

COMMENT ON TABLE signup_requests IS 'PII table — email, first_name, last_name are sensitive. Do not log in CloudWatch.';
COMMENT ON TABLE onboarding_events IS 'Append-only audit log. Never UPDATE or DELETE.';
