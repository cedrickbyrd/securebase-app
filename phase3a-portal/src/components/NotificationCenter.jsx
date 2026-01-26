import React, { useState, useEffect, useRef } from 'react';
import { Bell, Shield, DollarSign, CheckCircle, Info, X, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getNotifications, markAsRead } from '../services/notificationService';

/**
 * NotificationCenter Component - Real-time in-app notification display
 * 
 * Features:
 * - Bell icon with unread count badge
 * - Dropdown panel with recent notifications (last 10)
 * - Mark individual notification as read
 * - Mark all notifications as read
 * - Real-time updates (polling every 30s)
 * - Link to full notification history page
 * - Priority color indicators
 * - Type-based icons
 * - Mobile responsive design
 * - Accessibility (ARIA labels, keyboard navigation)
 * 
 * @component
 */
const NotificationCenter = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const dropdownRef = useRef(null);

  // Get user info from localStorage (set during login)
  const getUserInfo = () => {
    // In production, this would come from auth context
    // For now, using mock values or extracted from session
    return {
      userId: localStorage.getItem('userId') || 'test-user-id',
      customerId: localStorage.getItem('customerId') || 'test-customer-id',
    };
  };

  // Icon mapping for notification types
  const iconMap = {
    security_alert: Shield,
    billing: DollarSign,
    compliance: CheckCircle,
    system: Info,
    informational: Info,
  };

  // Priority color mapping
  const priorityColors = {
    critical: 'text-red-600 bg-red-50 border-red-200',
    high: 'text-orange-600 bg-orange-50 border-orange-200',
    medium: 'text-blue-600 bg-blue-50 border-blue-200',
    low: 'text-gray-600 bg-gray-50 border-gray-200',
  };

  // Fetch notifications from API
  const loadNotifications = async () => {
    setLoading(true);
    setError(null);
    const { userId, customerId } = getUserInfo();

    try {
      const response = await getNotifications({
        userId,
        customerId,
        limit: 10,
      });
      
      setNotifications(response.notifications || []);
      setUnreadCount(response.unreadCount || 0);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      setError('Failed to load notifications');
      // Set mock data for development if API fails
      if (process.env.NODE_ENV === 'development') {
        setNotifications([]);
        setUnreadCount(0);
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch notifications on mount and set up polling
  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000); // Poll every 30s
    
    return () => clearInterval(interval);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Mark notification as read
  const handleMarkAsRead = async (notificationId, event) => {
    if (event) {
      event.stopPropagation();
    }

    try {
      await markAsRead([notificationId]);
      
      // Update local state
      setNotifications(prev =>
        prev.map(n => 
          n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  // Mark all notifications as read
  const handleMarkAllAsRead = async () => {
    try {
      const unreadIds = notifications.filter(n => !n.read_at).map(n => n.id);
      
      if (unreadIds.length === 0) return;

      await markAsRead(unreadIds);
      
      // Update local state
      setNotifications(prev =>
        prev.map(n => ({ ...n, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  // Handle notification click
  const handleNotificationClick = (notification) => {
    handleMarkAsRead(notification.id);
    
    // Navigate based on notification type
    // Note: In production, use React Router's useNavigate() hook
    // For now, using window.location for simplicity
    const routes = {
      security_alert: '/compliance',
      billing: '/invoices',
      compliance: '/compliance',
      system: '/dashboard',
    };
    
    const route = routes[notification.type];
    if (route) {
      // TODO: Replace with: const navigate = useNavigate(); navigate(route);
      window.location.href = route;
    }
  };

  // Toggle dropdown
  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  // Get icon component for notification type
  const getIcon = (type) => {
    const IconComponent = iconMap[type] || Info;
    return IconComponent;
  };

  // Render notification item
  const renderNotificationItem = (notification) => {
    const IconComponent = getIcon(notification.type);
    const isUnread = !notification.read_at;
    const priorityColor = priorityColors[notification.priority] || priorityColors.low;

    return (
      <div
        key={notification.id}
        className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
          isUnread ? 'bg-blue-50' : ''
        }`}
        onClick={() => handleNotificationClick(notification)}
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`p-2 rounded-lg border ${priorityColor} flex-shrink-0`}>
            <IconComponent className="w-4 h-4" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className={`text-sm font-medium text-gray-900 ${isUnread ? 'font-semibold' : ''}`}>
                {notification.title}
              </p>
              {isUnread && (
                <button
                  onClick={(e) => handleMarkAsRead(notification.id, e)}
                  className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap"
                  aria-label="Mark as read"
                >
                  Mark read
                </button>
              )}
            </div>
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
              {notification.body || notification.message}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon with Badge */}
      <button
        onClick={toggleDropdown}
        className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg transition-colors"
        aria-label={`Notifications (${unreadCount} unread)`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Bell className="w-6 h-6" />
        
        {/* Unread badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-gray-100 rounded"
                aria-label="Close notifications"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-[500px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                <span className="ml-2 text-gray-600">Loading...</span>
              </div>
            ) : error ? (
              <div className="p-4 text-center text-red-600">
                {error}
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {notifications.map(renderNotificationItem)}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-4 border-t border-gray-200 text-center">
              <a 
                href="/notifications" 
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                onClick={() => setIsOpen(false)}
              >
                View all notifications
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
