import React from 'react';
import PropTypes from 'prop-types';

const SystemHealth = ({ metrics, incidents, regionStatus }) => {
const handleRemediate = async (serviceName) => {
  console.log(`Triggering remediation for: ${serviceName}`);
  // In Phase 5, this will call your Netlify function
  // await MockApiService.remediateService(serviceName);
  alert(`Remediation request sent for ${serviceName}. Check Audit Logs for status.`);
};  
  return (
    <div className="sb-SystemHealth">
      <header className="sb-SystemHealth__header">
        <h1>System Health Metrics</h1>
      </header>
      <section className="sb-SystemHealth__metrics">
        {metrics.map((metric, index) => (
          <div key={index} className="sb-HealthMetric">
            <span className={`sb-HealthMetric__name`}>{metric.name}</span>
            <span className={`sb-HealthMetric__value`}>{metric.value}</span>
          </div>
        ))}
      </section>
      <section className="sb-SystemHealth__incidents">
        <h2>Incidents</h2>
        {incidents.length > 0 ? (
          incidents.map((incident, index) => (
            <div key={index} className="sb-Incident">
              <p>{incident.description}</p>
              <span className={`sb-Incident__status ${incident.status}`}>{incident.status}</span>
            </div>
          ))
        ) : (
          <p>No incidents reported</p>
        )}
      </section>
      <section className="sb-SystemHealth__regionStatus">
        <h2>Region Status</h2>
        {regionStatus.map((status, index) => (
          <div key={index} className="sb-RegionStatus">
            <span className={`sb-RegionStatus__region`}>{status.region}</span>
            <span className={`sb-RegionStatus__status ${status.isOperational ? 'operational' : 'down'}`}>{status.isOperational ? 'Operational' : 'Down'}</span>
          </div>
        ))}
      </section>
    </div>
  );
};

SystemHealth.propTypes = {
  metrics: PropTypes.arrayOf(PropTypes.shape({
    name: PropTypes.string.isRequired,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  })).isRequired,
  incidents: PropTypes.arrayOf(PropTypes.shape({
    description: PropTypes.string.isRequired,
    status: PropTypes.string.isRequired,
  })).isRequired,
  regionStatus: PropTypes.arrayOf(PropTypes.shape({
    region: PropTypes.string.isRequired,
    isOperational: PropTypes.bool.isRequired,
  })).isRequired,
};

export default SystemHealth;
