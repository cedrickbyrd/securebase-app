import React, { useState, useEffect } from 'react';
import { Shield, Server, Lock, AlertTriangle, Plus, Trash2, Edit, CheckCircle, XCircle } from 'lucide-react';
import api from '../services/api';

/**
 * SSO Configuration Panel
 * Manage SSO providers (OIDC, SAML 2.0) for enterprise authentication
 */
const SSOConfiguration = () => {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    provider_type: 'oidc',
    provider_name: '',
    status: 'testing',
    oidc_issuer_url: '',
    oidc_client_id: '',
    oidc_client_secret: '',
    oidc_scopes: 'openid email profile',
    saml_entity_id: '',
    saml_sso_url: '',
    saml_x509_cert: '',
    auto_provision_users: true,
    default_role: 'viewer'
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      setLoading(true);
      const data = await api.get('/auth/sso/providers');
      setProviders(data.providers || []);
    } catch (err) {
      setError('Failed to load SSO providers');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const payload = { ...formData };
      
      // Parse scopes array
      if (formData.provider_type === 'oidc') {
        payload.oidc_scopes = formData.oidc_scopes.split(' ').filter(s => s);
      }

      await api.post('/auth/sso/providers', payload);
      setSuccess('SSO provider configured successfully');
      setShowAddForm(false);
      setFormData({
        provider_type: 'oidc',
        provider_name: '',
        status: 'testing',
        oidc_issuer_url: '',
        oidc_client_id: '',
        oidc_client_secret: '',
        oidc_scopes: 'openid email profile',
        saml_entity_id: '',
        saml_sso_url: '',
        saml_x509_cert: '',
        auto_provision_users: true,
        default_role: 'viewer'
      });
      loadProviders();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to configure SSO provider');
    }
  };

  const handleDelete = async (providerId) => {
    if (!window.confirm('Are you sure you want to disable this SSO provider?')) {
      return;
    }

    try {
      await api.delete(`/auth/sso/providers/${providerId}`);
      setSuccess('SSO provider disabled');
      loadProviders();
    } catch (_err) {
      setError('Failed to disable SSO provider');
    }
  };

  const getProviderIcon = (type) => {
    switch (type) {
      case 'oidc':
        return <Lock className="w-5 h-5 text-blue-500" />;
      case 'saml2':
        return <Shield className="w-5 h-5 text-purple-500" />;
      default:
        return <Server className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      active: <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Active</span>,
      testing: <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">Testing</span>,
      disabled: <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">Disabled</span>
    };
    return badges[status] || badges.disabled;
  };

  const formatLoginTime = (ms) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Shield className="w-8 h-8 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">SSO Configuration</h2>
            <p className="text-sm text-gray-600">Manage OIDC and SAML 2.0 providers for enterprise authentication</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Provider</span>
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-3">
          <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span className="text-sm text-red-800">{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <span className="text-sm text-green-800">{success}</span>
        </div>
      )}

      {/* Add Provider Form */}
      {showAddForm && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Add SSO Provider</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Provider Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Provider Type</label>
                <select
                  value={formData.provider_type}
                  onChange={(e) => setFormData({ ...formData, provider_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="oidc">OIDC (OpenID Connect)</option>
                  <option value="saml2">SAML 2.0</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Provider Name</label>
                <input
                  type="text"
                  placeholder="e.g., Google Workspace, Okta, Azure AD"
                  value={formData.provider_name}
                  onChange={(e) => setFormData({ ...formData, provider_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            {/* OIDC Configuration */}
            {formData.provider_type === 'oidc' && (
              <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900">OIDC Configuration</h4>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Issuer URL</label>
                  <input
                    type="url"
                    placeholder="https://accounts.google.com"
                    value={formData.oidc_issuer_url}
                    onChange={(e) => setFormData({ ...formData, oidc_issuer_url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Client ID</label>
                    <input
                      type="text"
                      value={formData.oidc_client_id}
                      onChange={(e) => setFormData({ ...formData, oidc_client_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Client Secret</label>
                    <input
                      type="password"
                      value={formData.oidc_client_secret}
                      onChange={(e) => setFormData({ ...formData, oidc_client_secret: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Scopes (space-separated)</label>
                  <input
                    type="text"
                    value={formData.oidc_scopes}
                    onChange={(e) => setFormData({ ...formData, oidc_scopes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="openid email profile"
                  />
                </div>
              </div>
            )}

            {/* SAML Configuration */}
            {formData.provider_type === 'saml2' && (
              <div className="space-y-4 p-4 bg-purple-50 rounded-lg">
                <h4 className="font-medium text-purple-900">SAML 2.0 Configuration</h4>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Entity ID</label>
                  <input
                    type="text"
                    value={formData.saml_entity_id}
                    onChange={(e) => setFormData({ ...formData, saml_entity_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">SSO URL</label>
                  <input
                    type="url"
                    value={formData.saml_sso_url}
                    onChange={(e) => setFormData({ ...formData, saml_sso_url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">X.509 Certificate (PEM format)</label>
                  <textarea
                    value={formData.saml_x509_cert}
                    onChange={(e) => setFormData({ ...formData, saml_x509_cert: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-xs"
                    rows="6"
                    placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                    required
                  />
                </div>
              </div>
            )}

            {/* Common Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Default Role</label>
                <select
                  value={formData.default_role}
                  onChange={(e) => setFormData({ ...formData, default_role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="viewer">Viewer</option>
                  <option value="analyst">Analyst</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="testing">Testing</option>
                  <option value="active">Active</option>
                </select>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="auto_provision"
                checked={formData.auto_provision_users}
                onChange={(e) => setFormData({ ...formData, auto_provision_users: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="auto_provision" className="text-sm text-gray-700">
                Auto-provision new users from SSO
              </label>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save Provider
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Providers List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading providers...</div>
        ) : providers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Shield className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p>No SSO providers configured</p>
            <p className="text-sm mt-1">Add your first provider to enable enterprise authentication</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stats</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Performance</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {providers.map((provider) => (
                <tr key={provider.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-3">
                      {getProviderIcon(provider.provider_type)}
                      <div>
                        <div className="font-medium text-gray-900">{provider.provider_name}</div>
                        <div className="text-sm text-gray-500">{provider.oidc_issuer_url || provider.saml_entity_id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-600 uppercase">{provider.provider_type}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(provider.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    <div>{provider.total_logins || 0} logins</div>
                    <div className="text-xs text-red-600">{provider.failed_logins || 0} failed</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">
                      Avg: {formatLoginTime(provider.avg_login_time_ms)}
                      {provider.avg_login_time_ms > 2000 && (
                        <AlertTriangle className="inline-block w-4 h-4 ml-1 text-yellow-500" />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleDelete(provider.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Performance Warning */}
      {providers.some(p => p.avg_login_time_ms > 2000) && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-800">
            <strong>Performance Warning:</strong> Some SSO providers have average login times exceeding the 2-second target.
            Consider optimizing provider configuration or network connectivity.
          </div>
        </div>
      )}
    </div>
  );
};

export default SSOConfiguration;
