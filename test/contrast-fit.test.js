import test from "node:test";
import assert from "node:assert/strict";

import {
  applyPaletteToElement,
  contrastRatio,
  createContrastFit,
  normalizeHex,
  parseHex,
} from "../src/contrast-fit.js";

test("normalizes 3 and 6 digit hex colors", () => {
  assert.equal(normalizeHex("#abc"), "#AABBCC");
  assert.equal(normalizeHex("f5f7f9"), "#F5F7F9");
  assert.equal(normalizeHex("nope"), null);
  assert.equal(normalizeHex("abc#def"), null);
  assert.equal(normalizeHex("#abcd"), null);
});

test("generates readable text tokens for dark and light backgrounds", () => {
  const dark = createContrastFit("#2B3548");
  const light = createContrastFit("#F5F7F9");

  assert.ok(dark.metrics.textContrast >= 8);
  assert.ok(dark.metrics.mutedContrast >= 4.7);
  assert.ok(light.metrics.textContrast >= 8);
  assert.ok(light.metrics.mutedContrast >= 4.7);
});

test("keeps series colors visible against the background", () => {
  const palette = createContrastFit("#6938EF");
  const background = parseHex(palette.background);

  assert.ok(contrastRatio(parseHex(palette.colors.seriesA), background) >= 3.3);
  assert.ok(contrastRatio(parseHex(palette.colors.seriesB), background) >= 3.3);
  assert.ok(contrastRatio(parseHex(palette.colors.seriesC), background) >= 3.3);
});

test("reports metrics from the final quantized CSS colors", () => {
  const palette = createContrastFit("#0011FF");
  const background = parseHex(palette.background);
  const text = parseHex(palette.colors.text);
  const muted = parseHex(palette.colors.muted);

  assert.equal(palette.metrics.textContrast, contrastRatio(text, background));
  assert.equal(palette.metrics.mutedContrast, contrastRatio(muted, background));
  assert.equal(palette.meetsTarget.text, palette.metrics.textContrast >= palette.targets.textContrast);
});

test("checks text against alpha-composited surfaces", () => {
  const palette = createContrastFit("#2B3548");
  const muted = parseHex(palette.colors.muted);
  const metricSurface = parseHex(palette.effectiveColors.metric);

  assert.equal(
    palette.metrics.metricMutedContrast,
    contrastRatio(muted, metricSurface),
  );
  assert.equal(palette.meetsTarget.panelMuted, true);
  assert.equal(palette.meetsTarget.metricMuted, true);
  assert.doesNotMatch(palette.warnings.join(" "), /surface/);
});

test("keeps series colors distinct on middle-value backgrounds", () => {
  const palette = createContrastFit("#A0A0A0");
  const series = [palette.colors.seriesA, palette.colors.seriesB, palette.colors.seriesC];

  assert.equal(new Set(series).size, 3);
  assert.equal(palette.meetsTarget.seriesDistinct, true);
  series.forEach((color) => {
    assert.ok(contrastRatio(parseHex(color), parseHex(palette.background)) >= 3.3);
  });
});

test("preserve mode reports when the fixed input cannot support a target", () => {
  const palette = createContrastFit("#777777", { backgroundStrategy: "preserve" });

  assert.equal(palette.inputBackground, "#777777");
  assert.equal(palette.background, "#777777");
  assert.equal(palette.usable, false);
  assert.equal(palette.meetsTarget.text, false);
  assert.equal(palette.meetsTarget.muted, false);
  assert.ok(palette.warnings.some((warning) => warning.includes("not achievable")));
});

test("keeps structured token metadata aligned with CSS output", () => {
  const palette = createContrastFit("#000044");
  const panel = palette.tokens.find(({ name }) => name === "Panel");

  assert.equal(panel.css, palette.colors.panel);
  assert.equal(panel.value, `${panel.color} / ${panel.alpha}`);
  assert.equal(panel.swatch, panel.css);
  assert.equal(panel.color, "#1A1A57");
  assert.equal(panel.effectiveColor, palette.effectiveColors.panel);
  assert.equal(panel.alpha, palette.alphas.panel);
  assert.equal(palette.meetsTarget.panelMuted, true);
  assert.equal(palette.metrics.panelMutedContrast >= palette.targets.surfaceTextContrast, true);
});

test("supports custom targets and rejects invalid options", () => {
  const palette = createContrastFit("#2B3548", {
    textContrast: 7,
    mutedContrast: 4.5,
    accentContrast: 3,
    surfaceTextContrast: 4.2,
  });

  assert.deepEqual(palette.targets, {
    textContrast: 7,
    mutedContrast: 4.5,
    accentContrast: 3,
    surfaceTextContrast: 4.2,
  });
  assert.throws(() => createContrastFit("#2B3548", { textContrast: 0 }), /textContrast/);
  assert.throws(() => createContrastFit("#2B3548", { accents: [] }), /accents/);
  assert.throws(() => createContrastFit("#2B3548", { accents: { seriesA: "#abcd" } }), /accent/);
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

  const palette = createContrastFit("#2B3548");
  applyPaletteToElement(element, palette);

  assert.equal(style.get("--contrast-fit-bg"), "#2B3548");
  assert.equal(style.get("--contrast-fit-text"), palette.colors.text);
  assert.equal(style.get("--contrast-fit-series-a"), palette.colors.seriesA);
});

