import { describe, it, expect } from "vitest";
import { generateHclPatch, PatchRequest } from "../src/services/terraformPatchEngine.js";

describe("terraformPatchEngine", () => {
  it("should append a compliant KMS encryption block for S3", () => {
    const existingHcl = `resource "aws_s3_bucket" "telemetry" { bucket = "telemetry-prod" }`;
    const request: PatchRequest = {
      filePath: "infra/terraform/storage/s3.tf",
      resourceType: "AWS::S3::Bucket",
      resourceName: "telemetry",
      patchType: "ENFORCE_S3_KMS",
      params: {},
    };

    const result = generateHclPatch(request, existingHcl);
    expect(result.updatedContent).toContain("aws_s3_bucket_server_side_encryption_configuration");
    expect(result.updatedContent).toContain("kms_master_key_id = var.kms_cmk_arn");
    expect(result.patchDiff).toContain("NIST 800-53 SC-13, SC-28");
  });

  it("should replace 0.0.0.0/0 with corporate VPN CIDR", () => {
    const existingHcl = `ingress { from_port = 22 to_port = 22 protocol = "tcp" cidr_blocks = ["0.0.0.0/0"] }`;
    const request: PatchRequest = {
      filePath: "infra/terraform/network/sg.tf",
      resourceType: "AWS::EC2::SecurityGroup",
      resourceName: "prod_ingress",
      patchType: "RESTRICT_SG_CIDR",
      params: { replacementCidr: "10.200.0.0/16" },
    };

    const result = generateHclPatch(request, existingHcl);
    expect(result.updatedContent).not.toContain('["0.0.0.0/0"]');
    expect(result.updatedContent).toContain('cidr_blocks = ["10.200.0.0/16"]');
  });
});
