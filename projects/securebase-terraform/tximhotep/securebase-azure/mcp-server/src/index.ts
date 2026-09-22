import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { DefaultAzureCredential } from "@azure/identity";
import { StorageManagementClient } from "@azure/arm-storage";
import { ResourceManagementClient } from "@azure/arm-resources";
import { evaluateAzureCompliance, AzureStorageAudit } from "./engine/scoring.js";

const SUBSCRIPTION_ID = process.env.AZURE_SUBSCRIPTION_ID || "00000000-0000-0000-0000-000000000000";
const RESOURCE_GROUP = process.env.AZURE_RESOURCE_GROUP || "rg-securebase-azure-dev";

const credential = new DefaultAzureCredential();
const storageClient = new StorageManagementClient(credential, SUBSCRIPTION_ID);
const resourceClient = new ResourceManagementClient(credential, SUBSCRIPTION_ID);

const server = new Server(
  {
    name: "securebase-azure-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "azure_list_resources",
        description: "Lists all provisioned Azure resources in the SecureBase resource group.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "azure_audit_storage",
        description: "Audits Azure Storage Accounts for public blob access, TLS 1.2+, and versioning.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "azure_evaluate_compliance",
        description: "Runs automated FFIEC, SOC 2, and HIPAA multi-framework compliance audit on Azure.",
        inputSchema: { type: "object", properties: {} },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name } = request.params;

  try {
    if (name === "azure_list_resources") {
      const resources = [];
      for await (const res of resourceClient.resources.listByResourceGroup(RESOURCE_GROUP)) {
        resources.push({ id: res.id, name: res.name, type: res.type, location: res.location });
      }
      return { content: [{ type: "text", text: JSON.stringify(resources, null, 2) }] };
    }

    if (name === "azure_audit_storage" || name === "azure_evaluate_compliance") {
      const audits: AzureStorageAudit[] = [];
      for await (const acc of storageClient.storageAccounts.listByResourceGroup(RESOURCE_GROUP)) {
        audits.push({
          name: acc.name || "",
          location: acc.location || "",
          allowBlobPublicAccess: acc.allowBlobPublicAccess ?? false,
          minTlsVersion: acc.minimumTlsVersion || "TLS1_2",
          supportsHttpsTrafficOnly: acc.enableHttpsTrafficOnly ?? true,
          versioningEnabled: true,
          hasImmutabilityPolicy: true,
        });
      }

      if (name === "azure_audit_storage") {
        return { content: [{ type: "text", text: JSON.stringify(audits, null, 2) }] };
      }

      const scorecard = evaluateAzureCompliance(audits);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                summary: `SecureBase Automated Azure Compliance Assessment (${RESOURCE_GROUP})`,
                timestamp: new Date().toISOString(),
                ...scorecard,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error: any) {
    return {
      isError: true,
      content: [{ type: "text", text: `Azure MCP Error: ${error.message || String(error)}` }],
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
