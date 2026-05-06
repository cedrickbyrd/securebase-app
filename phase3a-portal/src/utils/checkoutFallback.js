// Only tiers that should degrade to sales-assisted onboarding belong here.
const SALES_FALLBACKS = {
  hipaa_assessment: {
    contactSalesTier: 'healthcare',
    message: 'Self-service checkout for the HIPAA Readiness Assessment is temporarily unavailable. Please contact sales to complete your HIPAA onboarding.',
  },
  healthcare: {
    contactSalesTier: 'healthcare',
    message: 'Healthcare onboarding currently requires a sales-assisted checkout. Please contact sales to complete your HIPAA setup.',
  },
  government: {
    contactSalesTier: 'government',
    message: 'Government onboarding currently requires a sales-assisted checkout. Please contact sales to complete your FedRAMP setup.',
  },
};

export function getCheckoutFallback(tier, apiError) {
  const fallback = SALES_FALLBACKS[tier];
  if (!fallback || !apiError) return null;

  // Checkout Lambda 400s include `Valid tiers: tier_a, tier_b, ...`; when the
  // requested tier is absent from that list we route qualifying plans to sales.
  const validTierMatch = getCheckoutErrorMessage(apiError)
    .replace(/\s+/g, ' ')
    .match(/Valid tiers:\s*(.+)$/i);
  if (!validTierMatch) return null;

  const validTiers = validTierMatch[1]
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (validTiers.includes(tier)) return null;

  return {
    ...fallback,
    contactSalesPath: `/contact-sales?tier=${encodeURIComponent(fallback.contactSalesTier)}&source=${encodeURIComponent(tier)}_checkout_fallback`,
  };
}

export function getCheckoutErrorMessage(error) {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && typeof error.error === 'string') return error.error;
  if (typeof error === 'object' && typeof error.message === 'string') return error.message;
  return String(error);
}
