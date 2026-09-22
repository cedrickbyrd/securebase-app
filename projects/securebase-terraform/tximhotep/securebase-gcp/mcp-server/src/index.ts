import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { AssetServiceClient } from "@google-cloud/asset";
import { SecurityCenterClient } from "@google-cloud/security-center";
import { Storage } from "@google-cloud/storage";

const PROJECT_ID = process.env.GCP_PROJECT_ID || "securebase-gcp-dev";

// Initialize GCP Clients using Application Default Credentials
const assetClient = new AssetServiceClient();
const sccClient = new SecurityCenterClient();
const storageClient = new Storage({ projectId: PROJECT_ID });

const server = new Server(
  {
    name: "securebase-gcp-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define MCP Tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "gcp_list_assets",
        description: "Searches all active GCP resources in the SecureBase project via Cloud Asset Inventory.",
        inputSchema: {
          type: "object",
          properties: {
            assetType: {
              type: "string",
              description: "Optional asset type filter (e.g. 'storage.googleapis.com/Bucket', 'iam.googleapis.com/ServiceAccount').",
            },
            limit: {
              type: "number",
              description: "Maximum number of resources to return (default: 10).",
            },
          },
        },
      },
      {
        name: "gcp_audit_storage",
        description: "Audits Cloud Storage buckets for public access prevention, uniform bucket-level access, and encryption.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "gcp_scc_findings",
        description: "Retrieves active security findings and compliance posture alerts from Security Command Center.",
        inputSchema: {
          type: "object",
          properties: {
            severity: {
              type: "string",
              enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"],
              description: "Filter findings by minimum severity.",
            },
          },
        },
      },
    ],
  };
});

// Tool Handlers
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "gcp_list_assets") {
      const assetType = (args?.assetType as string) || "";
      const limit = (args?.limit as number) || 10;
      
      const query = assetType ? `assetType:"${assetType}"` : "";
      const [response] = await assetClient.searchAllResources({
        scope: `projects/${PROJECT_ID}`,
        query: query,
        pageSize: limit,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    }

    if (name === "gcp_audit_storage") {
      const [buckets] = await storageClient.getBuckets();
      const auditResults = await Promise.all(
        buckets.map(async (bucket) => {
          const [metadata] = await bucket.getMetadata();
          return {
            name: bucket.name,
            location: metadata.location,
            storageClass: metadata.storageClass,
            uniformBucketLevelAccess: metadata.iamConfiguration?.uniformBucketLevelAccess?.enabled ?? false,
            publicAccessPrevention: metadata.iamConfiguration?.publicAccessPrevention ?? "unspecified",
            defaultKmsKeyName: metadata.encryption?.defaultKmsKeyName ?? "Google-Managed",
            versioningEnabled: metadata.versioning?.enabled ?? false,
          };
        })
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(auditResults, null, 2),
          },
        ],
      };
    }

    if (name === "gcp_scc_findings") {
      const severity = (args?.severity as string) || "HIGH";
      const filter = `state="ACTIVE" AND severity="${severity}"`;
      
      const [findings] = await sccClient.listFindings({
        parent: `projects/${PROJECT_ID}/sources/-`,
        filter: filter,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(findings, null, 2),
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error: any) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `GCP MCP Error: ${error.message || String(error)}`,
        },
      ],
    };
  }
});

// Start STDIO Transport
const transport = new StdioServerTransport();
await server.connect(transport);
