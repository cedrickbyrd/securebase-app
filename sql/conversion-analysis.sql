-- =============================================================
-- SecureBase Conversion Analysis Queries
-- Run these in your Supabase SQL Editor
-- =============================================================
-- Pricing reference (kept in sync with live-config.js):
--   Standard    pilot $1,000 / full $2,000   price_1Srgn65bg6XXXrmNXXXXXXXX
--   Fintech     pilot $4,000 / full $8,000   price_1SrgoQ5bg6XXXrmNwsdnTwrW
--   Healthcare  pilot $7,500 / full $15,000  price_1SrgoQ5bg6XXXrmNQvC2YnmT
--   Government  pilot $12,500/ full $25,000  price_1SrgoR5bg6XXXrmNUUveBMDw
-- =============================================================


-- -------------------------------------------------------------
-- Query 1: Overall conversion summary
-- -------------------------------------------------------------
SELECT
  COUNT(*)                                                   AS total_pilot_subscriptions,
  COUNT(DISTINCT customer_id)                                AS unique_customers,
  SUM(CASE WHEN status = 'active'  THEN 1 ELSE 0 END)       AS active_subscriptions,
  SUM(CASE WHEN status = 'trialing' THEN 1 ELSE 0 END)      AS trialing_subscriptions,
  SUM(CASE WHEN status = 'canceled' THEN 1 ELSE 0 END)      AS canceled_subscriptions,
  SUM(CASE WHEN created_at >= NOW() - INTERVAL '24 hours'
           THEN 1 ELSE 0 END)                               AS new_last_24h,
  SUM(CASE WHEN created_at >= NOW() - INTERVAL '7 days'
           THEN 1 ELSE 0 END)                               AS new_last_7d
FROM subscriptions
WHERE price_id IN (
  'price_1Srgn65bg6XXXrmNXXXXXXXX',  -- Standard pilot
  'price_1SrgoQ5bg6XXXrmNwsdnTwrW',  -- Fintech pilot
  'price_1SrgoQ5bg6XXXrmNQvC2YnmT',  -- Healthcare pilot
  'price_1SrgoR5bg6XXXrmNUUveBMDw'   -- Government pilot
);


-- -------------------------------------------------------------
-- Query 2: Active subscriptions by pricing tier
-- -------------------------------------------------------------
SELECT
  CASE price_id
    WHEN 'price_1Srgn65bg6XXXrmNXXXXXXXX' THEN 'Standard'
    WHEN 'price_1SrgoQ5bg6XXXrmNwsdnTwrW' THEN 'Fintech'
    WHEN 'price_1SrgoQ5bg6XXXrmNQvC2YnmT' THEN 'Healthcare'
    WHEN 'price_1SrgoR5bg6XXXrmNUUveBMDw' THEN 'Government'
    ELSE 'Unknown'
  END                              AS tier,
  COUNT(*)                         AS subscription_count,
  MIN(created_at)                  AS first_subscription,
  MAX(created_at)                  AS latest_subscription
FROM subscriptions
WHERE status = 'active'
  AND price_id IN (
    'price_1Srgn65bg6XXXrmNXXXXXXXX',
    'price_1SrgoQ5bg6XXXrmNwsdnTwrW',
    'price_1SrgoQ5bg6XXXrmNQvC2YnmT',
    'price_1SrgoR5bg6XXXrmNUUveBMDw'
  )
GROUP BY price_id
ORDER BY subscription_count DESC;


-- -------------------------------------------------------------
-- Query 3: Monthly Recurring Revenue (MRR) by tier
-- -------------------------------------------------------------
SELECT
  CASE price_id
    WHEN 'price_1Srgn65bg6XXXrmNXXXXXXXX' THEN 'Standard'
    WHEN 'price_1SrgoQ5bg6XXXrmNwsdnTwrW' THEN 'Fintech'
    WHEN 'price_1SrgoQ5bg6XXXrmNQvC2YnmT' THEN 'Healthcare'
    WHEN 'price_1SrgoR5bg6XXXrmNUUveBMDw' THEN 'Government'
    ELSE 'Unknown'
  END                                         AS tier,
  COUNT(*)                                    AS active_subscriptions,
  CASE price_id
    WHEN 'price_1Srgn65bg6XXXrmNXXXXXXXX' THEN COUNT(*) * 1000
    WHEN 'price_1SrgoQ5bg6XXXrmNwsdnTwrW' THEN COUNT(*) * 4000
    WHEN 'price_1SrgoQ5bg6XXXrmNQvC2YnmT' THEN COUNT(*) * 7500
    WHEN 'price_1SrgoR5bg6XXXrmNUUveBMDw' THEN COUNT(*) * 12500
    ELSE 0
  END                                         AS tier_mrr_usd
