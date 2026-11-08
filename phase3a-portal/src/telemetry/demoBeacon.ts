// phase3a-portal/src/telemetry/demoBeacon.ts
export const trackDemoEvent = async (event: string, payload: Record<string, any>) => {
  try {
    const sessionToken = sessionStorage.getItem('sb_demo_token');
    await fetch(`${process.env.REACT_APP_API_URL}/api/v1/telemetry/beacon`, {
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
      keepalive: true, // Guarantees beacon dispatches even if page closes
    });
  } catch (err) {
    // Non-blocking, fail silently for visitor UI
  }
};
