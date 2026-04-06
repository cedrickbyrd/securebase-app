import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { demoAwareApiService } from '../services/demoApiService';
import { isDemoMode } from '../utils/demoData';
import { trackPageView, trackPageEngagement, incrementPagesViewed, trackCTAClick, trackWave3HighValueAction } from '../utils/analytics';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { usePersonalization } from '../hooks/usePersonalization';
import LeadCaptureForm from './LeadCaptureForm';
import SocialProof from './SocialProof';

const TEXAS_FINTECH_TIERS = new Set(['fintech_pro', 'fintech_elite']);

function getCustomerTier() {
  return localStorage.getItem('customerTier') || '';
}

export default function Compliance() {
  const navigate = useNavigate();
  const personalization = usePersonalization();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [complianceData, setComplianceData] = useState(null);
  const [findings, setFindings] = useState([]);
  const [texasData, setTexasData] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const startTimeRef = useRef(null);
  const reportRef = useRef(null);

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

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">SOC 2 Compliance</h1>
        <p className="text-gray-600">Trust Service Criteria Status</p>
      </div>

      {/* PDF Download Button - Outside of captured area */}
      <div className="mb-6">
        <button
          onClick={handleDownloadReport}
          disabled={downloading}
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
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

        {/* Compliance Assessment CTA */}
        <div style={{
          marginTop: '2rem',
          background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
          border: '1px solid #bbf7d0',
          borderRadius: '0.75rem',
          padding: '1.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
        }}>
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ flex: '1 1 260px' }}>
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.15rem', fontWeight: 700, color: '#065f46' }}>
                🔍 How audit-ready is your infrastructure?
              </h3>
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: '#047857' }}>
                Answer 5 questions and get your personalised compliance readiness score — plus a prioritised remediation roadmap.
              </p>
              <SocialProof context="compliance" />
            </div>
            <div style={{ width: '100%', maxWidth: '320px', flexShrink: 0 }}>
              <p style={{ margin: '0 0 0.5rem', fontWeight: 600, fontSize: '0.875rem', color: '#065f46' }}>
                Get your free audit readiness score:
              </p>
              <LeadCaptureForm
                trigger="assessment"
                onSuccess={() => {
                  trackCTAClick('compliance_assessment', 'compliance_page');
                  if (personalization.isWave3) trackWave3HighValueAction('assessment_lead_captured');
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
