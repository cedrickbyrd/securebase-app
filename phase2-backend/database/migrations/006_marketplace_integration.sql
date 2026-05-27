-- 2026-05-27: Add idempotent AWS Marketplace customer + metering schema updates

-- AWS Marketplace fields on customers
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS marketplace_customer_id          TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS marketplace_product_code         TEXT,
  ADD COLUMN IF NOT EXISTS marketplace_entitlement_status   TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS marketplace_subscription_start   TIMESTAMP,
  ADD COLUMN IF NOT EXISTS metering_dimension               TEXT;

CREATE INDEX IF NOT EXISTS idx_customers_marketplace_customer_id
  ON customers(marketplace_customer_id);

-- Metering records — immutable log of every BatchMeterUsage call
CREATE TABLE IF NOT EXISTS marketplace_metering_records (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id             UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  marketplace_customer_id TEXT NOT NULL,
  dimension               TEXT NOT NULL,
  quantity                INTEGER NOT NULL DEFAULT 1,
  timestamp               TIMESTAMP NOT NULL,
  metering_status         TEXT NOT NULL DEFAULT 'pending',
  aws_metering_record_id  TEXT,
  error_message           TEXT,
  created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_metering_customer  ON marketplace_metering_records(customer_id);
CREATE INDEX IF NOT EXISTS idx_metering_timestamp ON marketplace_metering_records(timestamp DESC);
