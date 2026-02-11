/**
 * Demo Customer Indicator Component
 * 
 * Visual indicator showing which demo customer profile is currently displayed.
 * Appears as a badge in the dashboard header to help prospects understand
 * they're viewing a specific customer scenario.
 */

import React from 'react';
import './DemoCustomerIndicator.css';

const DemoCustomerIndicator = ({ customer, customerIndex }) => {
  if (!customer) {
    return null;
  }

  // Map tier to icon
  const getTierIcon = (tier) => {
    const icons = {
      healthcare: '🏥',
      fintech: '💰',
      government: '🏛️',
      standard: '🚀'
    };
    return icons[tier] || '🏢';
  };

  // Map tier to color scheme
  const getTierColor = (tier) => {
    const colors = {
      healthcare: '#10b981',  // green
      fintech: '#f59e0b',     // amber
      government: '#3b82f6',  // blue
      standard: '#8b5cf6'     // purple
    };
    return colors[tier] || '#6b7280';
  };

  const tierColor = getTierColor(customer.tier);
  const tierIcon = getTierIcon(customer.tier);

  return (
    <div className="demo-customer-indicator" style={{ borderColor: tierColor }}>
      <div className="demo-indicator-icon" style={{ background: `${tierColor}20` }}>
        {tierIcon}
      </div>
      <div className="demo-indicator-content">
        <div className="demo-indicator-label">Demo Customer #{customerIndex + 1}</div>
        <div className="demo-indicator-name">{customer.name}</div>
        <div className="demo-indicator-details">
          <span className="demo-tier-badge" style={{ backgroundColor: tierColor }}>
            {customer.tier.charAt(0).toUpperCase() + customer.tier.slice(1)}
          </span>
          <span className="demo-framework-badge">{customer.framework}</span>
        </div>
      </div>
    </div>
  );
};

export default DemoCustomerIndicator;
