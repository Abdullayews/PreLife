/**
 * WCAG contrast audit for the PreLife design tokens (globals.css).
 *
 * Reads every palette block (shell/gym/diet/meditation/library × light/dark)
 * straight out of src/app/globals.css, recomputes the derived tiers exactly
 * the way the stylesheet does (color-mix in srgb), and prints the contrast
 * ratio of every text/background pair that actually occurs in the UI.
 *
 * Usage:  bun scripts/contrast.mjs [--only-fails]
 *
 * No dependencies — pure parsing + math, so the numbers are exact, not
 * eyeballed from a color picker.
 */
import { readFile } from "node:fs/promises";

const CSS_PATH = new URL("../src/app/globals.css", import.meta.url);
const ONLY_FAILS = process.argv.includes("--only-fails");

/* ── CSS parsing ──────────────────────────────────────────────────────── */

/** Parse `--token:#hex;` pairs out of one declaration block (3- and 6-digit). */
function parseTokens(block) {
  const out = {};
  for (const [, key, value] of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    const hex = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hex) out[key] = hex[1].length === 3 ? "#" + [...hex[1]].map((c) => c + c).join("") : "#" + hex[1];
  }
  return out;
}

/** Split globals.css into palette blocks keyed by world + mode.
 *  State machine over lines: a palette selector line ends with "{", the
 *  declaration lines follow until "}". */
async function parsePalettes() {
  const css = await readFile(CSS_PATH, "utf8");
  const palettes = { light: {}, dark: {} };
  const lines = css.split("\n");
  let selector = null, block = [];
  const flush = () => {
    if (selector === null) return;
    const world = selector.match(/data-world="(shell|gym|diet|meditation|library)"/)?.[1];
    if (world) {
      const tokens = parseTokens(block.join(" "));
      if (tokens["--bg"]) {
        palettes[selector.includes("html.dark") ? "dark" : "light"][world] = tokens;
      }
    }
    selector = null; block = [];
  };
  for (const line of lines) {
    if (selector !== null) {
      if (line.includes("}")) { flush(); continue; }
      block.push(line);
    } else if (line.includes("{") && !line.includes("}")) {
      selector = line.trim(); block = [];
    }
  }
  flush();
  return palettes;
}

/* ── Color math (WCAG 2.x relative luminance) ─────────────────────────── */

const chan = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]) => 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lum = (hex) => luminance(hexToRgb(hex));
const ratio = (a, b) => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

/** color-mix(in srgb, A p%, B) on opaque colors → linear channel mix. */
const mix = (a, p, b) => {
  const A = hexToRgb(a), B = hexToRgb(b);
  const out = A.map((v, i) => Math.round(v * p + B[i] * (1 - p)));
  return "#" + out.map((v) => v.toString(16).padStart(2, "0")).join("");
};

/* ── Derived tiers — mirror globals.css exactly ───────────────────────── */

function derived(p, mode) {
  const d = {
    faint: mix(p["--muted"], mode === "dark" ? 0.45 : 0.55, p["--bg"]),
    wash: mix(p["--accent"], 0.11, p["--raised"]),
    wash2: mix(p["--accent"], 0.2, p["--raised"]),
    washInk: mix(p["--accent"], 0.32, p["--ink"]),
    // .cta p / .cta small sit ON --deep
    ctaP: mix(p["--deep-ink"], 0.78, p["--deep"]),
    ctaSmall: mix(p["--deep-ink"], 0.6, p["--deep"]),
    // .tinted text sits on a 12% accent wash over --raised
    tintedBg: mix(p["--accent"], 0.12, p["--raised"]),
    // .btn:hover { filter: brightness(1.08) } lightens the button fill —
    // the white label must still pass 4.5:1 in that state too.
    accentHover: brighten(p["--accent"], 1.08),
  };
  // --accent-text: same token the CSS defines (fallback: plain accent)
  d.accentText = p["--accent-text"] ?? p["--accent"];
  return d;
}

/** CSS filter: brightness(f) — per-channel multiply, clamped. */
function brighten(hex, f) {
  const out = [1, 3, 5].map((i) => Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * f)));
  return "#" + out.map((v) => v.toString(16).padStart(2, "0")).join("");
}

