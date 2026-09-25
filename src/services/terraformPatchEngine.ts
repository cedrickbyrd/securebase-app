export interface PatchRequest {
  filePath: string;
  resourceType: string;
  resourceName: string;
  patchType: "ENFORCE_S3_KMS" | "RESTRICT_SG_CIDR";
  params: Record<string, any>;
}

export function generateHclPatch(request: PatchRequest, existingContent: string): { updatedContent: string; patchDiff: string } {
  if (request.patchType === "ENFORCE_S3_KMS") {
    const newBlock = `
# Enforced by SecureBase Autonomous Orchestration (NIST 800-53 SC-13, SC-28)
resource "aws_s3_bucket_server_side_encryption_configuration" "${request.resourceName}_encryption" {
  bucket = aws_s3_bucket.${request.resourceName}.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = var.kms_cmk_arn
      sse_algorithm     = "aws:kms"
    }
  }
}
`;
    const updatedContent = existingContent.trimEnd() + "\n" + newBlock;
    return {
      updatedContent,
      patchDiff: newBlock,
    };
  }

  if (request.patchType === "RESTRICT_SG_CIDR") {
    const updatedContent = existingContent.replace(
      /cidr_blocks\s*=\s*\[\s*"0\.0\.0\.0\/0"\s*\]/g,
      `cidr_blocks = ["${request.params.replacementCidr || "10.200.0.0/16"}"] # SecureBase auto-remediated`
    );

    return {
      updatedContent,
      patchDiff: `-${'cidr_blocks = ["0.0.0.0/0"]'}\n+${`cidr_blocks = ["${request.params.replacementCidr || "10.200.0.0/16"}"]`}`,
    };
  }

  throw new Error(`Unsupported patch type: ${request.patchType}`);
}
