/**
 * API Keys Component
 * Manage API keys: create, view, revoke, regenerate
 */

import React, { useState, useEffect } from 'react';
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import { apiService } from '../services/apiService';
import { formatDate } from '../utils/formatters';

export const ApiKeys = () => {
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showKeyValue, setShowKeyValue] = useState({});
  const [copiedKeyId, setCopiedKeyId] = useState(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState(['read', 'write']);
  const [createdKey, setCreatedKey] = useState(null);
  const [deletingKeyId, setDeletingKeyId] = useState(null);

  useEffect(() => {
    loadApiKeys();
  }, []);

  const loadApiKeys = async () => {
    try {
      setLoading(true);
      const response = await apiService.getApiKeys();
      setApiKeys(response.data);
      setError(null);
    } catch (err) {
      console.error('Failed to load API keys:', err);
      setError(err.message || 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async (e) => {
    e.preventDefault();
    try {
      const response = await apiService.createApiKey({
        name: newKeyName,
        scopes: newKeyScopes,
      });
      setCreatedKey(response.data);
      setNewKeyName('');
      setNewKeyScopes(['read', 'write']);
      setSuccess('API key created successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to create API key:', err);
      setError(err.message || 'Failed to create API key');
    }
  };

  const handleRevokeKey = async (keyId) => {
    try {
      setDeletingKeyId(keyId);
      await apiService.revokeApiKey(keyId);
      setApiKeys(apiKeys.filter((key) => key.id !== keyId));
      setSuccess('API key revoked successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to revoke API key:', err);
      setError(err.message || 'Failed to revoke API key');
    } finally {
      setDeletingKeyId(null);
    }
  };

  const handleCopyKey = (keyValue) => {
    navigator.clipboard.writeText(keyValue);
    setCopiedKeyId(keyValue);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const toggleShowKey = (keyId) => {
    setShowKeyValue((prev) => ({
      ...prev,
      [keyId]: !prev[keyId],
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">API Keys</h1>
              <p className="text-gray-600 mt-1">Manage authentication credentials for your applications</p>
            </div>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              <Plus className="w-5 h-5 mr-2" />
              New API Key
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-red-900">Error</h3>
              <p className="text-sm text-red-800 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Success Alert */}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start">
            <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-green-900">Success</h3>
              <p className="text-sm text-green-800 mt-1">{success}</p>
            </div>
          </div>
        )}

        {/* Create Form */}
        {showCreateForm && (
          <div className="mb-8 bg-white rounded-lg shadow p-6 border-l-4 border-blue-600">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New API Key</h2>
            <form onSubmit={handleCreateKey}>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Key Name
                  </label>
                  <input
                    type="text"
                    placeholder="Production Key"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Descriptive name to identify this key
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Scopes
                  </label>
                  <div className="space-y-2">
                    {['read', 'write', 'admin'].map((scope) => (
                      <label key={scope} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={newKeyScopes.includes(scope)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewKeyScopes([...newKeyScopes, scope]);
                            } else {
                              setNewKeyScopes(
                                newKeyScopes.filter((s) => s !== scope)
                              );
                            }
                          }}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="ml-3 text-sm text-gray-700 capitalize">
                          {scope}
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    Select permissions for this key
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
                  >
                    Create Key
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="flex-1 bg-gray-100 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-200 font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Created Key Display */}
        {createdKey && (
          <div className="mb-8 bg-green-50 border-2 border-green-200 rounded-lg p-6">
            <div className="flex items-start">
              <CheckCircle2 className="w-6 h-6 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-green-900 mb-2">
                  API Key Created
                </h3>
                <p className="text-sm text-green-800 mb-4">
                  Copy your new API key now. You won't be able to see it again.
                </p>

                <div className="bg-white rounded-lg p-4 mb-4 border border-green-300 font-mono text-sm break-all">
                  {createdKey.key}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleCopyKey(createdKey.key)}
                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    {copiedKeyId === createdKey.key ? 'Copied!' : 'Copy Key'}
                  </button>
                  <button
                    onClick={() => setCreatedKey(null)}
                    className="flex items-center px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 font-medium text-sm"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* API Keys List */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Active API Keys ({apiKeys.length})
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading API keys...</p>
              </div>
            </div>
          ) : apiKeys.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {apiKeys.map((apiKey) => (
                <div
                  key={apiKey.id}
                  className="px-6 py-4 hover:bg-gray-50 transition"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start flex-1">
                      <Key className="w-6 h-6 text-purple-600 mr-3 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">
                          {apiKey.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-2">
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-700 font-mono">
                            {apiKey.key_prefix}...
                          </code>
                          <button
                            onClick={() =>
                              handleCopyKey(`${apiKey.key_prefix}...`)
                            }
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium mb-3">
                        Active
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-4 bg-gray-50 rounded-lg p-4">
                    <div>
                      <p className="text-xs text-gray-600 uppercase">Scopes</p>
                      <div className="flex gap-1 mt-1">
                        {apiKey.scopes.map((scope) => (
                          <span
                            key={scope}
                            className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded"
                          >
                            {scope}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 uppercase">Created</p>
                      <p className="text-sm text-gray-900 mt-1">
                        {formatDate(apiKey.created_at)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 uppercase">Last Used</p>
                      <p className="text-sm text-gray-900 mt-1">
                        {apiKey.last_used_at
                          ? formatDate(apiKey.last_used_at)
                          : 'Never'}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => toggleShowKey(apiKey.id)}
                      className="text-blue-600 hover:text-blue-700 font-medium text-sm inline-flex items-center"
                    >
                      {showKeyValue[apiKey.id] ? (
                        <>
                          <EyeOff className="w-4 h-4 mr-1" />
                          Hide
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4 mr-1" />
                          Show
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleRevokeKey(apiKey.id)}
                      disabled={deletingKeyId === apiKey.id}
                      className="text-red-600 hover:text-red-700 font-medium text-sm inline-flex items-center disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      {deletingKeyId === apiKey.id ? 'Revoking...' : 'Revoke'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Key className="w-12 h-12 text-gray-400 mx-auto mb-4 opacity-20" />
                <p className="text-gray-600 font-medium">No API keys yet</p>
                <p className="text-gray-500 text-sm mt-1">
                  Create your first API key to get started
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Documentation */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-3">API Key Usage</h3>
          <div className="text-sm text-blue-800 space-y-2">
            <p>
              Include your API key in the Authorization header of all requests:
            </p>
            <code className="block bg-blue-100 px-3 py-2 rounded font-mono text-xs mt-2">
              Authorization: Bearer sb_YOUR_API_KEY_HERE
            </code>
            <p className="mt-3">
              For more details, see our{' '}
              <a href="/docs/api" className="underline font-medium">
                API documentation
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiKeys;
