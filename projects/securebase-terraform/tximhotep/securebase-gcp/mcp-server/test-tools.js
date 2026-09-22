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
    console.log("MCP Response:\n", JSON.stringify(json, null, 2));
    child.kill();
  } catch (e) {
    // Waiting for full JSON response
  }
});

// Send JSON-RPC initialize request
const initRequest = {
  jsonrpc: "2.0",
  id: 1,
  method: "tools/list",
  params: {},
};

child.stdin.write(JSON.stringify(initRequest) + "\n");
