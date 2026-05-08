import React from 'react';

const deliverables = [
  'Continuous governance evidence for regulated cloud environments',
  'Clearer proof of infrastructure and access control operation',
  'Verifiable deployment integrity and change traceability',
  'Exportable artifacts for audits, diligence, and procurement reviews',
];

const scrutinyQuestions = [
  'Customer security questionnaires',
  'Procurement and vendor risk reviews',
  'Audit and examiner requests',
  'Cyber insurance renewal discussions',
  'Investor and acquisition diligence',
];

const proofPoints = [
  { title: 'Sample governance snapshot', href: '/contact-sales?source=trust-center' },
  { title: 'Architecture overview', href: '/contact-sales?source=trust-center' },
  { title: 'Evidence export example', href: '/contact-sales?source=trust-center' },
  { title: 'Deployment integrity overview', href: '/contact-sales?source=trust-center' },
  { title: 'FAQ', href: '#faq' },
];

const frameworks = ['SOC 2 Workflow Support', 'HIPAA Safeguard Evidence', 'FedRAMP-Aligned Controls', 'FFIEC Readiness Support'];

const sectionTitle = 'text-2xl md:text-3xl font-bold text-white';
const sectionBody = 'mt-4 text-blue-100/90 leading-relaxed';

const TrustCenter = () => (
  <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white">
    <main className="max-w-6xl mx-auto px-6 py-16 md:py-24">
      <section id="hero" className="mb-16 md:mb-20">
        <p className="text-xs uppercase tracking-[0.2em] font-bold text-blue-300">
          Security, Governance, and Operational Trust
        </p>
        <h1 className="mt-4 text-4xl md:text-6xl font-bold leading-tight max-w-4xl">
          Continuous Governance Evidence for Regulated Cloud Infrastructure
        </h1>
        <p className="mt-6 text-lg text-blue-100/90 max-w-3xl">
          SecureBase helps regulated organizations maintain defensible cloud governance with continuously generated evidence across infrastructure, access, deployment integrity, and operational controls.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-4">
          <a
            href="/demo"
            className="inline-flex items-center justify-center rounded-xl px-6 py-3 font-semibold bg-gradient-to-r from-[#667eea] to-[#764ba2] hover:opacity-95 transition"
          >
            View Executive Demo
          </a>
          <a
            href="/contact-sales?source=trust-center"
            className="inline-flex items-center justify-center rounded-xl px-6 py-3 font-semibold border border-white/30 bg-white/5 hover:bg-white/10 transition"
          >
            Request Assessment
          </a>
        </div>
        <p className="mt-5 text-sm text-blue-200/90">
          Prepare for auditors, customers, insurers, and acquirers before they ask for proof.
        </p>
      </section>

      <section id="why-it-matters" className="mb-14 md:mb-16">
        <h2 className={sectionTitle}>Trust breaks down when evidence is manual, delayed, or incomplete</h2>
        <p className={sectionBody}>
          SecureBase reduces audit friction, accelerates security reviews, and helps teams present clearer operational proof to customers, insurers, regulators, and boards without last-minute evidence assembly.
        </p>
      </section>

      <section id="deliverables" className="mb-14 md:mb-16">
        <h2 className={sectionTitle}>What SecureBase Delivers</h2>
        <ul className="mt-6 grid gap-3 md:grid-cols-2">
          {deliverables.map((item) => (
            <li key={item} className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-blue-50">
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section id="governance-snapshot" className="mb-14 md:mb-16">
        <div className="rounded-2xl border border-blue-300/30 bg-blue-600/10 p-6 md:p-8">
          <h2 className={sectionTitle}>Immutable 72-hour snapshot of institutional cyber hygiene</h2>
          <p className={sectionBody}>
            SecureBase keeps structured governance records current before audits, renewals, diligence, or board review—so teams scramble less, defend more confidently, and respond faster when external proof is requested.
          </p>
        </div>
      </section>

      <section id="built-for-scrutiny" className="mb-14 md:mb-16">
        <h2 className={sectionTitle}>Prepared for the questions external stakeholders actually ask</h2>
        <ul className="mt-6 space-y-3">
          {scrutinyQuestions.map((item) => (
            <li key={item} className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-blue-50">
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section id="responsible-claims" className="mb-14 md:mb-16">
        <h2 className={sectionTitle}>Trust is built with evidence, not inflated language</h2>
        <p className={sectionBody}>
          We make precise claims, support them with artifacts, and avoid overstating compliance outcomes. Buyers and reviewers should be able to inspect what is true, not infer what might be.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {frameworks.map((framework) => (
            <span key={framework} className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-blue-100">
              {framework}
            </span>
          ))}
        </div>
      </section>

      <section id="proof-points" className="mb-14 md:mb-16">
        <h2 className={sectionTitle}>Evidence buyers can review, not just claims they have to trust</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {proofPoints.map((item) => (
            <a
              key={item.title}
              href={item.href}
              className="rounded-xl border border-white/15 bg-white/5 p-5 hover:bg-white/10 transition"
            >
              <h3 className="font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-sm text-blue-200">Preview available on request</p>
            </a>
          ))}
        </div>
      </section>

      <section id="faq" className="mb-14 md:mb-16">
        <h2 className={sectionTitle}>FAQ</h2>
        <div className="mt-6 rounded-xl border border-white/15 bg-white/5 p-6">
          <h3 className="font-semibold text-white">Does SecureBase replace audits?</h3>
          <p className="mt-2 text-sm text-blue-100/90">
            No. SecureBase helps teams prepare evidence for audits, diligence, and governance reviews with continuous, structured artifacts.
          </p>
        </div>
      </section>

      <section id="final-cta" className="rounded-2xl border border-white/20 bg-white/10 p-8 md:p-10">
        <p className="text-xs uppercase tracking-[0.2em] font-bold text-blue-300">See SecureBase in Action</p>
        <h2 className="mt-3 text-3xl md:text-4xl font-bold">Trust is easier to win when evidence already exists</h2>
        <p className="mt-4 text-blue-100/90 max-w-3xl">
          See how SecureBase helps regulated organizations reduce governance friction and maintain board-ready cyber governance.
        </p>
        <div className="mt-7 flex flex-col sm:flex-row gap-4">
          <a
            href="/demo"
            className="inline-flex items-center justify-center rounded-xl px-6 py-3 font-semibold bg-gradient-to-r from-[#667eea] to-[#764ba2] hover:opacity-95 transition"
          >
            View Executive Demo
          </a>
          <a
            href="/contact-sales?source=trust-center"
            className="inline-flex items-center justify-center rounded-xl px-6 py-3 font-semibold border border-white/30 bg-white/5 hover:bg-white/10 transition"
          >
            Request Assessment
          </a>
        </div>
      </section>
    </main>
  </div>
);

export default TrustCenter;
