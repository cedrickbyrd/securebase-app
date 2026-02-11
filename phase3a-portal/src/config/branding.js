/**
 * Branding Configuration - TxImhotep LLC
 * Central location for all company branding and contact information
 */

export const BRANDING = {
  companyName: import.meta.env.VITE_COMPANY_NAME || 'TxImhotep LLC',
  productName: import.meta.env.VITE_PRODUCT_NAME || 'SecureBase by TxImhotep LLC',
  productShortName: import.meta.env.VITE_PRODUCT_SHORT_NAME || 'SecureBase',
  
  companyUrl: import.meta.env.VITE_COMPANY_URL || 'https://tximhotep.com',
  portalUrl: import.meta.env.VITE_PORTAL_URL || 'https://securebase.tximhotep.com',
  marketingUrl: import.meta.env.VITE_MARKETING_URL || 'https://tximhotep.com',
  
  supportEmail: import.meta.env.VITE_SUPPORT_EMAIL || 'support@tximhotep.com',
  salesEmail: import.meta.env.VITE_SALES_EMAIL || 'sales@tximhotep.com',
  billingEmail: import.meta.env.VITE_BILLING_EMAIL || 'billing@tximhotep.com',
  securityEmail: import.meta.env.VITE_SECURITY_EMAIL || 'security@tximhotep.com',
  
  copyrightHolder: import.meta.env.VITE_COPYRIGHT_HOLDER || 'TxImhotep LLC',
  privacyPolicyUrl: import.meta.env.VITE_PRIVACY_POLICY_URL || 'https://tximhotep.com/privacy',
  termsOfServiceUrl: import.meta.env.VITE_TERMS_OF_SERVICE_URL || 'https://tximhotep.com/terms',
  
  year: new Date().getFullYear(),
  foundedYear: 2026,
  
  social: {
    linkedin: 'https://linkedin.com/company/tximhotep',
    twitter: 'https://twitter.com/tximhotep',
    github: 'https://github.com/cedrickbyrd',
  },
  
  supportPhone: import.meta.env.VITE_SUPPORT_PHONE || '+1-800-SECURE-TX',
  supportHours: '24/7',
};

export const getCopyrightText = () => {
  const startYear = BRANDING.foundedYear;
  const currentYear = BRANDING.year;
  const yearRange = startYear === currentYear ? startYear : `${startYear}-${currentYear}`;
  return `© ${yearRange} ${BRANDING.copyrightHolder}. All rights reserved.`;
};

export const getFullProductTitle = () => {
  return `${BRANDING.productName} - Customer Portal`;
};

export default BRANDING;
