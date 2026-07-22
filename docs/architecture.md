# Architecture

Adaptive Palette is intentionally small. The project is split into four layers:

1. `src/adaptive-palette.js`
   Framework-agnostic color computation. It returns semantic tokens, final-output contrast metrics, explicit contract status, OKLab series separation, and reversible CSS-variable application.

2. `src/svg-paint-adapter.js`
   Optional DOM integration for a deliberately limited inline SVG subset. It plans changes before writing, reapplies from immutable originals, and reports unsupported content so the caller can retain a light-surface fallback.

3. `examples/dashboard/`
   A plain HTML/CSS/JS demo that shows how generated tokens can drive dense charts, metrics, and status tags.

4. `index.html`
   A GitHub Pages friendly entry point that redirects to the dashboard example.

## Algorithm

The core module uses WCAG relative luminance and contrast ratio calculations:

- Pick black or white as the base readable direction.
- Solve required and preferred text targets separately, with explicit failure metadata.
- Remeasure rounded colors and alpha-composited pixels.
- Keep meaningful axes and bars above the non-text contrast target while treating grid lines as decorative.
- Search accents in OKLCH/OKLab and reject indistinguishable series combinations.
- Export colors, metrics, compliance status, and restorable CSS custom properties.

The SVG adapter never executes markup and is not a sanitizer. Unsupported structures are returned as fallback reasons before any partial color writes. The library does not depend on global inversion or `mix-blend-mode`, because those effects cannot reliably guarantee text or chart contrast.
