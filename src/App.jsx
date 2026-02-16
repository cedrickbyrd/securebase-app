import React, { useState } from 'react';
import { Shield, CheckCircle, FileCode, Download, Play, Settings, Lock, Eye, AlertTriangle, Zap, GitBranch, Database, Users, Cloud, Terminal, Rocket, DollarSign, Clock, Code, ShoppingCart, UserPlus } from 'lucide-react';
import ComplianceScreen from './components/compliance/ComplianceScreen';

export default function SecureBaseLandingZone() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedModule, setSelectedModule] = useState(null);
  const [deploymentLog, setDeploymentLog] = useState([]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [devEnvStep, setDevEnvStep] = useState('config');
  const [devConfig, setDevConfig] = useState({
    environment: 'development',
    region: 'us-east-1',
    orgName: '',
    email: '',
    enabledModules: {
      core: true,
      identity: true,
      security: true,
      logging: true,
      networking: false,
      monitoring: false,
      sales: false
    }
  });

  const modules = [
    { 
      id: 'core', 
      name: 'Access Controls & Segregation of Duties', 
      icon: Cloud, 
      description: 'SOX2-compliant role separation with account factory and SCP guardrails for access control', 
      resources: ['Organizations', 'OUs', 'Accounts', 'SCPs'], 
      status: 'essential', 
      devCost: '$0/month', 
      compliance: ['SOX2', 'SOC2', 'CIS'] 
    },
    { 
      id: 'identity', 
      name: 'Multi-Factor Authentication & SSO', 
      icon: Users, 
      description: 'Zero long-lived credentials with SSO, MFA enforcement for SOX2 user access controls', 
      resources: ['Identity Center', 'Permission Sets', 'Break-Glass Role', 'Password Policy'], 
      status: 'essential', 
      devCost: '$0/month', 
      compliance: ['SOX2', 'SOC2', 'NIST AC/IA'] 
    },
    { 
      id: 'security', 
      name: 'SOX2 Change Management & Monitoring', 
      icon: Shield, 
      description: 'Automated change detection, security monitoring, and SOX2-compliant audit controls', 
      resources: ['GuardDuty', 'Security Hub', 'Config', 'CloudTrail', 'KMS'], 
      status: 'essential', 
      devCost: '$10-15/month', 
      compliance: ['SOX2', 'SOC2', 'PCI-DSS'] 
    },
    { 
      id: 'logging', 
      name: 'Audit Trail & Evidence Collection (1-year retention)', 
      icon: Database, 
      description: 'Immutable audit logs for SOX2 compliance with 1-year retention and centralized aggregation', 
      resources: ['CloudTrail', 'CloudWatch', 'S3 Log Buckets', 'VPC Flow Logs'], 
      status: 'essential', 
      devCost: '$5-10/month', 
      compliance: ['SOX2', 'SOC2', 'NIST AU'] 
    },
    { 
      id: 'networking', 
      name: 'Data Integrity & Encryption', 
      icon: GitBranch, 
      description: 'Network segmentation and encryption-in-transit for SOX2 data integrity controls', 
      resources: ['Transit Gateway', 'VPCs', 'Subnets', 'Route Tables', 'NACLs'], 
      status: 'recommended', 
      devCost: '$30-40/month', 
      compliance: ['SOX2', 'SOC2', 'Zero Trust'] 
    },
    { 
      id: 'monitoring', 
      name: 'Real-Time Financial Controls', 
      icon: Eye, 
      description: 'Continuous monitoring and alerting for SOX2 control effectiveness and SOC2 availability', 
      resources: ['CloudWatch Dashboards', 'SNS Topics', 'EventBridge Rules'], 
      status: 'recommended', 
      devCost: '$5-8/month', 
      compliance: ['SOX2', 'SOC2', 'NIST SI'] 
    },
    { 
      id: 'sales', 
      name: 'Sales Enablement', 
      icon: DollarSign, 
      description: 'Lead tracking, pipeline analytics, and revenue forecasting for fintech platforms', 
      resources: ['Lead Management', 'Pipeline Analytics', 'Revenue Forecasting', 'CRM Integration'], 
      status: 'coming-soon', 
      devCost: 'Coming Q1 2026', 
      compliance: ['SOX2', 'SOC2'] 
    }
  ];

  const features = [
    { Icon: Shield, title: 'Audit-Ready', description: 'CIS, SOC2, NIST 800-53, RMF compliant from day one' },
    { Icon: Zap, title: 'Deploy in Hours', description: 'Production Terraform with no Control Tower dependency' },
    { Icon: Lock, title: 'Zero Trust', description: 'No long-lived credentials, MFA enforced, SCPs enabled' },
    { Icon: CheckCircle, title: 'Fintech Grade', description: 'Built for fintech audits and government requirements' },
    { Icon: GitBranch, title: 'Multi-Account', description: 'Opinionated OU structure with blast-radius control' },
    { Icon: Eye, title: 'Break-Glass Ready', description: 'Auditor-approved emergency access with CloudTrail logging' }
  ];

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setDeploymentLog(prev => [...prev, { timestamp, message, type }]);
  };

  const simulateDeployment = async () => {
    if (!devConfig.orgName || !devConfig.email) {
      alert('Please provide organization name and email');
      return;
    }

    setIsDeploying(true);
    setDeploymentLog([]);
    setDevEnvStep('deploying');
    
    const steps = [
      { msg: 'Initializing Terraform backend...', delay: 1000 },
      { msg: 'Validating AWS credentials...', delay: 800 },
      { msg: `Creating organization: ${devConfig.orgName}`, delay: 600 },
      { msg: 'Running terraform init...', delay: 1200 },
      { msg: '✓ Terraform initialized successfully', delay: 500, type: 'success' },
      { msg: 'Generating deployment plan...', delay: 1500 },
      { msg: 'Planning to create 23 resources...', delay: 800 },
    ];

    if (devConfig.enabledModules.core) {
      steps.push(
        { msg: '[Core] Creating AWS Organization...', delay: 1000 },
        { msg: '[Core] Configuring organizational units...', delay: 800 },
        { msg: '[Core] ✓ Core infrastructure ready', delay: 600, type: 'success' }
      );
    }

    if (devConfig.enabledModules.identity) {
      steps.push(
        { msg: '[Identity] Setting up IAM Identity Center...', delay: 1000 },
        { msg: '[Identity] Creating permission sets...', delay: 900 },
        { msg: '[Identity] ✓ Identity Center configured', delay: 600, type: 'success' }
      );
    }

    if (devConfig.enabledModules.security) {
      steps.push(
        { msg: '[Security] Enabling GuardDuty...', delay: 1200 },
        { msg: '[Security] Configuring Security Hub...', delay: 900 },
        { msg: '[Security] Setting up Config rules...', delay: 800 },
        { msg: '[Security] ✓ Security services active', delay: 600, type: 'success' }
      );
    }

    if (devConfig.enabledModules.logging) {
      steps.push(
        { msg: '[Logging] Creating S3 buckets for logs...', delay: 1000 },
        { msg: '[Logging] Enabling CloudTrail...', delay: 900 },
        { msg: '[Logging] ✓ Logging infrastructure deployed', delay: 600, type: 'success' }
      );
    }

    if (devConfig.enabledModules.networking) {
      steps.push(
        { msg: '[Networking] Creating Transit Gateway...', delay: 1200 },
        { msg: '[Networking] Configuring VPCs...', delay: 1000 },
        { msg: '[Networking] ✓ Network foundation ready', delay: 600, type: 'success' }
      );
    }

    if (devConfig.enabledModules.monitoring) {
      steps.push(
        { msg: '[Monitoring] Creating CloudWatch dashboards...', delay: 1000 },
        { msg: '[Monitoring] Setting up alarms...', delay: 800 },
        { msg: '[Monitoring] ✓ Monitoring configured', delay: 600, type: 'success' }
      );
    }

    steps.push(
      { msg: '', delay: 500 },
      { msg: '🎉 Deployment complete!', delay: 1000, type: 'success' },
      { msg: `Environment: ${devConfig.environment}`, delay: 300, type: 'info' },
      { msg: `Region: ${devConfig.region}`, delay: 300, type: 'info' },
      { msg: 'Next: Review resources in AWS Console', delay: 500, type: 'info' }
    );

    for (const step of steps) {
      await new Promise(resolve => setTimeout(resolve, step.delay));
      addLog(step.msg, step.type || 'info');
    }

    setIsDeploying(false);
    setDevEnvStep('complete');
  };

  const calculateCost = () => {
    let total = 0;
    return total;
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Shield className="text-blue-600 w-8 h-8" />
            <div>
              <div className="text-2xl font-bold tracking-tight text-gray-900">SecureBase</div>
              <div className="text-xs text-gray-600">AWS Landing Zone Terraform</div>
            </div>
          </div>
          <nav className="flex gap-6 items-center">
            <button onClick={() => setActiveTab('overview')} className={`text-sm font-medium ${activeTab === 'overview' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-blue-600'} transition pb-1`}>Overview</button>
            <button onClick={() => setActiveTab('modules')} className={`text-sm font-medium ${activeTab === 'modules' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-blue-600'} transition pb-1`}>Fintech Compliance Controls</button>
            <button onClick={() => setActiveTab('compliance')} className={`text-sm font-medium ${activeTab === 'compliance' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-blue-600'} transition pb-1`}>Compliance</button>
            <button onClick={() => window.location.href='https://cedrickbyrd.github.io/securebase-app/'} className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2 rounded-lg text-sm font-medium hover:from-blue-700 hover:to-blue-800 transition flex items-center gap-2 text-white shadow-md">
              <ShoppingCart className="w-4 h-4" />
              Purchase Now
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Demo banner / CTA (add near the top of main layout) */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-6 text-center">
          <p className="text-sm text-yellow-800">
            🚀 Try the interactive demo — <a
              href="https://demo.securebase.tximhotep.com"
              className="underline font-medium"
              target="_blank"
              rel="noopener noreferrer"
            >Open Demo</a>
            <span className="mx-2">·</span>
            Demo mode: sample data only
          </p>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-16">
            <section className="text-center space-y-6">
              <div className="inline-block px-4 py-2 bg-purple-100 border border-purple-300 rounded-full text-purple-700 text-sm mb-4 font-medium">
                SOX2 + SOC2 Ready • Fintech Compliance • Deploy in Hours
              </div>
              <h1 className="text-6xl font-extrabold bg-gradient-to-r from-blue-600 to-purple-700 bg-clip-text text-transparent leading-tight">
                SOX2-Ready Infrastructure<br />for Fintech Platforms
              </h1>
              <p className="text-gray-600 text-xl max-w-3xl mx-auto leading-relaxed">
                Don't spend $300K+ on DIY SOX2 compliance. Deploy production-grade SOX2 + SOC2 controls in hours, not months. Built for neobanks, lending platforms, and payment processors.
              </p>
              
              {/* Stats */}
              <div className="grid grid-cols-3 gap-6 max-w-4xl mx-auto mt-12">
                <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-md hover:shadow-lg transition">
                  <div className="text-3xl font-bold text-purple-600">SOX2 + SOC2</div>
                  <div className="text-sm text-gray-600">Controls</div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-md hover:shadow-lg transition">
                  <div className="text-3xl font-bold text-green-600">$204K+</div>
                  <div className="text-sm text-gray-600">Saved vs. DIY</div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-md hover:shadow-lg transition">
                  <div className="text-3xl font-bold text-blue-600">100%</div>
                  <div className="text-sm text-gray-600">Audit Pass Rate</div>
                </div>
              </div>
            </section>
            
            {/* Who This Is For */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-8 border border-blue-200">
              <h2 className="text-3xl font-bold mb-6 text-gray-900 text-center">Who This Is For</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white rounded-xl p-6 shadow-md">
                  <div className="text-2xl mb-2">🏦</div>
                  <h3 className="font-bold text-gray-900 mb-2">Neobanks</h3>
                  <p className="text-gray-600 text-sm">Digital-first banks (e.g., Chime, Current)</p>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-md">
                  <div className="text-2xl mb-2">💳</div>
                  <h3 className="font-bold text-gray-900 mb-2">Lending Platforms</h3>
                  <p className="text-gray-600 text-sm">Consumer/SMB lenders (e.g., Affirm, Kabbage)</p>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-md">
                  <div className="text-2xl mb-2">💰</div>
                  <h3 className="font-bold text-gray-900 mb-2">Payment Processors</h3>
                  <p className="text-gray-600 text-sm">B2B payment rails (e.g., Stripe, Plaid)</p>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-md">
                  <div className="text-2xl mb-2">🛍️</div>
                  <h3 className="font-bold text-gray-900 mb-2">Embedded Finance</h3>
                  <p className="text-gray-600 text-sm">SaaS + payments (e.g., Shopify Capital)</p>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-md">
                  <div className="text-2xl mb-2">₿</div>
                  <h3 className="font-bold text-gray-900 mb-2">Crypto/Web3</h3>
                  <p className="text-gray-600 text-sm">Digital asset platforms (compliance-ready)</p>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-md">
                  <div className="text-2xl mb-2">📊</div>
                  <h3 className="font-bold text-gray-900 mb-2">Investment Platforms</h3>
                  <p className="text-gray-600 text-sm">Robo-advisors and trading platforms</p>
                </div>
              </div>
            </div>
            
            {/* Features */}
            <div className="grid md:grid-cols-3 gap-8">
              {features.map((f, i) => (
                <div key={i} className="p-6 bg-white rounded-2xl border border-gray-200 shadow-md hover:shadow-lg hover:border-blue-300 transition">
                  <f.Icon className="text-blue-600 mb-4 w-10 h-10" />
                  <h3 className="text-lg font-bold mb-2 text-gray-900">{f.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{f.description}</p>
                </div>
              ))}
            </div>

            {/* Architecture Overview */}
            <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-md">
              <h2 className="text-2xl font-bold mb-6 text-gray-900">Account Architecture</h2>
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-lg font-semibold text-blue-600 mb-4">Organizational Units</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-gray-900">Management Account</div>
                        <div className="text-gray-600">Organization root, billing consolidation</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-gray-900">Security OU</div>
                        <div className="text-gray-600">GuardDuty, Security Hub, Log Archive</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-gray-900">Shared Services OU</div>
                        <div className="text-gray-600">Networking, CI/CD, shared resources</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-gray-900">Workloads OU</div>
                        <div className="text-gray-600">Production, Staging, Development</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-blue-600 mb-4">Security Controls</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-3">
                      <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">Multi-region CloudTrail with log validation</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">GuardDuty threat detection across all accounts</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">AWS Config with auto-remediation</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">SCPs enforcing security baselines</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ROI Comparison */}
            <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-md">
              <h2 className="text-3xl font-bold mb-8 text-gray-900 text-center">ROI: SecureBase vs. DIY SOX2 Compliance</h2>
              <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-red-50 rounded-xl p-6 border border-red-200">
                  <h3 className="text-xl font-bold text-red-700 mb-4">❌ DIY Approach</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Compliance consultant:</span>
                      <span className="font-bold text-gray-900">$50K-$150K</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Implementation time:</span>
                      <span className="font-bold text-gray-900">6-12 months</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Ongoing audit prep:</span>
                      <span className="font-bold text-gray-900">200+ hours/year</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Staff time cost:</span>
                      <span className="font-bold text-gray-900">$100K+/year</span>
                    </div>
                    <div className="pt-3 mt-3 border-t border-red-300 flex justify-between">
                      <span className="text-red-700 font-bold text-lg">Total Year 1 Cost:</span>
                      <span className="text-red-700 font-bold text-lg">$300K+</span>
                    </div>
                  </div>
                </div>
                <div className="bg-green-50 rounded-xl p-6 border border-green-200">
                  <h3 className="text-xl font-bold text-green-700 mb-4">✅ SecureBase Fintech Tier</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Deploy SOX2 controls:</span>
                      <span className="font-bold text-gray-900">&lt;10 minutes</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Automated evidence:</span>
                      <span className="font-bold text-gray-900">24/7</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Quarterly reports:</span>
                      <span className="font-bold text-gray-900">Included</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Monthly subscription:</span>
                      <span className="font-bold text-gray-900">$8K/month</span>
                    </div>
                    <div className="pt-3 mt-3 border-t border-green-300 flex justify-between">
                      <span className="text-green-700 font-bold text-lg">Total Year 1 Cost:</span>
                      <span className="text-green-700 font-bold text-lg">$96K</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-6 text-center bg-gradient-to-r from-green-100 to-blue-100 rounded-xl p-6 border border-green-300">
                <p className="text-2xl font-bold text-gray-900">
                  💰 Save <span className="text-green-600">$204K+</span> in Year 1
                </p>
                <p className="text-gray-600 mt-2">Plus faster time-to-audit and reduced operational overhead</p>
              </div>
            </div>
          </div>
        )}

        {/* Pilot Benefits Tab */}
        {activeTab === 'pilot-benefits' && (
          <div>
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4 text-gray-900">Fintech Compliance Controls</h2>
              <p className="text-gray-600 text-lg">SOX2 + SOC2 infrastructure controls for financial services platforms</p>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {modules.map((m) => (
                <div 
                  key={m.id} 
                  className={`p-6 bg-white rounded-xl border cursor-pointer transition shadow-md ${
                    selectedModule === m.id ? 'border-blue-600 ring-2 ring-blue-200 shadow-lg' : 'border-gray-200 hover:border-blue-400 hover:shadow-lg'
                  }`}
                  onClick={() => setSelectedModule(selectedModule === m.id ? null : m.id)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <m.icon className="text-blue-600" size={32} />
                    <div className="flex gap-2">
                      <span className={`text-xs font-mono px-2 py-1 rounded ${
                        m.status === 'essential' ? 'bg-orange-100 text-orange-700 border border-orange-300' : 
                        m.status === 'coming-soon' ? 'bg-yellow-100 text-yellow-700 border border-yellow-300' :
                        'bg-blue-100 text-blue-700 border border-blue-300'
                      }`}>
                        {m.status}
                      </span>
                      <span className="text-xs font-mono text-green-700 bg-green-100 px-2 py-1 rounded border border-green-300">
                        {m.devCost}
                      </span>
                    </div>
                  </div>

                  {/* Day 1 */}
                  <div className="flex gap-6">
                    <div className="flex-shrink-0">
                      <div className="w-16 h-16 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-bold">
                        Day 1
                      </div>
                    </div>
                    <div className="flex-1 bg-white rounded-lg p-6 shadow-md">
                      <h3 className="text-xl font-bold mb-3 text-gray-900">Infrastructure Deployment</h3>
                      <ul className="space-y-2 text-gray-700">
                        <li className="flex items-start gap-2">
                          <Zap className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                          <span>AWS Organizations, security services, and logging deployed</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Zap className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                          <span>GuardDuty, Security Hub, Config rules activated</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Zap className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                          <span>Your team gets read-only access to monitor progress</span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* Day 2 */}
                  <div className="flex gap-6">
                    <div className="flex-shrink-0">
                      <div className="w-16 h-16 rounded-full bg-green-600 text-white flex items-center justify-center text-xl font-bold">
                        Day 2
                      </div>
                    </div>
                    <div className="flex-1 bg-white rounded-lg p-6 shadow-md">
                      <h3 className="text-xl font-bold mb-3 text-gray-900">Handoff & Documentation</h3>
                      <ul className="space-y-2 text-gray-700">
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                          <span>Custom operations runbook delivered (incident response, access management)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                          <span>Security controls evidence package for auditors</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                          <span>Knowledge transfer session with your team</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
           #   </div>
              <div className="text-center mt-12">
                <p className="text-2xl font-bold text-blue-600">
                  🚀 Production-Ready Infrastructure in 48 Hours — Guaranteed
                </p>
                <p className="text-gray-600 mt-2">
                  If we miss the deadline, your first month is free
                </p>
              </div>
            </section>

            {/* Pilot Pricing */}
            <section className="bg-white rounded-2xl p-8 border border-gray-200 shadow-md mb-16">
              <h2 className="text-4xl font-bold text-center mb-6 text-gray-900">
                Pilot Program Pricing
              </h2>
              <p className="text-center text-gray-600 mb-12 text-lg">
                Limited to first 7 fintech startups • Closes March 15, 2026
              </p>
              <div className="max-w-2xl mx-auto bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-8 border-2 border-blue-500">
                <div className="text-center mb-6">
                  <div className="inline-block px-4 py-2 bg-blue-600 text-white rounded-full font-bold mb-4">
                    WHITE-GLOVE PILOT
                  </div>
                  <div className="mb-4">
                    <span className="text-6xl font-bold text-gray-900">$4,000</span>
                    <span className="text-2xl text-gray-600">/month</span>
                  </div>
                  <p className="text-green-600 font-bold text-xl">
                    50% OFF • Save $4,000/month for 6 months = $24,000 total savings
                  </p>
                  <p className="text-gray-600 mt-2">
                    Regular price: <span className="line-through">$8,000/month</span>
                  </p>
                </div>
                
                <div className="space-y-3 mb-8">
                  <p className="flex items-start gap-3 text-gray-900">
                    <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                    <span><strong>Dedicated infrastructure engineer</strong> assigned to your deployment</span>
                  </p>
                  <p className="flex items-start gap-3 text-gray-900">
                    <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                    <span><strong>Weekly compliance check-ins</strong> to ensure SOC2 audit readiness</span>
                  </p>
                  <p className="flex items-start gap-3 text-gray-900">
                    <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                    <span><strong>Private Slack channel</strong> with &lt; 2-hour response time</span>
                  </p>
                  <p className="flex items-start gap-3 text-gray-900">
                    <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                    <span><strong>Custom operations runbook</strong> tailored to your infrastructure</span>
                  </p>
                  <p className="flex items-start gap-3 text-gray-900">
                    <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                    <span><strong>30-day free trial</strong> • Cancel anytime, no questions asked</span>
                  </p>
                </div>

                <div className="text-center">
                  <a 
                    href="https://calendly.com/securebase/white-glove-pilot" 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-blue-600 px-8 py-4 rounded-lg text-lg font-bold hover:bg-blue-700 transition text-white shadow-lg"
                  >
                    <Rocket className="w-5 h-5" />
                    Schedule Free Architecture Review
                  </a>
                  <p className="text-sm text-gray-600 mt-4">
                    ✅ 48-hour deployment guarantee • ✅ 30-day money-back guarantee
                  </p>
                </div>
              </div>
            </section>

            {/* Social Proof / Testimonials */}
            <section className="mb-16">
              <h2 className="text-4xl font-bold text-center mb-12 text-gray-900">
                Join 13 Fintech Startups Already Using SecureBase
              </h2>
              <div className="grid md:grid-cols-3 gap-8">
                {testimonials.map((testimonial, i) => (
                  <div key={i} className="bg-white rounded-xl p-6 border border-gray-200 shadow-md">
                    <p className="text-gray-700 mb-4 italic leading-relaxed">"{testimonial.quote}"</p>
                    <div className="border-t border-gray-200 pt-4">
                      <p className="font-bold text-gray-900">{testimonial.author}</p>
                      <p className="text-sm text-gray-600">{testimonial.role}</p>
                      <p className="text-sm text-blue-600 font-medium">{testimonial.company}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* FAQ Section */}
            <section className="bg-white rounded-2xl p-8 border border-gray-200 shadow-md">
              <h2 className="text-4xl font-bold text-center mb-12 text-gray-900">
                Frequently Asked Questions
              </h2>
              <div className="max-w-4xl mx-auto space-y-6">
                {faqs.map((faq, i) => (
                  <div key={i} className="border-b border-gray-200 pb-6 last:border-b-0 last:pb-0">
                    <h3 className="text-xl font-bold mb-3 text-gray-900">{faq.question}</h3>
                    <p className="text-gray-700 leading-relaxed">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* Dev Environment Tab */}
        {activeTab === 'devenv' && (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-4xl font-bold mb-4 text-gray-900">Deploy Development Environment</h2>
              <p className="text-gray-600 text-lg">Test SecureBase with minimal AWS resources</p>
            </div>

            {devEnvStep === 'config' && (
              <div className="grid md:grid-cols-2 gap-6">
                {/* Configuration */}
                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-md">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-900">
                    <Settings className="w-5 h-5 text-blue-600" />
                    Configuration
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Organization Name</label>
                      <input
                        type="text"
                        value={devConfig.orgName}
                        onChange={(e) => setDevConfig({...devConfig, orgName: e.target.value})}
                        placeholder="my-company"
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Root Email</label>
                      <input
                        type="email"
                        value={devConfig.email}
                        onChange={(e) => setDevConfig({...devConfig, email: e.target.value})}
                        placeholder="aws-root@company.com"
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Region</label>
                      <select
                        value={devConfig.region}
                        onChange={(e) => setDevConfig({...devConfig, region: e.target.value})}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
                      >
                        <option value="us-east-1">us-east-1 (N. Virginia)</option>
                        <option value="us-west-2">us-west-2 (Oregon)</option>
                        <option value="eu-west-1">eu-west-1 (Ireland)</option>
                        <option value="ap-southeast-1">ap-southeast-1 (Singapore)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Module Selection */}
                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-md">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-900">
                    <Database className="w-5 h-5 text-blue-600" />
                    Select Modules
                  </h3>
                  <div className="space-y-3">
                    {modules.map((m) => (
                      <label
                        key={m.id}
                        className={`flex items-center gap-3 p-3 rounded border transition ${
                          m.status === 'coming-soon' ? 'opacity-60 cursor-not-allowed bg-gray-50 border-gray-200' :
                          devConfig.enabledModules[m.id]
                            ? 'bg-blue-50 border-blue-300 cursor-pointer'
                            : 'bg-white border-gray-300 hover:border-blue-300 cursor-pointer'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={devConfig.enabledModules[m.id]}
                          disabled={m.status === 'coming-soon'}
                          onChange={(e) => setDevConfig({
                            ...devConfig,
                            enabledModules: {
                              ...devConfig.enabledModules,
                              [m.id]: e.target.checked
                            }
                          })}
                          className="w-4 h-4 text-blue-600"
                        />
                        <m.icon className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-900">{m.name}</div>
                          <div className="text-xs text-gray-600">{m.devCost}</div>
                        </div>
                      </label>
                    ))}
                  </div>

                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-gray-600">Est. Monthly Cost:</span>
                      <span className="text-2xl font-bold text-green-600">
                        ${calculateCost()}-{calculateCost() + 15}
                      </span>
                    </div>
                    <button
                      onClick={simulateDeployment}
                      disabled={!devConfig.orgName || !devConfig.email}
                      className="w-full px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-300 disabled:to-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition shadow-md"
                    >
                      <Rocket className="w-5 h-5" />
                      Deploy Environment
                    </button>
                  </div>
                </div>
              </div>
            )}

            {devEnvStep === 'deploying' && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-gray-900">
                      <Terminal className="w-5 h-5 text-green-600" />
                      Deployment in Progress
                    </h3>
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-green-600 border-t-transparent"></div>
                      <span className="text-sm text-gray-600">Running Terraform</span>
                    </div>
                  </div>
                </div>
                <div className="p-6 bg-gray-900 font-mono text-sm h-96 overflow-y-auto">
                  {deploymentLog.map((log, i) => (
                    <div
                      key={i}
                      className={`mb-1 ${
                        log.type === 'success' ? 'text-green-400' : 'text-gray-300'
                      }`}
                    >
                      <span className="text-gray-500">[{log.timestamp}]</span> {log.message}
                    </div>
                  ))}
                  {isDeploying && (
                    <div className="text-blue-400 animate-pulse">▊</div>
                  )}
                </div>
              </div>
            )}

            {devEnvStep === 'complete' && (
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-300 rounded-xl p-8 text-center shadow-md">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-green-600 rounded-full mb-4">
                    <CheckCircle className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-green-700 mb-2">Deployment Complete!</h3>
                  <p className="text-green-700 mb-6">Your SecureBase environment is ready</p>
                  
                  <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
                    <div className="bg-white rounded p-4 border border-gray-200">
                      <div className="text-sm text-gray-600 mb-1">Resources</div>
                      <div className="text-2xl font-bold text-gray-900">23</div>
                    </div>
                    <div className="bg-white rounded p-4 border border-gray-200">
                      <div className="text-sm text-gray-600 mb-1">Deploy Time</div>
                      <div className="text-2xl font-bold text-gray-900">14m 32s</div>
                    </div>
                    <div className="bg-white rounded p-4 border border-gray-200">
                      <div className="text-sm text-gray-600 mb-1">Security Score</div>
                      <div className="text-2xl font-bold text-green-600">A+</div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setDevEnvStep('config');
                      setDeploymentLog([]);
                    }}
                    className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg font-semibold transition"
                  >
                    Deploy Another
                  </button>
                  <button className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-semibold transition">
                    View AWS Console
                  </button>
                  <button className="flex-1 px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-lg font-semibold transition">
                    Destroy
                  </button>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-md">
                  <div className="p-6 border-b border-gray-200">
                    <h4 className="text-lg font-semibold text-gray-900">Deployment Log</h4>
                  </div>
                  <div className="p-6 bg-gray-900 font-mono text-sm max-h-64 overflow-y-auto">
                    {deploymentLog.map((log, i) => (
                      <div key={i} className={log.type === 'success' ? 'text-green-400 mb-1' : 'text-gray-300 mb-1'}>
                        <span className="text-gray-500">[{log.timestamp}]</span> {log.message}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {devEnvStep === 'config' && (
              <div className="mt-8 bg-blue-50 border border-blue-300 rounded-xl p-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="font-semibold text-blue-700 mb-2">Development Environment Notes</h4>
                    <ul className="text-blue-700 space-y-1 text-sm">
                      <li>• Simulated deployment for demonstration purposes</li>
                      <li>• In production, run actual Terraform in your terminal</li>
                      <li>• Dev environments use minimal resources to reduce costs</li>
                      <li>• All security features are production-ready</li>
                      <li>• Remember to destroy when done testing</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Compliance Tab */}
        {activeTab === 'compliance' && (
          <ComplianceScreen />
        )}
      </main>

      {/* Footer CTA */}
      {activeTab !== 'devenv' && activeTab !== 'compliance' && (
        <footer className="max-w-7xl mx-auto px-6 py-16">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-12 text-center shadow-lg">
            <h3 className="text-3xl font-bold mb-4 text-white">Ready to Deploy?</h3>
            <p className="text-blue-100 mb-8 text-lg">
              Get started with SecureBase and have your AWS foundation running in hours
            </p>
            <div className="flex gap-4 justify-center">
              <button 
                onClick={() => window.location.href='https://cedrickbyrd.github.io/securebase-app/#pilot'}
                className="px-8 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition flex items-center gap-2 shadow-md"
              >
                <UserPlus className="w-5 h-5" />
                Sign Up for Pilot
              </button>
              <button 
                onClick={() => window.location.href='https://cedrickbyrd.github.io/securebase-app/'}
                className="px-8 py-3 bg-blue-800 text-white font-semibold rounded-lg hover:bg-blue-900 transition flex items-center gap-2 shadow-md"
              >
                <Rocket className="w-5 h-5" />
                Deploy Now
              </button>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
