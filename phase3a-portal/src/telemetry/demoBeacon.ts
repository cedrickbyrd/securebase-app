const API_BASE_URL =
  import.meta.env?.VITE_API_URL ||
  (typeof process !== 'undefined' ? process.env?.REACT_APP_API_URL : '') ||
  'https://securebase-api.onrender.com';

export const trackDemoEvent = async (event: string, payload: Record<string, any>) => {
  try {
    const sessionToken = sessionStorage.getItem('sb_demo_token') || 'demo_viewer_ephemeral';
    await fetch(`${API_BASE_URL}/api/v1/telemetry/beacon`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        event,
        payload,
        timestamp: new Date().toISOString(),
      }),
      keepalive: true,
    });
  } catch {
    // Non-blocking, fail silently for visitor UI
  }
};
