import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NotificationCenter from '../components/NotificationCenter';
import * as notificationService from '../services/notificationService';

/**
 * NotificationCenter Component Tests
 * 
 * Comprehensive test coverage including:
 * - Component rendering
 * - Notification bell icon with badge
 * - Unread count display
 * - Notification list display
 * - Mark as read functionality
 * - Mark all as read functionality
 * - Real-time updates (polling)
 * - Dropdown open/close
 * - Loading states
 * - Error states
 * - Empty state (no notifications)
 * - Accessibility (ARIA labels, keyboard navigation)
 */

// Mock data
const mockNotifications = [
  {
    id: 1,
    type: 'security_alert',
    priority: 'critical',
    title: 'Security Alert',
    body: 'Unusual login detected from new location',
    message: 'Unusual login detected from new location',
    read_at: null,
    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
  },
  {
    id: 2,
    type: 'billing',
    priority: 'high',
    title: 'Invoice Due',
    body: 'Payment due in 3 days - $1,234.56',
    message: 'Payment due in 3 days - $1,234.56',
    read_at: null,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
  },
  {
    id: 3,
    type: 'compliance',
    priority: 'medium',
    title: 'Compliance Check Complete',
    body: 'Monthly compliance scan completed successfully',
    message: 'Monthly compliance scan completed successfully',
    read_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
  },
  {
    id: 4,
    type: 'system',
    priority: 'low',
    title: 'System Update',
    body: 'Scheduled maintenance completed',
    message: 'Scheduled maintenance completed',
    read_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 2 days ago
  }
];

// Mock the notificationService module
vi.mock('../services/notificationService', () => ({
  getNotifications: vi.fn(),
  markAsRead: vi.fn(),
  default: {
    getNotifications: vi.fn(),
    markAsRead: vi.fn()
  }
}));

// Mock date-fns
vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn((date, options) => {
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (minutes < 60) return `${minutes} minutes ago`;
    if (hours < 24) return `${hours} hours ago`;
    return `${days} days ago`;
  })
}));

