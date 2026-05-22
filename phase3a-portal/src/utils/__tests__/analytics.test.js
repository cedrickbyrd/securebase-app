import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  initializeSessionTracking,
  trackVirtualPageView,
} from '../analytics';

describe('portal analytics', () => {
  beforeEach(() => {
    window.gtag = vi.fn();
  });

  afterEach(() => {
    delete window.gtag;
  });

  it('configures GA with manual page views enabled for SPA routing', () => {
    initializeSessionTracking();

    expect(window.gtag).toHaveBeenCalledWith(
      'config',
      expect.stringMatching(/^G-[A-Z0-9]+$/),
      expect.objectContaining({ send_page_view: false }),
    );
  });

  it('sends a manual page_view event with path, title and location', () => {
    trackVirtualPageView('/login', 'SecureBase Login', 'https://securebase.tximhotep.com/login');

    expect(window.gtag).toHaveBeenCalledWith('event', 'page_view', {
      page_path: '/login',
      page_title: 'SecureBase Login',
      page_location: 'https://securebase.tximhotep.com/login',
    });
  });

  it('deduplicates immediate duplicate page_view events for the same route', () => {
    trackVirtualPageView('/pricing', 'Pricing', 'https://securebase.tximhotep.com/pricing');
    trackVirtualPageView('/pricing', 'Pricing', 'https://securebase.tximhotep.com/pricing');

    const pageViewCalls = window.gtag.mock.calls.filter(
      ([callType, eventName]) => callType === 'event' && eventName === 'page_view',
    );
    expect(pageViewCalls).toHaveLength(1);
  });
});
