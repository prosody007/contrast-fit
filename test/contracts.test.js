import test from "node:test";
import assert from "node:assert/strict";
import {
  applyPaletteToElement, paletteToCssVariables, createContrastFit, contrastRatio,
  relativeLuminance, parseHex, normalizeHex, toHex, rgba, mix, readableTone, readableAccent,
} from "../src/contrast-fit.js";

const black = parseHex("#000");
const white = parseHex("fff");

test("WCAG reference values and sRGB breakpoint", () => {
  assert.equal(relativeLuminance(black), 0);
  assert.equal(relativeLuminance(white), 1);
  assert.equal(contrastRatio(black, white), 21);
  assert.equal(contrastRatio(white, white), 1);
  const channel = 0.04045 * 255;
  assert.ok(Math.abs(relativeLuminance({ r: channel, g: channel, b: channel }) - 0.04045 / 12.92) < 1e-12);
});

test("serialization, interpolation and alpha have explicit boundaries", () => {
  assert.equal(toHex({ r: 1.4, g: 127.5, b: 255 }), "#0180FF");
  assert.equal(rgba(white, 2), "rgba(255, 255, 255, 1)");
  assert.equal(rgba(white, -1), "rgba(255, 255, 255, 0)");
  assert.equal(rgba(black, 0.123456), "rgba(0, 0, 0, 0.1235)");
  assert.deepEqual(mix(black, white, 0), black);
  assert.deepEqual(mix(black, white, 1), white);
  assert.equal(toHex(mix(black, white, 0.5)), "#808080");
  for (const invalid of [null, {}, { r: NaN, g: 0, b: 0 }, { r: "1", g: 0, b: 0 }, { r: 256, g: 0, b: 0 }, { r: 0, g: -1, b: 0 }]) {
    for (const fn of [toHex, relativeLuminance, (color) => rgba(color, 0.5), (color) => mix(color, white, 0.5)]) {
      assert.throws(() => fn(invalid));
    }
  }
  for (const amount of [-1, 2, NaN, Infinity, "0.5"]) assert.throws(() => mix(black, white, amount), /amount/);
  for (const alpha of [NaN, Infinity, "1"]) assert.throws(() => rgba(black, alpha), /alpha/);
});

test("strict color input rejects every unsupported representation", () => {
  for (const input of [null, undefined, 123, {}, "", "#12", "#1234", "#12345678", "rgb(0,0,0)", "abc#def", "#ggg", "##fff", "#fff\n#000"]) {
    assert.equal(normalizeHex(input), null);
    assert.throws(() => parseHex(input), /Invalid hex/);
    assert.throws(() => createContrastFit(input), /Invalid background/);
  }
  assert.equal(normalizeHex(" \n#abc\t"), "#AABBCC");
});

test("known option keys and finite contrast bounds fail loudly", () => {
  for (const options of [[], "bad", true, 7, new Date()]) assert.throws(() => createContrastFit("fff", options), /options/);
  for (const strategy of [null, "", "warn", "AUTO", 1, true, {}, []]) {
    assert.throws(() => createContrastFit("fff", { backgroundStrategy: strategy }), /backgroundStrategy/);
  }
  assert.deepEqual(createContrastFit("fff", { backgroundStrategy: undefined }), createContrastFit("fff"));
  assert.deepEqual(createContrastFit("fff", null), createContrastFit("fff"));
  assert.throws(() => createContrastFit("fff", { textContast: 7 }), /Unknown options/);
  assert.throws(() => createContrastFit("fff", { accents: { seriseA: "#123456" } }), /Unknown accents/);
  for (const key of ["textContrast", "mutedContrast", "accentContrast", "surfaceTextContrast"]) {
    for (const value of [0, 22, NaN, Infinity, "4.5"]) assert.throws(() => createContrastFit("fff", { [key]: value }), new RegExp(key));
  }
  for (const value of [[], "red", new Date()]) assert.throws(() => createContrastFit("fff", { accents: value }), /accents/);
  for (const fn of [readableTone, readableAccent]) assert.throws(() => fn(black, white, 22), /minimumContrast/);
});

