import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ExportEvidence from '../ExportEvidence';

const generateEvidencePackage = vi.fn();
const pollUntilComplete = vi.fn();
const downloadFromUrl = vi.fn();

vi.mock('../../services/evidenceApiService', () => ({
  generateEvidencePackage: (...args) => generateEvidencePackage(...args),
  pollUntilComplete: (...args) => pollUntilComplete(...args),
  downloadFromUrl: (...args) => downloadFromUrl(...args),
}));

describe('ExportEvidence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('renders idle state with HIPAA selected by default', () => {
    render(<ExportEvidence />);

    expect(screen.getByRole('button', { name: /export evidence for audit/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('HIPAA');
  });

  it('calls generateEvidencePackage with selected framework and date range on export', async () => {
    generateEvidencePackage.mockResolvedValueOnce({
      status: 'complete',
      package_id: 'pkg-1',
      download_url: 'https://example.com/pkg.zip',
      sha256_manifest: 'abc123',
    });

    const { container } = render(<ExportEvidence />);
    const dateInputs = container.querySelectorAll('input[type="date"]');
    const periodStart = dateInputs[0].value;
    const periodEnd = dateInputs[1].value;

    fireEvent.click(screen.getByRole('button', { name: /export evidence for audit/i }));

    await waitFor(() => {
      expect(generateEvidencePackage).toHaveBeenCalledWith({
        framework: 'HIPAA',
        date_range_start: `${periodStart}T00:00:00.000Z`,
        date_range_end: `${periodEnd}T23:59:59.999Z`,
      });
    });
  });

  it('shows generating and polling states while waiting for completion', async () => {
    let resolveGenerate;
    const generatePromise = new Promise(resolve => {
      resolveGenerate = resolve;
    });

    generateEvidencePackage.mockReturnValueOnce(generatePromise);
    pollUntilComplete.mockResolvedValueOnce({
      status: 'complete',
      package_id: 'pkg-123',
      download_url: 'https://example.com/pkg.zip',
      sha256_manifest: 'abc123',
    });

    render(<ExportEvidence />);

    fireEvent.click(screen.getByRole('button', { name: /export evidence for audit/i }));
    expect(screen.getByText('Generating…')).toBeInTheDocument();

    resolveGenerate({ status: 'pending', package_id: 'pkg-123' });

    await waitFor(() => {
      expect(pollUntilComplete).toHaveBeenCalledWith(
        'pkg-123',
        expect.objectContaining({
          intervalMs: 5000,
          maxAttempts: 18,
          onProgress: expect.any(Function),
        }),
      );
    });
  });

  it('shows success state and sha256 when package is immediately complete', async () => {
    generateEvidencePackage.mockResolvedValueOnce({
      status: 'complete',
      package_id: 'pkg-1',
      download_url: 'https://example.com/pkg.zip',
      sha256_manifest: 'abc123',
    });

    render(<ExportEvidence />);
    fireEvent.click(screen.getByRole('button', { name: /export evidence for audit/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /download package/i })).toBeInTheDocument();
      expect(screen.getByText(/sha-256: abc123/i)).toBeInTheDocument();
    });
  });

  it('shows error state when generateEvidencePackage throws', async () => {
    generateEvidencePackage.mockRejectedValueOnce(new Error('HTTP 500: Internal Server Error'));

    render(<ExportEvidence />);
    fireEvent.click(screen.getByRole('button', { name: /export evidence for audit/i }));

    await waitFor(() => {
      expect(screen.getByText('HTTP 500: Internal Server Error')).toBeInTheDocument();
    });
  });

  it('surfaces 404 errors directly and does not show provisioning state', async () => {
    generateEvidencePackage.mockRejectedValueOnce(new Error('HTTP 404: Not Found'));

    render(<ExportEvidence />);
    fireEvent.click(screen.getByRole('button', { name: /export evidence for audit/i }));

    await waitFor(() => {
      expect(screen.getByText('HTTP 404: Not Found')).toBeInTheDocument();
      expect(screen.queryByText(/evidence engine provisioning/i)).not.toBeInTheDocument();
    });
  });

  it('passes updated framework value to generateEvidencePackage', async () => {
    generateEvidencePackage.mockResolvedValueOnce({
      status: 'complete',
      package_id: 'pkg-2',
      download_url: 'https://example.com/pkg.zip',
      sha256_manifest: 'abc123',
    });

    render(<ExportEvidence />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'SOC2' } });
    fireEvent.click(screen.getByRole('button', { name: /export evidence for audit/i }));

    await waitFor(() => {
      expect(generateEvidencePackage).toHaveBeenCalledWith(
        expect.objectContaining({
          framework: 'SOC2',
        }),
      );
    });
  });
});
