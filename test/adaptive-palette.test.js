import test from "node:test";
import assert from "node:assert/strict";

import {
  applyPaletteToElement,
  compositeColors,
  contrastRatio,
  createAdaptivePalette,
  normalizeHex,
  parseCssColor,
  parseHex,
  perceptualDistance,
  solveContrast,
} from "../src/adaptive-palette.js";

class FakeStyle {
  #values = new Map();
  #priorities = new Map();

  get length() {
    return this.#values.size;
  }

  item(index) {
    return [...this.#values.keys()][index] ?? "";
  }

  has(name) {
    return this.#values.has(name);
  }

  getPropertyValue(name) {
    return this.#values.get(name) ?? "";
  }

  getPropertyPriority(name) {
    return this.#priorities.get(name) ?? "";
  }

  setProperty(name, value, priority = "") {
    this.#values.set(name, String(value));
    this.#priorities.set(name, priority);
  }

  removeProperty(name) {
    const previous = this.getPropertyValue(name);
    this.#values.delete(name);
    this.#priorities.delete(name);
    return previous;
  }
}

test("normalizes only strict 3 and 6 digit hex colors", () => {
  assert.equal(normalizeHex("#abc"), "#AABBCC");
  assert.equal(normalizeHex("f5f7f9"), "#F5F7F9");
  assert.equal(normalizeHex("f#ff"), null);
  assert.equal(normalizeHex("abc#"), null);
  assert.equal(normalizeHex("##fff"), null);
  assert.equal(normalizeHex("nope"), null);
});

test("parses final CSS color formats used by the adapter", () => {
  assert.deepEqual(parseCssColor("#1238"), { r: 17, g: 34, b: 51, alpha: 136 / 255 });
  assert.deepEqual(parseCssColor("rgb(10 20 30 / 50%)"), { r: 10, g: 20, b: 30, alpha: 0.5 });
  assert.deepEqual(parseCssColor("rgba(10, 20, 30, .25)"), { r: 10, g: 20, b: 30, alpha: 0.25 });
  assert.equal(parseCssColor("url(#paint)"), null);
});

test("reports unreachable contrast targets instead of silently claiming success", () => {
  const background = parseHex("#007AFF");
  const result = solveContrast(background, parseHex("#000000"), 8);

  assert.equal(result.targetMet, false);
  assert.equal(result.css, "#000000");
  assert.ok(result.achieved > 5.22 && result.achieved < 5.23);
  assert.equal(result.achieved, result.maximum);
});

test("uses WCAG AA as the required text contract and records preferred failures", () => {
  const palette = createAdaptivePalette("#007AFF", { preferredTextContrast: 8 });

  assert.equal(palette.compliance.valid, true);
  assert.equal(palette.contracts.text.targetMet, true);
  assert.equal(palette.contracts.text.preferredTargetMet, false);
  assert.ok(palette.metrics.textContrast >= 4.5);
  assert.ok(palette.metrics.textContrast < 8);
});

test("fails closed when a caller explicitly requires an unreachable target", () => {
  const palette = createAdaptivePalette("#007AFF", {
    textContrast: 8,
    preferredTextContrast: 8,
  });

  assert.equal(palette.compliance.valid, false);
  assert.equal(palette.contracts.text.targetMet, false);
  assert.ok(palette.compliance.failures.includes("text"));
});

test("returns valid fallback colors when a series target is unreachable", () => {
  const palette = createAdaptivePalette("#777777", { seriesContrast: 21 });

  assert.equal(palette.compliance.valid, false);
  assert.equal(palette.contracts.series.targetMet, false);
  assert.match(palette.colors.seriesA, /^#[0-9A-F]{6}$/);
  assert.match(palette.colors.seriesB, /^#[0-9A-F]{6}$/);
  assert.match(palette.colors.seriesC, /^#[0-9A-F]{6}$/);
});

test("measures rounded, composited output rather than pre-serialization floats", () => {
  const palette = createAdaptivePalette("#1B212D");
  const background = parseHex(palette.background);
  const grid = parseCssColor(palette.colors.grid);
  const renderedGrid = compositeColors(grid, background, grid.alpha);

  assert.equal(palette.metrics.gridContrast, contrastRatio(renderedGrid, background));
  assert.equal(palette.metrics.axisContrast, contrastRatio(parseHex(palette.colors.axis), background));
  assert.equal(palette.metrics.barsContrast, contrastRatio(parseHex(palette.colors.bars), background));
  assert.ok(palette.metrics.axisContrast >= 3);
  assert.ok(palette.metrics.barsContrast >= 3);
});

test("keeps series visible and distinguishable on the former collapse boundary", () => {
  const before = createAdaptivePalette("#B2B2B2");
  const after = createAdaptivePalette("#B3B3B3");

  for (const palette of [before, after]) {
    const colors = [palette.colors.seriesA, palette.colors.seriesB, palette.colors.seriesC];
    assert.equal(new Set(colors).size, 3);
    assert.equal(palette.contracts.series.distinct, true);
    assert.ok(palette.metrics.seriesAContrast >= 3.3);
    assert.ok(palette.metrics.seriesBContrast >= 3.3);
    assert.ok(palette.metrics.seriesCContrast >= 3.3);
    assert.ok(perceptualDistance(parseHex(colors[0]), parseHex(colors[1])) >= 0.055);
    assert.ok(perceptualDistance(parseHex(colors[1]), parseHex(colors[2])) >= 0.055);
  }

  assert.ok(perceptualDistance(parseHex(before.colors.seriesA), parseHex(after.colors.seriesA)) < 0.03);
  assert.ok(perceptualDistance(parseHex(before.colors.seriesB), parseHex(after.colors.seriesB)) < 0.03);
  assert.ok(perceptualDistance(parseHex(before.colors.seriesC), parseHex(after.colors.seriesC)) < 0.03);
});

test("guarantees the required 4.5 text contract across a 32 x 32 x 32 RGB grid", () => {
  for (let r = 0; r < 256; r += 8) {
    for (let g = 0; g < 256; g += 8) {
      for (let b = 0; b < 256; b += 8) {
        const background = { r, g, b };
        const black = contrastRatio(background, { r: 0, g: 0, b: 0 });
        const white = contrastRatio(background, { r: 255, g: 255, b: 255 });
        const base = white >= black ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 };
        const result = solveContrast(background, base, 4.5);
        assert.equal(result.targetMet, true, `failed for rgb(${r}, ${g}, ${b})`);
        assert.ok(result.achieved >= 4.5, `under target for rgb(${r}, ${g}, ${b})`);
      }
    }
  }
});

test("keeps required palette contracts valid across an 8 x 8 x 8 RGB grid", () => {
  for (let r = 0; r < 256; r += 32) {
    for (let g = 0; g < 256; g += 32) {
      for (let b = 0; b < 256; b += 32) {
        const background = `#${[r, g, b]
          .map((channel) => channel.toString(16).padStart(2, "0"))
          .join("")}`;
        const palette = createAdaptivePalette(background);
        assert.equal(
          palette.compliance.valid,
          true,
          `${background} failed: ${palette.compliance.failures.join(", ")}`,
        );
      }
    }
  }
});

test("validates contrast options before generating a palette", () => {
  assert.throws(() => createAdaptivePalette("#FFFFFF", { textContrast: Number.NaN }), /textContrast/);
  assert.throws(() => createAdaptivePalette("#FFFFFF", { mutedContrast: Infinity }), /mutedContrast/);
  assert.throws(() => createAdaptivePalette("#FFFFFF", { graphicContrast: -1 }), /graphicContrast/);
  assert.throws(() => createAdaptivePalette("#FFFFFF", { seriesContrast: 22 }), /seriesContrast/);
});

test("applies tokens and restores absent values, existing values, and priority", () => {
  const style = new FakeStyle();
  style.setProperty("--adaptive-text", "hotpink", "important");
  const element = { style };
  const palette = createAdaptivePalette("#2B3548");
  const application = applyPaletteToElement(element, palette);

  assert.equal(style.getPropertyValue("--adaptive-bg"), "#2B3548");
  assert.equal(style.getPropertyValue("--adaptive-text"), palette.colors.text);
  assert.equal(style.getPropertyPriority("--adaptive-text"), "");

  application.restore();
  assert.equal(style.has("--adaptive-bg"), false);
  assert.equal(style.getPropertyValue("--adaptive-text"), "hotpink");
  assert.equal(style.getPropertyPriority("--adaptive-text"), "important");

  application.restore();
  assert.equal(style.getPropertyValue("--adaptive-text"), "hotpink");
});

test("reapplies CSS variables from immutable originals without theme-switch drift", () => {
  const style = new FakeStyle();
  style.setProperty("--adaptive-text", "hotpink", "important");
  const element = { style };
  const dark = createAdaptivePalette("#1B212D");
  const light = createAdaptivePalette("#F5F7F9");
  const expected = new Map();
  let latest;

  for (let index = 0; index < 20; index += 1) {
    const name = index % 2 === 0 ? "dark" : "light";
    latest = applyPaletteToElement(element, name === "dark" ? dark : light);
    const state = `${style.getPropertyValue("--adaptive-bg")}|${style.getPropertyValue("--adaptive-text")}`;
    if (expected.has(name)) assert.equal(state, expected.get(name));
    else expected.set(name, state);
  }

  latest.restore();
  assert.equal(style.has("--adaptive-bg"), false);
  assert.equal(style.getPropertyValue("--adaptive-text"), "hotpink");
  assert.equal(style.getPropertyPriority("--adaptive-text"), "important");
});
