/**
 * Unit tests for ReportBuilder component
 * Phase 4: Advanced Analytics & Reporting
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReportBuilder } from '../ReportBuilder';

describe('ReportBuilder Component', () => {
  it('should render ReportBuilder component', () => {
    render(<ReportBuilder />);
    expect(screen.getByText(/report builder/i)).toBeInTheDocument();
  });

  it('should allow field selection', async () => {
    render(<ReportBuilder />);
    const field = screen.getByText('Cost');
    fireEvent.click(field);
    expect(field).toHaveClass('selected');
  });

  it('should save report configuration', async () => {
    const onSave = vi.fn();
    render(<ReportBuilder onSave={onSave} />);
    
    const saveButton = screen.getByText(/save/i);
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
    });
  });
});
