/**
 * Unit tests for NotificationToast component
 * Story 3B-1: Real-time Notifications
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NotificationToast, { ToastContainer } from '../NotificationToast';

describe('NotificationToast Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const criticalNotification = {
    id: 'notif_001',
    type: 'security',
    severity: 'critical',
    title: 'Security Alert',
    message: 'Unusual API activity detected'
  };

  const warningNotification = {
    id: 'notif_002',
    type: 'billing',
    severity: 'warning',
    title: 'Invoice Due',
    message: 'Invoice is due in 3 days'
  };

  it('should render notification toast', () => {
    render(<NotificationToast notification={criticalNotification} />);
    
    expect(screen.getByText('Security Alert')).toBeInTheDocument();
    expect(screen.getByText('Unusual API activity detected')).toBeInTheDocument();
  });

  it('should auto-dismiss after 10 seconds for critical notifications', () => {
    const onClose = vi.fn();
    render(<NotificationToast notification={criticalNotification} onClose={onClose} />);
    
    // Fast-forward 10 seconds
    vi.advanceTimersByTime(10000);
    
    // Wait for animation
    vi.advanceTimersByTime(300);
    
    expect(onClose).toHaveBeenCalled();
  });

  it('should auto-dismiss after 5 seconds for non-critical notifications', () => {
    const onClose = vi.fn();
    render(<NotificationToast notification={warningNotification} onClose={onClose} />);
    
    // Fast-forward 5 seconds
    vi.advanceTimersByTime(5000);
    
    // Wait for animation
    vi.advanceTimersByTime(300);
    
    expect(onClose).toHaveBeenCalled();
  });

  it('should close when close button is clicked', () => {
    const onClose = vi.fn();
    render(<NotificationToast notification={criticalNotification} onClose={onClose} />);
    
    const closeButton = screen.getByLabelText(/close notification/i);
    fireEvent.click(closeButton);
    
    // Wait for animation
    vi.advanceTimersByTime(300);
    
    expect(onClose).toHaveBeenCalled();
  });

  it('should display correct icon for critical severity', () => {
    render(<NotificationToast notification={criticalNotification} />);
    
    const toast = screen.getByText('Security Alert').closest('.notification-toast');
    expect(toast).toHaveClass('severity-critical');
  });

  it('should display correct icon for warning severity', () => {
    render(<NotificationToast notification={warningNotification} />);
    
    const toast = screen.getByText('Invoice Due').closest('.notification-toast');
    expect(toast).toHaveClass('severity-warning');
  });
});

describe('ToastContainer Component', () => {
  const toasts = [
    {
      id: 'notif_001',
      severity: 'critical',
      title: 'Toast 1',
      message: 'Message 1'
    },
    {
      id: 'notif_002',
      severity: 'warning',
      title: 'Toast 2',
      message: 'Message 2'
    },
    {
      id: 'notif_003',
      severity: 'info',
      title: 'Toast 3',
      message: 'Message 3'
    },
    {
      id: 'notif_004',
      severity: 'success',
      title: 'Toast 4',
      message: 'Message 4'
    }
  ];

  it('should render toast container', () => {
    const onRemove = vi.fn();
    render(<ToastContainer toasts={[toasts[0]]} onRemove={onRemove} />);
    
    expect(screen.getByText('Toast 1')).toBeInTheDocument();
  });

  it('should limit to max 3 visible toasts', () => {
    const onRemove = vi.fn();
    render(<ToastContainer toasts={toasts} onRemove={onRemove} />);
    
    // Should show only the last 3 toasts
    expect(screen.queryByText('Toast 1')).not.toBeInTheDocument();
    expect(screen.getByText('Toast 2')).toBeInTheDocument();
    expect(screen.getByText('Toast 3')).toBeInTheDocument();
    expect(screen.getByText('Toast 4')).toBeInTheDocument();
  });

  it('should call onRemove when toast is closed', () => {
    const onRemove = vi.fn();
    render(<ToastContainer toasts={[toasts[0]]} onRemove={onRemove} />);
    
    const closeButton = screen.getByLabelText(/close notification/i);
    fireEvent.click(closeButton);
    
    expect(onRemove).toHaveBeenCalledWith('notif_001');
  });
});
