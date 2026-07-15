import test from "node:test";
import assert from "node:assert/strict";

import {
  applyPaletteToElement,
  contrastRatio,
  createAdaptivePalette,
  normalizeHex,
  parseHex,
} from "../src/adaptive-palette.js";

test("normalizes 3 and 6 digit hex colors", () => {
  assert.equal(normalizeHex("#abc"), "#AABBCC");
  assert.equal(normalizeHex("f5f7f9"), "#F5F7F9");
  assert.equal(normalizeHex("nope"), null);
});

test("generates readable text tokens for dark and light backgrounds", () => {
  const dark = createAdaptivePalette("#2B3548");
  const light = createAdaptivePalette("#F5F7F9");

  assert.ok(dark.metrics.textContrast >= 8);
  assert.ok(dark.metrics.mutedContrast >= 4.7);
  assert.ok(light.metrics.textContrast >= 8);
  assert.ok(light.metrics.mutedContrast >= 4.7);
});

test("keeps series colors visible against the background", () => {
  const palette = createAdaptivePalette("#6938EF");
  const background = parseHex(palette.background);

  assert.ok(contrastRatio(parseHex(palette.colors.seriesA), background) >= 3.3);
  assert.ok(contrastRatio(parseHex(palette.colors.seriesB), background) >= 3.3);
  assert.ok(contrastRatio(parseHex(palette.colors.seriesC), background) >= 3.3);
});

test("applies generated tokens as CSS custom properties", () => {
  const style = new Map();
  const element = {
    style: {
      setProperty(name, value) {
        style.set(name, value);
      },
    },
  };

  const palette = createAdaptivePalette("#2B3548");
  applyPaletteToElement(element, palette);

  assert.equal(style.get("--adaptive-bg"), "#2B3548");
  assert.equal(style.get("--adaptive-text"), palette.colors.text);
  assert.equal(style.get("--adaptive-series-a"), palette.colors.seriesA);
});
