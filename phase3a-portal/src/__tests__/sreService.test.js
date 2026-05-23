import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sreService } from '../services/sreService';

describe('sreService.getHIPAACompliance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    sessionStorage.clear();
    localStorage.clear();
    global.fetch = vi.fn();
  });

  it('returns mock HIPAA data in demo mode without calling the API', async () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true');

    const result = await sreService.getHIPAACompliance();

    expect(result).toMatchObject({
      overallScore: expect.any(Number),
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('calls the API outside demo mode', async () => {
    vi.stubEnv('VITE_DEMO_MODE', 'false');
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ overallScore: 92 }),
    });

    const result = await sreService.getHIPAACompliance();

    expect(result).toEqual({ overallScore: 92 });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/compliance/hipaa',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    );
  });
});
