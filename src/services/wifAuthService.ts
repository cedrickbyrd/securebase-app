import { STSClient, AssumeRoleWithWebIdentityCommand } from "@aws-sdk/client-sts";
import { GoogleAuth } from "google-auth-library";

export interface CloudCredentials {
  aws?: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
  };
  gcp?: {
    accessToken: string;
  };
}

export async function getCloudSecurityClient(
  cloudProvider: "aws" | "azure" | "gcp",
  targetScope: { account_or_subscription_or_project_id: string; region?: string }
): Promise<any> {
  const oidcToken = process.env.SECUREBASE_PLATFORM_OIDC_TOKEN;

  if (cloudProvider === "aws") {
    const sts = new STSClient({ region: targetScope.region || "us-east-1" });
    const roleArn = `arn:aws:iam::${targetScope.account_or_subscription_or_project_id}:role/SecureBaseRemediationRole`;

    const command = new AssumeRoleWithWebIdentityCommand({
      RoleArn: roleArn,
      RoleSessionName: `securebase-mcp-${Date.now()}`,
      WebIdentityToken: oidcToken,
      DurationSeconds: 900,
    });

    const response = await sts.send(command);
    return {
      credentials: {
        accessKeyId: response.Credentials?.AccessKeyId!,
        secretAccessKey: response.Credentials?.SecretAccessKey!,
        sessionToken: response.Credentials?.SessionToken!,
      },
      region: targetScope.region || "us-east-1",
    };
  }

  if (cloudProvider === "gcp") {
    const auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
    const client = await auth.getClient();
    return { client, projectId: targetScope.account_or_subscription_or_project_id };
  }

  throw new Error(`Cloud provider ${cloudProvider} not implemented in Sprint 2.`);
}
