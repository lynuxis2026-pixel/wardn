import { test } from "node:test";
import assert from "node:assert/strict";
import { lookupPackage, _resetTrustRegistryCacheForTests } from "../src/scanner/trust-registry.js";
import { scanServer } from "../src/scanner/index.js";
import type { McpServer } from "../src/types.js";

function mkServer(over: Partial<McpServer>): McpServer {
  return {
    name: over.name ?? "test",
    client: over.client ?? "claude-desktop",
    source: over.source ?? "fixture",
    transport: over.transport ?? "stdio",
    command: over.command,
    args: over.args ?? [],
    env: over.env ?? {},
    url: over.url,
  };
}

test("trust registry resolves a verified Anthropic package", () => {
  _resetTrustRegistryCacheForTests();
  const r = lookupPackage("@modelcontextprotocol/server-filesystem");
  assert.equal(r.entry?.verified, true);
  assert.equal(r.publisher?.label, "Anthropic");
});

test("trust registry strips trailing @version", () => {
  _resetTrustRegistryCacheForTests();
  const r = lookupPackage("@modelcontextprotocol/server-github@1.2.3");
  assert.equal(r.packageName, "@modelcontextprotocol/server-github");
  assert.equal(r.entry?.verified, true);
});

test("trust registry returns nothing for unknown packages", () => {
  _resetTrustRegistryCacheForTests();
  const r = lookupPackage("some-random-mcp-package");
  assert.equal(r.entry, undefined);
});

test("scanner emits 'verified' signal for known publishers", () => {
  _resetTrustRegistryCacheForTests();
  const server = mkServer({
    name: "fs",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/safe"],
  });
  const result = scanServer(server);
  assert.ok(
    result.signals.some((s) => s.id === "verified" && /Anthropic/.test(s.reason)),
    `expected a verified signal mentioning Anthropic, got ${JSON.stringify(result.signals)}`,
  );
});

test("scanner emits nothing extra for unknown packages", () => {
  _resetTrustRegistryCacheForTests();
  const server = mkServer({
    name: "scraper",
    command: "npx",
    args: ["-y", "cool-scraper-mcp"],
  });
  const result = scanServer(server);
  assert.equal(result.signals.find((s) => s.id === "verified"), undefined);
});
