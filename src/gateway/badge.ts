import type { ScanSummary } from "../scanner/index.js";

export type BadgeShow = "summary" | "trust";
export type BadgeTheme = "dark" | "light";

export interface BadgeInput {
  summary: ScanSummary;
  show?: BadgeShow;
  theme?: BadgeTheme;
}

interface Palette {
  bg: string;
  fg: string;
  fgDim: string;
  border: string;
  cyan: string;
  risky: string;
  review: string;
  trusted: string;
}

const DARK: Palette = {
  bg: "#000510",
  fg: "#d6ecf6",
  fgDim: "#6f93a8",
  border: "rgba(77,180,220,0.32)",
  cyan: "#4db4dc",
  risky: "#ff6b8a",
  review: "#f6c360",
  trusted: "#7be0a4",
};

const LIGHT: Palette = {
  bg: "#f4f8fb",
  fg: "#04243a",
  fgDim: "#3d5a6e",
  border: "rgba(77,180,220,0.5)",
  cyan: "#1d6f8e",
  risky: "#b8385d",
  review: "#8a5c0e",
  trusted: "#2b6e4a",
};

function statusColor(summary: ScanSummary, palette: Palette): string {
  if (summary.risky > 0) return palette.risky;
  if (summary.review > 0) return palette.review;
  return palette.trusted;
}

function statusLabel(summary: ScanSummary): string {
  if (summary.risky > 0) return summary.risky === 1 ? "1 risky" : `${summary.risky} risky`;
  if (summary.review > 0) return summary.review === 1 ? "1 review" : `${summary.review} review`;
  return "trusted";
}

/**
 * Approximate text width for the monospace face we ship in the badge. Tuned
 * against the in-SVG 12px font; close enough that the SVG width is never
 * cropped. Slightly generous on purpose — overshooting a few px is invisible.
 */
function textWidthPx(text: string, fontSize: number): number {
  return Math.ceil(text.length * fontSize * 0.62);
}

function escapeText(text: string): string {
  // SVG content goes inside a <text> element where < and & are illegal raw.
  // We only render numbers + enum labels, but keep the escape as defense.
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Render a deterministic, dependency-free SVG badge of the trust state.
 *
 * Two segments: a constant left ("⛨ wardn") and a status-tinted right with a
 * caption like "5 · 1 risky" or "trusted".
 *
 * Deterministic = same input always yields the same byte output (good for
 * HTTP caching + golden-style tests).
 */
export function renderBadge(input: BadgeInput): string {
  const palette = (input.theme ?? "dark") === "light" ? LIGHT : DARK;
  const show = input.show ?? "summary";
  const left = "⛨ wardn";
  const right =
    show === "trust"
      ? statusLabel(input.summary)
      : `${input.summary.total} · ${statusLabel(input.summary)}`;

  const fontSize = 12;
  const padX = 10;
  // ⛨ is wide in most monospace fonts; pad the left slot a touch.
  const leftW = textWidthPx(left, fontSize) + padX * 2 + 2;
  const rightW = textWidthPx(right, fontSize) + padX * 2;
  const totalW = leftW + rightW;
  const h = 28;
  const rx = 6;

  const accent = statusColor(input.summary, palette);
  const rightFill = palette.bg;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${h}" viewBox="0 0 ${totalW} ${h}" role="img" aria-label="wardn — ${escapeText(right)}">`,
    `<title>wardn — ${escapeText(right)}</title>`,
    `<defs>`,
    `<linearGradient id="topLit" x1="0" y1="0" x2="0" y2="1">`,
    `<stop offset="0" stop-color="${palette.cyan}" stop-opacity="0.18"/>`,
    `<stop offset="1" stop-color="${palette.cyan}" stop-opacity="0"/>`,
    `</linearGradient>`,
    `</defs>`,
    `<rect width="${totalW}" height="${h}" rx="${rx}" fill="${palette.bg}" stroke="${palette.border}"/>`,
    `<rect width="${totalW}" height="${h}" rx="${rx}" fill="url(#topLit)"/>`,
    `<line x1="${leftW}" y1="4" x2="${leftW}" y2="${h - 4}" stroke="${palette.border}" stroke-width="1"/>`,
    `<g font-family="ui-monospace, 'JetBrains Mono', Menlo, Consolas, monospace" font-size="${fontSize}">`,
    `<text x="${padX}" y="${h / 2 + 4}" fill="${palette.cyan}">⛨</text>`,
    `<text x="${padX + 16}" y="${h / 2 + 4}" fill="${palette.fg}" font-weight="600">wardn</text>`,
    `<text x="${leftW + padX}" y="${h / 2 + 4}" fill="${accent}">${escapeText(right)}</text>`,
    `</g>`,
    `</svg>`,
  ].join("");
}

export function isValidShow(v: string | undefined): v is BadgeShow {
  return v === "summary" || v === "trust";
}

export function isValidTheme(v: string | undefined): v is BadgeTheme {
  return v === "dark" || v === "light";
}
