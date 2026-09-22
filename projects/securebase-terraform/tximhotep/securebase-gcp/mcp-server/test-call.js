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
    console.log("Live Tool Execution Output:\n", JSON.stringify(json, null, 2));
    child.kill();
  } catch (e) {
    // Await complete JSON buffer
  }
});

// JSON-RPC Tool Call Request
const toolCallRequest = {
  jsonrpc: "2.0",
  id: 2,
  method: "tools/call",
  params: {
    name: "gcp_list_assets",
    arguments: {
      limit: 3
    }
  },
};

child.stdin.write(JSON.stringify(toolCallRequest) + "\n");
