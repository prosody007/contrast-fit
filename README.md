# Adaptive Palette

Generate accessible, theme-aware UI color tokens from a single background color.

Adaptive Palette is a small framework-agnostic color engine for AI-generated dashboards, charts, cards, and dynamic UI surfaces. It helps generated interfaces stay readable on both dark and light backgrounds without manually maintaining separate theme palettes.

## Highlights

- Generates semantic UI tokens from one background color
- Uses WCAG relative luminance and contrast ratio calculations
- Produces text, muted text, borders, panels, chart grid, axes, series colors, and status colors
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
  textContrast: 8,
  mutedContrast: 4.7,
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
    seriesA: "#139486"
  },
  metrics: {
    textContrast: 8.25,
    mutedContrast: 4.85,
    seriesAContrast: 3.48
  },
  tokens: []
}
```

### `applyPaletteToElement(element, palette, prefix?)`

Writes generated colors to CSS custom properties. The default prefix is `adaptive`.

```js
applyPaletteToElement(card, palette);
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

## How It Works

Adaptive Palette uses deterministic color generation:

1. Normalize and parse the input background color.
2. Calculate WCAG relative luminance and contrast ratio.
3. Choose a readable text direction from black or white.
4. Mix from the background toward the readable direction until target contrast is reached.
5. Derive panel, border, grid, axis, chart fill, and bar colors.
6. Adjust chart accent colors until they meet the minimum contrast target.
7. Export the result as JavaScript data and CSS variables.

The project does not use `mix-blend-mode` as the primary strategy. Blend modes are useful for visual effects, but they cannot reliably guarantee readability for dense charts and small UI text.

## Project Structure

```text
.
├── src/
│   └── adaptive-palette.js
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
│   └── adaptive-palette.test.js
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
- `npm test` runs Node test coverage for the core palette engine
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

The demo is static and does not collect user data, access cookies, or send network requests. Inputs are limited to hex colors and validated before use. If you extend the demo to accept arbitrary text, remote JSON, or user-provided chart data, avoid injecting that content with `innerHTML`.

## License

MIT
