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

  const validTierMatch = String(apiError).match(/Valid tiers:\s*(.+)$/i);
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
