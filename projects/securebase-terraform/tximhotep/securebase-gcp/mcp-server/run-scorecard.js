import { Storage } from "@google-cloud/storage";
import { evaluateGcpCompliance } from "./dist/engine/scoring.js";

const storage = new Storage({ projectId: "securebase-gcp-dev" });

async function run() {
  console.log("\n=======================================================");
  console.log("       SECUREBASE MULTI-FRAMEWORK COMPLIANCE SCORECARD  ");
  console.log("=======================================================\n");
  
  const [buckets] = await storage.getBuckets();
  const audits = await Promise.all(
    buckets.map(async (bucket) => {
      const [metadata] = await bucket.getMetadata();
      return {
        name: bucket.name,
        location: metadata.location || "US",
        uniformBucketLevelAccess: metadata.iamConfiguration?.uniformBucketLevelAccess?.enabled ?? false,
        publicAccessPrevention: metadata.iamConfiguration?.publicAccessPrevention ?? "unspecified",
        defaultKmsKeyName: metadata.encryption?.defaultKmsKeyName ?? "Google-Managed",
        versioningEnabled: metadata.versioning?.enabled ?? false,
      };
    })
  );

  const scorecard = evaluateGcpCompliance(audits);
  console.log(JSON.stringify({
    project: "securebase-gcp-dev",
    timestamp: new Date().toISOString(),
    ...scorecard
  }, null, 2));
}

run().catch(console.error);