FROM subscriptions
WHERE status = 'active'
  AND price_id IN (
    'price_1Srgn65bg6XXXrmNXXXXXXXX',
    'price_1SrgoQ5bg6XXXrmNwsdnTwrW',
    'price_1SrgoQ5bg6XXXrmNQvC2YnmT',
    'price_1SrgoR5bg6XXXrmNUUveBMDw'
  )
GROUP BY price_id
ORDER BY tier_mrr_usd DESC;


-- -------------------------------------------------------------
-- Query 4: Abandoned checkouts — HIGH PRIORITY (follow up!)
-- -------------------------------------------------------------
SELECT
  email,
  created_at,
  amount_total / 100.0                                AS amount_usd,
  ROUND(EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600)  AS hours_ago
FROM checkout_sessions
WHERE status = 'open'
  AND created_at >= NOW() - INTERVAL '3 days'
ORDER BY created_at DESC;


-- -------------------------------------------------------------
-- Query 5: Traffic source performance
--   Requires a page_views or events table with utm_source column.
--   Adjust the table/column names to match your schema.
-- -------------------------------------------------------------
SELECT
  COALESCE(utm_source, '(direct)')   AS traffic_source,
  COUNT(DISTINCT session_id)         AS sessions,
  COUNT(DISTINCT CASE WHEN page_path LIKE '%/pricing%' THEN session_id END)
                                     AS pricing_page_views,
  COUNT(DISTINCT cs.id)              AS checkout_starts,
  COUNT(DISTINCT s.id)               AS conversions,
  ROUND(
    100.0 * COUNT(DISTINCT s.id) /
    NULLIF(COUNT(DISTINCT session_id), 0), 2
  )                                  AS conversion_rate_pct
FROM page_views pv
LEFT JOIN checkout_sessions cs
       ON cs.metadata->>'session_id' = pv.session_id::text
      AND cs.created_at >= NOW() - INTERVAL '30 days'
LEFT JOIN subscriptions s
       ON s.customer_id = cs.customer_id
      AND s.status = 'active'
      AND s.price_id IN (
            'price_1Srgn65bg6XXXrmNXXXXXXXX',
            'price_1SrgoQ5bg6XXXrmNwsdnTwrW',
            'price_1SrgoQ5bg6XXXrmNQvC2YnmT',
            'price_1SrgoR5bg6XXXrmNUUveBMDw'
          )
WHERE pv.created_at >= NOW() - INTERVAL '30 days'
GROUP BY utm_source
ORDER BY conversions DESC, sessions DESC;


-- -------------------------------------------------------------
-- Query 6: Checkout funnel — sessions → pricing → checkout → purchase
-- -------------------------------------------------------------
WITH funnel AS (
  SELECT
    COUNT(DISTINCT pv.session_id)                                   AS total_sessions,
    COUNT(DISTINCT CASE WHEN pv.page_path LIKE '%/pricing%'
                        THEN pv.session_id END)                     AS pricing_page_views,
    COUNT(DISTINCT cs.id)                                           AS checkout_starts,
    COUNT(DISTINCT CASE WHEN s.status = 'active' THEN s.id END)    AS conversions
  FROM page_views pv
  LEFT JOIN checkout_sessions cs
         ON cs.metadata->>'session_id' = pv.session_id::text
        AND cs.created_at >= NOW() - INTERVAL '30 days'
  LEFT JOIN subscriptions s
         ON s.customer_id = cs.customer_id
        AND s.price_id IN (
              'price_1Srgn65bg6XXXrmNXXXXXXXX',
              'price_1SrgoQ5bg6XXXrmNwsdnTwrW',
              'price_1SrgoQ5bg6XXXrmNQvC2YnmT',
              'price_1SrgoR5bg6XXXrmNUUveBMDw'
            )
  WHERE pv.created_at >= NOW() - INTERVAL '30 days'
)
SELECT
  total_sessions,
  pricing_page_views,
  ROUND(100.0 * pricing_page_views / NULLIF(total_sessions, 0), 1)   AS sessions_to_pricing_pct,
  checkout_starts,
  ROUND(100.0 * checkout_starts / NULLIF(pricing_page_views, 0), 1)  AS pricing_to_checkout_pct,
  conversions,
  ROUND(100.0 * conversions / NULLIF(checkout_starts, 0), 1)         AS checkout_to_purchase_pct,
  ROUND(100.0 * conversions / NULLIF(total_sessions, 0), 2)          AS overall_conversion_pct
FROM funnel;


