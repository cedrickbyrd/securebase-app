import { useState } from 'react';

export const useDemoCustomer = () => {
  // Safe defaults so the app doesn't crash
  const [customer] = useState({ name: "Production Tenant", id: "live_001" });
  const [customerIndex] = useState(0);

  return { customer, customerIndex };
};
