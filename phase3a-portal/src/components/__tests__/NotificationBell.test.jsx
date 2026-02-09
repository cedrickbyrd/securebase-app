/**
 * Unit tests for NotificationBell component
 * Story 3B-1: Real-time Notifications
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NotificationBell from '../NotificationBell';

// Mock the API service
vi.mock('../../services/mockApiService', () => ({
  mockApiService: {
    getNotifications: vi.fn(() => Promise.resolve([
      {
        id: 'notif_001',
        type: 'security',
        severity: 'critical',
        title: 'Security Alert',
        message: 'Unusual API activity detected from IP 192.168.1.100',
        timestamp: '2026-02-08T15:30:00Z',
        read: false,
        actionUrl: '/activity'
      },
      {
        id: 'notif_002',
        type: 'billing',
        severity: 'warning',
        title: 'Invoice Due',
        message: 'Invoice INV-2026-002 is due in 3 days',
        timestamp: '2026-02-07T10:00:00Z',
        read: false,
        actionUrl: '/invoices'
      },
      {
        id: 'notif_003',
        type: 'compliance',
        severity: 'info',
        title: 'Compliance Assessment Complete',
        message: 'SOC 2 assessment completed successfully',
        timestamp: '2026-02-06T14:22:00Z',
        read: true,
        actionUrl: '/compliance'
      }
    ])),
    markNotificationAsRead: vi.fn((id) => Promise.resolve({ success: true, id })),
    markAllNotificationsAsRead: vi.fn(() => Promise.resolve({ success: true }))
  }
}));

describe('NotificationBell Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should render notification bell icon', async () => {
    render(<NotificationBell />);
    
    await waitFor(() => {
      const bellButton = screen.getByRole('button', { name: /notifications/i });
      expect(bellButton).toBeInTheDocument();
    });
  });

  it('should display unread count badge', async () => {
    render(<NotificationBell />);
    
    await waitFor(() => {
      const badge = screen.getByText('2'); // 2 unread notifications
      expect(badge).toBeInTheDocument();
    });
  });

  it('should open notification panel when bell is clicked', async () => {
    render(<NotificationBell />);
    
    await waitFor(() => {
      const bellButton = screen.getByRole('button', { name: /notifications/i });
      fireEvent.click(bellButton);
    });
    
    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });

  it('should display notifications in panel', async () => {
    render(<NotificationBell />);
    
    await waitFor(() => {
      const bellButton = screen.getByRole('button', { name: /notifications/i });
      fireEvent.click(bellButton);
    });
    
    expect(screen.getByText('Security Alert')).toBeInTheDocument();
    expect(screen.getByText('Invoice Due')).toBeInTheDocument();
  });

  it('should filter notifications by type', async () => {
    render(<NotificationBell />);
    
    await waitFor(() => {
      const bellButton = screen.getByRole('button', { name: /notifications/i });
      fireEvent.click(bellButton);
    });
    
    const securityFilter = screen.getByRole('button', { name: /security/i });
    fireEvent.click(securityFilter);
    
    expect(screen.getByText('Security Alert')).toBeInTheDocument();
    expect(screen.queryByText('Invoice Due')).not.toBeInTheDocument();
  });

  it('should mark notification as read', async () => {
    const { mockApiService } = await import('../../services/mockApiService');
    render(<NotificationBell />);
    
    await waitFor(() => {
      const bellButton = screen.getByRole('button', { name: /notifications/i });
      fireEvent.click(bellButton);
    });
    
    const markReadButtons = screen.getAllByLabelText(/mark as read/i);
    fireEvent.click(markReadButtons[0]);
    
    await waitFor(() => {
      expect(mockApiService.markNotificationAsRead).toHaveBeenCalledWith('notif_001');
    });
  });

  it('should mark all notifications as read', async () => {
    const { mockApiService } = await import('../../services/mockApiService');
    render(<NotificationBell />);
    
    await waitFor(() => {
      const bellButton = screen.getByRole('button', { name: /notifications/i });
      fireEvent.click(bellButton);
    });
    
    const markAllButton = screen.getByText(/mark all as read/i);
    fireEvent.click(markAllButton);
    
    await waitFor(() => {
      expect(mockApiService.markAllNotificationsAsRead).toHaveBeenCalled();
    });
  });

  it('should trigger toast for critical notifications', async () => {
    const onCriticalAlert = vi.fn();
    render(<NotificationBell onCriticalAlert={onCriticalAlert} />);
    
    await waitFor(() => {
      expect(onCriticalAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'critical',
          title: 'Security Alert'
        })
      );
    });
  });

  it('should trigger toast for warning notifications', async () => {
    const onCriticalAlert = vi.fn();
    render(<NotificationBell onCriticalAlert={onCriticalAlert} />);
    
    await waitFor(() => {
      expect(onCriticalAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'warning',
          title: 'Invoice Due'
        })
      );
    });
  });

  it('should close panel when clicking outside', async () => {
    render(<NotificationBell />);
    
    await waitFor(() => {
      const bellButton = screen.getByRole('button', { name: /notifications/i });
      fireEvent.click(bellButton);
    });
    
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    
    // Simulate click outside
    fireEvent.mouseDown(document.body);
    
    await waitFor(() => {
      expect(screen.queryByText('Notifications')).not.toBeInTheDocument();
    });
  });
});
