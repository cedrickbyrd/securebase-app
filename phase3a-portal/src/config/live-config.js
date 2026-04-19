import { loadStripe } from '@stripe/stripe-js';

const LIVE_STRIPE_PUBLIC_KEY = import.meta.env.VITE_STRIPE_PUBLIC_KEY || 'pk_live_YOUR_KEY_HERE';

if (LIVE_STRIPE_PUBLIC_KEY === 'pk_live_YOUR_KEY_HERE') {
  console.error('⚠️ CRITICAL: VITE_STRIPE_PUBLIC_KEY not configured!');
}

const stripePromise = loadStripe(LIVE_STRIPE_PUBLIC_KEY);
const API_BASE_URL = 'https://api.securebase.tximhotep.com';

const PRICING_TIERS = {
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

// Compliance Jumpstart one-time pilot product ($495, SKU: pilot_compliance)
// Stripe product : prod_UMibaH3IqO1SJD  (nickname: SecureBase_Price_pilot_compliance)
// Stripe price   : price_1TNzAi5bg6XXXrmN5GGfPrtq
const PILOT_COMPLIANCE_ID = 'price_1TNzAi5bg6XXXrmN5GGfPrtq';

export {
  stripePromise,
  API_BASE_URL,
  PRICING_TIERS,
  PILOT_COUPON_ID,
  PILOT_COMPLIANCE_ID,
  LIVE_STRIPE_PUBLIC_KEY
};
