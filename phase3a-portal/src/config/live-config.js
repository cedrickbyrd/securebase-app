import { loadStripe } from '@stripe/stripe-js';

// Live mode Stripe configuration
const LIVE_STRIPE_PUBLIC_KEY = 'pk_live_YOUR_KEY_HERE'; // Replace with your actual live key
const stripePromise = loadStripe(LIVE_STRIPE_PUBLIC_KEY);

// API Configuration for production
const API_BASE_URL = 'https://api.securebase.com/v1';

// Pricing configuration (live mode)
const PRICING_TIERS = {
  standard: {
    name: 'Standard',
    price: 2000,
    pilotPrice: 1000,
    priceId: 'price_STANDARD_LIVE_ID', // Replace with actual Stripe price ID
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
    priceId: 'price_FINTECH_LIVE_ID', // Replace with actual Stripe price ID
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
    priceId: 'price_HEALTHCARE_LIVE_ID', // Replace with actual Stripe price ID
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
    priceId: 'price_GOVERNMENT_LIVE_ID', // Replace with actual Stripe price ID
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
const PILOT_COUPON_ID = 'coupon_PILOT_LIVE_ID'; // Replace with actual coupon ID

export {
  stripePromise,
  API_BASE_URL,
  PRICING_TIERS,
  PILOT_COUPON_ID,
  LIVE_STRIPE_PUBLIC_KEY
};