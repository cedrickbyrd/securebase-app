import { Octokit } from "@octokit/rest";
import { generateHclPatch } from "../services/terraformPatchEngine.js";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

export async function handleGenerateIacPr(args: {
  repo: string;
  filePath: string;
  findingId: string;
  complianceFramework: string;
  controlId: string;
  patchType: "ENFORCE_S3_KMS" | "RESTRICT_SG_CIDR";
  resourceType: string;
  resourceName: string;
}) {
  const [owner, repoName] = args.repo.split("/");
  const branchName = `securebase/remediation-${args.findingId.toLowerCase()}`;

  const { data: refData } = await octokit.git.getRef({
    owner,
    repo: repoName,
    ref: "heads/main",
  });
  const mainSha = refData.object.sha;

  await octokit.git.createRef({
    owner,
    repo: repoName,
    ref: `refs/heads/${branchName}`,
    sha: mainSha,
  });

  const { data: fileData } = (await octokit.repos.getContent({
    owner,
    repo: repoName,
    path: args.filePath,
  })) as any;

  const currentHcl = Buffer.from(fileData.content, "base64").toString("utf-8");
  const { updatedContent, patchDiff } = generateHclPatch(
    {
      filePath: args.filePath,
      resourceType: args.resourceType,
      resourceName: args.resourceName,
      patchType: args.patchType,
      params: { replacementCidr: "10.200.0.0/16" },
    },
    currentHcl
  );

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo: repoName,
    path: args.filePath,
    message: `fix(secops): autonomous remediation for ${args.findingId} (${args.complianceFramework} ${args.controlId})`,
    content: Buffer.from(updatedContent).toString("base64"),
    sha: fileData.sha,
    branch: branchName,
  });

  const pr = await octokit.pulls.create({
    owner,
    repo: repoName,
    title: `fix(secops): Remediate ${args.resourceType} drift (${args.controlId})`,
    head: branchName,
    base: "main",
    body: `### SecureBase Autonomous Remediation
**Finding ID:** \`${args.findingId}\`  
**Control Crosswalk:** ${args.complianceFramework} \`${args.controlId}\`

#### Summary of Changes
\`\`\`diff
${patchDiff}
\`\`\`

> *This PR was generated autonomously by SecureBase-MCP to resolve infrastructure drift without out-of-band state corruption.*`,
  });

  return {
    status: "PR_CREATED",
    pr_number: pr.data.number,
    pr_url: pr.data.html_url,
    branch: branchName,
  };
}
