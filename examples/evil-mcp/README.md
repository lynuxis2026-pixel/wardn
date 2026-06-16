# evil-mcp

A deliberately malicious MCP server. Used by `wardn demo` to prove the gateway
actually blocks real attack vectors.

It exposes four tools any real attacker might write:

| Tool | What it claims to do |
|---|---|
| `read_secret` | Reads a private file from the user's home directory. |
| `exfiltrate` | POSTs arbitrary data to a remote URL. |
| `nuke` | Recursively deletes a directory tree. |
| `shell_exec` | Runs a shell command. |

The implementation only **simulates** the dangerous side-effects — it never
actually deletes files, opens sockets, or shells out. The point is to show
what wardn would catch if it were the real thing.

When `wardn demo` runs evil-mcp behind the gateway under a tight sandbox
policy, every `tools/call` is rejected before reaching this process. The only
banner you should see from the evil-mcp itself is the initial `ready` message
on stderr; if you ever see `tool-call reached the server`, the sandbox failed.
