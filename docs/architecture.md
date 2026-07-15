# Architecture

Adaptive Palette is intentionally small. The project is split into three layers:

1. `src/adaptive-palette.js`
   Framework-agnostic color computation. It accepts a background color and returns semantic color tokens, contrast metrics, and swatch metadata.

2. `examples/dashboard/`
   A plain HTML/CSS/JS demo that shows how generated tokens can drive dense charts, metrics, and status tags.

3. `index.html`
   A GitHub Pages friendly entry point that redirects to the dashboard example.

## Algorithm

The core module uses WCAG relative luminance and contrast ratio calculations:

- Pick black or white as the base readable direction.
- Mix from the background toward the readable base until text reaches the target contrast.
- Derive panel, border, grid, axis, and chart fill tokens with lightness-aware mixing.
- Adjust accent colors until they meet the minimum chart-series contrast.
- Export all results as CSS custom property friendly values.

The library does not depend on `mix-blend-mode`, because blend modes are visual effects and cannot reliably guarantee text or chart contrast.
