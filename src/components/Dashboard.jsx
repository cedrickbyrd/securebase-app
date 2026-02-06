import React from 'react';
import apiService from '../../services/apiService';

const Dashboard = () => {
    const [metrics, setMetrics] = React.useState({});
    const [invoices, setInvoices] = React.useState([]);
    const [apiKeys, setApiKeys] = React.useState([]);
    const [complianceStatus, setComplianceStatus] = React.useState('');
    const [supportTickets, setSupportTickets] = React.useState([]);

    React.useEffect(() => {
        // fetch metrics, invoices, api keys, compliance status, and support tickets
        apiService.fetchMetrics().then(setMetrics);
        apiService.fetchInvoices().then(setInvoices);
        apiService.fetchApiKeys().then(setApiKeys);
        apiService.fetchComplianceStatus().then(setComplianceStatus);
        apiService.fetchSupportTickets().then(setSupportTickets);
    }, []);

    return (
        <div className="sb-Dashboard">
            <header className="sb-Dashboard__header">
                <h1>Dashboard</h1>
            </header>
            <section className="sb-Dashboard__metrics">
                <h2>Metrics</h2>
                {/* Display metrics here */}
            </section>
            <section className="sb-Dashboard__invoices">
                <h2>Invoices</h2>
                {/* Display invoices here */}
            </section>
            <section className="sb-Dashboard__api-keys">
                <h2>API Keys</h2>
                {/* Display API keys here */}
            </section>
            <section className="sb-Dashboard__compliance-status">
                <h2>Compliance Status</h2>
                {/* Display compliance status here */}
            </section>
            <section className="sb-Dashboard__support-tickets">
                <h2>Support Tickets</h2>
                {/* Display support tickets here */}
            </section>
        </div>
    );
};

export default Dashboard;