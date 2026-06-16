# Launch pack

Everything you need to put wardn on the map. Open in this order:

1. **[CHECKLIST.md](CHECKLIST.md)** — the master timeline. Start here.
2. **[show-hn.md](show-hn.md)** — the post body + reply playbook.
3. **[twitter-thread.md](twitter-thread.md)** — 4–5 tweets ready to copy.
4. **[awesome-mcp-pr.md](awesome-mcp-pr.md)** — the PR title + body + entry snippet.
5. **[devto-article.md](devto-article.md)** — the long-form story article.
6. **[demo.tape](demo.tape)** — `vhs` script for the launch GIF.
7. **[cloudflare.md](cloudflare.md)** — `wardn.dev` deploy in 6 steps.

All drafts are templates — adapt the voice, don't copy-paste blindly.

## Two-minute sequence

```bash
# Generate the demo GIF for the launch.
vhs docs/launch/demo.tape   # produces docs/launch/demo.gif

# Publish.
npm whoami                  # confirm you're logged in
npm publish                 # ships v0.1.0 to npm

# Tag + release.
git tag v0.1.0              # (npm version already created this — skip if so)
git push origin v0.1.0
gh release create v0.1.0 --generate-notes

# Push the launch posts (each one separately — see CHECKLIST.md for timing).
```

After that the only thing that matters is the next 36 hours of engagement.
