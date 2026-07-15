# Adaptive Palette

Adaptive Palette generates readable semantic UI color tokens from a single background color. It is designed for AI-generated dashboards, charts, cards, and other dynamic UI where manually maintaining separate light and dark theme palettes is expensive.

## Why

AI-generated interfaces often produce random colors, low contrast text, unreadable charts, or components that only work on one background. This project provides a small reusable color engine that turns one background color into a full set of practical UI tokens:

- text and muted text
- panels, metric cards, borders, grid lines, and axes
- chart series colors and bar colors
- success and warning status colors
- contrast metadata for debugging

## Demo

Run the local demo:

```bash
npm run dev
```

Then open:

```text
http://127.0.0.1:4173/
```

The demo includes two dense chart cards. Change the background color input and the chart, text, borders, and status colors update together.

## Usage

```js
import {
  applyPaletteToElement,
  createAdaptivePalette,
} from "./src/adaptive-palette.js";

const card = document.querySelector(".card");
const palette = createAdaptivePalette("#2B3548");

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
```

## API

### `createAdaptivePalette(backgroundHex, options?)`

Returns generated colors, contrast metrics, and swatch metadata.

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

### `applyPaletteToElement(element, palette, prefix?)`

Writes the generated tokens to CSS custom properties. The default prefix is `adaptive`, producing variables such as:

- `--adaptive-bg`
- `--adaptive-text`
- `--adaptive-muted`
- `--adaptive-border`
- `--adaptive-grid`
- `--adaptive-series-a`

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
│   └── architecture.md
├── test/
│   └── adaptive-palette.test.js
├── index.html
├── package.json
└── README.md
```

## Development

```bash
npm test
npm run check
npm run dev
```

## Deploy to Vercel

This is a static project and does not require a backend or environment variables.

1. Push the repository to GitHub.
2. Import the repository in Vercel.
3. Use the default project root.
4. Keep the framework preset as `Other` if Vercel does not detect one.
5. Use `npm run build` as the build command.

The included `vercel.json` redirects `/` to `/examples/dashboard/` and adds basic static-site security headers.

## Notes

This project uses WCAG contrast calculations and deterministic color mixing. It does not use `mix-blend-mode` as the primary strategy because blend modes are useful for visual effects but cannot reliably guarantee readability for dense charts and small UI text.

## License

MIT
