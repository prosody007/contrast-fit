# ContrastFit API reference

ContrastFit turns one opaque background color into a deterministic set of semantic UI colors, measured contrast results, and chart rendering instructions. It has zero runtime dependencies. The supported environments are modern browsers and Node.js 22+ for server-side rendering and tooling.

This reference describes the complete public API. For the product overview, see the [README](../README.md); for the algorithm and its limits, see [architecture](./architecture.md). The authoritative TypeScript declarations are in [`src/contrast-fit.d.ts`](../src/contrast-fit.d.ts).

## Distribution and imports

[`contrast-fit@0.1.0`](https://www.npmjs.com/package/contrast-fit/v/0.1.0) is published on the official npm registry under `latest`. Registry bytes and an empty registry-installed consumer were independently verified. This is an early-access 0.x API; exact fitted colors and APIs may evolve with documented changes. See the [release notes](https://github.com/prosody007/contrast-fit/releases/tag/v0.1.0) and [release checklist](../RELEASING.md) for source, integrity and verification boundaries.

```sh
npm install contrast-fit
# Or pin the first public release:
npm install contrast-fit@0.1.0
```

From a repository checkout:

```js
import {
  createContrastFit,
  paletteToCssVariables,
  applyPaletteToElement,
} from "./src/contrast-fit.js";
```

To use the package in a separate local application, build and pack the reviewed checkout, then install the resulting file:

```sh
# In the ContrastFit checkout, with its development tools installed:
npm run build
npm pack --pack-destination ../

# In the consuming application; replace <version> with the archive's actual version:
npm install /path/to/contrast-fit-<version>.tgz
```

The package provides named exports through ESM and CommonJS entry points:

```js
// ESM, after installing from npm or a reviewed local tarball:
import { createContrastFit } from "contrast-fit";

// CommonJS, in a separate .cjs consumer:
const { createContrastFit } = require("contrast-fit");
```

Build outputs are `dist/contrast-fit.js` (ESM), `dist/contrast-fit.cjs` (CommonJS), and `dist/contrast-fit.global.js` (classic browser script), with TypeScript declarations resolved by the package manifest. The browser bundle exposes the named exports on `globalThis.ContrastFit`:

```html
<!-- Copy node_modules/contrast-fit/dist/contrast-fit.global.js into your assets directory. -->
<script src="assets/contrast-fit.global.js"></script>
<script>
  const palette = globalThis.ContrastFit.createContrastFit("#123456");
</script>
```

The browser example is self-hosted and does not rely on a CDN. The global bundle does not automatically apply a theme or modify the page. Strict TypeScript consumers resolve ESM declarations through the import export condition and CommonJS declarations through the require condition; both NodeNext import and typed require were verified against the actual registry-installed release.

## Input conventions

- Color strings must be opaque three- or six-digit hex. A leading `#` is optional; surrounding whitespace is trimmed; normalized output is uppercase `#RRGGBB`.
- CSS names, `rgb()`, `hsl()`, eight-digit hex, gradients, images, and transparent backgrounds are not accepted.
- A `Color` is `{ r: number, g: number, b: number }`, with finite channels in `[0, 255]`. Fractional RGB channels are allowed before serialization.
- Options and `accents` must be plain objects (ordinary or null-prototype objects), not arrays or class instances. Unknown option/accent keys throw rather than being ignored.
- Every contrast target is a finite number in `[1, 21]`; targets are never silently lowered.
- Results are fresh objects. Calls do not mutate input options, retain elements, read browser state, or share mutable result objects with later calls.

## `createContrastFit(backgroundHex, options?) → ContrastFitPalette`

Creates a palette. It is deterministic and DOM-free, so it can run in a browser, during server rendering, or in a build process.

```js
const palette = createContrastFit("#777777", {
  backgroundStrategy: "auto",
  textContrast: 8,
  mutedContrast: 4.7,
  accentContrast: 3.3,
  surfaceTextContrast: 4.5,
  accents: {
    seriesA: "#18B7A6",
    seriesB: "#F06B8A",
    seriesC: "#8F7DFF",
  },
});

palette.inputBackground;            // "#777777": original normalized input
palette.background;                 // "#A0A0A0": actual resolved content background
palette.colors.text;                // "#000000"
palette.metrics.textContrast;       // approximately 8.03
palette.usable;                      // true: evaluated numeric contrast targets pass
palette.adjustments[0].type;         // "background"
```

The example uses the current default algorithm. Do not hard-code a particular repaired color as a permanent cross-version guarantee.

### Options (`PaletteOptions`)

| Field | Default | Meaning |
| --- | --- | --- |
| `backgroundStrategy` | `"auto"` | Fit the content background when necessary. `"preserve"` locks the exact normalized input background. |
| `textContrast` | `8` | Minimum text/background ratio. |
| `mutedContrast` | `4.7` | Minimum muted-text/background ratio. |
| `accentContrast` | `3.3` | Minimum ratio for each series color against the resolved background. |
| `surfaceTextContrast` | `4.5` | Minimum text and muted-text ratios on panel/metric surfaces, and foreground/background ratios for both status pairs. |
| `accents` | values in the example above | Optional `seriesA`, `seriesB`, and `seriesC` opaque hex preferences. Readable, sufficiently distinct preferences are retained where possible. |

Omitted or `null` top-level options select defaults. At runtime, nullish target values, `accents`, and individual accent values also fall back to defaults; the TypeScript options intentionally describe normal, non-null field values. `backgroundStrategy: null` is invalid, not a request for the default.

Text may be strengthened beyond its base target to satisfy surface requirements. Auto mode bases background feasibility on the maximum of the four requested targets. It fits rather than lowering those targets.

With `backgroundStrategy: "preserve"`, `background === inputBackground`, but `usable` can be false and `warnings` can describe unresolved contrast constraints. Generated status pairs may still be repaired: preserve mode locks the content background, not every generated color.

### Return fields (`ContrastFitPalette`)

| Field | Meaning |
| --- | --- |
| `inputBackground` | Normalized original input. Suitable for an outside frame or an input control, not a substitute for the resolved content background. |
| `background` | Actual content background. Identical to `colors.background`; all content metrics and alpha composites use this color. |
| `isDark` | Whether white has strictly greater contrast than black on the resolved background. It is a text-direction decision, not an independent perceptual theme classification. |
| `colors` | The 17 authored CSS color values listed below. |
| `effectiveColors` | Seven opaque hex composites for `panel`, `metric`, `border`, `grid`, `axis`, `plotFill`, and `bars`. |
| `alphas` | Applied numeric alpha values for those same seven fields. |
| `targets` | Effective `textContrast`, `mutedContrast`, `accentContrast`, and `surfaceTextContrast` options. |
| `metrics` | Raw contrast ratios, RGB distances, and OKLab distances; see the metric table below. |
| `meetsTarget` | Individual pass/fail flags, including a separate color-only `seriesDistinct` flag. |
| `usable` | True when all evaluated numeric contrast-target flags pass. It excludes `seriesDistinct` and does not inspect whether a chart adapter actually applies `seriesStyles`. |
| `adjustments` | Traceable records for background repair, status-pair repair, or required redundant series encoding. |
| `seriesStyles` | Stable per-series dash/marker instructions, available on every result. |
| `warnings` | Human-readable unresolved diagnostics. Not stable machine-readable error codes; inspect flags for decisions. |
| `tokens` | 17 token metadata records for display/inspection, described below. |

`usable` is **not** a whole-page accessibility certificate, a color-vision-deficiency guarantee, or a claim that every border, axis, bar, grid line, or arbitrary foreground/background combination passes a contrast threshold. Empty warnings likewise do not establish complete accessibility.

### Colors and CSS variables

The default prefix is `contrast-fit`. There are exactly 17 color entries and 17 CSS variables:

| `colors` key | Default CSS variable | Authored value |
| --- | --- | --- |
| `background` | `--contrast-fit-bg` | Opaque hex; the resolved content background |
| `text` | `--contrast-fit-text` | Opaque hex |
| `muted` | `--contrast-fit-muted` | Opaque hex |
| `panel` | `--contrast-fit-panel` | `rgba(...)` |
| `metric` | `--contrast-fit-metric` | `rgba(...)` |
| `border` | `--contrast-fit-border` | `rgba(...)` |
| `grid` | `--contrast-fit-grid` | `rgba(...)` |
| `axis` | `--contrast-fit-axis` | `rgba(...)` |
| `plotFill` | `--contrast-fit-plot-fill` | `rgba(...)` |
| `bars` | `--contrast-fit-bars` | `rgba(...)` |
| `seriesA` | `--contrast-fit-series-a` | Opaque hex |
| `seriesB` | `--contrast-fit-series-b` | Opaque hex |
| `seriesC` | `--contrast-fit-series-c` | Opaque hex |
| `goodBg` | `--contrast-fit-good-bg` | Opaque hex |
| `goodText` | `--contrast-fit-good-text` | Opaque hex |
| `warnBg` | `--contrast-fit-warn-bg` | Opaque hex |
| `warnText` | `--contrast-fit-warn-text` | Opaque hex |

The seven alpha values assume **one layer directly over `background`**. Nesting `metric` inside a translucent `panel`, adding a gradient, or using another parent background invalidates that single-layer measurement. Use `effectiveColors` as opaque surface values when that better matches your layout, and retest the rendered result.

### Metrics and flags

| `metrics` field(s) | Compared colors | `meetsTarget` field(s) and rule |
| --- | --- | --- |
| `textContrast` | `text` / `background` | `text`: at least `targets.textContrast` |
| `mutedContrast` | `muted` / `background` | `muted`: at least `targets.mutedContrast` |
| `panelTextContrast`, `panelMutedContrast` | `text`, `muted` / `effectiveColors.panel` | `panelText`, `panelMuted`: at least `targets.surfaceTextContrast` |
| `metricTextContrast`, `metricMutedContrast` | `text`, `muted` / `effectiveColors.metric` | `metricText`, `metricMuted`: at least `targets.surfaceTextContrast` |
| `seriesAContrast`, `seriesBContrast`, `seriesCContrast` | Each series / `background` | `seriesA`, `seriesB`, `seriesC`: at least `targets.accentContrast` |
| `goodTextContrast`, `warnTextContrast` | Each status foreground / its own status background | `goodText`, `warnText`: at least `targets.surfaceTextContrast` |
| `seriesABDistance`, `seriesACDistance`, `seriesBCDistance` | Euclidean distance in encoded RGB channel units | Part of `seriesDistinct` |
| `seriesABPerceptualDistance`, `seriesACPerceptualDistance`, `seriesBCPerceptualDistance` | Euclidean distance in OKLab | Part of `seriesDistinct` |

`seriesDistinct` requires every pair to meet both the current RGB distance threshold (`32`) and OKLab distance threshold (`0.075`). These are selection heuristics, not WCAG thresholds and not simulations of different forms of color vision. Compare raw ratios for pass/fail decisions; rounded display values can hide a failing boundary.

### Chart rendering instructions

```js
palette.seriesStyles;
// {
//   seriesA: { dashArray: "none", marker: "circle" },
//   seriesB: { dashArray: "9 5", marker: "square" },
//   seriesC: { dashArray: "2 5", marker: "diamond" }
// }
```

Apply these to chart paths, point markers, and matching legend keys. `dashArray` is an SVG/CSS dash string; `marker` is a symbolic instruction for your adapter to draw a shape, not an SVG marker URL. The serializers below export colors only; they do not modify chart geometry or supply a framework adapter.

At extreme targets, for example 21:1 for every option, the available contrast-passing series colors can collapse. `usable` can be true while `meetsTarget.seriesDistinct` is false. A `series-encoding` adjustment asks the renderer to use the supplied patterns and shapes. Provide labels or a data table as appropriate; do not equate the numeric flag with accessible chart semantics.

### Adjustments and token metadata

Each adjustment has `type: "background" | "status" | "series-encoding"`, a human-readable `message`, and optional `from`/`to` hex strings. These records describe selected repairs or rendering instructions, not a full log of every intermediate candidate, foreground mix, or alpha change. Do not parse message text as an API.

Each token has:

| Field | Meaning |
| --- | --- |
| `name` | Display label, not a versioned machine identifier. |
| `css` | Authored CSS color, equivalent to `swatch`. |
| `color` | Opaque source hex, before alpha composition. |
| `alpha` | Applied alpha; `1` for opaque tokens. |
| `effectiveColor` | Quantized opaque composition over the resolved content background. |
| `contrast` | Evaluated ratio for text, muted text, series, and status foregrounds; otherwise `null`. |
| `value` | Display string: CSS hex for opaque tokens, `"#RRGGBB / alpha"` for transparent tokens. Do not use this field as a CSS color. |
| `swatch` | CSS swatch value, equivalent to `css`. |

The `Background` token represents the resolved background. Prefer named `colors`, `effectiveColors`, and `alphas` fields rather than array positions or display names for application logic.

## `paletteToCssVariables(palette, prefix = "contrast-fit")`

Returns a fresh `Record<string, string>` with the 17 properties above. This function does not read or write the DOM and is suitable for server-side rendering.

- The input must contain the complete generated `colors` object. The TypeScript parameter is `Pick<ContrastFitPalette, "colors">`.
- A custom prefix must match `[A-Za-z_][A-Za-z0-9_-]*`; it replaces only the prefix, not the token suffixes.
- Values are validated before returning. Treat the input as generated palette data, not arbitrary untrusted CSS; this is not a general CSS sanitizer.
- It does not serialize `seriesStyles`, warnings, attributes, or the original input color.

```js
const variables = paletteToCssVariables(createContrastFit("#123456"), "card");
variables["--card-bg"]; // "#123456"
```

Use your renderer's normal escaping and style-property handling for SSR. Reuse the same input and options during client hydration.

## `applyPaletteToElement(element, palette, prefix = "contrast-fit")`

Validates the element adapter and the complete CSS map, then calls `element.style.setProperty(name, value)` once for each variable. Returns that map.

```js
const card = document.querySelector(".card");
if (card) applyPaletteToElement(card, createContrastFit("#777777"));
```

The element needs only `{ style: { setProperty(name, value) } }`; a real DOM element is not required. This supports test doubles and custom renderers. The function does not set `background-color`, so your stylesheet must consume `--contrast-fit-bg`. It does not remove unrelated properties, update chart styles, attach listeners, or retain the element. If a custom `setProperty` implementation throws midway, previous writes are not rolled back.

## Color utilities

All utilities are named exports in every distribution format. They operate on opaque RGB objects unless stated otherwise.

| Signature | Behavior |
| --- | --- |
| `normalizeHex(value: unknown): string \| null` | Normalize supported hex to uppercase six-digit form; return `null` for unsupported input, including ordinary non-string values. |
| `parseHex(hex: string): Color` | Parse supported hex to integer RGB channels. |
| `toHex(color: Color): string` | Validate channels, round each to its nearest integer, and return uppercase hex. |
| `rgba(color: Color, alpha: number): string` | Validate channels and finite alpha; clamp alpha to `[0, 1]`, round it to four decimals, and round channels to integers. Return CSS `rgba(...)`. |
| `mix(first: Color, second: Color, amount: number): Color` | Interpolate in encoded sRGB with finite `amount` in `[0, 1]`. Preserve fractional channels; this is neither linear-light nor perceptual interpolation. |
| `relativeLuminance(color: Color): number` | WCAG relative luminance in `[0, 1]`, using the sRGB transfer function. |
| `contrastRatio(first: Color, second: Color): number` | Symmetric WCAG ratio in `[1, 21]`. No automatic alpha composition. |
| `readableTone(background: Color, base: Color, minimumContrast: number): Color` | Try quantized background-to-base mixes from 32% to 100% in 1% steps. Return the first passing candidate, otherwise the strongest candidate on that search path. |
| `readableAccent(background: Color, accent: Color, minimumContrast = 3.3): Color` | Preserve a quantized accent if it already passes; otherwise try 1% mixes toward whichever of black/white has stronger background contrast (white on a tie). Return the first passing or strongest available candidate. |

`readableTone` and `readableAccent` return only a color, not success metadata. They do not repair the background. In particular, `readableTone` searches only toward the supplied base and can fail a target that the opposite direction could satisfy. Use `createContrastFit` for automatic direction selection, background repair, and target-status reporting.

## Errors

| Condition | Error type |
| --- | --- |
| Unsupported background or accent string passed to `createContrastFit` | `Error` |
| Unsupported color string passed to `parseHex` | `Error` |
| Non-plain options/accents object, unknown option/accent key, or unsupported `backgroundStrategy` | `TypeError` |
| A target is not a finite number in `[1, 21]` | `RangeError` |
| Missing/malformed RGB object or a non-numeric/non-finite channel | `TypeError` |
| RGB channel outside `[0, 255]` | `RangeError` |
| Non-numeric/non-finite alpha passed to `rgba` | `TypeError` |
| Non-numeric/non-finite/out-of-range mix amount | `RangeError` |
| Missing/incomplete/malformed palette colors, or an invalid CSS prefix | `TypeError` |
| Element without a callable `style.setProperty` | `TypeError` |
| An application-supplied `setProperty` throws | Its original error propagates; writes already made are not rolled back |

`normalizeHex` returns `null` instead of throwing for unsupported color input. Contrast failures in an otherwise valid preserve-mode request return flags and warnings rather than throwing. Error messages and warning strings are diagnostic prose, not stable identifiers.

## Public type inventory

The declaration file exports `Color`, `AccentOptions`, `PaletteOptions`, `PaletteColors`, `EffectiveColors`, `PaletteTargets`, `PaletteMetrics`, `PaletteMeetsTarget`, `PaletteToken`, `PaletteAdjustment`, `SeriesStyles`, `ContrastFitPalette`, `StyleLike`, and `ElementLike`. These are compile-time types, not runtime constructors. Breaking pre-release changes are recorded in [MIGRATING.md](../MIGRATING.md) and [CHANGELOG.md](../CHANGELOG.md).
