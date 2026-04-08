import { PRICING_TIERS } from '../config/live-config';

/**
 * Validates that the Stripe priceId and displayed price are consistent with
 * the configured PRICING_TIERS for the given tier key.
 *
 * This is a front-end guard — the authoritative check must also happen server-side
 * before any Stripe checkout session is created.
 *
 * @param {string} tier          - Tier key (e.g. 'standard', 'fintech', 'healthcare', 'government')
 * @param {string} priceId       - Stripe Price ID passed to checkout
 * @param {number} [displayedPrice] - Dollar amount shown to the user (pilot price or full price)
 * @returns {{ valid: boolean, error?: string, expectedPrice?: number, expectedPriceId?: string }}
 */
export function validatePriceConsistency(tier, priceId, displayedPrice) {
  const tierConfig = PRICING_TIERS[tier];
  if (!tierConfig) {
    return { valid: false, error: `Unknown pricing tier: "${tier}". Please contact sales.` };
  }

  const expectedPriceId = tierConfig.priceId;
  const expectedPrice = tierConfig.pilotPrice ?? tierConfig.price;

  // Validate priceId matches configuration
  if (priceId && expectedPriceId && priceId !== expectedPriceId) {
    console.error('[PRICING_MISMATCH] priceId mismatch', {
      tier,
      expected: expectedPriceId,
      received: priceId,
      timestamp: new Date().toISOString(),
    });
    return {
      valid: false,
      error: 'Pricing configuration error. Please contact sales@securebase.tximhotep.com',
      expectedPriceId,
    };
  }

  // Validate displayed price matches configuration
  if (displayedPrice !== undefined && displayedPrice !== expectedPrice) {
    console.error('[PRICING_MISMATCH] displayed price mismatch', {
      tier,
      expectedPrice,
      displayedPrice,
      timestamp: new Date().toISOString(),
    });
    return {
      valid: false,
      error: `Pricing configuration error (expected $${expectedPrice.toLocaleString()}/mo). Please contact sales@securebase.tximhotep.com`,
      expectedPrice,
    };
  }

  return { valid: true, expectedPrice, expectedPriceId };
}

/**
 * Returns the effective display price for a tier (pilot price if available, otherwise full price).
 * @param {string} tier
 * @returns {number|null}
 */
export function getEffectivePrice(tier) {
  const tierConfig = PRICING_TIERS[tier];
  if (!tierConfig) return null;
  return tierConfig.pilotPrice ?? tierConfig.price;
}
