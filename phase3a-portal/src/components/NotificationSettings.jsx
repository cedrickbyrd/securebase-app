import React, { useState, useEffect } from 'react';

/**
 * NotificationSettings Component - User notification preference management
 * 
 * TODO: Implement full notification settings functionality
 * 
 * Features to implement:
 * - Display event type subscription toggles
 * - Channel preferences (email, SMS, in-app)
 * - Email verification status display
 * - SMS number configuration
 * - Test notification button per channel
 * - Save/Cancel buttons with confirmation
 * - Form validation
 * - Success/error toast messages
 * - Loading states during save
 * - Mobile responsive design
 * - Accessibility
 * 
 * @component
 * @example
 * <NotificationSettings userId="user-uuid" />
 */
const NotificationSettings = ({ userId }) => {
  // TODO: Add state management
  const [subscriptions, setSubscriptions] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [smsNumber, setSmsNumber] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // Event types configuration
  const eventTypes = [
    { id: 'security_alert', name: 'Security Alerts', description: 'Critical security findings and threats' },
    { id: 'billing', name: 'Billing & Payments', description: 'Invoices, payment confirmations, failures' },
    { id: 'compliance', name: 'Compliance & Audit', description: 'Config violations, audit findings' },
    { id: 'system', name: 'System Updates', description: 'Deployments, maintenance windows' },
    { id: 'features', name: 'New Features', description: 'Product updates and new capabilities' },
  ];

  // TODO: Fetch user subscriptions from API
  useEffect(() => {
    if (userId) {
      // fetchSubscriptions();
    }
  }, [userId]);

  // TODO: Implement fetch function
  const fetchSubscriptions = async () => {
    // setLoading(true);
    // setError(null);
    // try {
    //   const response = await notificationService.getSubscriptions(userId);
    //   setSubscriptions(response.subscriptions);
    //   setEmailVerified(response.emailVerified);
    //   setSmsNumber(response.smsNumber || '');
    // } catch (error) {
    //   console.error('Failed to fetch subscriptions:', error);
    //   setError('Failed to load notification settings');
    // } finally {
    //   setLoading(false);
    // }
  };

  // TODO: Implement toggle handler
  const handleToggle = (eventType, channel) => {
    // setHasChanges(true);
    // setSubscriptions(prev => ({
    //   ...prev,
    //   [eventType]: {
    //     ...prev[eventType],
    //     [channel]: !prev[eventType]?.[channel]
    //   }
    // }));
  };

  // TODO: Implement save handler
  const handleSave = async () => {
    // setSaving(true);
    // setError(null);
    // setSuccessMessage(null);
    // try {
    //   await notificationService.updateSubscriptions(userId, subscriptions);
    //   setSuccessMessage('Notification preferences saved successfully!');
    //   setHasChanges(false);
    //   setTimeout(() => setSuccessMessage(null), 3000);
    // } catch (error) {
    //   console.error('Failed to save subscriptions:', error);
    //   setError('Failed to save notification preferences');
    // } finally {
    //   setSaving(false);
    // }
  };

  // TODO: Implement cancel handler
  const handleCancel = () => {
    // fetchSubscriptions(); // Reset to original values
    // setHasChanges(false);
  };

  // TODO: Implement test notification
  const handleTestNotification = async (channel) => {
    // try {
    //   await notificationService.sendTestNotification(userId, channel);
    //   setSuccessMessage(`Test notification sent via ${channel}!`);
    //   setTimeout(() => setSuccessMessage(null), 3000);
    // } catch (error) {
    //   console.error('Failed to send test notification:', error);
    //   setError(`Failed to send test notification via ${channel}`);
    // }
  };

  // TODO: Render email verification section
  const renderEmailSection = () => {
    return (
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Email Notifications</h3>
        <div className="flex items-center">
          <span className="text-sm text-gray-600">
            Status: 
            {emailVerified ? (
              <span className="ml-2 text-green-600 font-medium">✓ Verified</span>
            ) : (
              <span className="ml-2 text-yellow-600 font-medium">⚠ Not verified</span>
            )}
          </span>
          {!emailVerified && (
            <button className="ml-4 text-sm text-blue-600 hover:text-blue-800">
              Verify email
            </button>
          )}
        </div>
      </div>
    );
  };

  // TODO: Render SMS section
  const renderSmsSection = () => {
    return (
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-2">SMS Notifications</h3>
        <div className="flex items-center">
          <input
            type="tel"
            value={smsNumber}
            onChange={(e) => {
              setSmsNumber(e.target.value);
              setHasChanges(true);
            }}
            placeholder="+1 (555) 123-4567"
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => handleTestNotification('sms')}
            className="ml-4 px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            disabled={!smsNumber}
          >
            Test SMS
          </button>
        </div>
      </div>
    );
  };

  // TODO: Render subscription table
  const renderSubscriptionTable = () => {
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Event Type
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                SMS
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                In-App
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {eventTypes.map((eventType) => (
              <tr key={eventType.id}>
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900">{eventType.name}</div>
                  <div className="text-sm text-gray-500">{eventType.description}</div>
                </td>
                <td className="px-6 py-4 text-center">
                  {/* TODO: Replace with actual toggle components */}
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    onChange={() => handleToggle(eventType.id, 'email')}
                    // checked={subscriptions[eventType.id]?.email || false}
                  />
                </td>
                <td className="px-6 py-4 text-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    onChange={() => handleToggle(eventType.id, 'sms')}
                    // checked={subscriptions[eventType.id]?.sms || false}
                    disabled={!smsNumber}
                  />
                </td>
                <td className="px-6 py-4 text-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    onChange={() => handleToggle(eventType.id, 'in_app')}
                    // checked={subscriptions[eventType.id]?.in_app !== false}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Main render
  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Notification Settings</h1>
        <p className="mt-2 text-sm text-gray-600">
          Manage how you receive notifications about important events
        </p>
      </div>

      {/* Success message */}
      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-800">{successMessage}</p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-600">Loading notification settings...</p>
        </div>
      ) : (
        <>
          {/* Email section */}
          {renderEmailSection()}

          {/* SMS section */}
          {renderSmsSection()}

          {/* Subscription table */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Notification Preferences</h3>
            {renderSubscriptionTable()}
          </div>

          {/* Action buttons */}
          <div className="flex justify-end space-x-4">
            <button
              onClick={handleCancel}
              disabled={!hasChanges || saving}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          {/* Test notification buttons */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Test Notifications</h3>
            <div className="flex space-x-4">
              <button
                onClick={() => handleTestNotification('email')}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                disabled={!emailVerified}
              >
                Send Test Email
              </button>
              <button
                onClick={() => handleTestNotification('sms')}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                disabled={!smsNumber}
              >
                Send Test SMS
              </button>
              <button
                onClick={() => handleTestNotification('in_app')}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Send Test In-App
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// TODO: Add PropTypes validation
NotificationSettings.propTypes = {
  // userId: PropTypes.string.isRequired,
};

export default NotificationSettings;
