import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useMFAStatus } from './lib/useMFAStatus';
import Login from './components/Login';
import SecureBaseLandingZone from './SecureBaseLandingZone';
import TrustCenter from './components/TrustCenter'; // [Step 1: Added Import]
import { Loader } from 'lucide-react';

function App() {
  const { aal, isLoading } = useMFAStatus();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader className="animate-spin text-blue-600 w-10 h-10 mx-auto mb-4" />
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">
            Authenticating SecureBase...
          </p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Public Sales View - No Auth Required for Phase 5 Pitching */}
        <Route path="/trust" element={<TrustCenter />} />

        <Route 
          path="/login" 
          element={!aal || aal === 'none' ? <Login /> : <Navigate to="/" />} 
        />
        
        <Route 
          path="/" 
          element={aal && aal !== 'none' ? <SecureBaseLandingZone /> : <Navigate to="/login" />} 
        />

        {/* [Step 2: Moved Wildcard to the BOTTOM] */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
export default App;
