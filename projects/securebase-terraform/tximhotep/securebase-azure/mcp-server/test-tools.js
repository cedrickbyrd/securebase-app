import { spawn } from "child_process";

const child = spawn("node", ["dist/index.js"], {
  env: { ...process.env, AZURE_RESOURCE_GROUP: "rg-securebase-azure-dev" },
  stdio: ["pipe", "pipe", "inherit"],
});

let buffer = "";
child.stdout.on("data", (data) => {
  buffer += data.toString();
  try {
    const json = JSON.parse(buffer);
    console.log("Azure MCP Response:\n", JSON.stringify(json, null, 2));
    child.kill();
    process.exit(0);
  } catch (e) {}
});

child.stdin.write(JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "tools/list",
  params: {},
}) + "\n");
