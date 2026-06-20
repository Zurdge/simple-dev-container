import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { spawnSync } from "child_process";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOKENS_PATH = join(__dirname, "..", "tokens.json");
const IMAGE = "dev-container";
const LABEL = "dev-container.managed=true";

const TokensSchema = z.record(z.string(), z.string());

function loadToken(repo: string): string {
  const tokens = TokensSchema.parse(JSON.parse(readFileSync(TOKENS_PATH, "utf-8")));
  if (!(repo in tokens)) {
    throw new Error(`Repo '${repo}' is not configured in tokens.json.`);
  }
  return tokens[repo];
}

function run(
  cmd: string[],
  timeoutMs = 60_000
): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync(cmd[0], cmd.slice(1), {
    encoding: "utf-8",
    timeout: timeoutMs,
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.status ?? 1,
  };
}

const err = (text: string) => ({ content: [{ type: "text" as const, text }], isError: true });
const ok  = (text: string) => ({ content: [{ type: "text" as const, text }] });

const server = new McpServer({ name: "dev-container-tasks", version: "1.0.0" });

server.registerTool(
  "task_start",
  {
    description: "Start a long-running dev container for a GitHub repo task.",
    inputSchema: {
      repo: z.string().describe("Repo key in tokens.json"),
      task_name: z.string().describe("Container name, e.g. task-1"),
    },
  },
  async ({ repo, task_name }) => {
    let token: string;
    try {
      token = loadToken(repo);
    } catch (e) {
      return err((e as Error).message);
    }
    const result = run([
      "docker", "run", "-d", "--init",
      "--label", LABEL,
      "--name", task_name,
      "-e", `GH_TOKEN=${token}`,
      IMAGE,
    ]);
    if (result.exitCode !== 0) return err(result.stderr.trim());
    return ok(
      `Container '${task_name}' started for repo '${repo}'.\n` +
      `Run commands with task_run(task_name='${task_name}', command='...')`
    );
  }
);

server.registerTool(
  "task_list",
  { description: "List all running task containers managed by this server." },
  async () => {
    const result = run([
      "docker", "ps",
      "--filter", `label=${LABEL}`,
      "--format", "{{.Names}}\t{{.Status}}\t{{.CreatedAt}}",
    ]);
    if (result.exitCode !== 0) return err(result.stderr.trim());
    const output = result.stdout.trim();
    if (!output) return ok("No task containers are running.");
    return ok(["NAME\tSTATUS\tCREATED", ...output.split("\n")].join("\n"));
  }
);

server.registerTool(
  "task_stop",
  {
    description: "Stop and remove a running task container.",
    inputSchema: {
      task_name: z.string().describe("Container name to stop"),
    },
  },
  async ({ task_name }) => {
    const stop = run(["docker", "stop", task_name]);
    if (stop.exitCode !== 0) return err(`Failed to stop: ${stop.stderr.trim()}`);
    const rm = run(["docker", "rm", task_name]);
    if (rm.exitCode !== 0) return err(`Stopped but failed to remove: ${rm.stderr.trim()}`);
    return ok(`Container '${task_name}' stopped and removed.`);
  }
);

server.registerTool(
  "task_run",
  {
    description: "Run a shell command inside a running task container.",
    inputSchema: {
      task_name: z.string().describe("Target container name"),
      command: z.string().describe("Shell command to execute"),
    },
  },
  async ({ task_name, command }) => {
    const result = run(["docker", "exec", task_name, "sh", "-c", command], 120_000);
    const output = (result.stdout + result.stderr).trim();
    const status = result.exitCode !== 0 ? `[exit ${result.exitCode}]` : "[ok]";
    return ok(output ? `${status}\n${output}` : status);
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
