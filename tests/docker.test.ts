import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { dockerizeSpawn, _setDockerAvailableForTests } from "../src/sandbox/docker.js";
import type { ServerPolicy } from "../src/sandbox/types.js";
import type { SpawnRewrite } from "../src/sandbox/enforce.js";

const base: SpawnRewrite = {
  command: "node",
  args: ["server.js"],
  env: { PATH: "/usr/bin" },
  changes: [],
};

test("dockerizeSpawn is a no-op when docker is unavailable", () => {
  _setDockerAvailableForTests(false);
  try {
    const p: ServerPolicy = {
      name: "x",
      enabled: true,
      filesystem: { paths: ["/safe"] },
      network: false,
      envWhitelist: [],
    };
    const out = dockerizeSpawn(base, { policy: p });
    assert.equal(out.command, base.command);
    assert.deepEqual(out.args, base.args);
  } finally {
    _setDockerAvailableForTests(undefined);
  }
});

test("dockerizeSpawn assembles --network none + --rm + bind mounts when docker is available", () => {
  _setDockerAvailableForTests(true);
  try {
    const p: ServerPolicy = {
      name: "x",
      enabled: true,
      filesystem: { paths: ["/safe"] },
      network: false,
      envWhitelist: [],
    };
    const out = dockerizeSpawn(base, { policy: p });
    assert.equal(out.command, "docker");
    assert.ok(out.args.includes("--rm"));
    assert.ok(out.args.includes("-i"));
    assert.ok(out.args.includes("--network"));
    assert.ok(out.args.includes("none"));
    assert.ok(out.args.includes("-v"));
    const v = out.args.indexOf("-v");
    const safe = path.resolve("/safe");
    assert.equal(out.args[v + 1], `${safe}:${safe}`);
    // image then command
    assert.ok(out.args.includes("node:20-alpine"));
    assert.ok(out.args.includes("node"));
    assert.ok(out.args.includes("server.js"));
    assert.ok(out.changes.some((c) => /containerized/.test(c)));
  } finally {
    _setDockerAvailableForTests(undefined);
  }
});

test("dockerizeSpawn drops --network none when network is allowed", () => {
  _setDockerAvailableForTests(true);
  try {
    const p: ServerPolicy = {
      name: "x",
      enabled: true,
      filesystem: { paths: [] },
      network: true,
      envWhitelist: [],
    };
    const out = dockerizeSpawn(base, { policy: p });
    const ni = out.args.indexOf("--network");
    assert.equal(ni, -1, "--network should not be set when policy.network is true");
  } finally {
    _setDockerAvailableForTests(undefined);
  }
});

test("dockerizeSpawn honours a custom image override", () => {
  _setDockerAvailableForTests(true);
  try {
    const p: ServerPolicy = {
      name: "x",
      enabled: true,
      filesystem: { paths: [] },
      network: false,
      envWhitelist: [],
    };
    const out = dockerizeSpawn(base, { policy: p, image: "node:22-bookworm-slim" });
    assert.ok(out.args.includes("node:22-bookworm-slim"));
    assert.ok(!out.args.includes("node:20-alpine"));
  } finally {
    _setDockerAvailableForTests(undefined);
  }
});
