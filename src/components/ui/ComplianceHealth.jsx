import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const ComplianceHealth = ({ targetScore = 94 }) => {
  const [score, setScore] = useState(0);
  const strokeDasharray = 283; // Circumference for a 45 radius circle
  const percentage = (score / 100) * strokeDasharray;

  useEffect(() => {
    // Animate score on mount
    const timeout = setTimeout(() => setScore(targetScore), 500);
    return () => clearTimeout(timeout);
  }, [targetScore]);

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl">
      <div className="relative w-48 h-48">
        {/* Background Track */}
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="96" cy="96" r="45"
            fill="transparent"
            stroke="currentColor"
            strokeWidth="8"
            className="text-slate-800"
          />
          {/* Animated Progress Gauge */}
          <motion.circle
            cx="96" cy="96" r="45"
            fill="transparent"
            stroke="currentColor"
            strokeWidth="8"
            strokeDasharray={strokeDasharray}
            initial={{ strokeDashoffset: strokeDasharray }}
            animate={{ strokeDashoffset: strokeDasharray - percentage }}
            transition={{ duration: 2, ease: "easeOut" }}
            className="text-emerald-500"
            strokeLinecap="round"
          />
        </svg>
        
        {/* Center Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span 
            className="text-5xl font-bold text-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {score}%
          </motion.span>
          <span className="text-slate-400 text-xs uppercase tracking-widest font-semibold">Health Score</span>
        </div>
      </div>

      <div className="mt-6 text-center">
        <p className="text-slate-300 text-sm">
          Framework: <span className="text-emerald-400 font-mono">SOC2-TYPE-II</span>
        </p>
        <div className="flex items-center gap-2 mt-2 text-xs text-emerald-500/80 bg-emerald-500/10 px-3 py-1 rounded-full">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Live Monitoring Active
        </div>
      </div>
    </div>
  );
};

export default ComplianceHealth;
