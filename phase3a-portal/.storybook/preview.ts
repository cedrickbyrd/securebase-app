import type { Preview } from '@storybook/react';

function jsonResponse(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  );
}

function buildFetch(scenario = 'default') {
  return async (input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    if (url.includes('/tenant/compliance/history')) {
      if (scenario === 'compliance-empty') {
        return jsonResponse({ frameworks: {} });
      }
      if (scenario === 'compliance-error') {
        return jsonResponse({ error: 'Unable to load compliance history.' }, 500);
      }
      return jsonResponse({
        frameworks: {
          SOC2: {
            current_score: 88,
            score_delta_7d: 3,
            status: 'Passing',
            trend: 'Improving',
            history: [
              { date: '2026-05-01', score: 84 },
              { date: '2026-05-10', score: 86 },
              { date: '2026-05-20', score: 88 }
            ],
            violations: [
              {
                control_id: 'SOC2-CC6.7',
                control_name: 'Encryption at Rest',
                severity: 'High',
                status: 'NON_COMPLIANT',
                days_failing: 4,
              },
            ],
          },
          HIPAA: {
            current_score: 82,
            score_delta_7d: 1,
            status: 'Passing',
            trend: 'Stable',
            history: [
              { date: '2026-05-01', score: 81 },
              { date: '2026-05-10', score: 81 },
              { date: '2026-05-20', score: 82 }
            ],
            violations: [],
          },
          FedRAMP: {
            current_score: 75,
            score_delta_7d: -2,
            status: 'At Risk',
            trend: 'Declining',
            history: [
              { date: '2026-05-01', score: 79 },
              { date: '2026-05-10', score: 77 },
              { date: '2026-05-20', score: 75 }
            ],
            violations: [],
          },
        },
      });
    }

    if (url.includes('/admin/evidence/generate')) {
      return jsonResponse({
        id: 'pkg-20260520-001',
        status: 'complete',
        download_url: 'https://example.com/evidence.zip',
        sha256_manifest: '89cc2ab03a2d2ebf95a5f64c2b57cf551f3886f70abf7ceaf0393ed66ea4f91f',
        size_bytes: 49152,
        generated_at: '2026-05-20T10:00:00Z',
      });
    }

    if (/\/admin\/evidence\/[^/?]+/.test(url)) {
      return jsonResponse({
        id: 'pkg-20260520-001',
        package_name: 'securebase-evidence-2026-05-20.zip',
        framework: 'SOC2',
        status: 'complete',
        date_range_start: '2026-02-20T00:00:00Z',
        date_range_end: '2026-05-20T23:59:59Z',
        log_count: 241,
        size_bytes: 49152,
        sha256: '89cc2ab03a2d2ebf95a5f64c2b57cf551f3886f70abf7ceaf0393ed66ea4f91f',
        created_at: '2026-05-20T10:00:00Z',
        download_url: 'https://example.com/evidence.zip',
        download_url_expires_in: 3600,
      });
    }

    if (url.includes('/admin/evidence')) {
      if (scenario === 'evidence-empty') {
        return jsonResponse({ packages: [], count: 0 });
      }
      return jsonResponse({
        packages: [
          {
            id: 'pkg-20260520-001',
            package_name: 'securebase-evidence-2026-05-20.zip',
            framework: 'SOC2',
            status: 'complete',
            date_range_start: '2026-02-20T00:00:00Z',
            date_range_end: '2026-05-20T23:59:59Z',
            log_count: 241,
            size_bytes: 49152,
            sha256: '89cc2ab03a2d2ebf95a5f64c2b57cf551f3886f70abf7ceaf0393ed66ea4f91f',
            created_at: '2026-05-20T10:00:00Z',
          },
        ],
        count: 1,
      });
    }

    return jsonResponse({});
  };
}

const preview: Preview = {
  decorators: [
    (Story, context) => {
      const scenario = context.parameters.fetchScenario || 'default';
      globalThis.fetch = buildFetch(scenario);
      globalThis.localStorage?.setItem('sessionToken', 'storybook-token');
      globalThis.sessionStorage?.setItem('sessionToken', 'storybook-token');
      return Story();
    },
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: 'padded',
  },
};

export default preview;
