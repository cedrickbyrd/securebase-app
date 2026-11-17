import React from 'react';
import { ShieldCheck, Lock, Key, Cpu, FileCheck, ExternalLink, CheckCircle2, AlertOctagon } from 'lucide-react';

export const ZeroDataCustodyView: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Hero Overview */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 sm:p-8">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>FOUNDATIONAL ENGINEERING CONSTITUTION</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Zero-Data-Custody Architecture
          </h1>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed font-sans">
            SecureBase by <strong className="text-white">TxImhotep LLC</strong> operates under strict sovereign zero-data-custody principles.
            We evaluate statutory compliance strictly through pre-flight Abstract Syntax Tree (AST) parsing of OpenTofu / Terraform IaC manifests.
            Customer database payloads, PII/PHI, and persistent credentials never enter our perimeter.
          </p>
        </div>

        {/* Sovereign Marketplace Identification */}
        <div className="mt-6 pt-6 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
          <div className="p-3 bg-slate-950 border border-slate-800 rounded">
            <span className="text-slate-400 block mb-1">GCP Project:</span>
            <span className="text-white font-bold">SecureBase-GCP</span>
            <span className="text-[11px] text-slate-400 block mt-0.5">Project ID: 594006980795</span>
          </div>
          <div className="p-3 bg-slate-950 border border-slate-800 rounded">
            <span className="text-slate-400 block mb-1">Repository:</span>
            <span className="text-cyan-300 font-bold">cedrickbyrd/securebase-app</span>
            <span className="text-[11px] text-slate-400 block mt-0.5">Autonomous Shift-Left</span>
          </div>
          <div className="p-3 bg-slate-950 border border-slate-800 rounded">
            <span className="text-slate-400 block mb-1">Sovereign Portal:</span>
            <span className="text-white font-bold">demo.securebase.tximhotep.com</span>
            <span className="text-[11px] text-slate-400 block mt-0.5">TxImhotep LLC</span>
          </div>
          <div className="p-3 bg-slate-950 border border-slate-800 rounded">
            <span className="text-slate-400 block mb-1">Distribution:</span>
            <span className="text-emerald-400 font-bold">Google Cloud Marketplace</span>
            <span className="text-[11px] text-slate-400 block mt-0.5">Direct Procurement</span>
          </div>
        </div>
      </div>

      {/* 3 Pillars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Pillar 1 */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6">
          <div className="w-10 h-10 rounded-lg bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center mb-4 text-cyan-400">
            <Key className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white mb-2 font-mono">
            1. Keyless WIF &amp; STS Tokens
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed font-sans mb-4">
            Zero persistent secrets. SecureBase authenticates with customer cloud estates exclusively via Google Cloud Workload Identity Federation (WIF) and AWS STS short-lived tokens.
          </p>
          <ul className="space-y-2 text-xs font-mono text-slate-300">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>No service account JSON keys stored</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Short-lived tokens (max 3,600s TTL)</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Cryptographic OpenID token exchange</span>
            </li>
          </ul>
        </div>

        {/* Pillar 2 */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6">
          <div className="w-10 h-10 rounded-lg bg-purple-950/80 border border-purple-800/60 flex items-center justify-center mb-4 text-purple-400">
            <Cpu className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white mb-2 font-mono">
            2. Pure AST Pre-Flight Analysis
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed font-sans mb-4">
            Evaluations parse declarative Abstract Syntax Trees before infrastructure is deployed. We inspect resource declarations and read-only cloud metadata—never database content.
          </p>
          <ul className="space-y-2 text-xs font-mono text-slate-300">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span>Zero customer data-plane proxying</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span>No PII / PHI ingestion or disk storage</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span>Pre-commit &amp; PR shift-left evaluation</span>
            </li>
          </ul>
        </div>

        {/* Pillar 3 */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6">
          <div className="w-10 h-10 rounded-lg bg-emerald-950/80 border border-emerald-800/60 flex items-center justify-center mb-4 text-emerald-400">
            <Lock className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white mb-2 font-mono">
            3. Customer-Owned WORM Vaults
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed font-sans mb-4">
            Evidence manifests are sealed with SHA-256 and committed directly to customer-owned Google Cloud Storage Bucket Lock (Compliance Mode) or AWS S3 Object Lock.
          </p>
          <ul className="space-y-2 text-xs font-mono text-slate-300">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>2,555 Days (7-year statutory retention)</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Undeletable even by cloud root keys</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Immutable cryptographic audit chain</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Prohibitions Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6">
        <h3 className="text-sm font-bold text-white uppercase font-mono mb-4 flex items-center gap-2">
          <AlertOctagon className="w-4 h-4 text-rose-400" />
          <span>Strict Zero-Custody Architectural Invariants</span>
        </h3>

        <div className="overflow-x-auto border border-slate-800 rounded-lg font-mono text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <th className="py-2.5 px-4 font-semibold">Data Category</th>
                <th className="py-2.5 px-4 font-semibold">Custody Status</th>
                <th className="py-2.5 px-4 font-semibold">Technical Enforcement Mechanism</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              <tr>
                <td className="py-3 px-4 font-semibold text-slate-200">Customer Databases (SQL / NoSQL)</td>
                <td className="py-3 px-4 text-rose-400 font-bold">NEVER INGESTED</td>
                <td className="py-3 px-4 text-slate-400 font-sans">Network endpoints restricted; no data plane access required.</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-slate-200">Customer PHI / ePHI (HIPAA)</td>
                <td className="py-3 px-4 text-rose-400 font-bold">NEVER PROXIED</td>
                <td className="py-3 px-4 text-slate-400 font-sans">Only storage bucket encryption flags and retention policies are parsed.</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-slate-200">Cloud IAM Long-Lived Access Keys</td>
                <td className="py-3 px-4 text-rose-400 font-bold">STRICTLY PROHIBITED</td>
                <td className="py-3 px-4 text-slate-400 font-sans">Only Workload Identity Federation (WIF) and STS tokens permitted.</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-slate-200">Infrastructure Code (IaC)</td>
                <td className="py-3 px-4 text-emerald-400 font-bold">IN-MEMORY AST ONLY</td>
                <td className="py-3 px-4 text-slate-400 font-sans">Parsed ephemerally in volatile memory; immediately wiped upon synthesis.</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-slate-200">Audit Evidence Manifests</td>
                <td className="py-3 px-4 text-cyan-400 font-bold">CUSTOMER WORM SINK</td>
                <td className="py-3 px-4 text-slate-400 font-sans">SHA-256 sealed and streamed directly into customer-controlled WORM buckets.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Carrier-Grade Engineering Provenance Box */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 font-mono text-xs text-cyan-400">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span className="font-bold uppercase">Carrier-Grade Engineering Provenance</span>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
            25-Year Systems Lineage
          </span>
        </div>
        <h4 className="text-sm font-bold text-white mb-2 font-mono">
          Why Physical Layer Isolation &amp; Carrier Telecommunications Inform Software Invariants
        </h4>
        <p className="text-xs text-slate-300 leading-relaxed font-sans mb-4">
          Software architectures frequently fail because pure software engineers treat the cloud as an ethereal, infinitely elastic sandbox.
          SecureBase was engineered under an uncompromising reality: <strong className="text-white">25 years of mission-critical telecommunications infrastructure engineering</strong>,
          anchored by <strong className="text-white">18 years operating at national carrier scale inside AT&amp;T</strong> and rigorous <strong className="text-white">SATCOM RF systems engineering</strong>.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
            <span className="text-cyan-400 font-bold block mb-1">1. Out-of-Band Control Planes</span>
            <p className="text-slate-400 text-[11px] font-sans">
              Just as telecom carriers separate SS7 / Diameter signaling from voice bearer payloads, SecureBase operates strictly on metadata and AST control declarations, never traversing customer data planes.
            </p>
          </div>

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
            <span className="text-amber-400 font-bold block mb-1">2. RF Physical Realism</span>
            <p className="text-slate-400 text-[11px] font-sans">
              Decades calculating orbital link budgets (Friis equation, Eb/N0 noise floors, Reed-Solomon FEC) ground our shift-left gates in deterministic mathematics rather than hopeful runtime retries.
            </p>
          </div>

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
            <span className="text-purple-400 font-bold block mb-1">3. Fail-Closed Resilience</span>
            <p className="text-slate-400 text-[11px] font-sans">
              Derived from off-grid DC microgrids and battery storage budgets: when anomalies emerge, the system fails closed instantly to preserve state and prevent cascading failure.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
