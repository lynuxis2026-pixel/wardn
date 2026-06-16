# wardn launch copy

## GitHub repo description

Local-first MCP control plane: discover, score, sandbox, and proxy the code your AI agents run.

## GitHub About

`wardn` shows every MCP server running in Claude Desktop, Cursor, VS Code, or custom agents. It
scores each server with explainable security signals, routes traffic through a local gateway, and
lets developers sandbox risky servers without sending data to the cloud.

## Short pitch

Your AI agents are running code you probably have not reviewed. `wardn` shows what is running,
explains what is risky, and stops unsafe MCP tool-calls locally.

## Launch post

I built `wardn`: a local-first MCP control plane for developers.

It scans Claude Desktop, Cursor, and VS Code configs, lists every MCP server, explains the risk,
then lets you route traffic through a local gateway and sandbox dangerous servers.

No cloud account. No telemetry. One command:

```bash
npx wardn scan
```

The wedge is security trust: see and stop the risky code your agents run.

## Screenshot alt text

The wardn dashboard showing five MCP servers, one risky filesystem server, three review items, one
trusted server, and a live tool-call log in a dark Lynuxis interface.
