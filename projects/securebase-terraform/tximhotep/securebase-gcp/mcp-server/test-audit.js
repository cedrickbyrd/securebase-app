import { spawn } from "child_process";

const child = spawn("node", ["dist/index.js"], {
  env: { ...process.env, GCP_PROJECT_ID: "securebase-gcp-dev" },
  stdio: ["pipe", "pipe", "inherit"],
});

let buffer = "";
child.stdout.on("data", (data) => {
  buffer += data.toString();
  try {
    const json = JSON.parse(buffer);
    console.log("Live MCP Storage Audit Output:\n", JSON.stringify(json, null, 2));
    child.kill();
  } catch (e) {}
});

// Execute gcp_audit_storage via JSON-RPC
child.stdin.write(JSON.stringify({
  jsonrpc: "2.0",
  id: 5,
  method: "tools/call",
  params: {
    name: "gcp_audit_storage",
    arguments: {}
  }
}) + "\n");
