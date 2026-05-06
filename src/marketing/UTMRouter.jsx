/**
 * UTMRouter.jsx
 *
 * Invisible component that mounts once at the top of the React tree, runs
 * `initMarketingCapture()` to capture & fire GA4 events, then silently
 * redirects UTM-tagged visitors to the appropriate vertical landing page
 * instead of the generic homepage:
 *
 *   Banking / FFIEC  →  /banks
 *   Healthcare / HIPAA  →  /healthcare
 *
 * Redirect only happens on the root path ("/") or "/pricing" so that direct
 * links to other pages (e.g. /checkout) are never hijacked.
 *
 * Rendered inside <Router> in App.jsx — already has access to routing context.
 */

import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { initMarketingCapture, detectVertical } from './utmCapture';

const REDIRECT_ELIGIBLE_PATHS = new Set(['/', '/pricing']);

export default function UTMRouter() {
  const navigate  = useNavigate();
  const location  = useLocation();

  useEffect(() => {
    // Always capture UTM params on every navigation.
    initMarketingCapture();

    // Only redirect on eligible entry paths.
    if (!REDIRECT_ELIGIBLE_PATHS.has(location.pathname)) return;

    const vertical = detectVertical();
    if (vertical === 'banking') {
      navigate('/banks', { replace: true });
    } else if (vertical === 'healthcare') {
      navigate('/healthcare', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return null;
}