-- -------------------------------------------------------------
-- Query 7: Customer details for active pilot subscribers
-- -------------------------------------------------------------
SELECT
  c.id                              AS customer_id,
  c.email,
  c.name,
  c.company,
  CASE s.price_id
    WHEN 'price_1Srgn65bg6XXXrmNXXXXXXXX' THEN 'Standard'
    WHEN 'price_1SrgoQ5bg6XXXrmNwsdnTwrW' THEN 'Fintech'
    WHEN 'price_1SrgoQ5bg6XXXrmNQvC2YnmT' THEN 'Healthcare'
    WHEN 'price_1SrgoR5bg6XXXrmNUUveBMDw' THEN 'Government'
  END                               AS tier,
  s.status                          AS subscription_status,
  s.created_at                      AS subscribed_at,
  s.current_period_end              AS next_renewal
FROM customers c
JOIN subscriptions s ON s.customer_id = c.id
WHERE s.status = 'active'
  AND s.price_id IN (
    'price_1Srgn65bg6XXXrmNXXXXXXXX',
    'price_1SrgoQ5bg6XXXrmNwsdnTwrW',
    'price_1SrgoQ5bg6XXXrmNQvC2YnmT',
    'price_1SrgoR5bg6XXXrmNUUveBMDw'
  )
ORDER BY s.created_at DESC;


-- -------------------------------------------------------------
-- Query 8: Daily conversion trends (last 30 days)
-- -------------------------------------------------------------
SELECT
  DATE_TRUNC('day', created_at)::date   AS date,
  COUNT(*)                              AS new_subscriptions,
  SUM(COUNT(*)) OVER (ORDER BY DATE_TRUNC('day', created_at))
                                        AS cumulative_subscriptions
FROM subscriptions
WHERE status IN ('active', 'trialing')
  AND price_id IN (
    'price_1Srgn65bg6XXXrmNXXXXXXXX',
    'price_1SrgoQ5bg6XXXrmNwsdnTwrW',
    'price_1SrgoQ5bg6XXXrmNQvC2YnmT',
    'price_1SrgoR5bg6XXXrmNUUveBMDw'
  )
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date;


-- -------------------------------------------------------------
-- Query 9: Revenue metrics summary
-- -------------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM subscriptions
   WHERE status = 'active'
     AND price_id IN (
       'price_1Srgn65bg6XXXrmNXXXXXXXX',
       'price_1SrgoQ5bg6XXXrmNwsdnTwrW',
       'price_1SrgoQ5bg6XXXrmNQvC2YnmT',
       'price_1SrgoR5bg6XXXrmNUUveBMDw'
     ))                                          AS active_subscriptions,

  (SELECT COALESCE(SUM(
    CASE price_id
      WHEN 'price_1Srgn65bg6XXXrmNXXXXXXXX' THEN 1000
      WHEN 'price_1SrgoQ5bg6XXXrmNwsdnTwrW' THEN 4000
      WHEN 'price_1SrgoQ5bg6XXXrmNQvC2YnmT' THEN 7500
      WHEN 'price_1SrgoR5bg6XXXrmNUUveBMDw' THEN 12500
    END
  ), 0)
  FROM subscriptions
  WHERE status = 'active'
    AND price_id IN (
      'price_1Srgn65bg6XXXrmNXXXXXXXX',
      'price_1SrgoQ5bg6XXXrmNwsdnTwrW',
      'price_1SrgoQ5bg6XXXrmNQvC2YnmT',
      'price_1SrgoR5bg6XXXrmNUUveBMDw'
    ))                                           AS mrr_usd,

  (SELECT COALESCE(SUM(
    CASE price_id
      WHEN 'price_1Srgn65bg6XXXrmNXXXXXXXX' THEN 1000
      WHEN 'price_1SrgoQ5bg6XXXrmNwsdnTwrW' THEN 4000
      WHEN 'price_1SrgoQ5bg6XXXrmNQvC2YnmT' THEN 7500
      WHEN 'price_1SrgoR5bg6XXXrmNUUveBMDw' THEN 12500
    END
  ), 0) * 12
  FROM subscriptions
  WHERE status = 'active'
    AND price_id IN (
      'price_1Srgn65bg6XXXrmNXXXXXXXX',
      'price_1SrgoQ5bg6XXXrmNwsdnTwrW',
      'price_1SrgoQ5bg6XXXrmNQvC2YnmT',
      'price_1SrgoR5bg6XXXrmNUUveBMDw'
    ))                                           AS arr_usd,

  (SELECT COUNT(*)
   FROM checkout_sessions
   WHERE status = 'open'
     AND created_at >= NOW() - INTERVAL '3 days') AS abandoned_checkouts_last_3d;
