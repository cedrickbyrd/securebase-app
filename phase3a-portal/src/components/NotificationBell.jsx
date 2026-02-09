import React, { useState, useEffect, useRef } from 'react';
import { Bell, Shield, DollarSign, Server, CheckCircle, Eye, X } from 'lucide-react';
import { mockApiService } from '../services/mockApiService';
import styles from './NotificationBell.module.css';

const NotificationBell = ({ onCriticalAlert }) => {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const dropdownRef = useRef(null);

  useEffect(() => {
    loadNotifications();
  }, []);

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

  // Check for critical alerts and show toast on mount
  useEffect(() => {
    const criticalNotifications = notifications.filter(
      n => !n.read && n.severity === 'error'
    );
    
    if (criticalNotifications.length > 0 && onCriticalAlert) {
      criticalNotifications.forEach(notification => {
        onCriticalAlert(notification);
      });
    }
  }, [notifications, onCriticalAlert]);

  const loadNotifications = async () => {
    try {
      const data = await mockApiService.getNotifications();
      setNotifications(data);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  };

  const getUnreadCount = () => {
    return notifications.filter(n => !n.read).length;
  };

  const getFilteredNotifications = () => {
    if (filter === 'all') {
      return notifications;
    }
    return notifications.filter(n => n.type === filter);
  };

  const handleMarkAsRead = async (id, event) => {
    if (event) {
      event.stopPropagation();
    }
    
    try {
      await mockApiService.markNotificationAsRead(id);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await mockApiService.markAllNotificationsAsRead();
      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true }))
      );
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const handleNotificationClick = (notification) => {
    handleMarkAsRead(notification.id);
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }
  };

  const getIcon = (type) => {
    const icons = {
      security: Shield,
      billing: DollarSign,
      system: Server,
      compliance: CheckCircle
    };
    const IconComponent = icons[type] || Bell;
    return <IconComponent className={styles.notificationIcon} />;
  };

  const getSeverityClass = (severity) => {
    return styles[`severity${severity.charAt(0).toUpperCase() + severity.slice(1)}`];
  };

  const getTypeClass = (type) => {
    return styles[`type${type.charAt(0).toUpperCase() + type.slice(1)}`];
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  const unreadCount = getUnreadCount();
  const filteredNotifications = getFilteredNotifications();

  return (
    <div className={styles.notificationBell} ref={dropdownRef}>
      <button
        className={styles.bellButton}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Notifications (${unreadCount} unread)`}
      >
        <Bell className={styles.bellIcon} />
        {unreadCount > 0 && (
          <span className={styles.badge}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHeader}>
            <h3>Notifications</h3>
            <div className={styles.headerActions}>
              {unreadCount > 0 && (
                <button
                  className={styles.markAllButton}
                  onClick={handleMarkAllAsRead}
                >
                  Mark all as read
                </button>
              )}
              <button
                className={styles.closeButton}
                onClick={() => setIsOpen(false)}
                aria-label="Close notifications"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className={styles.filterTabs}>
            <button
              className={`${styles.filterTab} ${filter === 'all' ? styles.active : ''}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              className={`${styles.filterTab} ${filter === 'security' ? styles.active : ''}`}
              onClick={() => setFilter('security')}
            >
              Security
            </button>
            <button
              className={`${styles.filterTab} ${filter === 'billing' ? styles.active : ''}`}
              onClick={() => setFilter('billing')}
            >
              Billing
            </button>
            <button
              className={`${styles.filterTab} ${filter === 'system' ? styles.active : ''}`}
              onClick={() => setFilter('system')}
            >
              System
            </button>
            <button
              className={`${styles.filterTab} ${filter === 'compliance' ? styles.active : ''}`}
              onClick={() => setFilter('compliance')}
            >
              Compliance
            </button>
          </div>

          <div className={styles.notificationList}>
            {filteredNotifications.length === 0 ? (
              <div className={styles.emptyState}>
                <Bell className={styles.emptyIcon} />
                <p>No notifications</p>
              </div>
            ) : (
              filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`${styles.notificationItem} ${!notification.read ? styles.unread : ''} ${getSeverityClass(notification.severity)}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className={`${styles.iconContainer} ${getTypeClass(notification.type)}`}>
                    {getIcon(notification.type)}
                  </div>
                  <div className={styles.notificationContent}>
                    <div className={styles.notificationHeader}>
                      <h4 className={styles.notificationTitle}>{notification.title}</h4>
                      {!notification.read && (
                        <button
                          className={styles.markReadButton}
                          onClick={(e) => handleMarkAsRead(notification.id, e)}
                          aria-label="Mark as read"
                        >
                          <Eye size={16} />
                        </button>
                      )}
                    </div>
                    <p className={styles.notificationMessage}>{notification.message}</p>
                    <div className={styles.notificationFooter}>
                      <span className={styles.timestamp}>
                        {formatTimestamp(notification.timestamp)}
                      </span>
                      {notification.actionUrl && (
                        <span className={styles.actionLink}>
                          {notification.actionText}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