test("preserves valid per-series accents and never mutates options", () => {
  const options = Object.freeze({ accents: Object.freeze({ seriesA: "#FF0000", seriesB: "#00FF00", seriesC: "#00FFFF" }) });
  const palette = createContrastFit("#000000", options);
  for (const key of ["seriesA", "seriesB", "seriesC"]) assert.equal(palette.colors[key], options.accents[key]);
  const partial = createContrastFit("#000", { accents: { seriesB: undefined } });
  assert.equal(partial.colors.seriesB, "#F06B8A");
  assert.deepEqual(createContrastFit("#000", options), palette);
});

test("CSS serializer exports all 17 colors without DOM, validates before mutation", () => {
  const palette = createContrastFit("#123456");
  const defaults = paletteToCssVariables(palette);
  assert.equal(defaults["--contrast-fit-bg"], palette.background);
  assert.equal(Object.keys(defaults).length, 17);
  assert.ok(Object.keys(defaults).every((name) => name.startsWith("--contrast-fit-")));
  const variables = paletteToCssVariables(palette, "report");
  const names = ["bg", "text", "muted", "panel", "metric", "border", "grid", "axis", "plot-fill", "bars", "series-a", "series-b", "series-c", "good-bg", "good-text", "warn-bg", "warn-text"];
  assert.deepEqual(Object.keys(variables), names.map((name) => `--report-${name}`));
  assert.deepEqual(Object.values(variables), Object.values(palette.colors));
  const written = {};
  assert.deepEqual(applyPaletteToElement({ style: { setProperty(name, value) { written[name] = value; } } }, palette, "report"), variables);
  assert.deepEqual(written, variables);
  for (const invalid of [null, {}, { colors: {} }, { colors: { ...palette.colors, text: "red; background: url(https://invalid/)" } }]) {
    let calls = 0;
    assert.throws(() => applyPaletteToElement({ style: { setProperty() { calls += 1; } } }, invalid), /palette/);
    assert.equal(calls, 0);
  }
  for (const prefix of [null, "", "bad prefix", "1x", "--x;", 3]) assert.throws(() => paletteToCssVariables(palette, prefix), /prefix/);
});

function checkPalette(palette) {
  const metricTargetPairs = {
    text: ["textContrast", "textContrast"], muted: ["mutedContrast", "mutedContrast"],
    panelText: ["panelTextContrast", "surfaceTextContrast"], panelMuted: ["panelMutedContrast", "surfaceTextContrast"],
    metricText: ["metricTextContrast", "surfaceTextContrast"], metricMuted: ["metricMutedContrast", "surfaceTextContrast"],
    seriesA: ["seriesAContrast", "accentContrast"], seriesB: ["seriesBContrast", "accentContrast"], seriesC: ["seriesCContrast", "accentContrast"],
    goodText: ["goodTextContrast", "surfaceTextContrast"], warnText: ["warnTextContrast", "surfaceTextContrast"],
  };
  for (const [key, [metric, target]] of Object.entries(metricTargetPairs)) {
    assert.equal(palette.meetsTarget[key], palette.metrics[metric] >= palette.targets[target], `${palette.background}: ${key}`);
  }
  assert.equal(palette.usable, Object.keys(metricTargetPairs).every((key) => palette.meetsTarget[key]));
  assert.ok(Object.values(palette.metrics).every(Number.isFinite));
  assert.equal(palette.tokens.length, 17);
  for (const [key, effective] of Object.entries(palette.effectiveColors)) {
    const match = /^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/.exec(palette.colors[key]);
    const bg = parseHex(palette.background);
    const alpha = Number(match[4]);
    const expected = toHex({ r: Math.round(bg.r + (Number(match[1]) - bg.r) * alpha), g: Math.round(bg.g + (Number(match[2]) - bg.g) * alpha), b: Math.round(bg.b + (Number(match[3]) - bg.b) * alpha) });
    assert.equal(effective, expected);
    assert.equal(palette.alphas[key], alpha);
    if (key === "panel" || key === "metric") {
      const actualComposite = {
        r: bg.r + (Number(match[1]) - bg.r) * alpha,
        g: bg.g + (Number(match[2]) - bg.g) * alpha,
        b: bg.b + (Number(match[3]) - bg.b) * alpha,
      };
      for (const foreground of ["text", "muted"]) {
        if (palette.meetsTarget[`${key}${foreground === "text" ? "Text" : "Muted"}`]) {
          assert.ok(contrastRatio(parseHex(palette.colors[foreground]), actualComposite) >= palette.targets.surfaceTextContrast);
        }
      }
    }
  }
  if (!palette.usable) assert.ok(palette.warnings.length > 0);
  assert.equal(palette.colors.background, palette.background);
}

