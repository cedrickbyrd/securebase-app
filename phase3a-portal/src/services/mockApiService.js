// phase3a-portal/src/services/mockApiService.js

export const mockApiService = {
  getComplianceScore: (tenantId = 'cnb-waxahachie', framework = 'ffiec') => {
    return {
      tenantId,
      score: 92,
      framework,
      evaluatedAt: new Date().toISOString(),
      criticalFindings: 0,
      status: 'COMPLIANT'
    };
  },

  getComplianceFindings: () => {
    return []; // Return safe empty array to prevent map() errors in UI during demo
  },

  getDriftAnalytics: (tenantId = 'cnb-waxahachie') => {
    const today = new Date();
    const history = [];
    const events = [];

    // 1. Generate 90 days of history
    for (let i = 89; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      let score = 92 + Math.random() * 6; // Base stable score
      
      // Simulate score drops on specific drift days
      if (i === 67 || i === 32 || i === 15) {
        score = 82 + Math.random() * 3;
      }
      
      history.push({
        date: date.toISOString(),
        score: parseFloat(score.toFixed(1))
      });
    }

    // 2. Inject rich drift events
    events.push(
      {
        id: 'drift_001',
        detectionTimestamp: new Date(today.getTime() - 67 * 24 * 60 * 60 * 1000).toISOString(),
        resolutionTimestamp: new Date(today.getTime() - 65 * 24 * 60 * 60 * 1000).toISOString(),
        controlId: 'AC-2',
        controlName: 'Account Management',
        controlCategory: 'Access Control',
        framework: 'soc2',
        severity: 'critical',
        status: 'resolved',
        previousState: 'compliant',
        currentState: 'non-compliant',
        rootCause: 'Password policy weakened via Terraform - minimum length reduced from 14 to 8 characters.',
        remediationSteps: [
          'Restore password minimum length to 14 characters in identity provider',
          'Review AWS CloudTrail for policy modification source',
          'Require PR approval for all IAM Terraform changes'
        ],
        assignedTo: 'security-ops@tximhotep.com',
        resolutionNotes: 'Policy restored and shift-left PR gate enforced via SecureBase.',
        sha256Evidence: '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4'
      },
      {
        id: 'drift_002',
        detectionTimestamp: new Date(today.getTime() - 32 * 24 * 60 * 60 * 1000).toISOString(),
        resolutionTimestamp: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        controlId: 'AU-2',
        controlName: 'Audit Events',
        controlCategory: 'Audit and Accountability',
        framework: 'hipaa',
        severity: 'high',
        status: 'resolved',
        previousState: 'compliant',
        currentState: 'non-compliant',
        rootCause: 'S3 bucket lifecycle rule altered, changing audit log retention from 7 years to 30 days.',
        remediationSteps: [
          'Restore S3 lifecycle rule to 2555 days (7 years)',
          'Verify existing audit logs were not pruned',
          'Apply S3 Object Lock (WORM) to compliance log bucket'
        ],
        assignedTo: 'compliance@tximhotep.com',
        resolutionNotes: 'Retention restored. WORM compliance mode enabled.',
        sha256Evidence: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      },
      {
        id: 'drift_003',
        detectionTimestamp: new Date(today.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        resolutionTimestamp: null,
        controlId: 'IA-5',
        controlName: 'Authenticator Management',
        controlCategory: 'Identification and Authentication',
        framework: 'ffiec-cat',
        severity: 'high',
        status: 'in_progress',
        previousState: 'compliant',
        currentState: 'non-compliant',
        rootCause: 'AWS IAM user created with console access but no MFA enforced.',
        remediationSteps: [
          'Enforce MFA requirement on IAM user provisioning',
          'Implement SCP preventing actions without aws:MultiFactorAuthPresent',
          'Run credential report audit across all accounts'
        ],
        assignedTo: 'identity-admin@tximhotep.com',
        resolutionNotes: null,
        sha256Evidence: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2'
      }
    );

    return { history, events };
  }
};
