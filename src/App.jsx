import React, { useState, useEffect } from 'react';
import { 
  Shield, CheckCircle, Rocket, Lock, Eye, Zap, 
  GitBranch, Database, Users, Cloud, Terminal, 
  DollarSign, ShoppingCart, UserPlus, ArrowRight, Activity,
  AlertCircle, Loader, Check, X, Server, Key, FileText
} from 'lucide-react';
import ComplianceScreen from './components/compliance/ComplianceScreen';

export default function SecureBaseLandingZone() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);
  
  // Deployment wizard state
  const [devEnvStep, setDevEnvStep] = useState('config'); // config, deploying, complete
  const [deploymentProgress, setDeploymentProgress] = useState(0);
  const [deploymentConfig, setDeploymentConfig] = useState({
    awsRegion: 'us-east-1',
    orgName: '',
    adminEmail: '',
    enableBackup: true,
    enableGuardDuty: true
  });

  // Check for Stripe success/cancel on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      setActiveTab('success');
    } else if (params.get('canceled') === 'true') {
      setCheckoutError('Checkout was canceled. Feel free to try again when ready.');
      setActiveTab('pricing');
    }
  }, []);

  // Stripe Checkout Logic
  const handleCheckout = async (priceId, planName) => {
    setIsCheckingOut(true);
    setCheckoutError(null);
    
    try {
      const response = await fetch('/.netlify/functions/securebase-checkout-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          priceId : 'price_1SrgoR5bg6XXXrmNXe0tTgki',
          successUrl: `${window.location.origin}?success=true`,
          cancelUrl: `${window.location.origin}?canceled=true`
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }
      
      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      console.error('Checkout failed:', err);
    } finally {
      setIsCheckingOut(false);
    }
  };

  // Simulate deployment process
  const startDeployment = () => {
    setDevEnvStep('deploying');
    setDeploymentProgress(0);
    
    const interval = setInterval(() => {
      setDeploymentProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setDevEnvStep('complete'), 500);
          return 100;
        }
        return prev + 5;
      });
    }, 300);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-100">
      {/* Global Navigation */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('overview')}>
            <div className="bg-blue-600 p-2 rounded-lg">
              <Shield className="text-white w-6 h-6" />
            </div>
            <div>
              <div className="text-xl font-bold tracking-tight">SecureBase</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">TxImhotep LLC</div>
            </div>
          </div>
          
          <nav className="hidden md:flex items-center gap-8">
            {['overview', 'compliance', 'devenv', 'pricing'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-sm font-semibold capitalize transition-all ${
                  activeTab === tab ? 'text-blue-600' : 'text-slate-600 hover:text-blue-500'
                }`}
              >
                {tab === 'devenv' ? 'Deploy' : tab}
              </button>
            ))}
            <button 
              onClick={() => setActiveTab('pricing')}
              className="bg-slate-900 text-white px-5 py-2.5 rounded-full text-sm font-bold hover:bg-slate-800 transition flex items-center gap-2 shadow-lg shadow-slate-200"
            >
              <ShoppingCart className="w-4 h-4" />
              Purchase Now
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        
        {/* TAB: OVERVIEW (Hero & Value Prop) */}
        {activeTab === 'overview' && (
          <div className="space-y-24 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <section className="text-center pt-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-100 rounded-full text-blue-700 text-xs font-bold mb-8">
                <Activity className="w-3 h-3" /> v1.0 PRODUCTION READY
              </div>
              <h1 className="text-5xl md:text-7xl font-black tracking-tight text-slate-900 mb-8">
                Audit-Ready AWS <br />
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  In Under 48 Hours
                </span>
              </h1>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
                Deploy a SOX2/SOC2 compliant Landing Zone without the complexity of Control Tower. 
                Built for Fintechs that need to pass audits yesterday.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button 
                  onClick={() => setActiveTab('pricing')}
                  className="px-8 py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 shadow-xl shadow-blue-200"
                >
                  Start Your Pilot <ArrowRight className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setActiveTab('devenv')}
                  className="px-8 py-4 bg-white text-slate-900 border border-slate-200 rounded-xl font-bold text-lg hover:bg-slate-50 transition"
                >
                  Try Demo Deployment
                </button>
              </div>
            </section>

            {/* Feature Grid */}
            <section className="grid md:grid-cols-3 gap-8">
              {[
                { icon: Lock, title: "Zero Trust Auth", desc: "MFA enforced, zero long-lived credentials, and centralized Identity Center." },
                { icon: Terminal, title: "Pure Terraform", desc: "No proprietary lock-in. Full ownership of your infrastructure code from day one." },
                { icon: Activity, title: "Continuous Drift Detection", desc: "Real-time alerts for configuration changes that could impact your compliance." }
              ].map((feature, i) => (
                <div key={i} className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition">
                  <feature.icon className="text-blue-600 w-10 h-10 mb-6" />
                  <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </section>

            {/* Social Proof */}
            <section className="bg-white rounded-3xl p-12 border border-slate-200">
              <h2 className="text-3xl font-bold text-center mb-8">Trusted by Forward-Thinking Fintechs</h2>
              <div className="grid md:grid-cols-3 gap-8 text-center">
                <div>
                  <div className="text-4xl font-black text-blue-600 mb-2">48hrs</div>
                  <div className="text-slate-600 font-medium">Average Deployment Time</div>
                </div>
                <div>
                  <div className="text-4xl font-black text-blue-600 mb-2">100%</div>
                  <div className="text-slate-600 font-medium">SOC2 Audit Pass Rate</div>
                </div>
                <div>
                  <div className="text-4xl font-black text-blue-600 mb-2">$0</div>
                  <div className="text-slate-600 font-medium">Compliance Surprises</div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* TAB: COMPLIANCE (Live Signals) */}
        {activeTab === 'compliance' && (
          <div className="animate-in fade-in duration-500">
            <ComplianceScreen />
          </div>
        )}

        {/* TAB: DEPLOYMENT WIZARD */}
        {activeTab === 'devenv' && (
          <div className="max-w-4xl mx-auto animate-in fade-in duration-500">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4 text-gray-900">Deploy Development Environment</h2>
              <p className="text-slate-600">Experience SecureBase deployment in a sandbox environment</p>
            </div>

            {/* Step 1: Configuration */}
            {devEnvStep === 'config' && (
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Server className="w-5 h-5 text-blue-600" />
                    AWS Configuration
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-slate-700">Organization Name</label>
                      <input
                        type="text"
                        value={deploymentConfig.orgName}
                        onChange={(e) => setDeploymentConfig({...deploymentConfig, orgName: e.target.value})}
                        placeholder="Acme Corp"
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-slate-700">Admin Email</label>
                      <input
                        type="email"
                        value={deploymentConfig.adminEmail}
                        onChange={(e) => setDeploymentConfig({...deploymentConfig, adminEmail: e.target.value})}
                        placeholder="admin@acme.com"
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-slate-700">AWS Region</label>
                      <select
                        value={deploymentConfig.awsRegion}
                        onChange={(e) => setDeploymentConfig({...deploymentConfig, awsRegion: e.target.value})}
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="us-east-1">US East (N. Virginia)</option>
                        <option value="us-west-2">US West (Oregon)</option>
                        <option value="eu-west-1">EU (Ireland)</option>
                        <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-600" />
                    Security Features
                  </h3>
                  <div className="space-y-4">
                    <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition">
                      <input
                        type="checkbox"
                        checked={deploymentConfig.enableBackup}
                        onChange={(e) => setDeploymentConfig({...deploymentConfig, enableBackup: e.target.checked})}
                        className="w-5 h-5 text-blue-600"
                      />
                      <div className="flex-1">
                        <div className="font-semibold">AWS Backup</div>
                        <div className="text-sm text-slate-600">Automated daily backups with 30-day retention</div>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition">
                      <input
                        type="checkbox"
                        checked={deploymentConfig.enableGuardDuty}
                        onChange={(e) => setDeploymentConfig({...deploymentConfig, enableGuardDuty: e.target.checked})}
                        className="w-5 h-5 text-blue-600"
                      />
                      <div className="flex-1">
                        <div className="font-semibold">GuardDuty Threat Detection</div>
                        <div className="text-sm text-slate-600">Real-time monitoring for malicious activity</div>
                      </div>
                    </label>
                  </div>

                  <div className="mt-8 p-4 bg-blue-50 border border-blue-100 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div className="text-sm text-blue-900">
                        <strong>Demo Mode:</strong> This is a simulated deployment. No actual AWS resources will be created.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 flex justify-center">
                  <button
                    onClick={startDeployment}
                    disabled={!deploymentConfig.orgName || !deploymentConfig.adminEmail}
                    className="px-12 py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition flex items-center gap-3 shadow-xl shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Rocket className="w-5 h-5" />
                    Start Deployment
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Deploying */}
            {devEnvStep === 'deploying' && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
                  <h3 className="text-2xl font-bold flex items-center gap-3">
                    <Loader className="w-6 h-6 animate-spin" />
                    Deploying SecureBase Infrastructure
                  </h3>
                  <p className="text-blue-100 mt-2">Setting up your compliant AWS environment...</p>
                </div>

                <div className="p-8">
                  <div className="mb-6">
                    <div className="flex justify-between mb-2 text-sm font-semibold">
                      <span>Progress</span>
                      <span>{deploymentProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full transition-all duration-300 ease-out"
                        style={{ width: `${deploymentProgress}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-3 font-mono text-sm">
                    {[
                      { step: 'Creating VPC and subnets', done: deploymentProgress > 10 },
                      { step: 'Configuring security groups', done: deploymentProgress > 25 },
                      { step: 'Enabling CloudTrail logging', done: deploymentProgress > 40 },
                      { step: 'Setting up GuardDuty', done: deploymentProgress > 55 },
                      { step: 'Deploying AWS Config rules', done: deploymentProgress > 70 },
                      { step: 'Configuring backup policies', done: deploymentProgress > 85 },
                      { step: 'Finalizing IAM policies', done: deploymentProgress > 95 }
                    ].map((item, i) => (
                      <div key={i} className={`flex items-center gap-3 p-3 rounded-lg ${item.done ? 'bg-green-50' : 'bg-slate-50'}`}>
                        {item.done ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <Loader className="w-5 h-5 text-blue-600 animate-spin" />
                        )}
                        <span className={item.done ? 'text-green-900' : 'text-slate-600'}>{item.step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Complete */}
            {devEnvStep === 'complete' && (
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl p-10 text-center">
                  <div className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Check className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-3xl font-bold text-green-900 mb-3">Deployment Complete!</h3>
                  <p className="text-green-800 text-lg">Your compliant AWS environment is ready</p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-xl border border-slate-200">
                    <h4 className="font-bold text-lg mb-4 flex items-center gap-2">
                      <Key className="w-5 h-5 text-blue-600" />
                      Access Details
                    </h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                        <span className="text-slate-600">Region:</span>
                        <span className="font-mono font-semibold">{deploymentConfig.awsRegion}</span>
                      </div>
                      <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                        <span className="text-slate-600">Organization:</span>
                        <span className="font-semibold">{deploymentConfig.orgName}</span>
                      </div>
                      <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                        <span className="text-slate-600">Admin Email:</span>
                        <span className="font-mono text-xs">{deploymentConfig.adminEmail}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-xl border border-slate-200">
                    <h4 className="font-bold text-lg mb-4 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-600" />
                      Next Steps
                    </h4>
                    <ul className="space-y-3 text-sm">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                        <span>Check your email for access credentials</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                        <span>Review compliance dashboard</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                        <span>Download audit evidence bundle</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-4 justify-center pt-6">
                  <button
                    onClick={() => setActiveTab('compliance')}
                    className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition"
                  >
                    View Compliance Dashboard
                  </button>
                  <button
                    onClick={() => {
                      setDevEnvStep('config');
                      setDeploymentProgress(0);
                    }}
                    className="px-8 py-3 bg-white text-slate-900 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition"
                  >
                    Deploy Another Environment
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: PRICING (Stripe Loop) */}
        {activeTab === 'pricing' && (
          <div className="max-w-5xl mx-auto space-y-12 animate-in fade-in zoom-in-95 duration-500">
            <div className="text-center">
              <h2 className="text-4xl font-black text-slate-900 mb-4">Predictable Pricing for Scale</h2>
              <p className="text-slate-600">Select the plan that fits your current compliance audit window.</p>
            </div>

            {/* Error Display */}
            {checkoutError && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                  <div className="font-semibold text-red-900">Checkout Error</div>
                  <div className="text-sm text-red-700">{checkoutError}</div>
                </div>
                <button onClick={() => setCheckoutError(null)} className="ml-auto">
                  <X className="w-5 h-5 text-red-600 hover:text-red-800" />
                </button>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-8 pt-8">
              {/* Pilot Tier */}
              <div className="relative bg-white border-2 border-blue-600 rounded-[2rem] p-10 shadow-2xl flex flex-col">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-1 rounded-full text-[10px] font-black tracking-widest uppercase">
                  Early Adopter Pilot
                </div>
                <h3 className="text-2xl font-bold">White-Glove Pilot</h3>
                <div className="my-6">
                  <span className="text-6xl font-black">$4,000</span>
                  <span className="text-slate-400 font-bold">/mo</span>
                </div>
                <ul className="space-y-4 mb-10 flex-grow">
                  {['SOX2 + SOC2 Base Controls', 'White-Glove AWS Deployment', 'Quarterly Evidence Reports', 'CIS Benchmark Hardening'].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm font-medium text-slate-700">
                      <CheckCircle className="text-green-500 w-5 h-5" /> {item}
                    </li>
                  ))}
                </ul>
                <button 
                  onClick={() => handleCheckout('price_1SrgoR5bg6XXXrmNXe0tTgki', 'White-Glove Pilot')}
                  disabled={isCheckingOut}
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-lg hover:bg-blue-700 transition shadow-lg shadow-blue-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isCheckingOut ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Join the Pilot'
                  )}
                </button>
              </div>

              {/* Standard Tier */}
              <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-10 flex flex-col text-white">
                <h3 className="text-2xl font-bold">Fintech Standard</h3>
                <div className="my-6">
                  <span className="text-6xl font-black">$8,000</span>
                  <span className="text-slate-500 font-bold">/mo</span>
                </div>
                <ul className="space-y-4 mb-10 flex-grow">
                  {['Everything in Pilot', '24/7 Priority Incident Ops', 'Multi-Region Expansion', 'Unlimited Account Vending'].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm font-medium text-slate-300">
                      <CheckCircle className="text-blue-400 w-5 h-5" /> {item}
                    </li>
                  ))}
                </ul>
                <button 
                  onClick={() => handleCheckout('price_1SrgqW5bg6XXXrmNzkk8O5E5', 'Fintech Standard')}
                  disabled={isCheckingOut}
                  className="w-full py-4 bg-white text-slate-900 rounded-2xl font-black text-lg hover:bg-slate-100 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isCheckingOut ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Select Standard'
                  )}
                </button>
              </div>
            </div>

            {/* Trust Signals */}
            <div className="text-center pt-8 border-t border-slate-200">
              <p className="text-sm text-slate-600 mb-4">Trusted payment processing by</p>
              <div className="flex items-center justify-center gap-2">
                <Lock className="w-4 h-4 text-slate-400" />
                <span className="font-bold text-slate-700">Stripe</span>
                <span className="text-slate-400">•</span>
                <span className="text-sm text-slate-600">256-bit SSL encryption</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB: POST-PURCHASE SUCCESS */}
        {activeTab === 'success' && (
          <div className="max-w-3xl mx-auto animate-in fade-in zoom-in-95 duration-500">
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-3xl p-12 text-center">
              <div className="w-24 h-24 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-8">
                <Check className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-4xl font-black text-green-900 mb-4">Welcome to SecureBase!</h2>
              <p className="text-xl text-green-800 mb-8">Your payment was successful. Let's get you set up.</p>
              
              <div className="bg-white rounded-2xl p-8 text-left mb-8">
                <h3 className="text-2xl font-bold mb-6">What Happens Next?</h3>
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">1</div>
                    <div>
                      <h4 className="font-bold text-lg mb-2">Welcome Email (Next 5 minutes)</h4>
                      <p className="text-slate-600">Check your inbox for onboarding credentials and your dedicated Slack channel invite.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">2</div>
                    <div>
                      <h4 className="font-bold text-lg mb-2">Kickoff Call (Within 24 hours)</h4>
                      <p className="text-slate-600">Our team will schedule a white-glove onboarding session to review your AWS requirements.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">3</div>
                    <div>
                      <h4 className="font-bold text-lg mb-2">Deployment Begins (48 hours)</h4>
                      <p className="text-slate-600">We'll deploy your compliant infrastructure and provide real-time progress updates.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => setActiveTab('devenv')}
                  className="px-8 py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 shadow-xl"
                >
                  <Rocket className="w-5 h-5" />
                  Try Demo Deployment
                </button>
                <button
                  onClick={() => setActiveTab('compliance')}
                  className="px-8 py-4 bg-white text-slate-900 border-2 border-slate-200 rounded-xl font-bold text-lg hover:bg-slate-50 transition"
                >
                  View Compliance Features
                </button>
              </div>
            </div>

            <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-1" />
                <div className="text-sm">
                  <strong className="text-blue-900">Questions?</strong>
                  <p className="text-blue-800 mt-1">
                    Email us at <a href="mailto:support@securebase.tximhotep.com" className="font-semibold underline">support@securebase.tximhotep.com</a> or 
                    check your Slack channel for immediate assistance.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modern Footer */}
      <footer className="bg-white border-t border-slate-200 mt-24">
        <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3">
            <Shield className="text-blue-600 w-5 h-5" />
            <span className="font-bold text-slate-900">SecureBase by TxImhotep LLC</span>
          </div>
          <div className="text-sm text-slate-500 font-medium">
            © 2026 TxImhotep LLC. Built for the future of Fintech Compliance.
          </div>
        </div>
      </footer>
    </div>
  );
}
