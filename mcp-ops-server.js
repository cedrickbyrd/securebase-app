import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { execSync } from "child_process";

const server = new McpServer({
  name: "securebase-ops",
  version: "1.0.0"
});

// TOOL 1: Check GitHub Action Status
server.tool("check_workflow_health", "Checks the status of recent GitHub Actions for SecureBase", {}, async () => {
  const status = execSync(`gh run list --repo ${process.env.GH_REPO} --limit 1`).toString();
  return { content: [{ type: "text", text: status }] };
});

// TOOL 2: Verify S3 Proxy Headers
server.tool("verify_s3_shield", 
  "Tests if the Netlify proxy is correctly shielding the S3 bucket",
  { url: z.string().describe("The URL to test (e.g., /storage/index.html)") },
  async ({ url }) => {
    try {
      const fullUrl = `https://demo.securebase.tximhotep.com${url}`;
      const headers = execSync(`curl -I -s ${fullUrl}`).toString();
      const isCached = headers.includes("X-Cache: HIT") || headers.includes("Age:");
      return { 
        content: [{ 
          type: "text", 
          text: `Proxy Check for ${url}:\n${isCached ? "✅ SHIELD ACTIVE (Cached)" : "⚠️ BYPASSING CACHE"}\n\n${headers}` 
        }] 
      };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// TOOL 3: Audit AWS Request Count (Phase 5 Cost Control)
server.tool("audit_s3_usage", "Checks S3 object count to monitor potential free tier risks", {}, async () => {
  const result = execSync(`aws s3 ls s3://${process.env.S3_BUCKET_PROD} --recursive --summarize | tail -n 2`).toString();
  return { content: [{ type: "text", text: `Current S3 Payload:\n${result}` }] };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
