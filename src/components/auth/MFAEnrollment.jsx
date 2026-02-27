import { QRCodeSVG } from 'qrcode.react';

// ... inside your MFAEnrollment component ...

{step === 'scan' && (
  <div className="flex flex-col items-center space-y-6">
    <div className="text-center">
      <p className="text-sm font-medium text-slate-600 mb-2">Scan with Authy</p>
      <div className="p-4 bg-white rounded-2xl border shadow-sm inline-block">
        <QRCodeSVG 
          value={enrollData.totp.qr_code} 
          size={180}
          level="H" // High error correction makes it easier for cameras to scan
          includeMargin={true}
        />
      </div>
    </div>

    <div className="w-full bg-slate-50 p-4 rounded-xl border border-dashed border-slate-300">
      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Manual Entry Key</p>
      <code className="text-xs break-all text-blue-600 font-mono select-all">
        {enrollData.totp.secret}
      </code>
    </div>

    <button 
      onClick={() => setStep('verify')} 
      className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
    >
      I've Scanned It <ArrowRight className="w-4 h-4" />
    </button>
  </div>
)}
