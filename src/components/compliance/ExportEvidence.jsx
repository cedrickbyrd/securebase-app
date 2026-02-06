import React, { useState } from 'react';

export default function ExportEvidence() {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = () => {
    setIsExporting(true);
    
    setTimeout(() => {
      setIsExporting(false);
      alert('Evidence report generated!\n\n(In production, this downloads a PDF)');
    }, 2000);
  };

  return (
    <div className="sb-ExportEvidence">
      <div className="sb-ExportEvidence__content">
        <div className="sb-ExportEvidence__info">
          <h3>Audit-Ready Evidence</h3>
          <p className="u-text-muted">
            Export all evidence with timestamps, mapped to SOC 2 controls
          </p>
        </div>

        <button 
          className="sb-Button sb-Button--primary sb-Button--large"
          onClick={handleExport}
          disabled={isExporting}
        >
          {isExporting ? 'Generating Report...' : 'Export Evidence for Audit'}
        </button>
      </div>
    </div>
  );
}
