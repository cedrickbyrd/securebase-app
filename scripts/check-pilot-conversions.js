#!/usr/bin/env node
/**
 * SecureBase Pilot Conversion Checker
 *
 * Queries the Stripe API for pilot subscriptions across all pricing tiers,
 * reports MRR, and surfaces abandoned checkouts for follow-up.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_... node scripts/check-pilot-conversions.js
 *
 * Environment variables (can also be set in .env):
 *   STRIPE_SECRET_KEY  — Required. Stripe secret key (sk_live_... or sk_test_...).
 */

'use strict';

const https = require('https');
const querystring = require('querystring');

// ---------------------------------------------------------------------------
// Pricing tiers — kept in sync with phase3a-portal/src/config/live-config.js
// ---------------------------------------------------------------------------
const PRICING_TIERS = {
  standard:   { name: 'Standard',    priceId: 'price_1Srgn65bg6XXXrmNXXXXXXXX', pilotPrice: 1000,  fullPrice: 2000  },
  fintech:    { name: 'Fintech',     priceId: 'price_1SrgoQ5bg6XXXrmNwsdnTwrW', pilotPrice: 4000,  fullPrice: 8000  },
  healthcare: { name: 'Healthcare',  priceId: 'price_1SrgoQ5bg6XXXrmNQvC2YnmT', pilotPrice: 7500,  fullPrice: 15000 },
  government: { name: 'Government',  priceId: 'price_1SrgoR5bg6XXXrmNUUveBMDw', pilotPrice: 12500, fullPrice: 25000 },
};

const ALL_PRICE_IDS = Object.values(PRICING_TIERS).map((t) => t.priceId);

