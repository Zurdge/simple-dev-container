# dev-container MCP

A stdio MCP server that manages long-running Docker containers for AI agent tasks. Each container is pre-authenticated with a scoped GitHub token — agents call tools to start containers, run commands in them, and stop them when done.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Node.js](https://nodejs.org/) 18+
- A GitHub fine-grained PAT for each repo agents will access

## Setup

**1. Build the Docker image**

```bash
docker build -t dev-container .
```

**2. Install and build the MCP server**

```bash
npm install
npm run build
```

**3. Configure tokens**

Add an entry to `tokens.json` for each repo:

```json
{
  "my-org/my-repo": "github_pat_..."
}
```

Use [fine-grained PATs](https://github.com/settings/tokens?type=beta) scoped to the minimum permissions the agent needs. `tokens.json` is gitignored.

**4. Add to your MCP client config**

```json
{
  "mcpServers": {
    "dev-container": {
      "command": "node",
      "args": ["/path/to/git-container/dist/index.js"]
    }
  }
}
```

## Tools

### `task_start`

Starts a long-running container for a repo. Looks up the token from `tokens.json` — the token is never exposed to the caller.

| Parameter | Type | Description |
|---|---|---|
| `repo` | string | Key in `tokens.json` |
| `task_name` | string | Docker container name, e.g. `task-1` |

### `task_list`

Lists all running containers managed by this server.

### `task_stop`

Stops and removes a container.

| Parameter | Type | Description |
|---|---|---|
| `task_name` | string | Container to stop |

### `task_run`

Runs a shell command inside a running container and returns stdout + stderr.

| Parameter | Type | Description |
|---|---|---|
| `task_name` | string | Target container |
| `command` | string | Shell command, e.g. `gh pr list` |

