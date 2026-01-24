import React, { useState, useEffect } from 'react';
import { Globe, Plus, Trash2, CheckCircle, XCircle, AlertTriangle, Shield } from 'lucide-react';
import api from '../services/api';

/**
 * IP Whitelist Management Component
 * Manage customer IP address whitelisting with 100% enforcement
 */
const IPWhitelistManagement = () => {
  const [whitelists, setWhitelists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    ip_range: '',
    description: '',
    expires_at: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadWhitelists();
  }, []);

  const loadWhitelists = async () => {
    try {
      setLoading(true);
      const data = await api.get('/security/ip-whitelist');
      setWhitelists(data.whitelists || []);
    } catch (err) {
      setError('Failed to load IP whitelists');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validate IP/CIDR format
    if (!isValidCIDR(formData.ip_range)) {
      setError('Invalid IP address or CIDR notation (e.g., 192.168.1.0/24 or 203.0.113.5)');
      return;
    }

    try {
      await api.post('/security/ip-whitelist', formData);
      setSuccess('IP address added to whitelist');
      setShowAddForm(false);
      setFormData({ ip_range: '', description: '', expires_at: '' });
      loadWhitelists();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add IP whitelist');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to remove this IP from the whitelist?')) {
      return;
    }

    try {
      await api.delete(`/security/ip-whitelist/${id}`);
      setSuccess('IP removed from whitelist');
      loadWhitelists();
    } catch (err) {
      setError('Failed to remove IP whitelist');
    }
  };

  const isValidCIDR = (ipRange) => {
    // Simple validation for IP/CIDR
    const cidrPattern = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    if (!cidrPattern.test(ipRange)) return false;

    const parts = ipRange.split('/');
    const ip = parts[0].split('.');
    
    // Validate IP octets
    for (let octet of ip) {
      const num = parseInt(octet, 10);
      if (num < 0 || num > 255) return false;
    }

    // Validate CIDR suffix if present
    if (parts[1]) {
      const suffix = parseInt(parts[1], 10);
      if (suffix < 0 || suffix > 32) return false;
    }

    return true;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const isExpiringSoon = (expiresAt) => {
    if (!expiresAt) return false;
    const daysUntilExpiry = (new Date(expiresAt) - new Date()) / (1000 * 60 * 60 * 24);
    return daysUntilExpiry > 0 && daysUntilExpiry <= 7;
  };

  const isExpired = (expiresAt) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Globe className="w-8 h-8 text-green-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">IP Whitelist Management</h2>
            <p className="text-sm text-gray-600">Control access by IP address with 100% enforcement</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add IP Range</span>
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

      {/* Info Banner */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start space-x-3">
        <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <strong>100% IP Whitelist Enforcement:</strong> Only requests from whitelisted IP addresses will be accepted.
          If no IPs are whitelisted, all IPs are allowed by default. Add at least one IP range to enable enforcement.
        </div>
      </div>

      {/* Add IP Form */}
      {showAddForm && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Add IP Range</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                IP Address or CIDR Range <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., 192.168.1.0/24 or 203.0.113.5"
                value={formData.ip_range}
                onChange={(e) => setFormData({ ...formData, ip_range: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Use CIDR notation for ranges (e.g., 10.0.0.0/8) or single IP (e.g., 203.0.113.42)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <input
                type="text"
                placeholder="e.g., Office network, VPN gateway, Production servers"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Expiration Date (Optional)</label>
              <input
                type="date"
                value={formData.expires_at}
                onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                min={new Date().toISOString().split('T')[0]}
              />
              <p className="text-xs text-gray-500 mt-1">Leave empty for permanent whitelist entry</p>
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
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Add to Whitelist
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Whitelists Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading whitelists...</div>
        ) : whitelists.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Globe className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p>No IP whitelists configured</p>
            <p className="text-sm mt-1">All IP addresses are currently allowed</p>
            <p className="text-sm mt-1 text-yellow-600 font-medium">Add an IP range to enable whitelist enforcement</p>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Range</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usage</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expires</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Added</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {whitelists.map((whitelist) => (
                  <tr 
                    key={whitelist.id} 
                    className={`hover:bg-gray-50 ${isExpired(whitelist.expires_at) ? 'bg-red-50' : ''}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <code className="px-2 py-1 bg-gray-100 rounded text-sm font-mono text-gray-800">
                          {whitelist.ip_range}
                        </code>
                        {isExpired(whitelist.expires_at) && (
                          <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">Expired</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{whitelist.description || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
                        {whitelist.usage_count || 0} requests
                      </div>
                      {whitelist.last_used_at && (
                        <div className="text-xs text-gray-500">
                          Last: {formatDate(whitelist.last_used_at)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm ${isExpiringSoon(whitelist.expires_at) ? 'text-yellow-600 font-medium' : 'text-gray-600'}`}>
                        {formatDate(whitelist.expires_at)}
                      </div>
                      {isExpiringSoon(whitelist.expires_at) && (
                        <div className="flex items-center space-x-1 text-xs text-yellow-600">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Expiring soon</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatDate(whitelist.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleDelete(whitelist.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Remove from whitelist"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Summary Stats */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm">
                <div className="text-gray-600">
                  <strong>{whitelists.length}</strong> IP range{whitelists.length !== 1 ? 's' : ''} whitelisted
                  {whitelists.filter(w => isExpiringSoon(w.expires_at)).length > 0 && (
                    <span className="ml-4 text-yellow-600">
                      <AlertTriangle className="inline-block w-4 h-4 mr-1" />
                      {whitelists.filter(w => isExpiringSoon(w.expires_at)).length} expiring soon
                    </span>
                  )}
                </div>
                <div className="text-gray-500">
                  Total requests: {whitelists.reduce((sum, w) => sum + (w.usage_count || 0), 0)}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Quick Examples */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold mb-3 flex items-center space-x-2">
          <Globe className="w-5 h-5 text-gray-600" />
          <span>Common IP Range Examples</span>
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="font-medium text-gray-700 mb-1">Single IP Address</div>
            <code className="px-2 py-1 bg-gray-100 rounded text-xs">203.0.113.42</code>
            <p className="text-xs text-gray-500 mt-1">Allow only this specific IP</p>
          </div>
          <div>
            <div className="font-medium text-gray-700 mb-1">Private Network (/24)</div>
            <code className="px-2 py-1 bg-gray-100 rounded text-xs">192.168.1.0/24</code>
            <p className="text-xs text-gray-500 mt-1">Allow 192.168.1.0 - 192.168.1.255</p>
          </div>
          <div>
            <div className="font-medium text-gray-700 mb-1">Small Range (/28)</div>
            <code className="px-2 py-1 bg-gray-100 rounded text-xs">10.0.0.0/28</code>
            <p className="text-xs text-gray-500 mt-1">Allow 10.0.0.0 - 10.0.0.15 (16 addresses)</p>
          </div>
          <div>
            <div className="font-medium text-gray-700 mb-1">Large Range (/16)</div>
            <code className="px-2 py-1 bg-gray-100 rounded text-xs">172.16.0.0/16</code>
            <p className="text-xs text-gray-500 mt-1">Allow 172.16.0.0 - 172.16.255.255</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IPWhitelistManagement;
