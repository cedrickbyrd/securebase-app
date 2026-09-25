import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getCloudSecurityClient } from "../src/services/wifAuthService.js";

const mockSend = vi.fn();
vi.mock("@aws-sdk/client-sts", () => ({
  STSClient: vi.fn().mockImplementation(() => ({ send: mockSend })),
  AssumeRoleWithWebIdentityCommand: vi.fn().mockImplementation((args) => args),
}));

const mockGetClient = vi.fn();
vi.mock("google-auth-library", () => ({
  GoogleAuth: vi.fn().mockImplementation(() => ({ getClient: mockGetClient })),
}));

describe("wifAuthService", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, SECUREBASE_PLATFORM_OIDC_TOKEN: "mock-jwt-token" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should exchange OIDC JWT for AWS STS credentials", async () => {
    mockSend.mockResolvedValueOnce({
      Credentials: {
        AccessKeyId: "ASIA_MOCK_KEY",
        SecretAccessKey: "MOCK_SECRET",
        SessionToken: "MOCK_SESSION",
      },
    });

    const client = await getCloudSecurityClient("aws", {
      account_or_subscription_or_project_id: "112233445566",
      region: "us-east-1",
    });

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(client.credentials.accessKeyId).toBe("ASIA_MOCK_KEY");
  });

  it("should initialize GoogleAuth for GCP", async () => {
    const mockGcpClient = { email: "sa@gcp.com" };
    mockGetClient.mockResolvedValueOnce(mockGcpClient);

    const client = await getCloudSecurityClient("gcp", {
      account_or_subscription_or_project_id: "tximhotep-core-prod",
    });

    expect(mockGetClient).toHaveBeenCalledTimes(1);
    expect(client.projectId).toBe("tximhotep-core-prod");
  });
});
