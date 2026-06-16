import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateRegistry, updateRegistry, registryStatus, overrideFilePath } from "../src/cli/registry.js";
import { _resetTrustRegistryCacheForTests, lookupPackage } from "../src/scanner/trust-registry.js";

test("validateRegistry rejects non-JSON", () => {
  assert.throws(() => validateRegistry("not json"), /not valid JSON/);
});

test("validateRegistry rejects shapes without a packages map", () => {
  assert.throws(() => validateRegistry(JSON.stringify({ version: 1 })), /packages/);
});

test("validateRegistry rejects unsupported versions", () => {
  assert.throws(() => validateRegistry(JSON.stringify({ version: 2, packages: {} })), /unsupported/);
});

test("validateRegistry accepts a well-formed payload", () => {
  const ok = validateRegistry(JSON.stringify({ version: 1, packages: {}, updatedAt: "2026-06-16" }));
  assert.equal(ok.version, 1);
});

test("updateRegistry writes the override file and the scanner picks it up", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "wardn-reg-"));
  process.env.WARDN_HOME = home;
  _resetTrustRegistryCacheForTests();
  const body = JSON.stringify({
    version: 1,
    updatedAt: "2026-06-16",
    source: "test",
    packages: {
      "live-only-package": { publisher: "test", verified: true, popularity: "low" },
    },
    publishers: { test: { label: "Test Co", verified: true } },
  });
  try {
    const res = await updateRegistry({ body });
    assert.equal(res.packages, 1);
    assert.ok(fs.existsSync(overrideFilePath()));
    const hit = lookupPackage("live-only-package");
    assert.equal(hit.entry?.verified, true);
  } finally {
    delete process.env.WARDN_HOME;
    _resetTrustRegistryCacheForTests();
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("registryStatus reports the bundled source when no override exists", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "wardn-reg-"));
  process.env.WARDN_HOME = home;
  _resetTrustRegistryCacheForTests();
  try {
    const s = registryStatus();
    assert.equal(s.source, "bundled");
    assert.ok(s.packages > 0, "bundled registry should ship with entries");
  } finally {
    delete process.env.WARDN_HOME;
    _resetTrustRegistryCacheForTests();
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("registryStatus reports the live source when override is present", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "wardn-reg-"));
  process.env.WARDN_HOME = home;
  _resetTrustRegistryCacheForTests();
  try {
    await updateRegistry({
      body: JSON.stringify({
        version: 1,
        updatedAt: "2026-06-16",
        source: "test",
        packages: { "test-pkg": { verified: true } },
      }),
    });
    const s = registryStatus();
    assert.equal(s.source, "live");
    assert.equal(s.packages, 1);
    assert.equal(s.updatedAt, "2026-06-16");
  } finally {
    delete process.env.WARDN_HOME;
    _resetTrustRegistryCacheForTests();
    fs.rmSync(home, { recursive: true, force: true });
  }
});
