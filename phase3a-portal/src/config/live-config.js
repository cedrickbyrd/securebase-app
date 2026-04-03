import { loadStripe } from '@stripe/stripe-js';

// Live mode Stripe configuration
// IMPORTANT: This should be set via environment variable VITE_STRIPE_PUBLIC_KEY
// The hardcoded value here is only a fallback and should be replaced
const LIVE_STRIPE_PUBLIC_KEY = import.meta.env.VITE_STRIPE_PUBLIC_KEY || 'pk_live_YOUR_KEY_HERE';

// Validate Stripe key is configured
if (LIVE_STRIPE_PUBLIC_KEY === 'pk_live_YOUR_KEY_HERE') {
  console.error('⚠️ CRITICAL: VITE_STRIPE_PUBLIC_KEY not configured! Signup will fail.');
  console.error('Please set VITE_STRIPE_PUBLIC_KEY in your .env file');
}

const stripePromise = loadStripe(LIVE_STRIPE_PUBLIC_KEY);

// API Configuration for production
const API_BASE_URL = 'https://api.securebase.tximhotep.com';

// Pricing configuration (live mode)
const PRICING_TIERS = {
  standard: {
    name: 'Standard',
    price: 2000,
    pilotPrice: 1000,
    priceId: 'price_1SrgqW5bg6XXXrmNzkk8O5E5', // Stripe test-mode price ID
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
    priceId: 'price_1SrgqV5bg6XXXrmNL6XoLDcD', // Stripe test-mode price ID
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
    priceId: 'price_1SrgqU5bg6XXXrmNKA43A08i', // Stripe test-mode price ID
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
    priceId: 'price_1SrgqW5bg6XXXrmN4Tdhkqku', // Stripe test-mode price ID
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

// Pilot program configuration
// IMPORTANT: This should match the backend STRIPE_PILOT_COUPON environment variable
const PILOT_COUPON_ID = import.meta.env.VITE_STRIPE_PILOT_COUPON || 'coupon_PILOT_LIVE_ID';

export {
  stripePromise,
  API_BASE_URL,
  PRICING_TIERS,
  PILOT_COUPON_ID,
  LIVE_STRIPE_PUBLIC_KEY
};
