import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {
  bubblewrapSpawn,
  isBubblewrapAvailable,
  _resetBubblewrapCacheForTests,
  _setBubblewrapAvailableForTests,
} from "../src/sandbox/bubblewrap.js";
import type { ServerPolicy } from "../src/sandbox/types.js";
import type { SpawnRewrite } from "../src/sandbox/enforce.js";

const baseRewrite: SpawnRewrite = {
  command: "node",
  args: ["server.js"],
  env: { PATH: "/usr/bin" },
  changes: ["filesystem paths: / → /safe"],
};

test("isBubblewrapAvailable returns false off-Linux", () => {
  _resetBubblewrapCacheForTests();
  if (process.platform !== "linux") {
    assert.equal(isBubblewrapAvailable(), false);
  } else {
    // On Linux the result depends on whether bwrap is installed; we just
    // assert the function returned a boolean without throwing.
    assert.equal(typeof isBubblewrapAvailable(), "boolean");
  }
});

test("bubblewrapSpawn is a no-op when bwrap is unavailable", () => {
  _resetBubblewrapCacheForTests();
  const policy: ServerPolicy = {
    name: "test",
    enabled: true,
    filesystem: { paths: ["/safe"] },
    network: false,
    envWhitelist: [],
  };
  // Off Linux the function should return the input unchanged.
  if (process.platform !== "linux") {
    const out = bubblewrapSpawn(baseRewrite, policy);
    assert.equal(out.command, baseRewrite.command);
    assert.deepEqual(out.args, baseRewrite.args);
    assert.deepEqual(out.changes, baseRewrite.changes);
  }
});

test("bubblewrap arg layout includes namespace flags and binds (forced available)", () => {
  _setBubblewrapAvailableForTests(true);
  try {
    const policy: ServerPolicy = {
      name: "test",
      enabled: true,
      filesystem: { paths: ["/safe"] },
      network: false,
      envWhitelist: [],
    };
    const out = bubblewrapSpawn(baseRewrite, policy);
    assert.equal(out.command, "bwrap");
    assert.ok(out.args.includes("--die-with-parent"));
    assert.ok(out.args.includes("--unshare-pid"));
    assert.ok(out.args.includes("--unshare-ipc"));
    assert.ok(out.args.includes("--unshare-net"), "should drop network namespace");
    assert.ok(out.args.includes("--bind"), "should bind the policy path");
    assert.ok(out.args.includes(path.resolve("/safe")));
    assert.ok(out.args.includes("--ro-bind"), "should read-only bind /usr etc");
    assert.ok(out.args.includes("--"), "must delimit bwrap args from the inner command");
    assert.ok(out.changes.some((c) => /bubblewrap-isolated/.test(c)));
  } finally {
    _setBubblewrapAvailableForTests(undefined);
  }
});

test("bubblewrap keeps network when policy.network is true", () => {
  _setBubblewrapAvailableForTests(true);
  try {
    const policy: ServerPolicy = {
      name: "test",
      enabled: true,
      filesystem: { paths: [] },
      network: true,
      envWhitelist: [],
    };
    const out = bubblewrapSpawn(baseRewrite, policy);
    assert.ok(!out.args.includes("--unshare-net"));
    assert.ok(out.args.includes("--share-net"));
  } finally {
    _setBubblewrapAvailableForTests(undefined);
  }
});
