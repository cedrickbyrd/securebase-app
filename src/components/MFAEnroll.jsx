import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function MFAEnroll() {
  const [factorId, setFactorId] = useState(null);
  const [qrCode, setQrCode] = useState(''); // SVG string
  const [verifyCode, setVerifyCode] = useState('');
  const [status, setStatus] = useState('idle'); // idle, enrolling, verifying, active

  const onEnroll = async () => {
    setStatus('enrolling');
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      issuer: 'SecureBase'
    });

    if (error) {
      alert(error.message);
      setStatus('idle');
      return;
    }

    setFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setStatus('verifying');
  };

  const onVerify = async () => {
    const { data, error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: factorId,
      code: verifyCode
    });

    if (error) {
      alert("Invalid code: " + error.message);
    } else {
      setStatus('active');
      alert("MFA is now enabled!");
    }
  };

  return (
    <div className="p-4 border rounded-lg shadow-sm">
      <h2 className="text-xl font-bold">SecureBase Multi-Factor Auth</h2>
      
      {status === 'idle' && (
        <button onClick={onEnroll} className="bg-blue-600 text-white px-4 py-2 rounded">
          Enable MFA
        </button>
      )}

      {status === 'verifying' && (
        <div className="flex flex-col gap-4">
          <p>Scan this QR code with your Authenticator app:</p>
          <div dangerouslySetInnerHTML={{ __html: qrCode }} className="w-48 h-48" />
          <input 
            type="text" 
            placeholder="000000"
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value)}
            className="border p-2 rounded"
          />
          <button onClick={onVerify} className="bg-green-600 text-white px-4 py-2 rounded">
            Verify Code
          </button>
        </div>
      )}

      {status === 'active' && (
        <p className="text-green-600 font-bold">✓ Multi-Factor Authentication is Active</p>
      )}
    </div>
  );
}
