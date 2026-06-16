import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runDemo } from "../src/cli/demo.js";

test("wardn demo blocks every attack before it reaches evil-mcp", async (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "wardn-demo-"));
  process.env.WARDN_HOME = home;

  // Silence the demo's pretty output during the test.
  const origWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((..._args: unknown[]) => true) as typeof process.stdout.write;

  t.after(() => {
    process.stdout.write = origWrite;
    delete process.env.WARDN_HOME;
    fs.rmSync(home, { recursive: true, force: true });
  });

  const result = await runDemo({ fast: true });
  assert.equal(result.total, 4);
  assert.equal(result.reachedServer, 0, "no attack should reach the evil-mcp process");
  assert.equal(result.blocked, 4, "all four attacks must be blocked");
});
