import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import EvidencePackages from '../EvidencePackages';

const listEvidencePackages = vi.fn();
const getEvidencePackage = vi.fn();
const generateEvidencePackage = vi.fn();
const downloadFromUrl = vi.fn();

vi.mock('../../services/evidenceApiService', () => ({
  listEvidencePackages: (...args) => listEvidencePackages(...args),
  getEvidencePackage: (...args) => getEvidencePackage(...args),
  generateEvidencePackage: (...args) => generateEvidencePackage(...args),
  downloadFromUrl: (...args) => downloadFromUrl(...args),
}));

describe('EvidencePackages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('renders expected history columns and empty state', async () => {
    listEvidencePackages.mockResolvedValueOnce({ packages: [] });

    render(<EvidencePackages />);

    await waitFor(() => {
      expect(screen.getByText('No evidence packages yet. Generate your first package below.')).toBeInTheDocument();
    });

    expect(screen.getByText('Framework')).toBeInTheDocument();
    expect(screen.getByText('Date Range')).toBeInTheDocument();
    expect(screen.getByText('Log Count')).toBeInTheDocument();
    expect(screen.getByText('Size')).toBeInTheDocument();
    expect(screen.getByText('SHA256')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Created At')).toBeInTheDocument();
  });

  it('submits generation and polls until completion', async () => {
    vi.useFakeTimers();

    listEvidencePackages
      .mockResolvedValueOnce({ packages: [] })
      .mockResolvedValueOnce({
        packages: [{ id: 'pkg-pending', framework: 'ALL', status: 'pending', created_at: '2026-01-01T00:00:00Z' }],
      })
      .mockResolvedValueOnce({
        packages: [{ id: 'pkg-complete', framework: 'ALL', status: 'complete', created_at: '2026-01-01T00:00:00Z' }],
      });

    generateEvidencePackage.mockResolvedValueOnce({ message: 'started' });

    render(<EvidencePackages />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /generate/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^generate$/i }));

    await waitFor(() => {
      expect(generateEvidencePackage).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/checking status every 5 seconds/i)).toBeInTheDocument();
    });

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(screen.getByText(/completed successfully/i)).toBeInTheDocument();
    });
  });

  it('shows download link expiry indicator for completed package', async () => {
    listEvidencePackages.mockResolvedValueOnce({
      packages: [{
        id: 'pkg-1',
        framework: 'HIPAA',
        status: 'complete',
        date_range_start: '2026-01-01T00:00:00Z',
        date_range_end: '2026-01-31T23:59:59Z',
        log_count: 10,
        size_bytes: 2048,
        sha256: '1234567890abcdef1234567890abcdef',
        created_at: '2026-02-01T10:00:00Z',
      }],
    });

    getEvidencePackage.mockResolvedValueOnce({
      package_name: 'evidence.zip',
      download_url: 'https://example.com/presigned',
      download_url_expires_in: 120,
    });

    render(<EvidencePackages />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /get link/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /get link/i }));

    await waitFor(() => {
      expect(downloadFromUrl).toHaveBeenCalledWith('https://example.com/presigned', 'evidence.zip');
      expect(screen.getByText(/link expires in/i)).toBeInTheDocument();
    });
  });

  it('shows timeout error when polling exceeds limit', async () => {
    vi.useFakeTimers();

    listEvidencePackages.mockResolvedValue({
      packages: [{ id: 'pkg-pending', framework: 'ALL', status: 'pending', created_at: '2026-01-01T00:00:00Z' }],
    });
    generateEvidencePackage.mockResolvedValueOnce({ message: 'started' });

    render(<EvidencePackages />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^generate$/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^generate$/i }));

    await waitFor(() => {
      expect(screen.getByText(/checking status every 5 seconds/i)).toBeInTheDocument();
    });

    await act(async () => {
      vi.advanceTimersByTime(365000);
    });

    await waitFor(() => {
      expect(screen.getByText(/timed out/i)).toBeInTheDocument();
    });
  });
});
