-- Phase 6.2: Compliance Score History
-- Migration: 002_compliance_score_history.sql
-- Created: 2026-05-08
-- Purpose: Daily compliance score snapshots and control violation log for
--          SOC 2 / HIPAA / FedRAMP trend analysis.
--
-- Tables:
--   compliance_score_daily   - One row per tenant per framework per day
--   control_violation_log    - Individual control violations driving score changes
--
-- All tables enforce Row-Level Security (RLS) for multi-tenant isolation.

-- ============================================================================
-- compliance_score_daily
-- Daily snapshot written by compliance_score_recalculator.py (EventBridge cron).
-- Supports 90-day and 365-day trend charts in the compliance dashboard.
-- ============================================================================

CREATE TABLE IF NOT EXISTS compliance_score_daily (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id         UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    score_date          DATE NOT NULL,
    framework           VARCHAR(50) NOT NULL
                        CHECK (framework IN ('SOC2', 'HIPAA', 'FedRAMP', 'CIS', 'OVERALL')),
    score               NUMERIC(5,2) NOT NULL                -- 0.00 – 100.00
                        CHECK (score >= 0 AND score <= 100),
    controls_total      INTEGER NOT NULL DEFAULT 0,
    controls_passing    INTEGER NOT NULL DEFAULT 0,
    controls_failing    INTEGER NOT NULL DEFAULT 0,
    controls_unknown    INTEGER NOT NULL DEFAULT 0,
    weighted_score      NUMERIC(5,2),                        -- Weighted by control severity
    critical_violations INTEGER NOT NULL DEFAULT 0,
    high_violations     INTEGER NOT NULL DEFAULT 0,
    medium_violations   INTEGER NOT NULL DEFAULT 0,
    low_violations      INTEGER NOT NULL DEFAULT 0,
    source_data         JSONB,                               -- Raw Config/Security Hub snapshot
    calculated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One snapshot per tenant per framework per day
    CONSTRAINT uq_compliance_score_daily UNIQUE (customer_id, score_date, framework)
);

-- Primary access pattern: tenant + date range + framework
CREATE INDEX IF NOT EXISTS idx_compliance_score_daily_tenant_date
    ON compliance_score_daily (customer_id, score_date DESC, framework);

-- Trend query: latest N days for a framework
CREATE INDEX IF NOT EXISTS idx_compliance_score_daily_framework
    ON compliance_score_daily (framework, score_date DESC);

-- ============================================================================
-- control_violation_log
-- Individual control violations recorded each time the recalculator runs.
-- Retains history for up to 365 days; older rows are purged by a scheduled job.
-- ============================================================================

CREATE TABLE IF NOT EXISTS control_violation_log (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id         UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    recorded_date       DATE NOT NULL,
    framework           VARCHAR(50) NOT NULL
                        CHECK (framework IN ('SOC2', 'HIPAA', 'FedRAMP', 'CIS')),
    control_id          VARCHAR(100) NOT NULL,               -- e.g. 'CC6.1', 'HIPAA-164.312(a)(1)'
    control_name        VARCHAR(255),
    aws_config_rule     VARCHAR(255),                        -- Mapped Config rule name
    severity            VARCHAR(20) NOT NULL
                        CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL')),
    status              VARCHAR(30) NOT NULL
                        CHECK (status IN ('NON_COMPLIANT', 'COMPLIANT', 'NOT_APPLICABLE', 'INSUFFICIENT_DATA')),
    resource_type       VARCHAR(100),                        -- e.g. 'AWS::S3::Bucket'
    resource_id         VARCHAR(255),                        -- ARN or ID of non-compliant resource
    remediation_url     TEXT,
    annotation          TEXT,
    first_seen_at       TIMESTAMPTZ,
    last_seen_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Query violations for a tenant on a given date
CREATE INDEX IF NOT EXISTS idx_control_violation_log_tenant_date
    ON control_violation_log (customer_id, recorded_date DESC);

-- Query open violations by severity
CREATE INDEX IF NOT EXISTS idx_control_violation_log_severity
    ON control_violation_log (customer_id, severity, status)
    WHERE status = 'NON_COMPLIANT';

-- Query by framework + control_id for drill-down
CREATE INDEX IF NOT EXISTS idx_control_violation_log_framework_control
    ON control_violation_log (customer_id, framework, control_id);

-- Trend: how long has a specific control been failing?
CREATE INDEX IF NOT EXISTS idx_control_violation_log_first_seen
    ON control_violation_log (customer_id, framework, control_id, first_seen_at);

-- ============================================================================
-- Row-Level Security Policies
-- ============================================================================

ALTER TABLE compliance_score_daily   ENABLE ROW LEVEL SECURITY;
ALTER TABLE control_violation_log    ENABLE ROW LEVEL SECURITY;

CREATE POLICY compliance_score_daily_tenant_isolation
    ON compliance_score_daily
    USING (
        customer_id = current_setting('app.current_customer_id', true)::UUID
    );

CREATE POLICY control_violation_log_tenant_isolation
    ON control_violation_log
    USING (
        customer_id = current_setting('app.current_customer_id', true)::UUID
    );

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE compliance_score_daily IS
    'Daily compliance score snapshots per tenant per framework (Phase 6.2). '
    'Written by compliance_score_recalculator Lambda at 02:00 UTC.';

COMMENT ON TABLE control_violation_log IS
    'Individual AWS Config / Security Hub / GuardDuty control violations per day (Phase 6.2). '
    'Used for drill-down, trend analysis, and MTTR calculation.';

COMMENT ON COLUMN compliance_score_daily.weighted_score IS
    'Weighted score accounting for control severity: CRITICAL=3x, HIGH=2x, MEDIUM=1x, LOW=0.5x.';

COMMENT ON COLUMN control_violation_log.first_seen_at IS
    'Timestamp of first recorded violation. Used to calculate Mean Time to Remediate (MTTR).';
