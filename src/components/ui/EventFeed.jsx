import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const MOCK_EVENTS = [
  { id: 1, type: 'IAM', msg: 'Verified Bridge Role Trust Relationship', status: 'success' },
  { id: 2, type: 'S3', msg: 'Encryption check: "customer-vault-prod" - PASS', status: 'success' },
  { id: 3, type: 'KMS', msg: 'Cryptographic signature generated for Artifact #882', status: 'info' },
  { id: 4, type: 'VPC', msg: 'Security Group "Inbound-Fintech" scan complete', status: 'success' },
  { id: 5, type: 'SES', msg: 'Onboarding Blueprint delivered to pilot@client.com', status: 'info' },
];

const EventFeed = () => {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    // Simulate live ingestion by adding events one by one
    let i = 0;
    const interval = setInterval(() => {
      if (i < MOCK_EVENTS.length) {
        setEvents((prev) => [MOCK_EVENTS[i], ...prev].slice(0, 5));
        i++;
      } else {
        clearInterval(interval);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full max-w-md bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-800 p-4 mt-4 shadow-xl">
      <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-2">
        <h3 className="text-slate-400 text-xs font-bold uppercase tracking-tighter">Live Monitor Stream</h3>
        <span className="text-[10px] font-mono text-emerald-500 animate-pulse">● CONNECTED</span>
      </div>

      <div className="space-y-3 h-64 overflow-hidden relative">
        <AnimatePresence initial={false}>
          {events.map((event) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/40 border border-slate-700/50"
            >
              <div className={`mt-1 h-2 w-2 rounded-full ${event.status === 'success' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
              <div className="flex-1">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-500 font-mono uppercase">{event.type}</span>
                  <span className="text-[9px] text-slate-600">JUST NOW</span>
                </div>
                <p className="text-xs text-slate-200 mt-1 font-medium">{event.msg}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {/* Fading effect at the bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-slate-900/90 to-transparent pointer-events-none" />
      </div>
    </div>
  );
};

export default EventFeed;