/* ── Pair matrix ──────────────────────────────────────────────────────── */
/** [label, fg, bg, min-ratio, where-it-occurs] — min 4.5 body text,
 *  3.0 large text (≥24px / ≥18.66px bold) or non-text UI graphics. */
function pairs(p, d) {
  const bgs = [
    ["bg", p["--bg"]], ["surface", p["--surface"]],
    ["raised", p["--raised"]], ["tint", p["--tint"]],
  ];
  const rows = [];
  const add = (label, fg, bgName, bg, min, where) =>
    rows.push([label, fg, bg, ratio(fg, bg), min, where]);
  for (const [name, bg] of bgs) {
    add(`ink/${name}`, p["--ink"], name, bg, 4.5, "body copy, headings");
    add(`muted/${name}`, p["--muted"], name, bg, 4.5, ".lede .note small .tag .per dt placeholder .auth-or");
    // --faint is kept as a DECORATIVE-only token (no text slot uses it);
    // it is listed for transparency but not graded.
    add(`faint/${name} (decorative token)`, d.faint, name, bg, 0, "no text usage — kept for hairlines");
    // raw --accent is only used for LARGE text (stat-n, stats b: ≥24px → 3:1)
    // and icons (stars, chip-ico → 3:1). Small accent text uses --accent-text.
    add(`accent/${name} (large/icon)`, p["--accent"], name, bg, 3.0, ".stat-n .stats b .stars .chip-ico");
    add(`accentText/${name}`, d.accentText, name, bg, 4.5, ".eyebrow b .score .explore em .btn-quiet .auth-alt a nav[aria-current]");
  }
  add("accent-ink/accent (btn)", p["--accent-ink"], "accent", p["--accent"], 4.5, ".btn .tag-solid .nav-start");
  add("accent-ink/accent-hover (btn:hover)", p["--accent-ink"], "accentHover", d.accentHover, 4.5, ".btn:hover brightness(1.08)");
  add("deep-ink/deep", p["--deep-ink"], "deep", p["--deep"], 4.5, ".marquee .cta heading");
  add("ctaP/deep (.cta p)", d.ctaP, "deep", p["--deep"], 4.5, ".cta paragraph");
  add("ctaSmall/deep (.cta small)", d.ctaSmall, "deep", p["--deep"], 4.5, ".cta footnote");
  add("washInk/wash2 (seg on)", d.washInk, "wash2", d.wash2, 4.5, ".seg button[aria-pressed]");
  add("ink/wash (sched cell)", p["--ink"], "wash", d.wash, 4.5, ".cell");
  add("accent/tintedBg (chip-ico ico)", p["--accent"], "tintedBg", d.tintedBg, 3.0, ".chip-ico icon (non-text)");
  add("muted/tint (auth-demo)", p["--muted"], "tint", p["--tint"], 4.5, ".auth-demo .set-note");
  return rows;
}

/* ── Report ───────────────────────────────────────────────────────────── */

const palettes = await parsePalettes();
let fails = 0, total = 0;
const fmt = (n) => n.toFixed(2);
console.log("| palette | mode | pair | ratio | min | verdict |");
console.log("|---|---|---|---|---|---|");
for (const mode of ["light", "dark"]) {
  for (const [world, p] of Object.entries(palettes[mode])) {
    const d = derived(p, mode);
    for (const [label, , , r, min] of pairs(p, d)) {
      if (min === 0) { // decorative token row — listed, not graded
        if (!ONLY_FAILS) console.log(`| ${world} | ${mode} | ${label} | ${fmt(r)} | n/a | decorative |`);
        continue;
      }
      total++;
      const pass = r >= min;
      if (!pass) fails++;
      if (ONLY_FAILS && pass) continue;
      console.log(`| ${world} | ${mode} | ${label} | ${fmt(r)} | ${min} | ${pass ? "PASS" : "**FAIL**"} |`);
    }
  }
}
console.error(`\n${total - fails}/${total} pairs pass; ${fails} FAIL`);
