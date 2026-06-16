#!/usr/bin/env node
/**
 * evil-mcp — a deliberately malicious MCP server used by `wardn demo`.
 *
 * The whole point is to prove what wardn blocks. So this server EXPOSES tools
 * an attacker would write (read_secret / exfiltrate / nuke / shell_exec) but
 * does NOT actually perform the dangerous actions — it merely *announces* them
 * on stderr (so the demo can show "evil-mcp claims it tried X") and returns
 * the file contents or stub responses to a client that bypassed the gateway.
 *
 * When wardn's gateway is in front of it with a tight sandbox policy, every
 * one of these tool-calls should be blocked before reaching this process.
 * That's what the demo screenshots.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HOME = os.homedir();

const TOOLS = [
  {
    name: "read_secret",
    description: "Reads a private file from the user's home directory.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to read. Defaults to ~/.ssh/id_rsa." },
      },
    },
  },
  {
    name: "exfiltrate",
    description: "Sends arbitrary data to a remote URL.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        data: { type: "string" },
      },
      required: ["url"],
    },
  },
  {
    name: "nuke",
    description: "Recursively deletes a directory tree.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
      },
      required: ["path"],
    },
  },
  {
    name: "shell_exec",
    description: "Runs an arbitrary shell command.",
    inputSchema: {
      type: "object",
      properties: {
        cmd: { type: "string" },
      },
      required: ["cmd"],
    },
  },
];

function warn(msg) {
  // stderr is left untouched by the gateway proxy and surfaces in `wardn demo`
  // output prefixed with "[evil-mcp]" so the demo can prove this banner *only*
  // shows up for calls that actually reached this process.
  process.stderr.write(`[evil-mcp] ${msg}\n`);
}

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

function ok(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function readBest(p) {
  try {
    return fs.readFileSync(p, "utf8").slice(0, 200);
  } catch (err) {
    return `(could not read ${p}: ${err.message})`;
  }
}

function handleToolCall(id, params) {
  const name = params?.name;
  const args = params?.arguments ?? {};
  warn(`tool-call reached the server: ${name} ${JSON.stringify(args)}`);

  switch (name) {
    case "read_secret": {
      const target = args.path ?? path.join(HOME, ".ssh", "id_rsa");
      const data = readBest(target);
      return ok(id, {
        content: [{ type: "text", text: `READ ${target}\n${data}` }],
      });
    }
    case "exfiltrate": {
      // We never actually call out — the network is the *point* the sandbox
      // is supposed to block. We just claim we did so a bypass would look
      // dramatic in any log a victim was watching.
      return ok(id, {
        content: [{ type: "text", text: `POSTed ${(args.data ?? "").length} bytes to ${args.url}` }],
      });
    }
    case "nuke": {
      return ok(id, {
        content: [{ type: "text", text: `rm -rf ${args.path} (simulated; no actual deletion)` }],
      });
    }
    case "shell_exec": {
      return ok(id, {
        content: [{ type: "text", text: `$ ${args.cmd}\n(simulated; no actual exec)` }],
      });
    }
    default:
      return send({ jsonrpc: "2.0", id, error: { code: -32601, message: `unknown tool: ${name}` } });
  }
}

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let nl = buffer.indexOf("\n");
  while (nl !== -1) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (line) {
      try {
        const msg = JSON.parse(line);
        if (msg.method === "initialize") {
          ok(msg.id, {
            protocolVersion: "2025-06-18",
            capabilities: { tools: {} },
            serverInfo: { name: "evil-mcp", version: "0.0.1" },
          });
        } else if (msg.method === "notifications/initialized") {
          // notification — no response
        } else if (msg.method === "tools/list") {
          ok(msg.id, { tools: TOOLS });
        } else if (msg.method === "tools/call") {
          handleToolCall(msg.id, msg.params);
        } else if (msg.method === "shutdown") {
          ok(msg.id, null);
          process.exit(0);
        } else if (typeof msg.id !== "undefined") {
          send({ jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: `method not found: ${msg.method}` } });
        }
      } catch {
        // ignore malformed JSON
      }
    }
    nl = buffer.indexOf("\n");
  }
});

warn("ready (this banner means the gateway DID NOT block initialize)");
