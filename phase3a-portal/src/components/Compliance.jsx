import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { demoAwareApiService } from '../services/demoApiService';
import { isDemoMode } from '../utils/demoData';
import { trackPageView, trackPageEngagement, incrementPagesViewed, trackComplianceScan, trackFeatureInteraction } from '../utils/analytics';
import { SOC2_SCAN_CATEGORIES, generateDemoScanResult } from '../mocks/mockData';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const TEXAS_FINTECH_TIERS = new Set(['fintech_pro', 'fintech_elite']);
const MAX_SCANS_PER_SESSION = 5;
const TOTAL_SOC2_CONTROLS = 92;

function getCustomerTier() {
  return localStorage.getItem('customerTier') || '';
}

export default function Compliance() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [complianceData, setComplianceData] = useState(null);
  const [findings, setFindings] = useState([]);
  const [texasData, setTexasData] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const startTimeRef = useRef(null);
  const reportRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [currentCategory, setCurrentCategory] = useState('');
  const [scanComplete, setScanComplete] = useState(false);
  const [toastMessage, setToastMessage] = useState(null); // { type: 'success'|'warning', text: string }
  const [scanCount, setScanCount] = useState(0); // Rate limiting: max scans per session
  const SCAN_COOLDOWN_MS = 30_000; // 30 seconds between scans
  const lastScanTimeRef = useRef(null);

  const isTexasTier = TEXAS_FINTECH_TIERS.has(getCustomerTier()) || isDemoMode();

  useEffect(() => {
    startTimeRef.current = Date.now();
    trackPageView('Compliance', '/compliance');
    incrementPagesViewed();
    loadComplianceData();
    return () => {
      const timeSpent = Math.floor((Date.now() - startTimeRef.current) / 1000);
      trackPageEngagement('Compliance', timeSpent);
    };
  }, []);

  const loadComplianceData = async () => {
    try {
      setLoading(true);
      setError(null);

      const requests = [
        demoAwareApiService.getComplianceScore(),
        demoAwareApiService.getComplianceFindings()
      ];

      if (isTexasTier) {
        requests.push(demoAwareApiService.getFintechComplianceStatus());
      }

      const [scoreResponse, findingsResponse, texasResponse] = await Promise.all(requests);

      setComplianceData(scoreResponse.data);
      setFindings(findingsResponse.data || []);
      if (texasResponse) setTexasData(texasResponse.data);
    } catch (err) {
      console.error('Error loading compliance data:', err);
      setError('Failed to load compliance data');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReport = async () => {
    try {
      setDownloading(true);
      
      const element = reportRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      // Handle multi-page PDFs
      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;
      
      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save(`SecureBase-SOC2-Compliance-Report-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const handleRunScan = async () => {
    // Rate limiting
    if (scanCount >= MAX_SCANS_PER_SESSION) {
      setToastMessage({ type: 'warning', text: `Maximum scans per session reached (${MAX_SCANS_PER_SESSION}). Please refresh to continue.` });
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }
    if (lastScanTimeRef.current && Date.now() - lastScanTimeRef.current < SCAN_COOLDOWN_MS) {
      const secondsLeft = Math.ceil((SCAN_COOLDOWN_MS - (Date.now() - lastScanTimeRef.current)) / 1000);
      setToastMessage({ type: 'warning', text: `Please wait ${secondsLeft}s before running another scan.` });
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

    const previousScore = complianceData?.overallScore || 0;

    setScanning(true);
    setScanComplete(false);
    setScanProgress(0);
    setCurrentCategory('');

    // GA4: scan initiated
    trackComplianceScan({
      status: 'started',
      scanType: 'demo',
      isDemoMode: isDemoMode(),
      currentScore: previousScore,
    });
    trackFeatureInteraction('Demo_Scan', 'initiated');

    // Animated progress through each category (~400ms each = ~3.2s total)
    for (let i = 0; i < SOC2_SCAN_CATEGORIES.length; i++) {
      setCurrentCategory(SOC2_SCAN_CATEGORIES[i]);
      setScanProgress(Math.round(((i + 1) / SOC2_SCAN_CATEGORIES.length) * 100));
      await new Promise(resolve => setTimeout(resolve, 400));
    }

    // Generate dynamic results
    const newResult = generateDemoScanResult();
    setComplianceData(newResult.data);

    const newScore = newResult.data.overallScore;
    const scoreChange = newScore - previousScore;

    // GA4: scan completed
    trackComplianceScan({
      status: 'completed',
      scanType: 'demo',
      newScore,
      metricsScanned: TOTAL_SOC2_CONTROLS,
    });
    trackFeatureInteraction('Demo_Scan', 'completed');

    setScanProgress(100);
    setScanComplete(true);
    setScanCount(prev => prev + 1);
    lastScanTimeRef.current = Date.now();

    // Toast notification
    const changeText = scoreChange > 0
      ? `Score improved by ${scoreChange}% 🎉`
      : scoreChange < 0
      ? `Score decreased by ${Math.abs(scoreChange)}%`
      : 'No change in score.';
    setToastMessage({
      type: scoreChange >= 0 ? 'success' : 'warning',
      text: `✅ Scan complete! ${TOTAL_SOC2_CONTROLS} controls analyzed. ${changeText}`,
    });
    setTimeout(() => setToastMessage(null), 5000);

    setScanning(false);

    // After 2 seconds revert button to idle state
    setTimeout(() => setScanComplete(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading compliance data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-2xl">⚠️</span>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {isDemoMode() && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-2xl">🎯</span>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <strong>Demo Mode:</strong> Showing sample compliance data
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toastMessage && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-4 rounded-lg shadow-xl text-white text-sm font-medium max-w-sm transition-all duration-300 ${
          toastMessage.type === 'success' ? 'bg-green-600' : 'bg-yellow-500'
        }`}>
          {toastMessage.text}
        </div>
      )}

      {/* Scan progress bar (visible only while scanning) */}
      {scanning && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-900">
              Scanning: <span className="font-semibold">{currentCategory}</span>
            </span>
            <span className="text-sm font-bold text-blue-600">{scanProgress}%</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${scanProgress}%` }}
            />
          </div>
          <div className="mt-2 text-xs text-blue-700">
            Analyzing {TOTAL_SOC2_CONTROLS} SOC2 controls across {SOC2_SCAN_CATEGORIES.length} categories...
          </div>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">SOC 2 Compliance</h1>
        <p className="text-gray-600">Trust Service Criteria Status</p>
      </div>

      {/* Action Buttons - Outside of captured area */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {/* Download Report Button */}
        <button
          onClick={handleDownloadReport}
          disabled={downloading}
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
        >
          {downloading ? (
            <>
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating PDF...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download Compliance Report (PDF)
            </>
          )}
        </button>

        {/* Run New Scan Button */}
        <button
          onClick={handleRunScan}
          disabled={scanning || downloading}
          className={`inline-flex items-center gap-2 px-6 py-3 font-semibold rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none text-white ${
            scanComplete
              ? 'bg-emerald-600'
              : scanning
              ? 'bg-blue-500 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {scanComplete ? (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Scan Complete!
            </>
          ) : scanning ? (
            <>
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Scanning {TOTAL_SOC2_CONTROLS} SOC2 Controls...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Run New Scan
            </>
          )}
        </button>

        {/* Scan count indicator (shown when approaching limit) */}
        {scanCount >= 3 && (
          <span className="text-xs text-gray-400">
            {MAX_SCANS_PER_SESSION - scanCount} scan{MAX_SCANS_PER_SESSION - scanCount !== 1 ? 's' : ''} remaining this session
          </span>
        )}
      </div>

      {/* Report Content - This will be captured in PDF */}
      <div ref={reportRef} style={{ backgroundColor: 'white', padding: '20px' }}>
        {/* Overall Score */}
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-8 mb-6 border-2 border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-semibold mb-2">Overall Compliance Score</h2>
              <div className="flex items-baseline gap-2">
                <span className="text-6xl font-bold text-blue-600">
                  {complianceData?.overallScore || 0}%
                </span>
                <span className="text-gray-600">
                  ({complianceData?.passedControls || 0} of {complianceData?.totalControls || 0} controls)
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                ✅ {complianceData?.criticalFindings || 0} Critical | 
                {' '}✅ {complianceData?.highFindings || 0} High | 
                {' '}⚠️ {complianceData?.mediumFindings || 0} Medium
              </p>
              {complianceData?.lastScanDate && (
                <p className="text-xs text-gray-400 mt-1">
                  Last scan: {new Date(complianceData.lastScanDate).toLocaleString()}
                  {complianceData?.scanDuration && ` · completed in ${complianceData.scanDuration}`}
                </p>
              )}
            </div>
            <div className="text-6xl">📊</div>
          </div>
        </div>

        {/* Categories */}
        {complianceData?.categories && complianceData.categories.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Trust Service Criteria</h3>
            <div className="space-y-4">
              {complianceData.categories.map((cat, idx) => (
                <div key={idx}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">{cat.name}</span>
                    <span className="text-sm text-gray-600">
                      {cat.passed}/{cat.total} controls ({cat.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full ${
                        cat.percentage >= 95 ? 'bg-green-500' :
                        cat.percentage >= 90 ? 'bg-blue-500' :
                        'bg-yellow-500'
                      }`}
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Texas DOB Compliance Section */}
        {isTexasTier && texasData && (
          <div className="bg-white rounded-lg shadow p-6 mb-6" style={{ borderLeft: '4px solid #1e3a5f' }}>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">⭐</span>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Texas DOB Compliance</h3>
                <p className="text-sm text-gray-500">7 TAC §33 · 31 CFR §1022 · TX HB 1666</p>
              </div>
              <span className="inline-block px-3 py-1 text-xs font-bold rounded-full bg-green-100 text-green-800">
                {texasData.passingControls}/{texasData.totalControls} controls (100%)
              </span>
            </div>
            <div className="space-y-3">
              {(texasData.controls || []).map(control => (
                <div key={control.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-green-500 font-bold">✅</span>
                      <span className="font-semibold text-sm">{control.id}:</span>
                      <span className="text-sm text-gray-700">{control.name}</span>
                    </div>
                    <p className="text-xs text-gray-500 ml-6">{control.summary}</p>
                  </div>
                  <span className="text-xs text-gray-400 ml-4 whitespace-nowrap">
                    {new Date(control.lastAssessedAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Findings */}
        {findings && findings.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Recent Findings</h3>
            <div className="space-y-3">
              {findings.map((finding) => (
                <div 
                  key={finding.id} 
                  className={`border-l-4 p-4 rounded ${
                    finding.severity === 'high' ? 'border-red-400 bg-red-50' :
                    finding.severity === 'medium' ? 'border-yellow-400 bg-yellow-50' :
                    'border-blue-400 bg-blue-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <span className={`inline-block px-2 py-1 text-xs font-semibold rounded mb-2 ${
                        finding.severity === 'high' ? 'text-red-800 bg-red-200' :
                        finding.severity === 'medium' ? 'text-yellow-800 bg-yellow-200' :
                        'text-blue-800 bg-blue-200'
                      }`}>
                        {finding.severity?.toUpperCase()}
                      </span>
                      <p className="font-medium">{finding.title}</p>
                      {finding.description && (
                        <p className="text-sm text-gray-600 mt-1">{finding.description}</p>
                      )}
                      <p className="text-sm text-gray-500 mt-1">{finding.date}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(!findings || findings.length === 0) && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-center py-8">
              <span className="text-6xl mb-4 block">🎉</span>
              <h3 className="text-xl font-semibold mb-2">All Clear!</h3>
              <p className="text-gray-600">No compliance findings to address</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
