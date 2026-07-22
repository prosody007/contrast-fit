# Adaptive Palette

Generate auditable, theme-aware UI color tokens from a single background color, with an optional conservative adapter for supported inline SVG paints.

Adaptive Palette is a small framework-agnostic color engine for AI-generated dashboards, charts, cards, and dynamic UI surfaces. It helps generated interfaces stay readable on both dark and light backgrounds without manually maintaining separate theme palettes.

## Highlights

- Generates semantic UI tokens from one background color
- Uses WCAG relative luminance and contrast ratio calculations
- Produces text, muted text, borders, panels, chart grid, axes, series colors, and status colors
- Reports whether every required contrast and series-separation contract was actually met
- Measures serialized and alpha-composited output, not only intermediate floating-point colors
- Keeps chart series distinct in OKLCH/OKLab, including color-vision-deficiency checks
- Conservatively adapts supported inline SVG paints and fails atomically to a caller-owned fallback
- Exports CSS custom properties for easy integration
- Works without dependencies, build tools, or a runtime framework
- Includes a static dashboard demo ready for Vercel

## Demo

Run locally:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:4173/
```

The demo contains dense chart cards with background color controls. Change a background color and the text, borders, chart lines, grid, and status colors update together.

## Installation

This repository currently ships as source-first JavaScript. You can import the module directly from `src/adaptive-palette.js` or copy the file into your own project.

```js
import {
  applyPaletteToElement,
  createAdaptivePalette,
} from "./src/adaptive-palette.js";
```

## Quick Start

```html
<article class="card" data-bg="#2B3548">
  <h2>North America expansion</h2>
  <svg class="chart"></svg>
</article>
```

```js
import {
  applyPaletteToElement,
  createAdaptivePalette,
} from "./src/adaptive-palette.js";

const card = document.querySelector(".card");
const palette = createAdaptivePalette(card.dataset.bg);

applyPaletteToElement(card, palette);
```

```css
.card {
  background: var(--adaptive-bg);
  color: var(--adaptive-text);
  border: 1px solid var(--adaptive-border);
}

.chart-grid {
  stroke: var(--adaptive-grid);
}

.chart-line {
  stroke: var(--adaptive-series-a);
}
```

## API

### `createAdaptivePalette(backgroundHex, options?)`

Creates an adaptive palette from a hex background color.

```js
const palette = createAdaptivePalette("#F5F7F9", {
  textContrast: 4.5,
  preferredTextContrast: 7,
  mutedContrast: 4.5,
  graphicContrast: 3,
  seriesContrast: 3.3,
  accents: {
    seriesA: "#18B7A6",
    seriesB: "#F06B8A",
    seriesC: "#8F7DFF",
  },
});
```

Returns:

```js
{
  background: "#F5F7F9",
  isDark: false,
  colors: {
    background: "#F5F7F9",
    text: "#494A4B",
    muted: "#6C6D6E",
    border: "rgba(...)",
    grid: "rgba(...)",
    seriesA: "#009385"
  },
  metrics: {
    textContrast: 7.04,
    axisContrast: 3.01,
    seriesAContrast: 3.55
  },
  compliance: {
    valid: true,
    failures: []
  },
  tokens: []
}
```

The required text contract defaults to WCAG AA `4.5:1`. The engine prefers `7:1` when the background can reach it. If a caller explicitly requires an impossible target, the best reachable color is returned with `targetMet: false`, and `compliance.valid` becomes `false`.

### `solveContrast(background, base, minimumContrast, options?)`

Returns both the final serialized color and auditable status metadata:

```js
const result = solveContrast(background, base, 8);

// {
//   css: "#000000",
//   target: 8,
//   achieved: 5.2278,
//   maximum: 5.2278,
//   targetMet: false
// }
```

### `applyPaletteToElement(element, palette, prefix?)`

Writes generated colors to CSS custom properties. The default prefix is `adaptive`.

```js
applyPaletteToElement(card, palette);
```

The returned object preserves the previous custom-property values and exposes an idempotent `restore()` method:

```js
const application = applyPaletteToElement(card, palette);
application.restore();
```

Common variables:

```text
--adaptive-bg
--adaptive-text
--adaptive-muted
--adaptive-panel
--adaptive-metric
--adaptive-border
--adaptive-grid
--adaptive-axis
--adaptive-bars
--adaptive-series-a
--adaptive-series-b
--adaptive-series-c
--adaptive-good-bg
--adaptive-good-text
--adaptive-warn-bg
--adaptive-warn-text
```

### Conservative Inline SVG Adapter

Import the adapter from the `./svg` export (or directly from `src/svg-paint-adapter.js` in a source checkout):

```js
import { createAdaptivePalette } from "adaptive-palette";
import { adaptSvgPaint } from "adaptive-palette/svg";

