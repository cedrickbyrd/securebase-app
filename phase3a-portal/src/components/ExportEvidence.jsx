import React, { useState } from 'react';
import { Download, CheckCircle2 } from 'lucide-react';

export default function ExportEvidence() {
  const [isExporting, setIsExporting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleExport = () => {
    setIsExporting(true);
    
    // Demo: simulate export delay
    setTimeout(() => {
      setIsExporting(false);
      setShowSuccess(true);
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        setShowSuccess(false);
      }, 3000);
    }, 2000);
  };

  return (
    <div className="bg-white rounded-lg border-2 border-dashed border-blue-400 p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            Audit-Ready Evidence
          </h3>
          <p className="text-sm text-gray-600">
            Export all evidence with timestamps, mapped to SOC 2 controls
          </p>
        </div>

        <button
          onClick={handleExport}
          disabled={isExporting}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5 whitespace-nowrap"
        >
          {isExporting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Generating Report...</span>
            </>
          ) : (
            <>
              <Download className="w-5 h-5" />
              <span>Export Evidence for Audit</span>
            </>
          )}
        </button>
      </div>

      {/* Success Message */}
      {showSuccess && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-900">
              Evidence report generated successfully!
            </p>
            <p className="text-xs text-green-700 mt-1">
              (In production, this will download a timestamped PDF)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}