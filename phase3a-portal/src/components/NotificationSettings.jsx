import React, { useState, useEffect } from 'react';
import { Settings, Save, RotateCcw, TestTube2, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { getSubscriptions, updateSubscriptions, sendTestNotification } from '../services/notificationService';

/**
 * NotificationSettings Component - User notification preference management
 * 
 * Features:
 * - Display event type subscription toggles
 * - Channel preferences (email, SMS, webhook, in-app)
 * - Email verification status display
 * - SMS number configuration
 * - Test notification buttons per channel
 * - Save/Cancel/Reset buttons
 * - Success/error toast messages
 * - Loading states during save
 * - Mobile responsive design
 * - Accessibility
 * 
 * @component
 */
const NotificationSettings = () => {
  const [preferences, setPreferences] = useState({});
  const [originalPreferences, setOriginalPreferences] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingChannel, setTestingChannel] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [emailVerified, setEmailVerified] = useState(false);
  const [smsNumber, setSmsNumber] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // Validation helpers
  const isValidPhoneNumber = (phone) => {
    // Basic validation: must contain at least 10 digits
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 15;
  };

  const isValidUrl = (url) => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  // Get user info from localStorage
  const getUserInfo = () => {
    return {
      userId: localStorage.getItem('userId') || 'test-user-id',
      customerId: localStorage.getItem('customerId') || 'test-customer-id',
    };
  };

  // Event types configuration
  const eventTypes = [
    { id: 'security_alert', name: 'Security Alerts', description: 'Critical security findings and threats' },
    { id: 'billing', name: 'Billing & Payments', description: 'Invoices, payment confirmations, failures' },
    { id: 'compliance', name: 'Compliance & Audit', description: 'Config violations, audit findings' },
    { id: 'system', name: 'System Updates', description: 'Deployments, maintenance windows' },
    { id: 'informational', name: 'Informational', description: 'Product updates and new capabilities' },
  ];

  // Channels configuration
  const channels = [
    { id: 'email', name: 'Email', enabled: true },
    { id: 'sms', name: 'SMS', enabled: true },
    { id: 'webhook', name: 'Webhook', enabled: true },
    { id: 'in_app', name: 'In-App', enabled: true },
  ];

  // Default preferences
  const getDefaultPreferences = () => {
    const defaults = {};
    eventTypes.forEach(event => {
      defaults[event.id] = {
        email: event.id === 'security_alert' || event.id === 'billing',
        sms: event.id === 'security_alert',
        webhook: false,
        in_app: true,
      };
    });
    return defaults;
  };

  // Load preferences on mount
  useEffect(() => {
    loadPreferences();
  }, []);

  // Check if there are unsaved changes
  useEffect(() => {
    const changed = JSON.stringify(preferences) !== JSON.stringify(originalPreferences);
    setHasChanges(changed);
  }, [preferences, originalPreferences]);

  // Load preferences from API
  const loadPreferences = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });
    const { userId, customerId } = getUserInfo();

    try {
      const response = await getSubscriptions(userId, customerId);
      
      const prefs = response.subscriptions || getDefaultPreferences();
      setPreferences(prefs);
      setOriginalPreferences(JSON.parse(JSON.stringify(prefs)));
      setEmailVerified(response.emailVerified || false);
      setSmsNumber(response.smsNumber || '');
      setWebhookUrl(response.webhookUrl || '');
    } catch (err) {
      console.error('Failed to fetch subscriptions:', err);
      setMessage({ type: 'error', text: 'Failed to load notification settings. Using defaults.' });
      
      // Set defaults on error
      const defaults = getDefaultPreferences();
      setPreferences(defaults);
      setOriginalPreferences(defaults);
    } finally {
      setLoading(false);
    }
  };

  // Toggle preference for event type + channel
  const handleToggle = (eventType, channel) => {
    setPreferences(prev => ({
      ...prev,
      [eventType]: {
        ...(prev[eventType] || {}),
        [channel]: !prev[eventType]?.[channel],
      },
    }));
  };

  // Save preferences
  const handleSave = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });
    const { userId, customerId } = getUserInfo();

    try {
      await updateSubscriptions(preferences, userId, customerId);
      setOriginalPreferences(JSON.parse(JSON.stringify(preferences)));
      setMessage({ type: 'success', text: 'Notification preferences saved successfully!' });
      
      setTimeout(() => {
        setMessage({ type: '', text: '' });
      }, 5000);
    } catch (err) {
      console.error('Failed to save subscriptions:', err);
      setMessage({ type: 'error', text: 'Failed to save notification preferences. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  // Cancel changes
  const handleCancel = () => {
    setPreferences(JSON.parse(JSON.stringify(originalPreferences)));
    setMessage({ type: '', text: '' });
  };

  // Reset to defaults
  const handleReset = () => {
    const defaults = getDefaultPreferences();
    setPreferences(defaults);
    setMessage({ type: 'info', text: 'Preferences reset to defaults. Click Save to apply.' });
  };

  // Send test notification
  const handleTest = async (channel) => {
    setTestingChannel(channel);
    setMessage({ type: '', text: '' });
    const { userId, customerId } = getUserInfo();

    try {
      const response = await sendTestNotification(channel, userId, customerId);
      setMessage({ 
        type: 'success', 
        text: `Test notification sent via ${channel}! ${response.note || ''}` 
      });
      
      setTimeout(() => {
        setMessage({ type: '', text: '' });
      }, 5000);
    } catch (err) {
      console.error('Failed to send test notification:', err);
      setMessage({ 
        type: 'error', 
        text: `Failed to send test notification via ${channel}. ${err.message || ''}` 
      });
    } finally {
      setTestingChannel(null);
    }
  };

  // Render toggle switch
  const renderToggle = (eventType, channel, disabled = false) => {
    const isChecked = preferences[eventType]?.[channel] || false;
    
    return (
      <button
        type="button"
        onClick={() => !disabled && handleToggle(eventType, channel)}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        } ${isChecked ? 'bg-blue-600' : 'bg-gray-200'}`}
        role="switch"
        aria-checked={isChecked}
        aria-label={`Toggle ${channel} for ${eventType}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            isChecked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    );
  };

  // Render message banner
  const renderMessage = () => {
    if (!message.text) return null;

    const styles = {
      success: 'bg-green-50 border-green-200 text-green-800',
      error: 'bg-red-50 border-red-200 text-red-800',
      info: 'bg-blue-50 border-blue-200 text-blue-800',
    };

    const icons = {
      success: <CheckCircle className="w-5 h-5 text-green-600" />,
      error: <AlertCircle className="w-5 h-5 text-red-600" />,
      info: <AlertCircle className="w-5 h-5 text-blue-600" />,
    };

    return (
      <div className={`mb-6 p-4 border rounded-lg flex items-start gap-3 ${styles[message.type]}`}>
        {icons[message.type]}
        <p className="text-sm flex-1">{message.text}</p>
      </div>
    );
  };

  // Main render
  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Settings className="w-8 h-8 text-gray-700" />
          <h1 className="text-3xl font-bold text-gray-900">Notification Settings</h1>
        </div>
        <p className="text-gray-600">
          Manage how you receive notifications about important events and updates
        </p>
      </div>

      {renderMessage()}

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <span className="ml-3 text-gray-600">Loading notification settings...</span>
        </div>
      ) : (
        <>
          {/* Channel Configuration */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Delivery Channels</h2>
            
            <div className="space-y-4">
              {/* Email */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-900">Email Notifications</label>
                  <p className="text-sm text-gray-500">
                    Status: {emailVerified ? (
                      <span className="text-green-600 font-medium">✓ Verified</span>
                    ) : (
                      <span className="text-yellow-600 font-medium">⚠ Not verified</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => handleTest('email')}
                  disabled={!emailVerified || testingChannel === 'email'}
                  className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {testingChannel === 'email' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <TestTube2 className="w-4 h-4" />
                  )}
                  Test Email
                </button>
              </div>

              {/* SMS */}
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-900">SMS Notifications</label>
                  <input
                    type="tel"
                    value={smsNumber}
                    onChange={(e) => setSmsNumber(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    className={`mt-1 block w-64 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      smsNumber && !isValidPhoneNumber(smsNumber) 
                        ? 'border-red-300 bg-red-50' 
                        : 'border-gray-300'
                    }`}
                  />
                  {smsNumber && !isValidPhoneNumber(smsNumber) && (
                    <p className="mt-1 text-xs text-red-600">Please enter a valid phone number</p>
                  )}
                </div>
                <button
                  onClick={() => handleTest('sms')}
                  disabled={!smsNumber || !isValidPhoneNumber(smsNumber) || testingChannel === 'sms'}
                  className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {testingChannel === 'sms' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <TestTube2 className="w-4 h-4" />
                  )}
                  Test SMS
                </button>
              </div>

              {/* Webhook */}
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-900">Webhook Notifications</label>
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://your-domain.com/webhook"
                    className={`mt-1 block w-64 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      webhookUrl && !isValidUrl(webhookUrl) 
                        ? 'border-red-300 bg-red-50' 
                        : 'border-gray-300'
                    }`}
                  />
                  {webhookUrl && !isValidUrl(webhookUrl) && (
                    <p className="mt-1 text-xs text-red-600">Please enter a valid HTTPS URL</p>
                  )}
                </div>
                <button
                  onClick={() => handleTest('webhook')}
                  disabled={!webhookUrl || !isValidUrl(webhookUrl) || testingChannel === 'webhook'}
                  className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {testingChannel === 'webhook' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <TestTube2 className="w-4 h-4" />
                  )}
                  Test Webhook
                </button>
              </div>

              {/* In-App */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-900">In-App Notifications</label>
                  <p className="text-sm text-gray-500">Real-time notifications in the portal</p>
                </div>
                <button
                  onClick={() => handleTest('in_app')}
                  disabled={testingChannel === 'in_app'}
                  className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {testingChannel === 'in_app' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <TestTube2 className="w-4 h-4" />
                  )}
                  Test In-App
                </button>
              </div>
            </div>
          </div>

          {/* Preferences Table */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Notification Preferences</h2>
              <p className="text-sm text-gray-600 mb-6">
                Choose which notifications you want to receive for each event type
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Event Type
                    </th>
                    {channels.map(channel => (
                      <th key={channel.id} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {channel.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {eventTypes.map((eventType) => (
                    <tr key={eventType.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{eventType.name}</div>
                        <div className="text-sm text-gray-500">{eventType.description}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {renderToggle(eventType.id, 'email', !emailVerified)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {renderToggle(eventType.id, 'sms', !smsNumber)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {renderToggle(eventType.id, 'webhook', !webhookUrl)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {renderToggle(eventType.id, 'in_app')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleReset}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Reset to Defaults
            </button>
            
            <div className="flex gap-4">
              <button
                onClick={handleCancel}
                disabled={!hasChanges || saving}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationSettings;
