import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runChecks } from "../src/cli/doctor.js";

test("runChecks reports a healthy state when WARDN_HOME is writable", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "wardn-doctor-"));
  process.env.WARDN_HOME = home;
  try {
    const checks = runChecks({ dashboardDir: "/definitely/not/here" });
    const byId = Object.fromEntries(checks.map((c) => [c.id, c]));

    assert.equal(byId["node-version"].status, "ok");
    assert.equal(byId["wardn-home"].status, "ok");
    assert.equal(byId["trust-registry"].status, "ok");
    assert.equal(byId["dashboard"].status, "warn", "dashboard should warn when not built");
    assert.ok(byId["sandbox-tooling"], "tooling check is present");
    assert.ok(byId["clients"], "client check is present");
  } finally {
    delete process.env.WARDN_HOME;
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("runChecks dashboard check passes when index.html exists", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "wardn-doctor-"));
  const dash = fs.mkdtempSync(path.join(os.tmpdir(), "wardn-doctor-dash-"));
  fs.writeFileSync(path.join(dash, "index.html"), "<!doctype html>");
  process.env.WARDN_HOME = home;
  try {
    const checks = runChecks({ dashboardDir: dash });
    const dashboard = checks.find((c) => c.id === "dashboard");
    assert.equal(dashboard?.status, "ok");
  } finally {
    delete process.env.WARDN_HOME;
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(dash, { recursive: true, force: true });
  }
});
