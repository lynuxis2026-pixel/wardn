import { test } from "node:test";
import assert from "node:assert/strict";
import { renderBadge, isValidShow, isValidTheme } from "../src/gateway/badge.js";

const cleanSummary = { total: 5, risky: 0, review: 0, trusted: 5 };
const reviewSummary = { total: 5, risky: 0, review: 2, trusted: 3 };
const riskySummary = { total: 5, risky: 1, review: 2, trusted: 2 };

test("renderBadge produces a self-closing SVG of valid shape", () => {
  const svg = renderBadge({ summary: cleanSummary });
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /<\/svg>$/);
  assert.match(svg, /role="img"/);
  assert.match(svg, /aria-label=/);
  assert.match(svg, /<title>wardn —/);
});

test("renderBadge uses the trusted color when no risky/review present", () => {
  const svg = renderBadge({ summary: cleanSummary, theme: "dark" });
  assert.match(svg, /#7be0a4/, "should reference the trusted green");
  assert.ok(!svg.includes("#ff6b8a"), "should not reference risky red");
});

test("renderBadge uses the review color when review > 0 and risky === 0", () => {
  const svg = renderBadge({ summary: reviewSummary });
  assert.match(svg, /#f6c360/);
  assert.match(svg, /2 review/);
});

test("renderBadge uses the risky color when any risky present", () => {
  const svg = renderBadge({ summary: riskySummary });
  assert.match(svg, /#ff6b8a/);
  assert.match(svg, /1 risky/);
});

test("renderBadge summary mode includes the total", () => {
  const svg = renderBadge({ summary: riskySummary, show: "summary" });
  assert.match(svg, /5 · 1 risky/);
});

test("renderBadge trust mode omits the total", () => {
  const svg = renderBadge({ summary: riskySummary, show: "trust" });
  assert.ok(svg.includes("1 risky"));
  assert.ok(!svg.includes("5 · 1 risky"));
});

test("renderBadge light theme swaps to lighter palette", () => {
  const svg = renderBadge({ summary: cleanSummary, theme: "light" });
  assert.match(svg, /#f4f8fb/, "light bg should be used");
  assert.ok(!svg.includes("#000510"), "should not contain the dark base");
});

test("renderBadge is deterministic for the same input", () => {
  const a = renderBadge({ summary: cleanSummary });
  const b = renderBadge({ summary: cleanSummary });
  assert.equal(a, b);
});

test("renderBadge pluralizes review labels when count > 1", () => {
  const singular = renderBadge({ summary: { total: 1, risky: 0, review: 1, trusted: 0 }, show: "trust" });
  assert.match(singular, /1 review/);
  const plural = renderBadge({ summary: { total: 3, risky: 0, review: 3, trusted: 0 }, show: "trust" });
  assert.match(plural, /3 review/);
});

test("renderBadge width scales with the right-side text", () => {
  const tight = renderBadge({ summary: { total: 1, risky: 0, review: 0, trusted: 1 } });
  const wide = renderBadge({ summary: { total: 9999, risky: 9, review: 99, trusted: 9891 } });
  const widthOf = (svg: string): number => Number(svg.match(/width="(\d+)"/)?.[1] ?? "0");
  assert.ok(widthOf(wide) > widthOf(tight), "wider text should produce a wider badge");
});

test("isValidShow / isValidTheme accept the documented enums", () => {
  assert.equal(isValidShow("summary"), true);
  assert.equal(isValidShow("trust"), true);
  assert.equal(isValidShow("evil"), false);
  assert.equal(isValidShow(undefined), false);
  assert.equal(isValidTheme("dark"), true);
  assert.equal(isValidTheme("light"), true);
  assert.equal(isValidTheme("blue"), false);
  assert.equal(isValidTheme(undefined), false);
});