const palette = createAdaptivePalette("#1B212D");
const result = adaptSvgPaint(svgElement, palette);

if (result.fallback) {
  svgContainer.classList.add("light-island");
}

// Reapply from immutable originals after a theme change.
const next = adaptSvgPaint(svgElement, createAdaptivePalette("#F5F7F9"));
next.restore();
```

Prefer explicit roles when the generator can provide them:

```html
<svg>
  <rect width="100%" height="100%" data-color-role="background" />
  <text data-color-role="text">Revenue</text>
  <path data-color-role="axis" />
  <path data-color-role="series-1" />
</svg>
```

The first adapter release supports presentation attributes, inline style, `currentColor`, CSS variables, local paint references, and simple linear/radial gradient stops. It rejects the whole adaptation without partial writes when it finds filters, masks, patterns, embedded style blocks, external references, raster images, unknown roles, unsupported paint syntax, or an input larger than the configured node limit. The caller must retain a light-surface fallback for those cases.

The adapter is not an HTML/SVG sanitizer and does not make untrusted script or event attributes safe. Sanitize model output before it reaches this layer.

## How It Works

Adaptive Palette uses deterministic color generation:

1. Normalize and parse the input background color.
2. Calculate WCAG relative luminance and contrast ratio.
3. Choose a readable text direction from black or white.
4. Solve required and preferred contrast independently and report unreachable targets.
5. Serialize, composite, and remeasure the final CSS colors.
6. Derive meaningful axes and bars at `3:1`; keep decorative grid contrast explicitly separate.
7. Search chart accents in OKLCH/OKLab while checking background contrast, pairwise separation, and simulated color-vision deficiencies.
8. Export colors, contract status, metrics, and CSS variables.

The project does not use global inversion or `mix-blend-mode` as the primary strategy. Those effects cannot reliably preserve semantic colors or guarantee readability for dense charts and small UI text.

## Scope

The palette engine is the preferred path for token-compliant generated UI. The SVG adapter is a compatibility layer, not a promise to reinterpret arbitrary SVG semantics. Vendor-managed charts such as Plotly and JSXGraph should be updated through their own theme APIs; Canvas, WebGL, Lottie, external SVG images, and complex paint servers remain caller-owned fallback cases.

Runtime code has no dependencies. The core module is framework-agnostic. The SVG adapter requires modern DOM and `CSSStyleDeclaration` APIs; validate it in the minimum WebView/browser versions your product supports before production rollout.

## Project Structure

```text
.
├── src/
│   ├── adaptive-palette.js
│   └── svg-paint-adapter.js
├── examples/
│   └── dashboard/
│       ├── index.html
│       ├── styles.css
│       └── app.js
├── docs/
│   ├── index.html
│   ├── styles.css
│   └── architecture.md
├── scripts/
│   └── build-static.mjs
├── test/
│   ├── adaptive-palette.test.js
│   └── svg-paint-adapter.test.js
├── vercel.json
├── package.json
└── README.md
```

## Development

```bash
npm test
npm run check
npm run build
npm run dev
```

Scripts:

- `npm run dev` starts a local static server on `127.0.0.1:4173`
- `npm run check` validates JavaScript syntax
- `npm test` runs the core and SVG adapter contract suites
- `npm run build` validates the project and writes static output to `public/`

## Deploy to Vercel

This project is static and does not require a backend or environment variables.

Recommended Vercel settings:

- Framework Preset: `Other`
- Build Command: `npm run build`
- Output Directory: `public`
- Project Root: repository root

The included `vercel.json` redirects `/` to `/examples/dashboard/` and adds basic static-site security headers.

## Security

The demo is static and does not collect user data, access cookies, or send network requests. Inputs are limited to hex colors and validated before use. The SVG adapter changes paint values only; it does not sanitize scripts, event handlers, URLs, or arbitrary markup. Sanitize untrusted content before adaptation, and avoid injecting it with `innerHTML`.

## License

MIT
