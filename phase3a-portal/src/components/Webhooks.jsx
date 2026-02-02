/**
 * Webhook Management Component
 * Create, view, test, and delete webhooks
 */

import React, { useState, useEffect } from 'react';
import {
  Webhook,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Copy,
  Eye,
  EyeOff,
  Send,
  AlertCircle,
  Clock,
  ExternalLink
} from 'lucide-react';
import { getWebhooks, createWebhook, deleteWebhook, testWebhook, getWebhookDeliveries } from '../services/api';

const Webhooks = () => {
  const [webhooks, setWebhooks] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeliveriesModal, setShowDeliveriesModal] = useState(false);
  const [newWebhook, setNewWebhook] = useState({
    url: '',
    description: '',
    events: []
  });
  const [testingWebhook, setTestingWebhook] = useState(null);
  const [showSecret, setShowSecret] = useState(false);
  const [createdSecret, setCreatedSecret] = useState(null);

  const eventTypes = [
    { value: 'invoice.created', label: 'Invoice Created', description: 'When a new invoice is generated' },
    { value: 'invoice.paid', label: 'Invoice Paid', description: 'When an invoice is marked as paid' },
    { value: 'invoice.overdue', label: 'Invoice Overdue', description: 'When an invoice becomes overdue' },
    { value: 'ticket.created', label: 'Ticket Created', description: 'When a support ticket is created' },
    { value: 'ticket.updated', label: 'Ticket Updated', description: 'When a ticket status changes' },
    { value: 'ticket.resolved', label: 'Ticket Resolved', description: 'When a ticket is resolved' },
    { value: 'compliance.scan_completed', label: 'Compliance Scan Completed', description: 'When a compliance scan finishes' },
    { value: 'compliance.finding_critical', label: 'Critical Finding', description: 'When a critical compliance finding is detected' },
    { value: 'usage.threshold_exceeded', label: 'Usage Threshold Exceeded', description: 'When usage exceeds configured threshold' },
    { value: 'api_key.created', label: 'API Key Created', description: 'When a new API key is created' },
    { value: 'api_key.revoked', label: 'API Key Revoked', description: 'When an API key is revoked' }
  ];

  useEffect(() => {
    loadWebhooks();
  }, []);

  const loadWebhooks = async () => {
    try {
      setLoading(true);
      const data = await getWebhooks();
      setWebhooks(data.webhooks || []);
    } catch (error) {
      console.error('Failed to load webhooks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWebhook = async () => {
    if (!newWebhook.url || !newWebhook.url.startsWith('https://')) {
      alert('Please enter a valid HTTPS URL');
      return;
    }

    if (newWebhook.events.length === 0) {
      alert('Please select at least one event type');
      return;
    }

    try {
      const response = await createWebhook(newWebhook);
      setCreatedSecret(response.webhook.secret);
      setShowCreateModal(false);
      setNewWebhook({ url: '', description: '', events: [] });
      loadWebhooks();
    } catch (error) {
      alert('Failed to create webhook: ' + error.message);
    }
  };

  const handleDeleteWebhook = async (webhookId) => {
    if (!confirm('Are you sure you want to delete this webhook?')) {
      return;
    }

    try {
      await deleteWebhook(webhookId);
      loadWebhooks();
    } catch (error) {
      alert('Failed to delete webhook: ' + error.message);
    }
  };

  const handleTestWebhook = async (webhookId) => {
    try {
      setTestingWebhook(webhookId);
      const result = await testWebhook(webhookId);
      
      if (result.success) {
        alert(`Webhook test successful! Status code: ${result.status_code}`);
      } else {
        alert(`Webhook test failed. Status code: ${result.status_code}\n${result.response}`);
      }
    } catch (error) {
      alert('Failed to test webhook: ' + error.message);
    } finally {
      setTestingWebhook(null);
    }
  };

  const handleViewDeliveries = async (webhook) => {
    try {
      setSelectedWebhook(webhook);
      const data = await getWebhookDeliveries(webhook.id);
      setDeliveries(data.deliveries || []);
      setShowDeliveriesModal(true);
    } catch (error) {
      alert('Failed to load deliveries: ' + error.message);
    }
  };

  const toggleEvent = (eventValue) => {
    setNewWebhook(prev => ({
      ...prev,
      events: prev.events.includes(eventValue)
        ? prev.events.filter(e => e !== eventValue)
        : [...prev.events, eventValue]
    }));
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Webhook className="w-8 h-8 text-primary-600" />
              Webhooks
            </h1>
            <p className="text-gray-600 mt-2">
              Subscribe to events and receive real-time notifications via HTTP POST
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 transition flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Create Webhook
          </button>
        </div>
      </div>

      {/* Secret Display Modal */}
      {createdSecret && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
              <h3 className="text-xl font-bold">Webhook Created!</h3>
            </div>
            
            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 mb-4">
              <p className="text-sm font-semibold text-yellow-900 mb-2">
                ⚠️ Save your webhook secret
              </p>
              <p className="text-sm text-yellow-800">
                This secret will only be shown once. Use it to verify webhook signatures.
              </p>
            </div>

            <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">Secret:</span>
                <button
                  onClick={() => setShowSecret(!showSecret)}
                  className="text-primary-600 hover:text-primary-700"
                >
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <code className="text-sm font-mono break-all">
                {showSecret ? createdSecret : '•'.repeat(50)}
              </code>
              <button
                onClick={() => copyToClipboard(createdSecret)}
                className="mt-2 text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                <Copy className="w-4 h-4" />
                Copy to clipboard
              </button>
            </div>

            <button
              onClick={() => setCreatedSecret(null)}
              className="w-full bg-primary-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-primary-700"
            >
              I've saved the secret
            </button>
          </div>
        </div>
      )}

      {/* Create Webhook Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 my-8">
            <h3 className="text-2xl font-bold mb-4">Create New Webhook</h3>

            <div className="space-y-4">
              {/* URL Input */}
              <div>
                <label className="block text-sm font-semibold mb-2">Webhook URL *</label>
                <input
                  type="url"
                  value={newWebhook.url}
                  onChange={(e) => setNewWebhook({ ...newWebhook, url: e.target.value })}
                  placeholder="https://yourdomain.com/webhook"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent"
                />
                <p className="text-xs text-gray-600 mt-1">Must be a valid HTTPS URL</p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold mb-2">Description (optional)</label>
                <input
                  type="text"
                  value={newWebhook.description}
                  onChange={(e) => setNewWebhook({ ...newWebhook, description: e.target.value })}
                  placeholder="Production webhook for invoice events"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent"
                />
              </div>

              {/* Event Selection */}
              <div>
                <label className="block text-sm font-semibold mb-2">Subscribe to Events *</label>
                <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-lg p-4 space-y-2">
                  {eventTypes.map(event => (
                    <label key={event.value} className="flex items-start gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded">
                      <input
                        type="checkbox"
                        checked={newWebhook.events.includes(event.value)}
                        onChange={() => toggleEvent(event.value)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-sm">{event.label}</div>
                        <div className="text-xs text-gray-600">{event.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Selected: {newWebhook.events.length} event{newWebhook.events.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCreateWebhook}
                className="flex-1 bg-primary-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-primary-700"
              >
                Create Webhook
              </button>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewWebhook({ url: '', description: '', events: [] });
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deliveries Modal */}
      {showDeliveriesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold">Delivery History</h3>
              <button
                onClick={() => setShowDeliveriesModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              {deliveries.length === 0 ? (
                <p className="text-gray-600 text-center py-8">No deliveries yet</p>
              ) : (
                deliveries.map(delivery => (
                  <div key={delivery.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {delivery.success ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-600" />
                          )}
                          <span className="font-semibold">{delivery.event_type}</span>
                          <span className="text-sm text-gray-600">
                            HTTP {delivery.status_code}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          {new Date(delivery.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Webhooks List */}
      {webhooks.length === 0 ? (
        <div className="text-center py-12">
          <Webhook className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No webhooks yet</h3>
          <p className="text-gray-600 mb-6">
            Create a webhook to receive real-time event notifications
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 inline-flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Create Your First Webhook
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {webhooks.map(webhook => (
            <div key={webhook.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{webhook.url}</h3>
                    {webhook.active ? (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">Active</span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-semibold rounded">Inactive</span>
                    )}
                  </div>
                  
                  {webhook.description && (
                    <p className="text-gray-600 mb-3">{webhook.description}</p>
                  )}

                  <div className="flex flex-wrap gap-2 mb-3">
                    {webhook.events.map(event => (
                      <span key={event} className="px-2 py-1 bg-primary-50 text-primary-700 text-xs font-medium rounded">
                        {event}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-6 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      {webhook.delivery_success_count || 0} successful
                    </div>
                    <div className="flex items-center gap-1">
                      <XCircle className="w-4 h-4 text-red-600" />
                      {webhook.delivery_failure_count || 0} failed
                    </div>
                    {webhook.last_triggered_at && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        Last: {new Date(webhook.last_triggered_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleTestWebhook(webhook.id)}
                    disabled={testingWebhook === webhook.id}
                    className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition"
                    title="Test webhook"
                  >
                    {testingWebhook === webhook.id ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    onClick={() => handleViewDeliveries(webhook)}
                    className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition"
                    title="View delivery history"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDeleteWebhook(webhook.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Delete webhook"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Documentation */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-blue-600" />
          Webhook Documentation
        </h3>
        <div className="space-y-2 text-sm text-gray-700">
          <p>
            <strong>Signature Verification:</strong> All webhook requests include an{' '}
            <code className="bg-white px-1 py-0.5 rounded">X-SecureBase-Signature</code> header.
            Verify using HMAC-SHA256 with your webhook secret.
          </p>
          <p>
            <strong>Retry Policy:</strong> Failed deliveries (5xx errors) are retried up to 5 times
            with exponential backoff (1m, 5m, 15m, 1h, 2h).
          </p>
          <p>
            <strong>Timeout:</strong> Webhook endpoints must respond within 10 seconds.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Webhooks;
