/**
 * usePersonalization hook
 * Detects Wave 3 outreach campaigns via UTM parameters and returns
 * tailored hero copy, CTAs, and social proof for high-value prospects.
 */

import { useMemo } from 'react';

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
  'icloud.com', 'aol.com', 'protonmail.com', 'mail.com',
]);

/**
 * Returns personalisation data based on the current page's UTM params.
 * Memoised so it is computed only once per render cycle.
 */
export function usePersonalization() {
  return useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const campaign = params.get('utm_campaign') || '';
    const source   = params.get('utm_source')   || '';
    const medium   = params.get('utm_medium')   || '';
    const content  = params.get('utm_content')  || '';

    const isWave3   = campaign.startsWith('wave3_');
    const isColumn  = campaign === 'wave3_column';
    const isMercury = campaign === 'wave3_mercury';
    const isLithic  = campaign === 'wave3_lithic';

    // Map UTM campaign to a friendly company label
    const companyName = isColumn
      ? 'Column'
      : isMercury
      ? 'Mercury'
      : isLithic
      ? 'Lithic'
      : null;

    const heroHeading = isColumn
      ? 'Banking infrastructure needs compliance infrastructure'
      : isMercury
      ? 'Automate compliance for your fintech platform'
      : isLithic
      ? 'Card issuing platforms need audit-ready compliance'
      : 'Compliance automation for SOC 2, FedRAMP, HIPAA';

    const heroParagraph = isColumn
      ? 'Purpose-built for banking-as-a-service providers. Ship faster, stay compliant.'
      : isMercury
      ? 'From SOC 2 readiness to continuous monitoring — all in one platform.'
      : isLithic
      ? 'Meet card-network and regulatory requirements without slowing down engineering.'
      : 'Achieve certification in 90 days and maintain it automatically.';

    const primaryCTA = isWave3
      ? 'Schedule Partnership Discussion →'
      : 'Start Free Trial →';

    const socialProof = isColumn
      ? 'Trusted by banking infrastructure platforms'
      : isMercury
      ? 'Built for Series B+ fintech companies'
      : isLithic
      ? 'Purpose-built for payment platforms'
      : 'Trusted by 500+ regulated companies';

    const urgencyMessage = isWave3
      ? `🎯 Exclusive offer for ${companyName} partners — first 10 customers get 50 % off Year 1`
      : null;

    const urgencyExpiry = isWave3 ? 'Offer expires April 30, 2026' : null;

    return {
      // Flags
      isWave3,
      isColumn,
      isMercury,
      isLithic,
      companyName,

      // Copy
      heroHeading,
      heroParagraph,
      primaryCTA,
      socialProof,
      urgencyMessage,
      urgencyExpiry,

      // Raw UTM data (safe to forward to analytics / CRM)
      utmParams: { campaign, source, medium, content },
    };
  }, []);
}

/**
 * Utility: extract likely company name from a work email address.
 * Returns an empty string for free-tier domains.
 * @param {string} email
 * @returns {string}
 */
export function extractCompanyFromEmail(email = '') {
  const parts = email.split('@');
  if (parts.length < 2) return '';
  const domain = parts[1].toLowerCase();
  if (FREE_EMAIL_DOMAINS.has(domain)) return '';
  // Capitalise the first word before the first dot
  const company = domain.split('.')[0];
  return company.charAt(0).toUpperCase() + company.slice(1);
}

/**
 * Utility: test whether an email address belongs to a free/consumer domain.
 * @param {string} email
 * @returns {boolean}
 */
export function isFreeEmailDomain(email = '') {
  const parts = email.split('@');
  if (parts.length < 2) return true;
  return FREE_EMAIL_DOMAINS.has(parts[1].toLowerCase());
}
