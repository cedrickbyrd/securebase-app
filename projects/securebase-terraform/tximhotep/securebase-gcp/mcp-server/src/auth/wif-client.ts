import { GoogleAuth, ExternalAccountClient } from 'google-auth-library';

export function getWifAuthClient(projectId: string, projectNumber: string) {
  // Uses AWS STS credentials from the environment automatically
  const audience = `//iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/securebase-aws-pool/providers/aws-control-plane-provider`;
  const serviceAccountEmail = `securebase-telemetry-agent@${projectId}.iam.gserviceaccount.com`;

  return ExternalAccountClient.fromJSON({
    type: 'external_account',
    audience: audience,
    subject_token_type: 'urn:ietf:params:aws:token-type:aws4_request',
    token_url: 'https://sts.googleapis.com/v1/token',
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccountEmail}:generateAccessToken`,
    credential_source: {
      environment_id: 'aws1',
      region_url: 'http://169.254.169.254/latest/meta-data/placement/region',
      url: 'http://169.254.169.254/latest/meta-data/iam/security-credentials',
      regional_cred_verification_url: 'https://sts.{region}.amazonaws.com?Action=GetCallerIdentity&Version=2011-06-15',
    },
  });
}
