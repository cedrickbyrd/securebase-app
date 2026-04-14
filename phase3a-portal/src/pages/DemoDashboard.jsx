import React, { useState, useEffect } from 'react';
import { fetchData } from '../utils/fetchData';

export default function DemoDashboard() {
  const [downloading, setDownloading] = useState(false);
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    document.title = 'Demo-Dashboard';
    fetchData('/metrics').then(setMetrics);
  }, []);

  const handleDownloadReport = () => {
    setDownloading(true);
    
    setTimeout(() => {
      // Create HTML report
      const htmlContent = generateReportHTML();
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `SecureBase-SOC2-Report-${new Date().toISOString().split('T')[0]}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setDownloading(false);
    }, 2000);
  };

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Demo Banner */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">🎯 Demo Environment</span>
            <div className="flex gap-3">
              <a
                href="https://securebase.tximhotep.com/signup"
                className="bg-white text-purple-600 px-4 py-2 rounded-md text-sm font-medium"
              >
                Start Free Trial
              </a>
              <button
                onClick={handleLogout}
                className="bg-purple-800 text-white px-4 py-2 rounded-md text-sm"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Demo-Dashboard</h1>
        <p className="text-gray-600 mb-8">Acme Corporation • FinTech Tier</p>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
            <div className="text-4xl mb-2">🏗️</div>
            <div className="text-3xl font-bold mb-1">3</div>
            <div className="text-sm font-semibold">Environments</div>
          </div>
          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6">
            <div className="text-4xl mb-2">✅</div>
            <div className="text-3xl font-bold mb-1">{metrics?.soc2Score ?? 94}%</div>
            <div className="text-sm font-semibold">SOC 2 Compliance</div>
          </div>
          <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-6">
            <div className="text-4xl mb-2">💰</div>
            <div className="text-3xl font-bold mb-1">$8,247</div>
            <div className="text-sm font-semibold">Monthly Cost</div>
          </div>
          <div className="bg-indigo-50 border-2 border-indigo-200 rounded-lg p-6">
            <div className="text-4xl mb-2">🛡️</div>
            <div className="text-3xl font-bold mb-1">A+</div>
            <div className="text-sm font-semibold">Security Score</div>
          </div>
        </div>

        {/* Main Report Card */}
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl shadow-xl p-8 mb-8 border-2 border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-4">📊 SOC 2 Compliance Report</h2>
              <ul className="space-y-2 mb-4">
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  197 of 209 controls implemented
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  All critical findings resolved
                </li>
                <li className="flex items-center">
                  <span className="text-yellow-500 mr-2">⚠</span>
                  12 minor recommendations
                </li>
              </ul>
            </div>
            <button
              onClick={handleDownloadReport}
              disabled={downloading}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50"
            >
              {downloading ? 'Generating...' : 'Download Report'}
            </button>
          </div>
        </div>

        {/* Environments */}
        <div className="grid grid-cols-3 gap-6">
          {['Production', 'Staging', 'Development'].map((env, i) => (
            <div key={env} className="bg-white border-2 rounded-lg p-6">
              <h3 className="text-lg font-bold mb-4">{env}</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Region:</span>
                  <span className="font-medium">us-east-1</span>
                </div>
                <div className="flex justify-between">
                  <span>Resources:</span>
                  <span className="font-medium">{47 - i * 5}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function generateReportHTML() {
  const date = new Date().toISOString().split('T')[0];
  return `<!DOCTYPE html>
<html>
<head>
  <title>SOC 2 Compliance Report</title>
  <style>
    body { font-family: Arial; max-width: 800px; margin: 40px auto; padding: 20px; }
    .header { text-align: center; border-bottom: 3px solid #4F46E5; padding-bottom: 20px; }
    h1 { color: #1F2937; }
    .metric { background: #F3F4F6; padding: 15px; margin: 10px 0; border-left: 4px solid #10B981; }
  </style>
</head>
<body>
  <div class="header">
    <h1>SOC 2 Type II Compliance Report</h1>
    <h2>Acme Corporation</h2>
    <p>Generated: ${date}</p>
  </div>
  <div class="metric">
    <h3>Overall Compliance: 94%</h3>
    <p>197 of 209 controls passed</p>
  </div>
  <h3>Infrastructure Coverage</h3>
  <ul>
    <li>3 AWS Environments</li>
    <li>127 Total Resources</li>
    <li>CloudTrail: Enabled</li>
    <li>GuardDuty: Active</li>
  </ul>
</body>
</html>`;
}
