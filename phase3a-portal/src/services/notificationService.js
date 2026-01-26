/**
 * Notification Service - API client for notification operations
 * 
 * This service handles:
 * - Fetching user notifications (paginated, filtered)
 * - Marking notifications as read
 * - Managing notification subscriptions/preferences
 * - Sending test notifications
 * - Real-time notification polling
 * 
 * Author: SecureBase Team
 * Created: 2026-01-26
 * Status: Implementation Complete
 */

// API configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Get authorization headers with JWT token
 */
const getAuthHeaders = () => {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
  };
};

/**
 * Fetch notifications for a user
 * 
 * @param {object} options - Filter options
 * @param {string} options.userId - User ID
 * @param {string} options.customerId - Customer ID
 * @param {string} options.type - Notification type (security, billing, system, etc.)
 * @param {boolean} options.read - Filter by read status (true/false/undefined for all)
 * @param {number} options.limit - Number of notifications to fetch (default: 10)
 * @param {string} options.cursor - Pagination cursor
 * @returns {Promise<object>} - { notifications: [], unreadCount: 0, hasMore: false, cursor: '' }
 */
export const getNotifications = async (options = {}) => {
  const {
    userId,
    customerId,
    type,
    read,
    limit = 10,
    cursor,
  } = options;

  const params = new URLSearchParams();
  if (userId) params.append('user_id', userId);
  if (customerId) params.append('customer_id', customerId);
  if (type) params.append('type', type);
  if (read !== undefined) params.append('read', read.toString());
  if (limit) params.append('limit', limit.toString());
  if (cursor) params.append('cursor', cursor);
  
  try {
    const response = await fetch(
      `${API_BASE_URL}/notifications?${params.toString()}`,
      {
        method: 'GET',
        headers: getAuthHeaders(),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      notifications: data.notifications || [],
      unreadCount: data.unreadCount || 0,
      hasMore: data.hasMore || false,
      cursor: data.cursor || null,
    };
  } catch (error) {
    console.error('Error fetching notifications:', error);
    throw error;
  }
};

/**
 * Mark notifications as read
 * 
 * @param {string[]} notificationIds - Array of notification IDs to mark as read
 * @returns {Promise<object>} - { success: true, markedCount: 0 }
 */
export const markAsRead = async (notificationIds) => {
  if (!notificationIds || notificationIds.length === 0) {
    throw new Error('No notification IDs provided');
  }
  
  try {
    const response = await fetch(
      `${API_BASE_URL}/notifications/mark-read`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ notification_ids: notificationIds }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: data.success || false,
      markedCount: data.markedCount || 0,
    };
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    throw error;
  }
};

/**
 * Get user notification subscriptions/preferences
 * 
 * @param {string} userId - User ID
 * @param {string} customerId - Customer ID
 * @returns {Promise<object>} - { subscriptions: {}, emailVerified: false, smsNumber: '', webhookUrl: '' }
 */
export const getSubscriptions = async (userId, customerId) => {
  const params = new URLSearchParams();
  if (userId) params.append('user_id', userId);
  if (customerId) params.append('customer_id', customerId);
  
  try {
    const response = await fetch(
      `${API_BASE_URL}/subscriptions?${params.toString()}`,
      {
        method: 'GET',
        headers: getAuthHeaders(),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      subscriptions: data.subscriptions || {},
      emailVerified: data.emailVerified || false,
      smsNumber: data.smsNumber || '',
      webhookUrl: data.webhookUrl || '',
    };
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    throw error;
  }
};

/**
 * Update user notification subscriptions/preferences
 * 
 * @param {object} subscriptions - Subscription preferences
 * @param {string} userId - User ID (optional, extracted from token)
 * @param {string} customerId - Customer ID (optional, extracted from token)
 * @returns {Promise<object>} - { success: true }
 */
export const updateSubscriptions = async (subscriptions, userId = null, customerId = null) => {
  const params = new URLSearchParams();
  if (userId) params.append('user_id', userId);
  if (customerId) params.append('customer_id', customerId);
  
  try {
    const response = await fetch(
      `${API_BASE_URL}/subscriptions?${params.toString()}`,
      {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ subscriptions }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: data.success || false,
    };
  } catch (error) {
    console.error('Error updating subscriptions:', error);
    throw error;
  }
};

/**
 * Send a test notification to verify delivery
 * 
 * @param {string} channel - Delivery channel (email, sms, in_app, webhook)
 * @param {string} userId - User ID (optional)
 * @param {string} customerId - Customer ID (optional)
 * @returns {Promise<object>} - { success: true, deliveryId: '', messageId: '' }
 */
export const sendTestNotification = async (channel, userId = null, customerId = null) => {
  if (!['email', 'sms', 'in_app', 'webhook'].includes(channel)) {
    throw new Error(`Invalid channel: ${channel}`);
  }
  
  const params = new URLSearchParams();
  if (userId) params.append('user_id', userId);
  if (customerId) params.append('customer_id', customerId);
  
  try {
    const response = await fetch(
      `${API_BASE_URL}/notifications/test?${params.toString()}`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ channel }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: data.success || false,
      deliveryId: data.deliveryId || '',
      messageId: data.messageId || '',
      note: data.note || '',
    };
  } catch (error) {
    console.error('Error sending test notification:', error);
    throw error;
  }
};

// Export all functions as default
export default {
  getNotifications,
  markAsRead,
  getSubscriptions,
  updateSubscriptions,
  sendTestNotification,
};
