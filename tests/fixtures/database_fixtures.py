"""
Database test fixtures for SecureBase integration tests.

Provides:
  - setup_test_schema  : session-scoped fixture that creates (or re-creates)
                         the minimal test schema in the test PostgreSQL database.
  - seed_test_data     : function-scoped fixture that inserts a standard set of
                         test rows and removes them after each test.
  - test_customer_row  : convenience fixture that returns the dict describing the
                         pre-seeded test customer.
  - test_api_key_row   : convenience fixture that returns the pre-seeded API key.
  - test_invoice_row   : convenience fixture that returns the pre-seeded invoice.
"""

import pytest
import uuid
from datetime import datetime, timezone


# ---------------------------------------------------------------------------
# Schema DDL
# ---------------------------------------------------------------------------

_TEST_SCHEMA_DDL = """
-- Required PostgreSQL extensions (no-op if already installed)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Custom ENUM types ─────────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE customer_tier AS ENUM
        ('standard', 'fintech', 'healthcare', 'gov-federal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE customer_status AS ENUM
        ('active', 'suspended', 'deleted', 'trial');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE compliance_framework AS ENUM
        ('soc2', 'hipaa', 'fedramp', 'cis');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE payment_method_type AS ENUM
        ('stripe', 'aws_marketplace', 'invoice');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE invoice_status AS ENUM
        ('draft', 'issued', 'paid', 'overdue', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE notification_channel AS ENUM
        ('email', 'sms', 'webhook');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM
        ('invoice_issued', 'compliance_alert', 'system_update', 'support_response');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── customers ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                     TEXT NOT NULL UNIQUE,
    tier                     customer_tier NOT NULL,
    framework                compliance_framework NOT NULL,
    status                   customer_status DEFAULT 'active',
    aws_org_id               TEXT UNIQUE,
    aws_management_account_id TEXT,
    email                    TEXT NOT NULL UNIQUE,
    billing_email            TEXT NOT NULL,
    billing_contact_phone    TEXT,
    mfa_enforced             BOOLEAN DEFAULT TRUE,
    audit_retention_days     INTEGER DEFAULT 2555,
    encryption_required      BOOLEAN DEFAULT TRUE,
    vpc_isolation_enabled    BOOLEAN DEFAULT TRUE,
    payment_method           payment_method_type DEFAULT 'aws_marketplace',
    stripe_customer_id       TEXT UNIQUE,
    stripe_subscription_id   TEXT UNIQUE,
    subscription_status      TEXT DEFAULT 'inactive',
    trial_end_date           TIMESTAMP,
    tags                     JSONB DEFAULT '{}',
    custom_config            JSONB DEFAULT '{}',
    created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── api_keys ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id  UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    key_prefix   TEXT NOT NULL,
    key_hash     TEXT NOT NULL,
    name         TEXT NOT NULL DEFAULT 'Default',
    is_active    BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMP,
    expires_at   TIMESTAMP,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by   TEXT
);

-- ── invoices ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    month       TEXT NOT NULL,
    status      invoice_status DEFAULT 'draft',
    amount_usd  NUMERIC(12, 2) NOT NULL DEFAULT 0,
    issued_at   TIMESTAMP,
    due_at      TIMESTAMP,
    paid_at     TIMESTAMP,
    pdf_s3_key  TEXT,
    line_items  JSONB DEFAULT '[]',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── audit_events ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_events (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id   UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    event_type    TEXT NOT NULL,
    resource_type TEXT,
    resource_id   TEXT,
    actor_email   TEXT,
    actor_ip      TEXT,
    metadata      JSONB DEFAULT '{}',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""

_CLEANUP_CUSTOMER_IDS_PREFIX = "test-"


# ---------------------------------------------------------------------------
# Schema setup (session-scoped — runs once per test session)
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def setup_test_schema(db_connection):
    """
    Create (or ensure) the test database schema exists.

    Runs once per test session.  Requires the ``db_connection`` fixture from
    ``tests/conftest.py`` — it is automatically skipped when no test database
    is reachable, so this fixture inherits that safe behaviour.
    """
    cursor = db_connection.cursor()
    try:
        cursor.execute(_TEST_SCHEMA_DDL)
        db_connection.commit()
    finally:
        cursor.close()
    yield
    # No teardown — schema is intentionally left in place between runs so that
    # manual inspection is possible after a test failure.


# ---------------------------------------------------------------------------
# Seed data (function-scoped — isolated per test)
# ---------------------------------------------------------------------------

_TEST_CUSTOMER_ID = "a0000000-0000-0000-0000-000000000001"
_TEST_API_KEY_ID = "a0000000-0000-0000-0000-000000000002"
_TEST_INVOICE_ID = "a0000000-0000-0000-0000-000000000003"


@pytest.fixture
def seed_test_data(setup_test_schema, db_connection):
    """
    Insert a canonical set of test rows before each test, then remove them.

    Inserted rows:
      * One ``customers`` row   (id = _TEST_CUSTOMER_ID)
      * One ``api_keys`` row    (id = _TEST_API_KEY_ID)
      * One ``invoices`` row    (id = _TEST_INVOICE_ID)

    All rows use a deterministic UUID so tests can reference them by constant
    values rather than querying for them first.
    """
    cursor = db_connection.cursor()
    try:
        # customers
        cursor.execute(
            """
            INSERT INTO customers (
                id, name, tier, framework, status,
                email, billing_email
            ) VALUES (
                %s, %s, 'standard'::customer_tier, 'cis'::compliance_framework,
                'active'::customer_status, %s, %s
            )
            ON CONFLICT (id) DO NOTHING
            """,
            (
                _TEST_CUSTOMER_ID,
                "SecureBase Integration Test Customer",
                "admin@test-integration.example.com",
                "billing@test-integration.example.com",
            ),
        )

        # api_keys
        cursor.execute(
            """
            INSERT INTO api_keys (id, customer_id, key_prefix, key_hash, name)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (id) DO NOTHING
            """,
            (
                _TEST_API_KEY_ID,
                _TEST_CUSTOMER_ID,
                "sk_test_",
                "test-hash-placeholder",
                "Test API Key",
            ),
        )

        # invoices
        cursor.execute(
            """
            INSERT INTO invoices (id, customer_id, month, status, amount_usd)
            VALUES (%s, %s, %s, 'draft'::invoice_status, %s)
            ON CONFLICT (id) DO NOTHING
            """,
            (
                _TEST_INVOICE_ID,
                _TEST_CUSTOMER_ID,
                datetime.now(timezone.utc).strftime("%Y-%m"),
                999.00,
            ),
        )

        db_connection.commit()
    except Exception:
        db_connection.rollback()
        raise
    finally:
        cursor.close()

    yield

    # Cleanup: remove seeded rows in reverse FK order
    cursor = db_connection.cursor()
    try:
        cursor.execute("DELETE FROM invoices     WHERE id = %s", (_TEST_INVOICE_ID,))
        cursor.execute("DELETE FROM api_keys     WHERE id = %s", (_TEST_API_KEY_ID,))
        cursor.execute("DELETE FROM audit_events WHERE customer_id = %s", (_TEST_CUSTOMER_ID,))
        cursor.execute("DELETE FROM customers    WHERE id = %s", (_TEST_CUSTOMER_ID,))
        db_connection.commit()
    except Exception:
        db_connection.rollback()
    finally:
        cursor.close()


# ---------------------------------------------------------------------------
# Convenience row fixtures (depend on seed_test_data)
# ---------------------------------------------------------------------------

@pytest.fixture
def test_customer_row(seed_test_data):
    """Return the dict for the pre-seeded test customer."""
    return {
        "id": _TEST_CUSTOMER_ID,
        "name": "SecureBase Integration Test Customer",
        "tier": "standard",
        "framework": "cis",
        "status": "active",
        "email": "admin@test-integration.example.com",
        "billing_email": "billing@test-integration.example.com",
    }


@pytest.fixture
def test_api_key_row(seed_test_data):
    """Return the dict for the pre-seeded test API key."""
    return {
        "id": _TEST_API_KEY_ID,
        "customer_id": _TEST_CUSTOMER_ID,
        "key_prefix": "sk_test_",
        "key_hash": "test-hash-placeholder",
        "name": "Test API Key",
        "is_active": True,
    }


@pytest.fixture
def test_invoice_row(seed_test_data):
    """Return the dict for the pre-seeded test invoice."""
    return {
        "id": _TEST_INVOICE_ID,
        "customer_id": _TEST_CUSTOMER_ID,
        "month": datetime.now(timezone.utc).strftime("%Y-%m"),
        "status": "draft",
        "amount_usd": 999.00,
    }


# ---------------------------------------------------------------------------
# Multi-tenant isolation data
# ---------------------------------------------------------------------------

_TENANT_A_ID = "b0000000-0000-0000-0000-000000000001"
_TENANT_B_ID = "b0000000-0000-0000-0000-000000000002"


@pytest.fixture
def seed_multi_tenant_data(setup_test_schema, db_connection):
    """
    Seed two isolated tenants (Tenant A and Tenant B) for RLS / isolation tests.
    Each tenant gets one customer row and one API key.
    """
    cursor = db_connection.cursor()
    try:
        for tenant_id, suffix in ((_TENANT_A_ID, "a"), (_TENANT_B_ID, "b")):
            cursor.execute(
                """
                INSERT INTO customers (
                    id, name, tier, framework, status, email, billing_email
                ) VALUES (
                    %s, %s,
                    'standard'::customer_tier, 'cis'::compliance_framework,
                    'active'::customer_status, %s, %s
                )
                ON CONFLICT (id) DO NOTHING
                """,
                (
                    tenant_id,
                    f"Tenant {suffix.upper()} Test Corp",
                    f"admin@tenant-{suffix}.example.com",
                    f"billing@tenant-{suffix}.example.com",
                ),
            )
            key_id = str(uuid.uuid4())
            cursor.execute(
                """
                INSERT INTO api_keys (id, customer_id, key_prefix, key_hash, name)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
                """,
                (
                    key_id,
                    tenant_id,
                    f"sk_tenant_{suffix}_",
                    f"hash-tenant-{suffix}",
                    f"Tenant {suffix.upper()} Key",
                ),
            )
        db_connection.commit()
    except Exception:
        db_connection.rollback()
        raise
    finally:
        cursor.close()

    yield {"tenant_a_id": _TENANT_A_ID, "tenant_b_id": _TENANT_B_ID}

    cursor = db_connection.cursor()
    try:
        for tenant_id in (_TENANT_A_ID, _TENANT_B_ID):
            cursor.execute("DELETE FROM api_keys     WHERE customer_id = %s", (tenant_id,))
            cursor.execute("DELETE FROM audit_events WHERE customer_id = %s", (tenant_id,))
            cursor.execute("DELETE FROM customers    WHERE id = %s", (tenant_id,))
        db_connection.commit()
    except Exception:
        db_connection.rollback()
    finally:
        cursor.close()