test("all 4096 short-hex backgrounds obey metric, alpha and series invariants", () => {
  for (let index = 0; index < 4096; index += 1) {
    const palette = createContrastFit(index.toString(16).padStart(3, "0"));
    checkPalette(palette);
    assert.equal(palette.usable, true, palette.inputBackground);
    assert.deepEqual(palette.warnings, []);
    assert.equal(palette.inputBackground, normalizeHex(index.toString(16).padStart(3, "0")));
    assert.ok(palette.meetsTarget.seriesA && palette.meetsTarget.seriesB && palette.meetsTarget.seriesC);
    assert.ok(palette.meetsTarget.seriesDistinct);
    assert.ok(palette.meetsTarget.panelText && palette.meetsTarget.panelMuted && palette.meetsTarget.metricText && palette.meetsTarget.metricMuted);
    assert.equal(new Set([palette.colors.seriesA, palette.colors.seriesB, palette.colors.seriesC]).size, 3);
  }
});

test("all 4096 preserve backgrounds retain their input and honest diagnostics", () => {
  for (let index = 0; index < 4096; index += 1) {
    const input = index.toString(16).padStart(3, "0");
    const palette = createContrastFit(input, { backgroundStrategy: "preserve" });
    checkPalette(palette);
    assert.equal(palette.inputBackground, normalizeHex(input));
    assert.equal(palette.background, palette.inputBackground);
    assert.equal(palette.adjustments.some(({ type }) => type === "background"), false);
    if (!palette.usable) assert.ok(palette.warnings.length > 0);
  }
});

test("gray repair chooses the nearer quantized black/white mixing path", () => {
  for (const input of ["#555555", "#777777", "#999999"]) {
    for (const target of [8, 12, 21]) {
      const originalLightness = Math.cbrt(relativeLuminance(parseHex(input)));
      let nearest = null;
      let nearestDistance = Infinity;
      // For neutral grays, OKLab lightness is cbrt(luminance), so the complete
      // quantized path can be checked independently without a second solver.
      for (let value = 0; value <= 255; value += 1) {
        const color = { r: value, g: value, b: value };
        if (Math.max(contrastRatio(color, white), contrastRatio(color, black)) < target) continue;
        const distance = Math.abs(Math.cbrt(relativeLuminance(color)) - originalLightness);
        if (distance < nearestDistance) {
          nearest = toHex(color);
          nearestDistance = distance;
        }
      }
      const palette = createContrastFit(input, { textContrast: target });
      assert.equal(palette.background, nearest);
      assert.equal(palette.usable, true);
    }
  }
});

test("each independent custom 21 target is solved without reducing the request", () => {
  for (const key of ["textContrast", "mutedContrast", "accentContrast", "surfaceTextContrast"]) {
    for (const background of ["#777777", "#2B3548", "#F5F7F9"]) {
      const options = Object.freeze({ [key]: 21, accents: Object.freeze({ seriesA: "#007F80" }) });
      const palette = createContrastFit(background, options);
      checkPalette(palette);
      assert.equal(palette.usable, true);
      assert.equal(palette.targets[key], 21);
      assert.equal(palette.inputBackground, background);
      assert.deepEqual(palette.warnings, []);
      assert.deepEqual(palette, createContrastFit(background, options));
    }
  }
});

test("extreme targets resolve automatically while preserve diagnostics remain accurate", () => {
  for (const bg of ["#000", "#fff", "#777", "#8855EE"]) {
    for (const target of [1, 21]) {
      const palette = createContrastFit(bg, { textContrast: target, mutedContrast: target, accentContrast: target, surfaceTextContrast: target, accents: { seriesA: "#000", seriesB: "#000", seriesC: "#000" } });
      checkPalette(palette);
      assert.equal(palette.usable, true);
      assert.deepEqual(palette.warnings, []);
      const preserved = createContrastFit(bg, { backgroundStrategy: "preserve", textContrast: target, mutedContrast: target, accentContrast: target, surfaceTextContrast: target });
      checkPalette(preserved);
      assert.equal(preserved.background, normalizeHex(bg));
    }
  }
});
