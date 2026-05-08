import React, { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import { adminService } from '../../services/adminService';

const statusStyles = {
  healthy: 'bg-green-500',
  degraded: 'bg-yellow-500',
  down: 'bg-red-500',
  unknown: 'bg-gray-400',
};

const cardStyles = {
  healthy: 'border-green-200 bg-green-50',
  degraded: 'border-yellow-200 bg-yellow-50',
  down: 'border-red-200 bg-red-50',
  unknown: 'border-gray-200 bg-gray-50',
};

const SystemHealth = ({ refreshKey = 0 }) => {
  const [health, setHealth] = useState({ services: [], lastUpdated: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const loadHealth = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await adminService.getSystemHealth();
        if (mounted) {
          setHealth({
            services: data.services || [],
            lastUpdated: data.lastUpdated || new Date().toISOString(),
          });
        }
      } catch (err) {
        if (mounted) {
          setError(err);
          setHealth({ services: [], lastUpdated: new Date().toISOString() });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadHealth();

    return () => {
      mounted = false;
    };
  }, [refreshKey]);

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Activity className="w-5 h-5" />
          System Health
        </h2>
        {health.lastUpdated && (
          <span className="text-xs text-gray-500">
            Last updated: {new Date(health.lastUpdated).toLocaleTimeString()}
          </span>
        )}
      </div>
      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          Unable to load system health right now.
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[...Array(8)].map((_, idx) => (
            <div key={idx} className="h-16 rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {health.services.map((service) => {
            const rawStatus = (service.status || 'unknown').toLowerCase();
            const status = statusStyles[rawStatus] ? rawStatus : 'unknown';
            return (
                <div
                  key={service.name}
                  className={`border rounded-lg px-4 py-3 flex items-center justify-between ${cardStyles[status] || cardStyles.unknown}`}
                >
                <span className="text-sm font-medium text-gray-900">{service.name}</span>
                <div className="flex items-center gap-2">
                  <span
                    data-testid={`status-indicator-${service.name}`}
                    className={`inline-flex w-3 h-3 rounded-full ${statusStyles[status] || statusStyles.unknown}`}
                    aria-label={`${service.name} status ${status}`}
                  />
                  <span className="text-xs font-semibold uppercase text-gray-700">{status}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default SystemHealth;
