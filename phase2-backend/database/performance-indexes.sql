-- SecureBase Database Performance Indexes
-- Optimize query performance for common access patterns

-- ====================================
-- CUSTOMER TABLE INDEXES
-- ====================================

-- Fast lookup by email (login)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_email 
ON customers(email);

-- Fast lookup by tier (analytics queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_tier 
ON customers(tier);

-- Composite index for active customers by tier
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_status_tier 
ON customers(status, tier) 
WHERE status = 'active';

-- ====================================
-- INVOICES TABLE INDEXES
-- ====================================

-- Fast lookup by customer and date (most common query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_customer_date 
ON invoices(customer_id, invoice_date DESC);

-- Partial index for unpaid invoices
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_unpaid 
ON invoices(customer_id, invoice_date DESC) 
WHERE status = 'unpaid';

-- Fast lookup by billing period
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_billing_period 
ON invoices(billing_period_start, billing_period_end);

-- ====================================
-- USAGE METRICS TABLE INDEXES
-- ====================================

-- Most common query: metrics by customer and time range
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usage_metrics_customer_time 
ON usage_metrics(customer_id, timestamp DESC);

-- Composite index for filtered queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usage_metrics_customer_metric_time 
ON usage_metrics(customer_id, metric_name, timestamp DESC);

-- Partial index for recent metrics (hot data)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usage_metrics_recent 
ON usage_metrics(customer_id, metric_name, timestamp DESC) 
WHERE timestamp > (NOW() - INTERVAL '90 days');

-- ====================================
-- API KEYS TABLE INDEXES
-- ====================================

-- Fast lookup by key value (API authentication)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_api_keys_key_value 
ON api_keys(key_value) 
WHERE revoked_at IS NULL;

-- Fast lookup by customer
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_keys_customer 
ON api_keys(customer_id, created_at DESC);

-- Partial index for active keys only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_keys_active 
ON api_keys(customer_id, created_at DESC) 
WHERE revoked_at IS NULL;

-- ====================================
-- SUPPORT TICKETS TABLE INDEXES
-- ====================================

-- Fast lookup by customer and status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_customer_status 
ON support_tickets(customer_id, status, created_at DESC);

-- Fast lookup by priority
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_priority 
ON support_tickets(priority, status, created_at DESC) 
WHERE status IN ('open', 'in_progress');

-- Fast lookup by assignee
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_assignee 
ON support_tickets(assigned_to, status, created_at DESC) 
WHERE assigned_to IS NOT NULL;

-- ====================================
-- AUDIT LOG TABLE INDEXES
-- ====================================

-- Fast lookup by customer and timestamp
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_customer_time 
ON audit_log(customer_id, timestamp DESC);

-- Fast lookup by user and action
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_user_action 
ON audit_log(user_id, action, timestamp DESC);

-- Partial index for recent audit logs (compliance queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_recent 
ON audit_log(customer_id, action, timestamp DESC) 
WHERE timestamp > (NOW() - INTERVAL '90 days');

-- GIN index for full-text search on metadata
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_metadata_gin 
ON audit_log USING GIN(metadata);

-- ====================================
-- REPORTS TABLE INDEXES
-- ====================================

-- Fast lookup by customer
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reports_customer 
ON reports(customer_id, created_at DESC);

-- Fast lookup by type
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reports_type 
ON reports(customer_id, report_type, created_at DESC);

-- ====================================
-- WEBHOOK SUBSCRIPTIONS TABLE INDEXES
-- ====================================

-- Fast lookup by customer and event type
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webhooks_customer_event 
ON webhook_subscriptions(customer_id, event_type) 
WHERE enabled = true;

-- Fast lookup by URL (for validation)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webhooks_url 
ON webhook_subscriptions(callback_url) 
WHERE enabled = true;

-- ====================================
-- WEBHOOK DELIVERIES TABLE INDEXES
-- ====================================

-- Fast lookup by subscription
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webhook_deliveries_subscription 
ON webhook_deliveries(subscription_id, created_at DESC);

-- Partial index for failed deliveries (retry logic)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webhook_deliveries_failed 
ON webhook_deliveries(subscription_id, created_at DESC) 
WHERE status = 'failed' AND retry_count < 5;

-- ====================================
-- COST FORECASTS TABLE INDEXES
-- ====================================

-- Fast lookup by customer and forecast date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cost_forecasts_customer_date 
ON cost_forecasts(customer_id, forecast_date DESC);

-- ====================================
-- ANALYZE TABLES
-- ====================================

-- Update table statistics for query optimizer
ANALYZE customers;
ANALYZE invoices;
ANALYZE usage_metrics;
ANALYZE api_keys;
ANALYZE support_tickets;
ANALYZE audit_log;
ANALYZE reports;
ANALYZE webhook_subscriptions;
ANALYZE webhook_deliveries;
ANALYZE cost_forecasts;

-- ====================================
-- VERIFY INDEXES
-- ====================================

-- Check index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Check index sizes
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Check for unused indexes (idx_scan = 0)
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
AND idx_scan = 0
AND indexname NOT LIKE 'pg_%'
ORDER BY pg_relation_size(indexrelid) DESC;

-- ====================================
-- MAINTENANCE QUERIES
-- ====================================

-- Reindex all tables (run monthly)
-- REINDEX TABLE CONCURRENTLY customers;
-- REINDEX TABLE CONCURRENTLY invoices;
-- REINDEX TABLE CONCURRENTLY usage_metrics;

-- Vacuum analyze (run weekly)
-- VACUUM ANALYZE customers;
-- VACUUM ANALYZE invoices;
-- VACUUM ANALYZE usage_metrics;

-- ====================================
-- NOTES
-- ====================================

/*
1. All indexes created with CONCURRENTLY to avoid table locks
2. Partial indexes used where applicable to reduce index size
3. Descending order for timestamp columns (most recent first)
4. GIN indexes for JSONB columns (metadata)
5. Unique indexes for constraints (api_keys.key_value)

Performance Impact:
- Read queries: 10-100x faster for indexed columns
- Write queries: 5-10% slower due to index maintenance
- Storage: +10-30% for indexes

Monitoring:
- Check pg_stat_user_indexes weekly for index usage
- Drop unused indexes to reduce write overhead
- Reindex monthly to reduce bloat
- Vacuum analyze weekly to update statistics

*/
