import React, { useState } from 'react';
import {
  X,
  Radio,
  Wifi,
  Server,
  ShieldCheck,
  Zap,
  Cpu,
  Layers,
  Activity,
  Globe,
  BatteryCharging,
  Sun,
  HardDrive,
  Lock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Gauge,
  Key,
  Anchor,
  Share2
} from 'lucide-react';

interface CarrierGradeInfrastructureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CarrierGradeInfrastructureModal: React.FC<CarrierGradeInfrastructureModalProps> = ({
  isOpen,
  onClose
}) => {
  const [activePillar, setActivePillar] = useState<'carrier' | 'satcom' | 'cloud' | 'resilience'>('carrier');
  
  // Interactive Simulator States
  const [availabilityNines, setAvailabilityNines] = useState<number>(5); // 3, 4, 5
  const [satcomBand, setSatcomBand] = useState<'C' | 'Ku' | 'Ka'>('Ku');
  const [solarWattage, setSolarWattage] = useState<number>(3200);
  const [batteryKwh, setBatteryKwh] = useState<number>(15.4);
  const [systemLoadW, setSystemLoadW] = useState<number>(450);

  if (!isOpen) return null;

  // Calculators
  const downtimeMinutesPerYear = availabilityNines === 5 ? 5.26 : availabilityNines === 4 ? 52.6 : 525.6;
  const downtimeSecondsPerDay = availabilityNines === 5 ? 0.86 : availabilityNines === 4 ? 8.64 : 86.4;

  const satcomSpecs = {
    C: { freq: '4-8 GHz', rainFade: 'Negligible (<0.5 dB)', antennaSize: '2.4m - 4.5m', linkMargin: '4.8 dB', latency: '240ms GEO' },
    Ku: { freq: '12-18 GHz', rainFade: 'Moderate (2-5 dB)', antennaSize: '1.2m - 1.8m', linkMargin: '3.6 dB', latency: '240ms GEO' },
    Ka: { freq: '26.5-40 GHz', rainFade: 'High (8-14 dB)', antennaSize: '0.65m - 1.0m', linkMargin: '2.9 dB', latency: '240ms GEO / 25ms LEO' }
  };

  const autonomyHours = ((batteryKwh * 1000 * 0.85) / systemLoadW).toFixed(1);
  const autonomyDays = (parseFloat(autonomyHours) / 24).toFixed(1);
  const dailyGenKwh = ((solarWattage * 4.5 * 0.82) / 1000).toFixed(1);
  const dailyConsumptionKwh = ((systemLoadW * 24) / 1000).toFixed(1);
  const isNetPositive = parseFloat(dailyGenKwh) >= parseFloat(dailyConsumptionKwh);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-6">
        
        {/* Top Header Bar */}
        <div className="p-6 border-b border-slate-800 bg-slate-950/90 flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 font-mono text-xs text-cyan-400">
              <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
              <span>ARCHITECTURAL PROVENANCE &amp; SYSTEMS FOUNDATION</span>
              <span className="text-slate-600">|</span>
              <span className="text-amber-400 font-bold">25-YEAR LINEAGE</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-3">
              Mission-Critical Telecommunications &amp; Enterprise Cloud Infrastructure
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-3xl leading-relaxed">
              How 25 years of infrastructure engineering: anchored by 18 years operating at national carrier scale inside AT&amp;T,
              SATCOM RF subsystems, and autonomous DC microgrids, powers SecureBase&apos;s zero-data-custody shift-left engine.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
            aria-label="Close Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Executive Convergence Matrix Bar */}
        <div className="px-6 py-3 bg-slate-950/60 border-b border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
          <div className="p-2.5 bg-slate-900/90 border border-slate-800 rounded-lg">
            <span className="text-slate-400 text-[10px] uppercase block">Carrier Core Scale</span>
            <span className="text-cyan-400 font-bold text-xs mt-0.5 block">18 Yrs AT&amp;T National</span>
            <span className="text-[10px] text-slate-400">99.999% Availability Invariant</span>
          </div>
          <div className="p-2.5 bg-slate-900/90 border border-slate-800 rounded-lg">
            <span className="text-slate-400 text-[10px] uppercase block">Physical &amp; RF Reality</span>
            <span className="text-amber-400 font-bold text-xs mt-0.5 block">SATCOM Engineering</span>
            <span className="text-[10px] text-slate-400">Link Budgets &amp; FEC Grounding</span>
          </div>
          <div className="p-2.5 bg-slate-900/90 border border-slate-800 rounded-lg">
            <span className="text-slate-400 text-[10px] uppercase block">Shift-Left Cloud</span>
            <span className="text-emerald-400 font-bold text-xs mt-0.5 block">AWS / GCP / Azure</span>
            <span className="text-[10px] text-slate-400">WIF / OIDC &amp; OPA Rego AST</span>
          </div>
          <div className="p-2.5 bg-slate-900/90 border border-slate-800 rounded-lg">
            <span className="text-slate-400 text-[10px] uppercase block">Physical Autonomy</span>
            <span className="text-purple-400 font-bold text-xs mt-0.5 block">DC Microgrids</span>
            <span className="text-[10px] text-slate-400">Fail-Closed Black-Start Logic</span>
          </div>
        </div>

        {/* 4 Pillar Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 gap-2 overflow-x-auto text-xs font-mono">
          <button
            onClick={() => setActivePillar('carrier')}
            className={`py-3 px-3.5 border-b-2 font-semibold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
              activePillar === 'carrier'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-4 h-4 text-cyan-400" />
            <span>1. Carrier Scale &amp; Five-Nines (AT&amp;T)</span>
          </button>

          <button
            onClick={() => setActivePillar('satcom')}
            className={`py-3 px-3.5 border-b-2 font-semibold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
              activePillar === 'satcom'
                ? 'border-amber-400 text-amber-300 bg-amber-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-4 h-4 text-amber-400" />
            <span>2. SATCOM &amp; RF Physical Grounding</span>
          </button>

          <button
            onClick={() => setActivePillar('cloud')}
            className={`py-3 px-3.5 border-b-2 font-semibold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
              activePillar === 'cloud'
                ? 'border-emerald-400 text-emerald-300 bg-emerald-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>3. Enterprise Cloud &amp; Shift-Left</span>
          </button>

          <button
            onClick={() => setActivePillar('resilience')}
            className={`py-3 px-3.5 border-b-2 font-semibold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
              activePillar === 'resilience'
                ? 'border-purple-400 text-purple-300 bg-purple-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-4 h-4 text-purple-400" />
            <span>4. DC Microgrids &amp; Hard Resilience</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* PILLAR 1: CARRIER SCALE & FIVE NINES */}
          {activePillar === 'carrier' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                    <Server className="w-4 h-4" />
                    Operational Lineage: 18 Years National Tier-1 IP Carrier
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                    AT&amp;T Backbone Pedigree
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white">
                  Deterministic High-Availability &amp; Zero-Tolerance Blast Radii
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
                  Pure software engineers often treat cloud services as elastic black boxes, relying on soft retries, unmetered auto-scaling, and post-incident runbooks.
                  Operating at national carrier scale inside AT&amp;T for nearly two decades teaches an unforgiving truth: <strong className="text-white">failure is structural, physical, and inevitable</strong>.
                  At Tier-1 volume, network topology must be designed for sub-50 millisecond Automatic Protection Switching (APS), deterministic fault isolation, and mathematical MTBF (Mean Time Between Failures).
                </p>
              </div>

              {/* Interactive Five-Nines Calculus Workbench */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-mono font-bold text-white uppercase flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-cyan-400" />
                    <span>Carrier Availability Calculator: The Cost of Architecture</span>
                  </h4>
                  <div className="flex items-center gap-1.5 font-mono text-xs">
                    {[3, 4, 5].map((nines) => (
                      <button
                        key={nines}
                        onClick={() => setAvailabilityNines(nines)}
                        className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                          availabilityNines === nines
                            ? 'bg-cyan-500 text-slate-950 font-bold'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {nines === 5 ? '99.999% (Five Nines)' : nines === 4 ? '99.99%' : '99.9%'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                    <span className="text-slate-400 text-[11px] block">Max Downtime Per Year:</span>
                    <span className="text-cyan-400 font-bold text-base mt-1 block">
                      {downtimeMinutesPerYear} minutes
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {availabilityNines === 5 ? 'Strict Carrier SLA threshold' : 'Enterprise SaaS standard'}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                    <span className="text-slate-400 text-[11px] block">Max Downtime Per Day:</span>
                    <span className="text-emerald-400 font-bold text-base mt-1 block">
                      {downtimeSecondsPerDay} seconds
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Requires sub-second failover planes
                    </span>
                  </div>

                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                    <span className="text-slate-400 text-[11px] block">Engineering Architecture:</span>
                    <span className="text-white font-bold text-xs mt-1 block">
                      {availabilityNines === 5 ? 'Active-Active BGP Anycast + Ring APS' : 'Active-Passive Multi-AZ'}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Deterministic route dampening
                    </span>
                  </div>
                </div>
              </div>

              {/* Translation to SecureBase */}
              <div className="border border-slate-800 rounded-xl overflow-hidden font-mono text-xs">
                <div className="bg-slate-950 p-3 border-b border-slate-800 text-slate-400 font-semibold">
                  Carrier Topology Pattern to SecureBase Cloud Control Crosswalk
                </div>
                <div className="divide-y divide-slate-800/80 bg-slate-900/60">
                  <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <span className="text-cyan-400 font-bold">SONET/DWDM Ring Self-Healing:</span>
                      <p className="text-slate-400 text-[11px] font-sans">
                        Dual counter-rotating fiber rings automatically redirect optical carriers in under 50ms upon physical fiber cut.
                      </p>
                    </div>
                    <div className="sm:text-right shrink-0">
                      <span className="text-white font-semibold">SecureBase Pre-Flight IaC Gate</span>
                      <span className="block text-[10px] text-emerald-400">Blocks broken routes in PR before synthesis</span>
                    </div>
                  </div>

                  <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <span className="text-cyan-400 font-bold">BGP Route Flap Dampening:</span>
                      <p className="text-slate-400 text-[11px] font-sans">
                        Suppresses unstable edge announcements to prevent cascading routing table collapse across the global autonomous system (AS).
                      </p>
                    </div>
                    <div className="sm:text-right shrink-0">
                      <span className="text-white font-semibold">Autonomous Guardrails</span>
                      <span className="block text-[10px] text-emerald-400">Circuit breakers on cloud treasury sweeps</span>
                    </div>
                  </div>

                  <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <span className="text-cyan-400 font-bold">SS7 / Diameter Signaling Isolation:</span>
                      <p className="text-slate-400 text-[11px] font-sans">
                        Out-of-band control plane separated from bearer traffic payload, preventing voice eavesdropping or payload tampering.
                      </p>
                    </div>
                    <div className="sm:text-right shrink-0">
                      <span className="text-white font-semibold">Zero-Data Custody Boundary</span>
                      <span className="block text-[10px] text-emerald-400">Zero customer database access; AST only</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PILLAR 2: SATCOM & RF PHYSICAL GROUNDING */}
          {activePillar === 'satcom' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-amber-400 uppercase tracking-wider flex items-center gap-2">
                    <Radio className="w-4 h-4" />
                    Physical-Layer Reality Check: Space &amp; RF Telecommunications
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                    Orbital Link Budgets
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white">
                  Ground Stations, RF Subsystems, &amp; Thermal Noise Math
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
                  In pure software engineering, packets either arrive or get dropped. In Satellite Communications (SATCOM), every bit traverses 35,786 kilometers of atmosphere, ionospheric scintillation, and thermal noise.
                  System engineers calculate link budgets using the Friis transmission equation, manage Block Upconverters (BUC) and Low-Noise Block downconverters (LNB), and deploy Forward Error Correction (Reed-Solomon, Viterbi, LDPC) to extract signal from below the noise floor.
                  <strong className="text-white"> This imparts a rare, uncompromising physical reality check that software is merely an abstraction over physics and energy.</strong>
                </p>
              </div>

              {/* SATCOM Interactive Link Margin Workbench */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-mono font-bold text-white uppercase flex items-center gap-2">
                    <Wifi className="w-4 h-4 text-amber-400" />
                    <span>RF Frequency Band &amp; Link Margin Simulator</span>
                  </h4>
                  <div className="flex items-center gap-1.5 font-mono text-xs">
                    {(['C', 'Ku', 'Ka'] as const).map((band) => (
                      <button
                        key={band}
                        onClick={() => setSatcomBand(band)}
                        className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                          satcomBand === band
                            ? 'bg-amber-400 text-slate-950 font-bold'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {band}-Band
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                    <span className="text-slate-400 text-[10px] block">Carrier Frequency:</span>
                    <span className="text-white font-bold text-xs mt-1 block">
                      {satcomSpecs[satcomBand].freq}
                    </span>
                    <span className="text-[10px] text-slate-400">Atmospheric window</span>
                  </div>

                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                    <span className="text-slate-400 text-[10px] block">Atmospheric / Rain Fade:</span>
                    <span className="text-amber-400 font-bold text-xs mt-1 block">
                      {satcomSpecs[satcomBand].rainFade}
                    </span>
                    <span className="text-[10px] text-slate-400">Hydrometeor attenuation</span>
                  </div>

                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                    <span className="text-slate-400 text-[10px] block">Ground Antenna Aperture:</span>
                    <span className="text-cyan-400 font-bold text-xs mt-1 block">
                      {satcomSpecs[satcomBand].antennaSize}
                    </span>
                    <span className="text-[10px] text-slate-400">Parabolic G/T gain</span>
                  </div>

                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                    <span className="text-slate-400 text-[10px] block">Link Operating Margin:</span>
                    <span className="text-emerald-400 font-bold text-xs mt-1 block">
                      {satcomSpecs[satcomBand].linkMargin}
                    </span>
                    <span className="text-[10px] text-slate-400">Above Eb/N0 threshold</span>
                  </div>
                </div>
              </div>

              {/* Systems Engineering Principles */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-950/80 border border-amber-700/60 flex items-center justify-center text-amber-400">
                    <Activity className="w-4 h-4" />
                  </div>
                  <h5 className="font-mono font-bold text-xs text-white">Eb/N0 &amp; Noise Temperature</h5>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                    Every operational subsystem has an intrinsic thermal noise floor. If signal-to-noise is insufficient, bit error rate (BER) cascades. In SecureBase, noise is eliminated by parsing ASTs before telemetry.
                  </p>
                </div>

                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-700/60 flex items-center justify-center text-cyan-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <h5 className="font-mono font-bold text-xs text-white">Forward Error Correction (FEC)</h5>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                    Mathematical parity bits (LDPC &amp; Reed-Solomon) allow flawless message reconstruction without retransmissions over high-latency links. Similar to deterministic SHA-256 evidence digests in WORM vaults.
                  </p>
                </div>

                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-700/60 flex items-center justify-center text-emerald-400">
                    <Globe className="w-4 h-4" />
                  </div>
                  <h5 className="font-mono font-bold text-xs text-white">Orbital Delay &amp; Asynchrony</h5>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                    At 240ms round-trip latency to geostationary orbit, synchronous request-response loops fail. Real systems require decoupled, asynchronous, idempotent message processing.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* PILLAR 3: ENTERPRISE CLOUD & SHIFT-LEFT */}
          {activePillar === 'cloud' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    Modern Enterprise Cloud Native Governance
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                    Tri-Cloud Sovereign Architecture
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white">
                  Bridging Telecom Rigor into AWS, GCP, and Azure Control Planes
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
                  The convergence point of this career foundation is translating carrier-grade isolation, zero trust, and fault-containment into modern cloud architectures.
                  Instead of static credentials, SecureBase enforces cryptographic token exchange via Google Cloud Workload Identity Federation (WIF) and AWS STS short-lived roles (TTL &le; 3,600s).
                  Instead of inspecting runtime customer databases, our OPA/Rego and TypeScript AST engines evaluate infrastructure-as-code (Terraform / OpenTofu) pre-flight in pull requests.
                </p>
              </div>

              {/* The 4 Enterprise Pillars Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-cyan-400">
                    <Key className="w-4 h-4" />
                    <span className="font-bold">Keyless OIDC &amp; Workload Identity Federation</span>
                  </div>
                  <p className="text-slate-400 text-[11px] font-sans">
                    Eliminates all permanent IAM credentials and service account JSON keys. Uses cryptographic identity claims exchanged for 1,800-second ephemeral tokens.
                  </p>
                  <div className="p-2 bg-slate-900 rounded border border-slate-800 text-[10px] text-slate-300">
                    <code>sts:AssumeRoleWithWebIdentity (AWS) &amp; google.subject (GCP WIF)</code>
                  </div>
                </div>

                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <ShieldCheck className="w-4 h-4" />
                    <span className="font-bold">Zero-Data Custody Invariant</span>
                  </div>
                  <p className="text-slate-400 text-[11px] font-sans">
                    Zero customer database payloads, PII, PHI, or transaction ledgers ever traverse SecureBase compute. We inspect only read-only infrastructure control metadata.
                  </p>
                  <div className="p-2 bg-slate-900 rounded border border-slate-800 text-[10px] text-slate-300">
                    <code>Enforced via IAM ReadOnlyAccess &amp; SecurityAudit baseline policies</code>
                  </div>
                </div>

                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-amber-400">
                    <Layers className="w-4 h-4" />
                    <span className="font-bold">Continuous Multi-Framework Alignment</span>
                  </div>
                  <p className="text-slate-400 text-[11px] font-sans">
                    Simultaneous evaluation across FFIEC AIO Booklet &sect;II.C (CAT sunset replacement), FedRAMP High Rev. 5, HIPAA 45 CFR &sect;164.312, and SOC 2 Type II.
                  </p>
                  <div className="p-2 bg-slate-900 rounded border border-slate-800 text-[10px] text-slate-300">
                    <code>AST parsing evaluates 100% of controls before git merge</code>
                  </div>
                </div>

                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-purple-400">
                    <Anchor className="w-4 h-4" />
                    <span className="font-bold">Immutable WORM Cryptographic Vaulting</span>
                  </div>
                  <p className="text-slate-400 text-[11px] font-sans">
                    Customer-owned S3 Object Lock and GCS Bucket Lock in strict COMPLIANCE mode for 2,555 days (7-year statutory retention), signed with deterministic SHA-256.
                  </p>
                  <div className="p-2 bg-slate-900 rounded border border-slate-800 text-[10px] text-slate-300">
                    <code>Undeletable by root credentials | Meets FDIC / OCC standards</code>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PILLAR 4: DC MICROGRIDS & AUTONOMOUS RESILIENCE */}
          {activePillar === 'resilience' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-purple-400 uppercase tracking-wider flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Physical Autonomy: DC Microgrids &amp; Hard Constraints
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                    Off-Grid Engineering
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white">
                  Power Budgets, Battery Chemistries, &amp; Cold-Start Resiliency
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
                  The systems engineering discipline extends outside the datacenter into off-grid DC microgrids, LiFePO4 battery chemistry, solar MPPT charge controllers, and thermal dissipation models.
                  When grid power collapses, software assumptions vanish. The system must cold-start from stored chemical energy, manage finite watt-hour budgets, and prioritize critical control planes over non-essential telemetry.
                  <strong className="text-white"> This proves out systems engineering under immutable physical boundary conditions.</strong>
                </p>
              </div>

              {/* Interactive DC Microgrid Simulator */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-mono font-bold text-white uppercase flex items-center gap-2">
                    <BatteryCharging className="w-4 h-4 text-purple-400" />
                    <span>Autonomous DC Microgrid Energy Simulator</span>
                  </h4>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                    isNetPositive ? 'bg-emerald-950 text-emerald-400 border border-emerald-700' : 'bg-rose-950 text-rose-400 border border-rose-700'
                  }`}>
                    {isNetPositive ? 'NET POSITIVE (Self-Sustaining)' : 'DEFICIT (Depleting Storage)'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                    <div className="flex items-center justify-between text-slate-400 text-[11px]">
                      <span>Solar Array Capacity:</span>
                      <span className="text-amber-400 font-bold">{solarWattage} W</span>
                    </div>
                    <input
                      type="range"
                      min="1000"
                      max="6000"
                      step="200"
                      value={solarWattage}
                      onChange={(e) => setSolarWattage(Number(e.target.value))}
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                    <span className="text-[10px] text-slate-400 block">Daily Gen: ~{dailyGenKwh} kWh/day</span>
                  </div>

                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                    <div className="flex items-center justify-between text-slate-400 text-[11px]">
                      <span>LiFePO4 Storage:</span>
                      <span className="text-purple-400 font-bold">{batteryKwh} kWh</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="30"
                      step="1"
                      value={batteryKwh}
                      onChange={(e) => setBatteryKwh(Number(e.target.value))}
                      className="w-full accent-purple-400 cursor-pointer"
                    />
                    <span className="text-[10px] text-slate-400 block">Usable Depth: 85% DoD</span>
                  </div>

                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                    <div className="flex items-center justify-between text-slate-400 text-[11px]">
                      <span>Continuous Load:</span>
                      <span className="text-cyan-400 font-bold">{systemLoadW} W</span>
                    </div>
                    <input
                      type="range"
                      min="150"
                      max="1200"
                      step="50"
                      value={systemLoadW}
                      onChange={(e) => setSystemLoadW(Number(e.target.value))}
                      className="w-full accent-cyan-400 cursor-pointer"
                    />
                    <span className="text-[10px] text-slate-400 block">Daily Need: ~{dailyConsumptionKwh} kWh/day</span>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-950 border border-purple-900/40 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <Sun className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-slate-300">
                      Total Autonomous Runtime (Zero Solar Input): <strong className="text-white">{autonomyHours} hours ({autonomyDays} days)</strong>
                    </span>
                  </div>
                  <div className="text-[11px] text-purple-300">
                    Black-start sequencing enabled | Hard physical resilience
                  </div>
                </div>
              </div>

              {/* Physical Hard Constraints Summary */}
              <div className="border border-slate-800 rounded-xl p-4 bg-slate-950/80 space-y-2 font-mono text-xs">
                <span className="text-slate-400 uppercase text-[10px] block">Unifying Operational Law:</span>
                <p className="text-slate-200 text-xs font-sans leading-relaxed">
                  Whether managing an orbital satellite downlink, a 100-gigabit AT&amp;T optical transport node, an off-grid solar microgrid, or an institutional banking cloud infrastructure, the foundational engineering imperative is identical:
                  <strong className="text-white block mt-1">
                    Systems must fail closed, decouple state from transport, preserve deterministic audit trails, and survive unassisted under hard physical limits.
                  </strong>
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/90 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>TxImhotep LLC &middot; Cedrick Byrd &middot; Lead DevSecOps &amp; Enterprise Cloud Architect</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              Close Briefing
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