test("validates palette application inputs and supports custom prefixes", () => {
  const style = new Map();
  const element = {
    style: {
      setProperty(name, value) {
        style.set(name, value);
      },
    },
  };
  const palette = createContrastFit("#FFFFFF");

  applyPaletteToElement(element, palette, "report");
  assert.equal(style.get("--report-text"), palette.colors.text);
  assert.throws(() => applyPaletteToElement(element, palette, "bad prefix"), /prefix/);
  assert.throws(() => applyPaletteToElement({}, palette), /setProperty/);
});

test("auto repairs a middle-gray content background instead of only warning", () => {
  const palette = createContrastFit(" #777 ");

  assert.equal(palette.inputBackground, "#777777");
  assert.notEqual(palette.background, palette.inputBackground);
  assert.equal(palette.colors.background, palette.background);
  assert.equal(palette.usable, true);
  assert.ok(Object.values(palette.meetsTarget).every(Boolean));
  assert.deepEqual(palette.warnings, []);
  assert.deepEqual(palette.adjustments.filter(({ type }) => type === "background").map(({ from, to }) => ({ from, to })),
    [{ from: palette.inputBackground, to: palette.background }]);
  assert.equal(palette.tokens[0].effectiveColor, palette.background);
  assert.deepEqual(palette, createContrastFit("#777", { backgroundStrategy: "auto" }));
});

test("auto leaves already-supporting backgrounds unchanged", () => {
  for (const input of ["#2B3548", "#F5F7F9", "#000000", "#FFFFFF"]) {
    const palette = createContrastFit(input);
    assert.equal(palette.background, input);
    assert.equal(palette.inputBackground, input);
    assert.equal(palette.usable, true);
    assert.deepEqual(palette.adjustments, []);
    assert.deepEqual(palette, createContrastFit(input, { backgroundStrategy: "preserve" }));
  }
});

test("surface targets strengthen foregrounds before fitting translucent surfaces", () => {
  const options = { textContrast: 1, mutedContrast: 1, accentContrast: 1, surfaceTextContrast: 12 };
  for (const background of ["#2B3548", "#F5F7F9", "#777777"]) {
    const palette = createContrastFit(background, options);
    assert.equal(palette.usable, true);
    assert.ok(palette.metrics.textContrast >= 12);
    assert.ok(palette.metrics.mutedContrast >= 12);
    for (const key of ["panelText", "panelMuted", "metricText", "metricMuted", "goodText", "warnText"]) {
      assert.equal(palette.meetsTarget[key], true);
    }
    assert.deepEqual(palette.targets, options);
    assert.deepEqual(palette.warnings, []);
  }
});

test("status repair tries foregrounds before changing status backgrounds", () => {
  const ordinary = createContrastFit("#000");
  const stronger = createContrastFit("#000", { surfaceTextContrast: 10 });
  const strongest = createContrastFit("#000", { surfaceTextContrast: 21 });

  assert.equal(stronger.colors.goodBg, ordinary.colors.goodBg);
  assert.equal(stronger.colors.warnBg, ordinary.colors.warnBg);
  assert.ok(stronger.adjustments.some(({ type, message }) => type === "status" && message.includes("foreground")));
  assert.equal(stronger.adjustments.some(({ type, message }) => type === "status" && message.includes("background")), false);
  assert.ok(strongest.adjustments.some(({ type, message }) => type === "status" && message.includes("background")));
  assert.equal(strongest.metrics.goodTextContrast, 21);
  assert.equal(strongest.metrics.warnTextContrast, 21);
});

test("extreme 21 targets are actually solved with explicit non-color series encodings", () => {
  const options = Object.freeze({ textContrast: 21, mutedContrast: 21, accentContrast: 21, surfaceTextContrast: 21 });
  const expectedStyles = {
    seriesA: { dashArray: "none", marker: "circle" },
    seriesB: { dashArray: "9 5", marker: "square" },
    seriesC: { dashArray: "2 5", marker: "diamond" },
  };
  for (const background of ["#777777", "#2B3548", "#F5F7F9"]) {
    const palette = createContrastFit(background, options);
    assert.equal(palette.inputBackground, background);
    assert.ok(["#000000", "#FFFFFF"].includes(palette.background));
    assert.equal(palette.usable, true);
    assert.equal(palette.meetsTarget.seriesDistinct, false);
    assert.deepEqual(palette.seriesStyles, expectedStyles);
    assert.deepEqual(palette.targets, options);
    assert.deepEqual(palette.warnings, []);
    assert.ok(palette.adjustments.some(({ type }) => type === "series-encoding"));
    for (const [key, value] of Object.entries(palette.meetsTarget)) {
      if (key !== "seriesDistinct") assert.equal(value, true, key);
    }
    assert.equal(palette.alphas.panel, 0);
    if (palette.isDark) assert.equal(palette.alphas.metric, 0);
    assert.equal(palette.tokens.length, 17);
    assert.equal(Object.keys(palette.colors).length, 17);
    assert.deepEqual(palette, createContrastFit(background, options));
  }
});
