import React from 'react';
import { Link } from 'react-router-dom';
import EarlyAccessForm from '../components/EarlyAccessForm';

const valueProps = [
  {
    icon: '⚡',
    title: '48 Hours',
    description: 'From sign-up to a fully provisioned, compliant AWS Landing Zone — not weeks.',
  },
  {
    icon: '💰',
    title: '$25K vs $500K+',
    description: 'Enterprise-grade compliance infrastructure at a fraction of the cost of building in-house.',
  },
  {
    icon: '🛡️',
    title: 'Compliance Ready',
    description: 'SOC 2, HIPAA, FedRAMP, and CIS controls built-in from day one.',
  },
];

const LandingPage = () => {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      {/* Hero */}
      <header className="flex flex-col items-center justify-center text-center px-6 pt-20 pb-12">
        <div className="inline-block bg-white/10 backdrop-blur text-white text-xs font-semibold px-4 py-1 rounded-full mb-6 border border-white/20">
          🚀 Now in Early Access · 200+ Companies on the Waitlist
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold text-white leading-tight mb-4 max-w-3xl">
          Compliant AWS Infrastructure<br />
          <span className="text-yellow-300">in 48 Hours</span>
        </h1>
        <p className="text-xl text-blue-100 max-w-2xl mb-10">
          SecureBase delivers enterprise-grade SOC 2, HIPAA, and FedRAMP-ready AWS Landing Zones
          as a managed service — without the million-dollar consulting bill.
        </p>
        <a href="#request-access" className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold py-3 px-8 rounded-lg text-lg shadow-lg transition">
          🚀 Request Early Access
        </a>
      </header>

      {/* Value Props */}
      <section className="px-6 py-12">
        <h2 className="text-center text-2xl font-bold text-white mb-10">Why SecureBase?</h2>
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {valueProps.map((prop) => (
            <div
              key={prop.title}
              className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/20 text-center"
            >
              <div className="text-4xl mb-3">{prop.icon}</div>
              <h3 className="text-xl font-bold text-white mb-2">{prop.title}</h3>
              <p className="text-blue-100 text-sm">{prop.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Demo Access Section */}
      <section className="px-6 py-10 flex flex-col items-center">
        <div className="w-full max-w-lg text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-black font-bold py-4 px-10 rounded-xl text-lg shadow-lg transition transform hover:scale-105"
          >
            🎮 Try Live Demo (No Signup Required)
          </Link>
          <p className="text-blue-200 text-xs mt-4">
            See the product first — demo credentials are shown on the login page.
          </p>
        </div>
      </section>

      {/* Lead Capture */}
      <section id="request-access" className="px-6 py-16 flex flex-col items-center">
        <div className="w-full max-w-lg bg-white/10 backdrop-blur rounded-2xl border border-white/20 p-8">
          <h2 className="text-2xl font-bold text-white text-center mb-2">Request Early Access</h2>
          <p className="text-blue-200 text-center text-sm mb-8">
            Join 200+ companies securing their AWS infrastructure with SecureBase.
          </p>
          <EarlyAccessForm />
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto py-8 text-center">
        <p className="text-blue-200 text-sm mb-3">
          Prefer to talk to a human?{' '}
          <a
            href="https://calendly.com/securebase/white-glove-pilot"
            target="_blank"
            rel="noopener noreferrer"
            className="text-yellow-300 hover:text-yellow-200 underline font-semibold"
          >
            Schedule a Demo
          </a>
        </p>
        <p className="text-blue-300 text-xs">© {new Date().getFullYear()} TxImhotep LLC · SecureBase</p>
      </footer>
    </div>
  );
};

export default LandingPage;
