import React, { useState, useEffect } from 'react';

/**
 * NotificationCenter Component - Real-time in-app notification display
 * 
 * TODO: Implement full notification center functionality
 * 
 * Features to implement:
 * - Display notification bell icon with unread count badge
 * - Dropdown panel with recent notifications (last 10)
 * - Mark individual notification as read
 * - Mark all notifications as read
 * - Filter by notification type (security, billing, system, info)
 * - Real-time updates (polling every 30s or WebSocket)
 * - Link to full notification history page
 * - Notification click handling (navigation to relevant page)
 * - Mobile responsive design
 * - Accessibility (ARIA labels, keyboard navigation)
 * 
 * @component
 * @example
 * <NotificationCenter userId="user-uuid" />
 */
const NotificationCenter = ({ userId }) => {
  // TODO: Add state management
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all, security, billing, system

  // TODO: Fetch notifications from API
  useEffect(() => {
    if (userId) {
      // fetchNotifications();
      // startPolling(); // Poll every 30 seconds for real-time updates
    }
    
    return () => {
      // cleanup: stopPolling();
    };
  }, [userId, filter]);

  // TODO: Calculate unread count
  useEffect(() => {
    // const unread = notifications.filter(n => !n.read_at).length;
    // setUnreadCount(unread);
  }, [notifications]);

  // TODO: Implement fetch function
  const fetchNotifications = async () => {
    // setLoading(true);
    // setError(null);
    // try {
    //   const response = await notificationService.getNotifications(userId, {
    //     read: filter === 'unread' ? false : undefined,
    //     type: filter === 'all' ? undefined : filter,
    //     limit: 10
    //   });
    //   setNotifications(response.notifications);
    //   setUnreadCount(response.unreadCount);
    // } catch (error) {
    //   console.error('Failed to fetch notifications:', error);
    //   setError('Failed to load notifications');
    // } finally {
    //   setLoading(false);
    // }
  };

  // TODO: Implement mark as read
  const handleMarkAsRead = async (notificationId) => {
    // try {
    //   await notificationService.markAsRead([notificationId]);
    //   setNotifications(prev =>
    //     prev.map(n => n.id === notificationId ? { ...n, read_at: new Date() } : n)
    //   );
    // } catch (error) {
    //   console.error('Failed to mark notification as read:', error);
    // }
  };

  // TODO: Implement mark all as read
  const handleMarkAllAsRead = async () => {
    // try {
    //   const unreadIds = notifications.filter(n => !n.read_at).map(n => n.id);
    //   if (unreadIds.length > 0) {
    //     await notificationService.markAsRead(unreadIds);
    //     setNotifications(prev =>
    //       prev.map(n => ({ ...n, read_at: new Date() }))
    //     );
    //   }
    // } catch (error) {
    //   console.error('Failed to mark all as read:', error);
    // }
  };

  // TODO: Implement notification click handler
  const handleNotificationClick = (notification) => {
    // handleMarkAsRead(notification.id);
    // Navigate to relevant page based on notification type
    // e.g., if type === 'billing', navigate to /invoices
  };

  // TODO: Implement toggle dropdown
  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  // TODO: Render notification icon with badge
  const renderBellIcon = () => {
    return (
      <div className="relative">
        {/* Bell icon */}
        <button
          onClick={toggleDropdown}
          className="relative p-2 text-gray-600 hover:text-gray-900"
          aria-label={`Notifications (${unreadCount} unread)`}
        >
          {/* TODO: Replace with actual bell icon */}
          <span className="text-2xl">🔔</span>
          
          {/* Unread badge */}
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </div>
    );
  };

  // TODO: Render notification list
  const renderNotificationList = () => {
    // if (loading) {
    //   return <div className="p-4 text-center">Loading...</div>;
    // }

    // if (error) {
    //   return <div className="p-4 text-center text-red-600">{error}</div>;
    // }

    // if (notifications.length === 0) {
    //   return <div className="p-4 text-center text-gray-500">No notifications</div>;
    // }

    return (
      <div className="divide-y divide-gray-200">
        {/* TODO: Map notifications to list items */}
        {/* {notifications.map(notification => (
          <div
            key={notification.id}
            className={`p-4 hover:bg-gray-50 cursor-pointer ${!notification.read_at ? 'bg-blue-50' : ''}`}
            onClick={() => handleNotificationClick(notification)}
          >
            <div className="flex items-start">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                <p className="text-sm text-gray-600">{notification.body}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(notification.created_at).toLocaleString()}
                </p>
              </div>
              {!notification.read_at && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMarkAsRead(notification.id);
                  }}
                  className="ml-2 text-xs text-blue-600 hover:text-blue-800"
                >
                  Mark read
                </button>
              )}
            </div>
          </div>
        ))} */}
        
        {/* Placeholder */}
        <div className="p-4 text-center text-gray-500">
          TODO: Notification list will be displayed here
        </div>
      </div>
    );
  };

  // TODO: Render dropdown panel
  return (
    <div className="relative">
      {renderBellIcon()}

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Filter tabs */}
          <div className="flex border-b border-gray-200">
            {/* TODO: Implement filter tabs */}
            {/* <button className="px-4 py-2 text-sm">All</button>
            <button className="px-4 py-2 text-sm">Security</button>
            <button className="px-4 py-2 text-sm">Billing</button>
            <button className="px-4 py-2 text-sm">System</button> */}
          </div>

          {/* Notification list */}
          <div className="max-h-96 overflow-y-auto">
            {renderNotificationList()}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 text-center">
            <a href="/notifications" className="text-sm text-blue-600 hover:text-blue-800">
              View all notifications
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

// TODO: Add PropTypes validation
NotificationCenter.propTypes = {
  // userId: PropTypes.string.isRequired,
};

export default NotificationCenter;
