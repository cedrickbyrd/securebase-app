/**
 * live-config.js — SecureBase portal runtime configuration
 *
 * ──────────────────────────────────────────────────────────────────────────
 * ⚠️  STRIPE PRICE ID ARCHITECTURE — READ BEFORE EDITING
 * ──────────────────────────────────────────────────────────────────────────
 *
 * The `priceId` fields in PRICING_TIERS are REFERENCE METADATA ONLY.
 * They are NOT sent to the checkout API and do NOT determine what Stripe charges.
 *
 * Checkout flow:
 *   Checkout.jsx  →  POST /api/checkout { tier: "standard", email, ... }
 *                                         ↑ NO priceId in payload
 *   → AWS Lambda (securebase-checkout-api)
 *   → resolves Price ID from Lambda env var: process.env.STRIPE_PRICE_STANDARD
 *   → stripe.checkout.sessions.create(...)
 *
 * To change what Stripe charges for a tier:
 *   Update the Lambda env var in AWS (STRIPE_PRICE_STANDARD, STRIPE_PRICE_FINTECH, etc.)
 *   NOT this file.
 *
 * The priceId values here serve as a human-readable cross-reference between
 * tiers and Stripe price objects. Keep them in sync with Lambda env vars as
 * a matter of documentation hygiene, but know they have no runtime effect on billing.
 *
 * See: /Claude.md § "💳 Stripe Checkout Architecture"
 * ──────────────────────────────────────────────────────────────────────────
 */
import { loadStripe } from '@stripe/stripe-js';

const LIVE_STRIPE_PUBLIC_KEY = import.meta.env.VITE_STRIPE_PUBLIC_KEY || 'pk_live_YOUR_KEY_HERE';

if (LIVE_STRIPE_PUBLIC_KEY === 'pk_live_YOUR_KEY_HERE') {
  console.error('⚠️ CRITICAL: VITE_STRIPE_PUBLIC_KEY not configured!');
}

const stripePromise = loadStripe(LIVE_STRIPE_PUBLIC_KEY);
const API_BASE_URL = 'https://api.securebase.tximhotep.com';

// Compliance Jumpstart one-time pilot product ($495, SKU: pilot_compliance)
// Stripe product : prod_UMibaH3IqO1SJD  (nickname: SecureBase_Price_pilot_compliance)
// Stripe price   : price_1TNzAi5bg6XXXrmN5GGfPrtq
const PILOT_COMPLIANCE_ID = 'price_1TNzAi5bg6XXXrmN5GGfPrtq';

const PRICING_TIERS = {
  pilot_compliance: {
    name: 'Compliance Jumpstart',
    price: 495,
    priceId: PILOT_COMPLIANCE_ID,
    billingType: 'payment',
    description: 'One-time compliance audit — AWS Landing Zone pilot at $495',
    features: [
      'CIS AWS Foundations compliance scan',
      'AWS Landing Zone audit report',
      'Security Hub baseline assessment',
      'CloudTrail configuration review',
      '30-day email support',
      '$495 credited toward any subscription upgrade',
    ],
  },
  standard: {
    name: 'Standard',
    price: 2000,
    pilotPrice: 1000,
    priceId: 'price_1TNygX5bg6XXXrmNBtIT7j1P',
    billingType: 'payment',
    description: 'CIS Foundations compliant AWS Landing Zone',
    features: [
      'CIS AWS Foundations Benchmark',
      'Security Hub monitoring', 
      'CloudTrail audit logging',
      'Config compliance tracking',
      '90-day log retention',
      'Email support',
    ],
  },
  fintech: {
    name: 'Fintech',
    price: 8000,
    pilotPrice: 4000,
    priceId: 'price_1SrgoQ5bg6XXXrmNwsdnTwrW',
    billingType: 'subscription',
    description: 'SOC2 Type II compliant infrastructure',
    features: [
      'SOC2 Type II controls',
      'All Standard features',
      'GuardDuty threat detection',
      '1-year log retention',
      'Quarterly compliance reports',
      'Priority support',
    ],
  },
  healthcare: {
    name: 'Healthcare',
    price: 15000,
    pilotPrice: 7500,
    priceId: 'price_1SrgoQ5bg6XXXrmNQvC2YnmT',
    billingType: 'subscription',
    description: 'HIPAA-compliant AWS Landing Zone',
    features: [
      'HIPAA compliance framework',
      'All Fintech features',
      '7-year audit log retention',
      'Encrypted EBS volumes',
      'Monthly compliance reports',
      'Dedicated support engineer',
    ],
  },
  government: {
    name: 'Government', 
    price: 25000,
    pilotPrice: 12500,
    priceId: 'price_1SrgoR5bg6XXXrmNUUveBMDw',
    billingType: 'subscription',
    description: 'FedRAMP-aligned AWS Landing Zone',
    features: [
      'FedRAMP compliance framework',
      'All Healthcare features',
      'Government cloud hosting',
      'FIPS 140-2 encryption',
      'Weekly compliance reports',
      '24/7 dedicated support',
    ],
  },
};

const PILOT_COUPON_ID = import.meta.env.VITE_STRIPE_PILOT_COUPON || 'coupon_PILOT_LIVE_ID';

export {
  stripePromise,
  API_BASE_URL,
  PRICING_TIERS,
  PILOT_COUPON_ID,
  PILOT_COMPLIANCE_ID,
  LIVE_STRIPE_PUBLIC_KEY
};
