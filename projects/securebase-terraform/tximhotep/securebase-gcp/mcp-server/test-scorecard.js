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
    if (json.result && json.result.content) {
      console.log("\n=======================================================");
      console.log("       SECUREBASE MULTI-FRAMEWORK COMPLIANCE SCORECARD  ");
      console.log("=======================================================\n");
      const scorecard = JSON.parse(json.result.content[0].text);
      console.log(JSON.stringify(scorecard, null, 2));
      child.kill();
    }
  } catch (e) {
    // waiting for full json
  }
});

// Execute gcp_evaluate_compliance tool
child.stdin.write(JSON.stringify({
  jsonrpc: "2.0",
  id: 7,
  method: "tools/call",
  params: {
    name: "gcp_evaluate_compliance",
    arguments: {}
  }
}) + "\n");