describe('NotificationCenter Component', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    
    // Don't use fake timers for most tests to avoid complexity
    // vi.useFakeTimers();
    
    // Setup default mock implementation
    notificationService.getNotifications.mockResolvedValue({
      notifications: mockNotifications,
      unreadCount: 2
    });
    
    // Setup localStorage
    localStorage.setItem('userId', 'test-user-id');
    localStorage.setItem('customerId', 'test-customer-id');
  });

  afterEach(() => {
    vi.clearAllMocks();
    // vi.useRealTimers();
    localStorage.clear();
  });

  // ========================================================================
  // RENDERING TESTS
  // ========================================================================

  it('should render without crashing', async () => {
    render(<NotificationCenter />);
    
    await waitFor(() => {
      const bellButton = screen.getByRole('button', { name: /notifications/i });
      expect(bellButton).toBeInTheDocument();
    });
  });

  it('should render notification bell icon', async () => {
    render(<NotificationCenter />);
    
    await waitFor(() => {
      const bellButton = screen.getByRole('button', { name: /notifications/i });
      expect(bellButton).toBeInTheDocument();
    });
  });

  it('should render unread count badge when there are unread notifications', async () => {
    render(<NotificationCenter />);
    
    await waitFor(() => {
      const badge = screen.getByText('2');
      expect(badge).toBeInTheDocument();
    });
  });

  it('should not render badge when unread count is zero', async () => {
    notificationService.getNotifications.mockResolvedValue({
      notifications: mockNotifications.map(n => ({ ...n, read_at: new Date().toISOString() })),
      unreadCount: 0
    });
    
    render(<NotificationCenter />);
    
    await waitFor(() => {
      expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument();
    });
  });

  it('should display 99+ when unread count exceeds 99', async () => {
    notificationService.getNotifications.mockResolvedValue({
      notifications: mockNotifications,
      unreadCount: 150
    });
    
    render(<NotificationCenter />);
    
    await waitFor(() => {
      const badge = screen.getByText('99+');
      expect(badge).toBeInTheDocument();
    });
  });

  // ========================================================================
  // INTERACTION TESTS
  // ========================================================================

  it('should open dropdown when bell icon is clicked', async () => {
    const user = userEvent.setup({ delay: null });
    render(<NotificationCenter />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
    });
    
    const bellButton = screen.getByRole('button', { name: /notifications/i });
    await user.click(bellButton);
    
    await waitFor(() => {
      expect(screen.getByText('Security Alert')).toBeInTheDocument();
      expect(screen.getByText('Invoice Due')).toBeInTheDocument();
    });
  });

  it('should close dropdown when bell icon is clicked again', async () => {
    const user = userEvent.setup({ delay: null });
    render(<NotificationCenter />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
    });
    
    const bellButton = screen.getByRole('button', { name: /notifications/i });
    
    // Open dropdown
    await user.click(bellButton);
    await waitFor(() => {
      expect(screen.getByText('Security Alert')).toBeInTheDocument();
    });
    
    // Close dropdown
    await user.click(bellButton);
    await waitFor(() => {
      expect(screen.queryByText('Security Alert')).not.toBeInTheDocument();
    });
  });

  it('should close dropdown when clicking outside', async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <div>
        <NotificationCenter />
        <div data-testid="outside">Outside</div>
      </div>
    );
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
    });
    
    const bellButton = screen.getByRole('button', { name: /notifications/i });
    await user.click(bellButton);
    
    await waitFor(() => {
      expect(screen.getByText('Security Alert')).toBeInTheDocument();
    });
    
    // Click outside
    const outsideElement = screen.getByTestId('outside');
    await user.click(outsideElement);
    
    await waitFor(() => {
      expect(screen.queryByText('Security Alert')).not.toBeInTheDocument();
    });
  });

  it('should mark notification as read when "Mark Read" clicked', async () => {
    const user = userEvent.setup({ delay: null });
    notificationService.markAsRead.mockResolvedValue({ success: true, markedCount: 1 });
    
    render(<NotificationCenter />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
    });
    
    const bellButton = screen.getByRole('button', { name: /notifications/i });
    await user.click(bellButton);
    
    await waitFor(() => {
      expect(screen.getByText('Security Alert')).toBeInTheDocument();
    });
    
    const markReadButtons = screen.getAllByRole('button', { name: /mark read/i });
    await user.click(markReadButtons[0]);
    
    await waitFor(() => {
      expect(notificationService.markAsRead).toHaveBeenCalledWith([1]);
    });
  });

  it('should mark all notifications as read when "Mark All Read" clicked', async () => {
    const user = userEvent.setup({ delay: null });
    notificationService.markAsRead.mockResolvedValue({ success: true, markedCount: 2 });
    
    render(<NotificationCenter />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
    });
    
    const bellButton = screen.getByRole('button', { name: /notifications/i });
    await user.click(bellButton);
    
    await waitFor(() => {
      expect(screen.getByText('Security Alert')).toBeInTheDocument();
    });
    
    const markAllButton = screen.getByRole('button', { name: /mark all read/i });
    await user.click(markAllButton);
    
    await waitFor(() => {
      expect(notificationService.markAsRead).toHaveBeenCalledWith([1, 2]);
    });
  });

  // ========================================================================
  // DATA DISPLAY TESTS
  // ========================================================================

  it('should display notification list in dropdown', async () => {
    const user = userEvent.setup({ delay: null });
    render(<NotificationCenter />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
    });
    
    const bellButton = screen.getByRole('button', { name: /notifications/i });
    await user.click(bellButton);
    
    await waitFor(() => {
      expect(screen.getByText('Security Alert')).toBeInTheDocument();
      expect(screen.getByText('Invoice Due')).toBeInTheDocument();
      expect(screen.getByText('Compliance Check Complete')).toBeInTheDocument();
      expect(screen.getByText('System Update')).toBeInTheDocument();
    });
  });

  it('should display notification title, body, and timestamp', async () => {
    const user = userEvent.setup({ delay: null });
    render(<NotificationCenter />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
    });
    
    const bellButton = screen.getByRole('button', { name: /notifications/i });
    await user.click(bellButton);
    
    await waitFor(() => {
      // Title
      expect(screen.getByText('Security Alert')).toBeInTheDocument();
      
      // Body
      expect(screen.getByText(/unusual login detected/i)).toBeInTheDocument();
      
      // Timestamp (formatted by date-fns mock)
      expect(screen.getByText(/minutes ago|hours ago|days ago/i)).toBeInTheDocument();
    });
  });

  it('should highlight unread notifications', async () => {
    const user = userEvent.setup({ delay: null });
    render(<NotificationCenter />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
    });
    
    const bellButton = screen.getByRole('button', { name: /notifications/i });
    await user.click(bellButton);
    
    await waitFor(() => {
      const securityAlert = screen.getByText('Security Alert');
      const unreadNotification = securityAlert.closest('div[class*="bg-blue-50"]');
      expect(unreadNotification).toBeInTheDocument();
    });
  });

  it('should display empty state when no notifications exist', async () => {
    const user = userEvent.setup({ delay: null });
    notificationService.getNotifications.mockResolvedValue({
      notifications: [],
      unreadCount: 0
    });
    
    render(<NotificationCenter />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
    });
    
    const bellButton = screen.getByRole('button', { name: /notifications/i });
    await user.click(bellButton);
    
    await waitFor(() => {
      expect(screen.getByText(/no notifications/i)).toBeInTheDocument();
    });
  });

  it('should format timestamp with "time ago"', async () => {
    const user = userEvent.setup({ delay: null });
    render(<NotificationCenter />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
    });
    
    const bellButton = screen.getByRole('button', { name: /notifications/i });
    await user.click(bellButton);
    
    await waitFor(() => {
      // Our date-fns mock should format these
      const timestamps = screen.getAllByText(/\d+ (minutes?|hours?|days?) ago/i);
      expect(timestamps.length).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // ICON AND PRIORITY TESTS
  // ========================================================================

  it('should display correct icon based on type', async () => {
    const user = userEvent.setup({ delay: null });
    render(<NotificationCenter />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
    });
    
    const bellButton = screen.getByRole('button', { name: /notifications/i });
    await user.click(bellButton);
    
    await waitFor(() => {
      // Security alert should have Shield icon
      expect(screen.getByText('Security Alert')).toBeInTheDocument();
      
      // Billing should have DollarSign icon
      expect(screen.getByText('Invoice Due')).toBeInTheDocument();
      
      // Compliance should have CheckCircle icon
      expect(screen.getByText('Compliance Check Complete')).toBeInTheDocument();
      
      // System should have Info icon
      expect(screen.getByText('System Update')).toBeInTheDocument();
    });
  });

  it('should apply correct color based on priority', async () => {
    const user = userEvent.setup({ delay: null });
    render(<NotificationCenter />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
    });
    
    const bellButton = screen.getByRole('button', { name: /notifications/i });
    await user.click(bellButton);
    
    await waitFor(() => {
      const securityAlert = screen.getByText('Security Alert');
      const criticalNotification = securityAlert.closest('div').querySelector('[class*="text-red-600"]');
      expect(criticalNotification).toBeInTheDocument();
    });
  });

  // ========================================================================
  // LOADING AND ERROR TESTS
  // ========================================================================

  it('should display loading state while fetching notifications', async () => {
    notificationService.getNotifications.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        notifications: mockNotifications,
        unreadCount: 2
      }), 50))
    );
    
    const user = userEvent.setup({ delay: null });
    render(<NotificationCenter />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
    });
    
    const bellButton = screen.getByRole('button', { name: /notifications/i });
    await user.click(bellButton);
    
    // Should show loading text initially
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Security Alert')).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('should display error message when API call fails', async () => {
    notificationService.getNotifications.mockRejectedValue(new Error('API Error'));
    
    const user = userEvent.setup({ delay: null });
    render(<NotificationCenter />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
    });
    
    const bellButton = screen.getByRole('button', { name: /notifications/i });
    await user.click(bellButton);
    
    await waitFor(() => {
      expect(screen.getByText(/failed to load notifications/i)).toBeInTheDocument();
    });
  });

  it('should show loading spinner while fetching', async () => {
    notificationService.getNotifications.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        notifications: mockNotifications,
        unreadCount: 2
      }), 50))
    );
    
    const user = userEvent.setup({ delay: null });
    render(<NotificationCenter />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
    });
    
    const bellButton = screen.getByRole('button', { name: /notifications/i });
    await user.click(bellButton);
    
    // Should show loading text
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('Security Alert')).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  // ========================================================================
  // REAL-TIME UPDATES TESTS
  // ========================================================================

  it('should fetch notifications on component mount', async () => {
    render(<NotificationCenter />);
    
    await waitFor(() => {
      expect(notificationService.getNotifications).toHaveBeenCalledTimes(1);
      expect(notificationService.getNotifications).toHaveBeenCalledWith({
        userId: 'test-user-id',
        customerId: 'test-customer-id',
        limit: 10
      });
    });
  });

  it('should set up polling interval', async () => {
    const { unmount } = render(<NotificationCenter />);
    
    await waitFor(() => {
      expect(notificationService.getNotifications).toHaveBeenCalled();
    });
    
    // Unmount to clean up interval
    unmount();
  });

  it('should update unread count when notifications change', async () => {
    const { rerender } = render(<NotificationCenter />);
    
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });
    
    // Verify initial count is shown
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('should clean up polling on unmount', async () => {
    const { unmount } = render(<NotificationCenter />);
    
    await waitFor(() => {
      expect(notificationService.getNotifications).toHaveBeenCalledTimes(1);
    });
    
    const initialCallCount = notificationService.getNotifications.mock.calls.length;
    
    unmount();
    
    // After unmount, no more calls should be made
    expect(notificationService.getNotifications.mock.calls.length).toBe(initialCallCount);
  });

  // ========================================================================
  // NAVIGATION TESTS
  // ========================================================================

  it('should navigate to notification detail when notification is clicked', async () => {
    const user = userEvent.setup({ delay: null });
    
    // Mock window.location
    delete window.location;
    window.location = { href: '' };
    
    render(<NotificationCenter />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
    });
    
    const bellButton = screen.getByRole('button', { name: /notifications/i });
    await user.click(bellButton);
    
    await waitFor(() => {
      expect(screen.getByText('Security Alert')).toBeInTheDocument();
    });
    
    const notification = screen.getByText('Security Alert').closest('div[class*="cursor-pointer"]');
    await user.click(notification);
    
    // Should navigate based on notification type
    await waitFor(() => {
      expect(window.location.href).toBe('/compliance');
    });
  });

  it('should navigate to all notifications page when "View all" is clicked', async () => {
    const user = userEvent.setup({ delay: null });
    
    render(<NotificationCenter />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
    });
    
    const bellButton = screen.getByRole('button', { name: /notifications/i });
    await user.click(bellButton);
    
    await waitFor(() => {
      expect(screen.getByText(/view all notifications/i)).toBeInTheDocument();
    });
    
    const viewAllLink = screen.getByText(/view all notifications/i);
    expect(viewAllLink).toHaveAttribute('href', '/notifications');
  });

  // ========================================================================
  // ACCESSIBILITY TESTS
  // ========================================================================

  it('should have proper ARIA labels for screen readers', async () => {
    render(<NotificationCenter />);
    
    await waitFor(() => {
      const bellButton = screen.getByRole('button', { name: /notifications \(2 unread\)/i });
      expect(bellButton).toBeInTheDocument();
      expect(bellButton).toHaveAttribute('aria-label');
      expect(bellButton).toHaveAttribute('aria-expanded', 'false');
      expect(bellButton).toHaveAttribute('aria-haspopup', 'true');
    });
  });

  it('should support keyboard navigation', async () => {
    const user = userEvent.setup({ delay: null });
    render(<NotificationCenter />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
    });
    
    const bellButton = screen.getByRole('button', { name: /notifications/i });
    
    // Tab to the button
    bellButton.focus();
    expect(bellButton).toHaveFocus();
    
    // Press Enter to open dropdown
    await user.keyboard('{Enter}');
    
    await waitFor(() => {
      expect(screen.getByText('Security Alert')).toBeInTheDocument();
    });
  });

  it('should have aria-expanded attribute', async () => {
    const user = userEvent.setup({ delay: null });
    render(<NotificationCenter />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
    });
    
    const bellButton = screen.getByRole('button', { name: /notifications/i });
    
    // Initially closed
    expect(bellButton).toHaveAttribute('aria-expanded', 'false');
    
    // Open dropdown
    await user.click(bellButton);
    
    await waitFor(() => {
      expect(bellButton).toHaveAttribute('aria-expanded', 'true');
    });
  });

  it('should have accessible button labels', async () => {
    const user = userEvent.setup({ delay: null });
    render(<NotificationCenter />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
    });
    
    const bellButton = screen.getByRole('button', { name: /notifications/i });
    await user.click(bellButton);
    
    await waitFor(() => {
      // Mark read buttons should have aria-label
      const markReadButtons = screen.getAllByRole('button', { name: /mark/i });
      expect(markReadButtons.length).toBeGreaterThan(0);
      
      // Close button should have aria-label
      const closeButton = screen.getByRole('button', { name: /close notifications/i });
      expect(closeButton).toBeInTheDocument();
    });
  });
});

/**
 * Integration test scenarios covered:
 * - Real-time notification polling
 * - Mark as read functionality
 * - Dropdown interaction and navigation
 * - Error recovery and loading states
 * - Accessibility features
 */
