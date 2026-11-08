// phase3a-portal/src/services/supabaseBridge.js

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://dvmuaivsbtrykqsnrtnv.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Standard PostgREST headers required by Supabase
 */
const getHeaders = () => {
  if (!SUPABASE_ANON_KEY) {
    console.error('[SupabaseBridge] VITE_SUPABASE_ANON_KEY is missing from environment.');
  }
  
  return {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
};

export const supabaseBridge = {
  /**
   * Retrieves the latest compliance summary for a specific tenant.
   * Equivalent SQL: SELECT * FROM compliance_summaries WHERE tenant_id = '...' ORDER BY evaluated_at DESC LIMIT 1;
   */
  async getTenantComplianceScore(tenantId = 'cnb-waxahachie') {
    try {
      // Using Supabase PostgREST syntax for filtering and sorting
      const queryParams = new URLSearchParams({
        'tenant_id': `eq.${tenantId}`,
        'order': 'evaluated_at.desc',
        'limit': '1'
      });
      
      const endpoint = `${SUPABASE_URL}/rest/v1/compliance_summaries?${queryParams.toString()}`;
      
      const res = await fetch(endpoint, { 
        method: 'GET', 
        headers: getHeaders() 
      });
      
      if (!res.ok) {
        throw new Error(`[SupabaseBridge] HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      return data[0] || null; // Return the single most recent record
      
    } catch (error) {
      console.error('[SupabaseBridge] Error fetching tenant compliance score:', error);
      throw error;
    }
  },

  /**
   * Retrieves the 90-day compliance drift timeline for a specific tenant.
   * Equivalent SQL: SELECT * FROM compliance_drift_events WHERE tenant_id = '...' ORDER BY timestamp DESC LIMIT 90;
   */
  async getComplianceDrift(tenantId = 'cnb-waxahachie', limit = 90) {
    try {
      const queryParams = new URLSearchParams({
        'tenant_id': `eq.${tenantId}`,
        'order': 'timestamp.desc',
        'limit': limit.toString()
      });
      
      const endpoint = `${SUPABASE_URL}/rest/v1/compliance_drift_events?${queryParams.toString()}`;
      
      const res = await fetch(endpoint, { 
        method: 'GET', 
        headers: getHeaders() 
      });
      
      if (!res.ok) {
        throw new Error(`[SupabaseBridge] HTTP error! status: ${res.status}`);
      }
      
      return await res.json();
      
    } catch (error) {
      console.error('[SupabaseBridge] Error fetching compliance drift timeline:', error);
      throw error;
    }
  }
};
