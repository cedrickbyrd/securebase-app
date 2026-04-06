/**
 * SocialProof
 * Context-aware social proof and trust signals displayed near CTAs.
 * Pass a `context` prop to tailor the copy to the current page.
 */

import React from 'react';

const PROOF_DATA = {
  pricing: [
    { icon: '💼', text: 'Trusted by 500+ regulated companies' },
    { icon: '⚡', text: '90-day average time to SOC 2 certification' },
    { icon: '🏆', text: '4.9/5 rating from compliance officers' },
  ],
  api: [
    { icon: '👨‍💻', text: 'Built by ex-AWS compliance engineers' },
    { icon: '🔐', text: '99.99% API uptime SLA' },
    { icon: '📊', text: 'Processes 1M+ compliance checks daily' },
  ],
  compliance: [
    { icon: '✅', text: 'SOC 2, FedRAMP, and HIPAA coverage in one platform' },
    { icon: '🔍', text: 'Continuous control monitoring — no manual reviews' },
    { icon: '📄', text: 'Audit-ready evidence collected automatically' },
  ],
  default: [
    { icon: '🏢', text: 'Trusted by 500+ regulated companies' },
    { icon: '🚀', text: 'Go from 0 to SOC 2 certified in 90 days' },
    { icon: '🔒', text: 'Enterprise-grade security built in from day one' },
  ],
};

/**
 * @param {Object}  props
 * @param {string}  [props.context]    'pricing' | 'api' | 'compliance' | 'default'
 * @param {string}  [props.className]  Additional class names
 */
export default function SocialProof({ context = 'default', className = '' }) {
  const items = PROOF_DATA[context] || PROOF_DATA.default;

  return (
    <ul className={`sp-list ${className}`} style={styles.list}>
      {items.map((item) => (
        <li key={item.text} style={styles.item}>
          <span style={styles.icon}>{item.icon}</span>
          <span style={styles.text}>{item.text}</span>
        </li>
      ))}
    </ul>
  );
}

const styles = {
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.85rem',
    color: '#4b5563',
  },
  icon: {
    fontSize: '1rem',
    flexShrink: 0,
  },
  text: {
    lineHeight: 1.4,
  },
};
