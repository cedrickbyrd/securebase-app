import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, FileJson, Lock, Download } from 'lucide-react'; // Assuming lucide-react is in your stack

const ARTIFACTS = [
  { id: 'sb-882', name: 'iam-trust-policy.json', size: '4.2kb', date: 'Feb 23, 2026' },
  { id: 'sb-883', name: 's3-encryption-state.json', size: '12.8kb', date: 'Feb 23, 2026' },
  { id: 'sb-884', name: 'kms-rotation-audit.pdf', size: '142kb', date: 'Feb 22, 2026' },
];

const ArtifactVault = () => {
  return (
    <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-emerald-500/20 p-5 mt-4 shadow-[0_0_30px_rgba(16,185,129,0.05)]">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-emerald-500/10 rounded-lg">
          <ShieldCheck className="w-5 h-5 text-emerald-500" />
        </div>
        <div>
          <h3 className="text-white text-sm font-bold">Encrypted Evidence Vault</h3>
          <p className="text-[10px] text-slate-500 font-mono">Bucket: securebase-audit-log-prod</p>
        </div>
      </div>

      <div className="space-y-2">
        {ARTIFACTS.map((file, index) => (
          <motion.div
            key={file.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.02 }}
            className="group flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-emerald-500/30 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-700/30 rounded-md group-hover:bg-emerald-500/10 transition-colors">
                <FileJson className="w-4 h-4 text-slate-400 group-hover:text-emerald-400" />
              </div>
              <div>
                <div className="text-xs font-medium text-slate-200">{file.name}</div>
                <div className="text-[9px] text-slate-500 flex items-center gap-2">
                  <span>{file.date}</span>
                  <span className="flex items-center gap-1 text-emerald-500/70">
                    <Lock className="w-2 h-2" /> Signed (KMS)
                  </span>
                </div>
              </div>
            </div>
            <Download className="w-4 h-4 text-slate-600 group-hover:text-emerald-400" />
          </motion.div>
        ))}
      </div>

      <button className="w-full mt-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all border border-slate-700">
        View All 1,242 Artifacts
      </button>
    </div>
  );
};

export default ArtifactVault;
