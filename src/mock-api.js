/**
 * Mock API data for SecureBase root app.
 * Provides compliance scores and other demo data for components
 * that need to display real-time-like metrics without a live backend.
 */

// ---------------------------------------------------------------------------
// Compliance summary snapshot
// ---------------------------------------------------------------------------
export const mockComplianceData = {
  overall: 73,
  frameworks: {
    soc2: 75,
    hipaa: 70,
    fedramp: 75,
  },
  lastUpdated: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// 90-day compliance score history (one entry per ~3 days, 30 points)
// ---------------------------------------------------------------------------
function buildDateLabels(count) {
  const labels = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 3);
    labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  }
  return labels;
}

export const complianceScoreHistory = {
  labels: buildDateLabels(30),
  datasets: {
    overall:  [55,56,57,57,58,59,60,61,61,62,63,63,64,65,65,66,67,68,68,69,70,70,71,71,72,72,73,73,73,73],
    soc2:     [58,58,59,60,61,62,63,63,64,65,65,66,67,68,68,69,70,71,71,72,72,73,73,74,74,75,75,75,75,75],
    hipaa:    [52,53,53,54,55,55,56,57,57,58,58,59,60,60,61,62,62,63,63,64,65,65,66,67,67,68,69,69,70,70],
    fedramp:  [60,60,61,62,62,63,64,64,65,65,66,67,67,68,68,69,70,70,71,71,72,72,73,73,74,74,74,75,75,75],
  },
};

// ---------------------------------------------------------------------------
// Mock compliance controls
// ---------------------------------------------------------------------------
export const mockControls = [
  { id: 'CC6.1',  framework: 'SOC 2',   title: 'Logical and Physical Access Controls',  status: 'passing', severity: 'critical', evidence: 'IAM policies reviewed 2025-03-01.', remediation: 'No action required.' },
  { id: 'CC6.2',  framework: 'SOC 2',   title: 'New User Registration & Authorization', status: 'passing', severity: 'high',     evidence: 'SSO enforced via IAM Identity Center.', remediation: 'No action required.' },
  { id: 'CC6.6',  framework: 'SOC 2',   title: 'Logical Access Restrictions',           status: 'failing', severity: 'critical', evidence: 'Unused IAM user detected.',           remediation: 'Disable or remove unused IAM users immediately.' },
  { id: 'CC7.2',  framework: 'SOC 2',   title: 'System Monitoring',                     status: 'passing', severity: 'high',     evidence: 'GuardDuty enabled in all regions.',   remediation: 'No action required.' },
  { id: 'CC8.1',  framework: 'SOC 2',   title: 'Change Management',                     status: 'pending', severity: 'medium',   evidence: 'Change log review in progress.',      remediation: 'Complete change log audit by end of quarter.' },
  { id: 'CC9.2',  framework: 'SOC 2',   title: 'Risk Mitigation',                       status: 'passing', severity: 'medium',   evidence: 'Risk register updated 2025-02-15.',   remediation: 'No action required.' },
  { id: 'CC3.2',  framework: 'SOC 2',   title: 'Risk Assessment',                       status: 'failing', severity: 'high',     evidence: 'Annual risk assessment overdue.',     remediation: 'Schedule risk assessment workshop within 30 days.' },
  { id: 'CC2.2',  framework: 'SOC 2',   title: 'Internal Communication',                status: 'pending', severity: 'low',      evidence: 'Policy dissemination tracking open.', remediation: 'Send updated policy to all staff.' },
  { id: '164.312a', framework: 'HIPAA', title: 'Access Control – Unique User IDs',      status: 'passing', severity: 'critical', evidence: 'Unique IDs enforced via SSO.',        remediation: 'No action required.' },
  { id: '164.312b', framework: 'HIPAA', title: 'Audit Controls',                        status: 'passing', severity: 'high',     evidence: 'CloudTrail enabled; 7-year retention.',remediation: 'No action required.' },
  { id: '164.312c', framework: 'HIPAA', title: 'Integrity Controls',                    status: 'failing', severity: 'critical', evidence: 'S3 Object Lock not set on one bucket.', remediation: 'Enable Object Lock on all PHI-adjacent S3 buckets.' },
  { id: '164.312e', framework: 'HIPAA', title: 'Transmission Security',                 status: 'passing', severity: 'high',     evidence: 'TLS 1.3 enforced on all endpoints.',  remediation: 'No action required.' },
  { id: '164.308a', framework: 'HIPAA', title: 'Security Management Process',           status: 'pending', severity: 'medium',   evidence: 'Risk analysis update pending.',       remediation: 'Complete updated risk analysis.' },
  { id: '164.310a', framework: 'HIPAA', title: 'Facility Access Controls',              status: 'passing', severity: 'medium',   evidence: 'AWS GovCloud physical controls active.', remediation: 'No action required.' },
  { id: 'AC-2',   framework: 'FedRAMP', title: 'Account Management',                   status: 'passing', severity: 'critical', evidence: 'AWS Organizations SCPs enforced.',    remediation: 'No action required.' },
  { id: 'AC-6',   framework: 'FedRAMP', title: 'Least Privilege',                      status: 'passing', severity: 'critical', evidence: 'IAM permission boundaries applied.',  remediation: 'No action required.' },
  { id: 'AU-2',   framework: 'FedRAMP', title: 'Event Logging',                        status: 'passing', severity: 'high',     evidence: 'CloudTrail + CloudWatch Logs active.', remediation: 'No action required.' },
  { id: 'AU-9',   framework: 'FedRAMP', title: 'Protection of Audit Information',      status: 'failing', severity: 'high',     evidence: 'Log bucket policy allows delete.',    remediation: 'Apply deny-delete SCP to audit log buckets.' },
  { id: 'CM-6',   framework: 'FedRAMP', title: 'Configuration Settings',               status: 'pending', severity: 'medium',   evidence: 'AWS Config rule review pending.',     remediation: 'Run AWS Config conformance pack assessment.' },
  { id: 'IA-5',   framework: 'FedRAMP', title: 'Authenticator Management',             status: 'passing', severity: 'high',     evidence: 'MFA enforced for all console access.', remediation: 'No action required.' },
];

// ---------------------------------------------------------------------------
// Mock API object – simulates async backend calls
// ---------------------------------------------------------------------------
const LAST_SCAN = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
const NEXT_SCAN = new Date(Date.now() + 22 * 60 * 60 * 1000); // in 22 hours

export const mockAPI = {
  async getComplianceSummary() {
    await new Promise((r) => setTimeout(r, 600)); // simulate network latency
    return {
      overall: { score: 73, trend: '+6% vs 90 days', passing: 314, failing: 19, pending: 110 },
      soc2:    { score: 75, trend: '+5%', passing: 45, failing: 3, pending: 16 },
      hipaa:   { score: 70, trend: '+4%', passing: 38, failing: 3, pending: 13 },
      fedramp: { score: 75, trend: '+8%', passing: 231, failing: 13, pending: 81 },
      lastScan: {
        timestamp: LAST_SCAN.toISOString(),
        duration: '4m 32s',
      },
      nextScan: NEXT_SCAN.toISOString(),
    };
  },

  async runFullScan() {
    await new Promise((r) => setTimeout(r, 800));
    return { success: true, message: 'Scan queued successfully.' };
  },

  async generatePDFReport() {
    await new Promise((r) => setTimeout(r, 500));
    return { success: true, message: 'PDF report generation started.' };
  },

  async exportCSV() {
    await new Promise((r) => setTimeout(r, 300));
    return { success: true, message: 'CSV export ready.' };
  },
};

export default mockComplianceData;