// ---------------------------------------------------------------------------
// Minimal Stripe API client (no external dependencies)
// ---------------------------------------------------------------------------
function stripeRequest(path, params = {}) {
  return new Promise((resolve, reject) => {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      reject(new Error('STRIPE_SECRET_KEY environment variable is not set.'));
      return;
    }

    const query = Object.keys(params).length ? '?' + querystring.stringify(params) : '';
    const options = {
      hostname: 'api.stripe.com',
      port: 443,
      path: `/v1${path}${query}`,
      method: 'GET',
      headers: {
        Authorization: 'Basic ' + Buffer.from(secretKey + ':').toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (res.statusCode >= 400) {
            reject(new Error(`Stripe API error ${res.statusCode}: ${data.error?.message || body}`));
          } else {
            resolve(data);
          }
        } catch (e) {
          reject(new Error(`Failed to parse Stripe response: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/** Fetches all pages for a list endpoint, returning a flat array of objects. */
async function fetchAll(path, params = {}) {
  const items = [];
  let startingAfter = null;

  do {
    const query = { limit: 100, ...params };
    if (startingAfter) query.starting_after = startingAfter;

    const page = await stripeRequest(path, query);
    items.push(...page.data);
    startingAfter = page.has_more ? page.data[page.data.length - 1].id : null;
  } while (startingAfter);

  return items;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatUSD(cents) {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0 });
}

function tierForPriceId(priceId) {
  return Object.values(PRICING_TIERS).find((t) => t.priceId === priceId) || null;
}

function hoursAgo(unixTs) {
  return Math.round((Date.now() / 1000 - unixTs) / 3600);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║      SecureBase Pilot Conversion Checker             ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');

  // ── 1. Active subscriptions ───────────────────────────────────────────────
  console.log('⏳ Fetching subscriptions from Stripe…');

  const allSubscriptions = await fetchAll('/subscriptions', { status: 'all', expand: ['data.items'] });

  const pilotSubs = allSubscriptions.filter((sub) => {
    const priceId = sub.items?.data?.[0]?.price?.id;
    return ALL_PRICE_IDS.includes(priceId);
  });

  const activeSubs = pilotSubs.filter((s) => s.status === 'active');
  const cancelledSubs = pilotSubs.filter((s) => s.status === 'canceled');
  const trialSubs = pilotSubs.filter((s) => s.status === 'trialing');

  // MRR calculation
  let totalMrrCents = 0;
  const tierBreakdown = {};

  for (const sub of activeSubs) {
    const priceId = sub.items?.data?.[0]?.price?.id;
    const tier = tierForPriceId(priceId);
    const amountCents = sub.items?.data?.[0]?.price?.unit_amount ?? 0;

    totalMrrCents += amountCents;

    const key = tier?.name ?? priceId;
    tierBreakdown[key] = tierBreakdown[key] || { count: 0, mrrCents: 0 };
    tierBreakdown[key].count += 1;
    tierBreakdown[key].mrrCents += amountCents;
  }

  // ── 2. Abandoned checkouts (open sessions < 3 days old) ──────────────────
  console.log('⏳ Fetching checkout sessions…');

  const cutoffTs = Math.floor(Date.now() / 1000) - 3 * 24 * 3600; // 3 days ago
  const checkoutSessions = await fetchAll('/checkout/sessions', {
    status: 'open',
    created: { gte: cutoffTs },
    expand: ['data.customer_details'],
  }).catch(() => []); // gracefully handle insufficient permissions

  const abandonedCheckouts = checkoutSessions.filter((session) => {
    const priceId =
      session.metadata?.price_id ||
      (session.line_items?.data?.[0]?.price?.id);
    return priceId ? ALL_PRICE_IDS.includes(priceId) : session.amount_total >= 100000;
  });

  // ── 3. Print summary ──────────────────────────────────────────────────────
  console.log('');
  console.log('────────────────────────────────────────────────────────');
  console.log('  ACTIVE PILOT SUBSCRIPTIONS');
  console.log('────────────────────────────────────────────────────────');

  if (activeSubs.length === 0) {
    console.log('  ⚠️  No active pilot subscriptions found.');
    console.log('      This may be expected if the pilot just launched.');
  } else {
    for (const [tierName, data] of Object.entries(tierBreakdown)) {
      console.log(`  ✅  ${tierName.padEnd(12)} ${String(data.count).padStart(3)} sub(s)   MRR: ${formatUSD(data.mrrCents)}`);
    }
  }

  console.log('');
  console.log(`  Total active subscriptions : ${activeSubs.length}`);
  console.log(`  Trialing                   : ${trialSubs.length}`);
  console.log(`  Cancelled                  : ${cancelledSubs.length}`);
  console.log('');
  console.log(`  💰  Total Pilot MRR        : ${formatUSD(totalMrrCents)}`);
  console.log(`  📅  Annual Run Rate (ARR)  : ${formatUSD(totalMrrCents * 12)}`);
  console.log('');

  // ── 4. Abandoned checkouts ────────────────────────────────────────────────
  console.log('────────────────────────────────────────────────────────');
  console.log('  ABANDONED CHECKOUTS  (last 3 days — FOLLOW UP!)');
  console.log('────────────────────────────────────────────────────────');

  if (abandonedCheckouts.length === 0) {
    console.log('  ✅  No abandoned checkouts found.');
  } else {
    for (const session of abandonedCheckouts) {
      const email = session.customer_details?.email ?? '(email not captured)';
      const age = hoursAgo(session.created);
      const amount = formatUSD(session.amount_total ?? 0);
      console.log(`  🛒  ${email.padEnd(40)} ${amount.padStart(8)}   ${age}h ago`);
    }
  }

  console.log('');

  // ── 5. Conversion summary ─────────────────────────────────────────────────
  console.log('────────────────────────────────────────────────────────');
  console.log('  CONVERSION SUMMARY');
  console.log('────────────────────────────────────────────────────────');
  console.log(`  Total pilot leads (checkouts started) : ${pilotSubs.length + abandonedCheckouts.length}`);
  console.log(`  Converted to active subscription      : ${activeSubs.length}`);

  const convRate =
    pilotSubs.length + abandonedCheckouts.length > 0
      ? ((activeSubs.length / (pilotSubs.length + abandonedCheckouts.length)) * 100).toFixed(1)
      : 'N/A';
  console.log(`  Checkout → subscription rate          : ${convRate}%`);
  console.log('');

  if (activeSubs.length === 0) {
    console.log('  💡 Next steps:');
    console.log('     1. Check for abandoned checkouts above and follow up within 24 h');
    console.log('     2. Test checkout manually at /pricing');
    console.log('     3. Verify webhook delivery in Stripe Dashboard → Developers → Webhooks');
    console.log('     4. Run sql/conversion-analysis.sql in your Supabase SQL Editor');
  } else if (activeSubs.length >= 10) {
    console.log('  🚀 10+ conversions — consider an early GA launch!');
  } else if (activeSubs.length >= 5) {
    console.log('  🎉 Great start! Interview customers and scale what\'s working.');
  } else {
    console.log('  📈 Keep going! Interview your customers to learn what drove them to buy.');
  }

  console.log('');
  console.log('════════════════════════════════════════════════════════');
  console.log('');
}

main().catch((err) => {
  console.error('');
  console.error('❌ Error:', err.message);
  console.error('');
  if (err.message.includes('STRIPE_SECRET_KEY')) {
    console.error('   Set STRIPE_SECRET_KEY in your environment and re-run:');
    console.error('   STRIPE_SECRET_KEY=sk_... node scripts/check-pilot-conversions.js');
  }
  process.exit(1);
});
