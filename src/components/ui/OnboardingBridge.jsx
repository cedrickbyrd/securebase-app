import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Copy, ExternalLink, CheckCircle2, ArrowRight } from 'lucide-react';

const OnboardingBridge = () => {
  const [step, setStep] = useState(1);
  const cloudFormationLink = "https://console.aws.amazon.com/cloudformation/home...";

  const steps = [
    { title: "Review Policy", desc: "Audit-only, least-privilege access." },
    { title: "Deploy Stack", desc: "Launch the 60-second AWS template." },
    { title: "Confirm Trust", desc: "SecureBase verifies the handshake." }
  ];

  return (
    <div className="w-full max-w-md bg-slate-900 border-2 border-emerald-500/30 rounded-3xl p-6 mt-6 shadow-[0_0_50px_rgba(16,185,129,0.1)] relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 blur-[100px] rounded-full" />
      
      <div className="relative z-10">
        <h3 className="text-white text-lg font-bold mb-1">Activate Live Compliance</h3>
        <p className="text-slate-400 text-xs mb-6">Connect your AWS environment in under 60 seconds.</p>

        {/* Step Indicator */}
        <div className="flex justify-between mb-8">
          {steps.map((s, i) => (
            <div key={i} className="flex flex-col items-center gap-2 w-full">
              <div className={`h-1 w-full rounded-full transition-colors duration-500 ${step > i ? 'bg-emerald-500' : 'bg-slate-800'}`} />
              <span className={`text-[9px] font-bold uppercase tracking-wider ${step === i + 1 ? 'text-emerald-400' : 'text-slate-600'}`}>
                Step 0{i + 1}
              </span>
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="bg-black/40 rounded-xl p-4 border border-slate-800 font-mono text-[10px] text-emerald-400/80">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-slate-500">// securebase-readonly-policy.json</span>
                  <Copy className="w-3 h-3 cursor-pointer hover:text-white" />
                </div>
                <p>"Effect": "Allow",</p>
                <p>"Action": ["s3:Get*", "iam:GenerateCredentialReport"],</p>
                <p>"Resource": "*"</p>
              </div>
              <button 
                onClick={() => setStep(2)}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                Verify Permissions <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="text-center py-4"
            >
              <div className="inline-flex p-4 bg-emerald-500/10 rounded-full mb-4">
                <Terminal className="w-8 h-8 text-emerald-500" />
              </div>
              <p className="text-slate-200 text-sm font-medium mb-4">Launch our validated CloudFormation Stack</p>
              <a 
                href={cloudFormationLink} target="_blank" rel="noreferrer"
                onClick={() => setTimeout(() => setStep(3), 2000)}
                className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 text-xs font-bold underline underline-offset-4"
              >
                Open AWS Console <ExternalLink className="w-3 h-3" />
              </a>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="text-center py-6"
            >
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
              <h4 className="text-white font-bold mb-2">Handshake Successful!</h4>
              <p className="text-slate-400 text-xs mb-6">SecureBase is now vaulting evidence to your S3 bucket.</p>
              <button 
                className="w-full py-3 bg-white text-black text-xs font-black uppercase tracking-widest rounded-xl hover:bg-slate-200"
                onClick={() => window.location.href = 'https://tximhotep.com'}
              >
                Claim My Pilot Spot
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default OnboardingBridge;
