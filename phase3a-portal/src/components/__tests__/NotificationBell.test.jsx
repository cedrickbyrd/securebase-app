/**
 * Unit tests for NotificationBell component
 * Story 3B-1: Real-time Notifications
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NotificationBell from '../NotificationBell';
import { mockApiService } from '../../services/mockApiService';

// Mock the mockApiService
vi.mock('../../services/mockApiService', () => ({
  mockApiService: {
    getNotifications: vi.fn(),
    markNotificationAsRead: vi.fn(),
    markAllNotificationsAsRead: vi.fn(),
  },
}));

describe('NotificationBell Component', () => {
  const mockNotifications = [
    {
      id: 'notif_001',
      type: 'security',
      severity: 'warning',
      title: 'CloudTrail Disabled',
      message: 'CloudTrail logging was disabled in us-west-2 region',
      timestamp: '2026-02-08T14:30:00Z',
      read: false,
      actionUrl: '/compliance',
      actionText: 'View Details'
    },
    {
      id: 'notif_002',
      type: 'billing',
      severity: 'info',
      title: 'Invoice Generated',
      message: 'Your February invoice is ready for $1,250.00',
      timestamp: '2026-02-01T09:00:00Z',
      read: true,
      actionUrl: '/invoices',
      actionText: 'View Invoice'
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockApiService.getNotifications.mockResolvedValue(mockNotifications);
  });

  it('should render the bell icon', async () => {
    render(<NotificationBell />);
    
    await waitFor(() => {
      const bellButton = screen.getByLabelText(/notifications/i);
      expect(bellButton).toBeInTheDocument();
    });
  });

  it('should display unread count badge', async () => {
    render(<NotificationBell />);
    
    await waitFor(() => {
      const badge = screen.getByText('1'); // 1 unread notification
      expect(badge).toBeInTheDocument();
    });
  });

  it('should open dropdown when bell is clicked', async () => {
    render(<NotificationBell />);
    
    await waitFor(() => {
      const bellButton = screen.getByLabelText(/notifications/i);
      fireEvent.click(bellButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Notifications')).toBeInTheDocument();
      expect(screen.getByText('CloudTrail Disabled')).toBeInTheDocument();
    });
  });

  it('should display filter tabs', async () => {
    render(<NotificationBell />);
    
    await waitFor(() => {
      const bellButton = screen.getByLabelText(/notifications/i);
      fireEvent.click(bellButton);
    });

    await waitFor(() => {
      expect(screen.getByText('All')).toBeInTheDocument();
      expect(screen.getByText('Security')).toBeInTheDocument();
      expect(screen.getByText('Billing')).toBeInTheDocument();
      expect(screen.getByText('System')).toBeInTheDocument();
      expect(screen.getByText('Compliance')).toBeInTheDocument();
    });
  });

  it('should filter notifications by type', async () => {
    render(<NotificationBell />);
    
    await waitFor(() => {
      const bellButton = screen.getByLabelText(/notifications/i);
      fireEvent.click(bellButton);
    });

    await waitFor(() => {
      const securityTab = screen.getByText('Security');
      fireEvent.click(securityTab);
    });

    await waitFor(() => {
      expect(screen.getByText('CloudTrail Disabled')).toBeInTheDocument();
      expect(screen.queryByText('Invoice Generated')).not.toBeInTheDocument();
    });
  });

  it('should mark notification as read', async () => {
    mockApiService.markNotificationAsRead.mockResolvedValue({ success: true });
    
    render(<NotificationBell />);
    
    await waitFor(() => {
      const bellButton = screen.getByLabelText(/notifications/i);
      fireEvent.click(bellButton);
    });

    await waitFor(() => {
      const markReadButtons = screen.getAllByLabelText(/mark as read/i);
      fireEvent.click(markReadButtons[0]);
    });

    await waitFor(() => {
      expect(mockApiService.markNotificationAsRead).toHaveBeenCalledWith('notif_001');
    });
  });

  it('should mark all notifications as read', async () => {
    mockApiService.markAllNotificationsAsRead.mockResolvedValue({ success: true });
    
    render(<NotificationBell />);
    
    await waitFor(() => {
      const bellButton = screen.getByLabelText(/notifications/i);
      fireEvent.click(bellButton);
    });

    await waitFor(() => {
      const markAllButton = screen.getByText(/mark all as read/i);
      fireEvent.click(markAllButton);
    });

    await waitFor(() => {
      expect(mockApiService.markAllNotificationsAsRead).toHaveBeenCalled();
    });
  });

  it('should display empty state when no notifications', async () => {
    mockApiService.getNotifications.mockResolvedValue([]);
    
    render(<NotificationBell />);
    
    await waitFor(() => {
      const bellButton = screen.getByLabelText(/notifications/i);
      fireEvent.click(bellButton);
    });

    await waitFor(() => {
      expect(screen.getByText('No notifications')).toBeInTheDocument();
    });
  });

  it('should call onCriticalAlert for error severity notifications', async () => {
    const criticalNotification = {
      ...mockNotifications[0],
      severity: 'error',
    };
    mockApiService.getNotifications.mockResolvedValue([criticalNotification]);
    
    const onCriticalAlert = vi.fn();
    render(<NotificationBell onCriticalAlert={onCriticalAlert} />);
    
    await waitFor(() => {
      expect(onCriticalAlert).toHaveBeenCalledWith(criticalNotification);
    });
  });

  it('should close dropdown when clicking outside', async () => {
    render(
      <div>
        <NotificationBell />
        <div data-testid="outside">Outside</div>
      </div>
    );
    
    await waitFor(() => {
      const bellButton = screen.getByLabelText(/notifications/i);
      fireEvent.click(bellButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Notifications')).toBeInTheDocument();
    });

    const outside = screen.getByTestId('outside');
    fireEvent.mouseDown(outside);

    await waitFor(() => {
      expect(screen.queryByText('Notifications')).not.toBeInTheDocument();
    });
  });
});
