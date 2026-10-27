# ContrastFit

**UI color tokens with automatic contrast repair.**

Turn one background color into a coordinated set of interface and chart colors—then use the result, rather than manually repairing a list of contrast warnings.

ContrastFit is a deterministic, framework-independent JavaScript color engine for dashboards, embedded widgets, cards, and user-customizable interfaces. It fits text, surfaces, status pairs, and three chart series to your requested contrast targets. If the original background cannot support those targets, the default strategy adjusts the content background and preserves the original input separately. **It does not silently lower your targets.**

- **17 semantic color tokens**, including text, surfaces, chart colors, and status pairs.
- **Automatic repair**, with original input, applied background, measured results, and adjustment records.
- **Redundant chart identity** through distinct line patterns and circle/square/diamond markers.
- **ES modules, CommonJS, and a standalone browser script**, with TypeScript declarations.
- **SSR-safe CSS serialization**, optional DOM application, and **zero runtime dependencies**.

> **Release status:** [`contrast-fit@0.1.0`](https://www.npmjs.com/package/contrast-fit/v/0.1.0) is published on npm under `latest`, independently installed and verified from the official registry. This first usable **0.x release is early access**, not a 1.0 API-stability promise or WCAG certification. [Release notes and exact archive/checksums](https://github.com/prosody007/contrast-fit/releases/tag/v0.1.0) identify the tested package source; current documentation lives on `main`.

[Live demo](https://prosody007.github.io/contrast-fit/) · [CI](https://github.com/prosody007/contrast-fit/actions/workflows/ci.yml) · [Quick start](#quick-start) · [What it solves](#what-it-solves) · [Integration](#integration) · [API](#api-overview) · [Accessibility boundaries](#accessibility-boundaries) · [Development](#development-and-verification) · [Migration](./MIGRATING.md)

## What it solves

A fixed light/dark theme is often insufficient when users choose arbitrary background colors, a widget inherits its host's appearance, or generated dashboards need readable text and charts without maintaining a palette for every possible background.

ContrastFit turns that problem into a reproducible rendering plan:

1. **Provide an opaque background color** and, optionally, contrast targets and preferred chart accents.
2. **Fit the colors automatically.** Foregrounds and surfaces are adapted first; the content background changes only when the requested targets require it.
3. **Apply the returned background, colors, and chart styles.** Inspect metrics and adjustments when you need an audit trail.

### A concrete repair—not just a warning

With the default primary-text target of **8:1**, `#777777` cannot provide sufficient contrast against either black or white text. Keeping that exact background and merely emitting a warning would leave the integration unfinished.

```js
const palette = createContrastFit("#777777");

palette.inputBackground;                 // "#777777" — the user's original choice
palette.background;                      // "#A0A0A0" — resolved content background
palette.colors.text;                     // "#000000"
palette.metrics.textContrast.toFixed(2);  // "8.03"
palette.targets.textContrast;             // 8 — unchanged
palette.usable;                           // true
palette.warnings;                         // []
```

The original color remains available for a surrounding frame or host. The resolved color is used consistently by CSS variables, contrast measurements, alpha composites, and tokens.

Examples under the default options:

| Input background | Applied content background | Primary text | Primary-text contrast |
| --- | --- | --- | --- |
| `#777777` | `#A0A0A0` | `#000000` | `8.03:1` |
| `#2B3548` | `#2B3548` | `#CED1D5` | `8.04:1` |
| `#F5F7F9` | `#F5F7F9` | `#4A4A4B` | `8.24:1` |

These are reproducible examples, not a promise to preserve every requested background. Already-suitable backgrounds stay unchanged. Strict targets can require a substantial adjustment.

### Where it fits

| Use case | What ContrastFit provides |
| --- | --- |
| User-selected card or widget backgrounds | Automatic text and content-background fitting, with the original input preserved |
| Data-heavy dashboards | Coordinated text, panels, metrics, status pairs, and chart colors |
| Charts on changing backgrounds | Contrast-fitted series colors plus line/marker instructions |
| Server-rendered reports and applications | A pure color engine and DOM-free CSS-property map |
| Framework integrations | Plain objects and CSS variables, without a required React/Vue/Svelte runtime |
| Repeatable generated interfaces | Deterministic output for the same input and options, with inspectable measurements |

This is **not** a palette-inspiration generator, an image color extractor, a full design system, a page-wide accessibility scanner, or a WCAG certification service. It does not use AI or make network requests.

## Quick start

### Run the interactive demo

[Open the public demo](https://prosody007.github.io/contrast-fit/) without an account or installation. To run it locally, use **Node.js 22+** and npm:

```bash
git clone https://github.com/prosody007/contrast-fit.git
cd contrast-fit
npm ci --ignore-scripts
npm run dev
```

Open <http://127.0.0.1:4173/>. The development server binds to loopback only.

The public root opens **[ContrastFit Studio](./examples/studio/index.html)**: a scene-first workspace with three distinct local fixture applications: a filterable issue workbench with contextual details, a product catalogue with a real quantity/total order builder, and an editorial reading room with keyboard chapter navigation and a reading-list toggle. An optional fourth Analytics scene retains the measured chart; explicitly labeled fixed-palette before/after is a separate comparison mode. Explore auto-fit versus preserve, all four numeric targets, custom chart seeds, 17 semantic tokens, alpha composites, measured checks, separation heuristics, and adjustment records. Export current CSS, full JSON, or runnable JavaScript with a custom prefix; copy and download work without a backend. All results use the actual source engine, not simulated metrics. See the [Studio coverage and limits](./examples/studio/README.md). The [legacy two-dashboard example](./examples/dashboard/index.html) stays available, with its original chart/data/keyboard regression gates. The [product guide](./docs/index.html) explains integration and boundaries.

### Install from npm

Use Node.js **22+** for server-side applications and tooling:

```bash
npm install contrast-fit
# To pin the first public release explicitly:
npm install contrast-fit@0.1.0
```

The published package provides ESM, CommonJS, browser-global assets, and dual TypeScript declarations with **zero runtime dependencies**. The official-registry tarball was verified byte-for-byte against the reviewed release archive and exercised in an empty consumer.

### Build a local package instead

For source development or an independently reviewed checkout:

```bash
# In this repository, after npm ci --ignore-scripts:
npm pack

# In your application, install the tarball produced above:
npm install /absolute/path/to/contrast-fit-0.1.0.tgz
```

`npm pack` runs the package's validation/build lifecycle. For an intentionally script-disabled pack, run `npm run build:lib` and `npm run check:naming` first; do not pack stale or absent build artifacts.

Then import the installed package:

```js
import { createContrastFit, paletteToCssVariables } from "contrast-fit";

const palette = createContrastFit("#2B3548");
const variables = paletteToCssVariables(palette);

console.log(variables["--contrast-fit-bg"]);   // "#2B3548"
console.log(variables["--contrast-fit-text"]); // "#CED1D5"
```

## Integration

### Browser modules and DOM application

When serving a checkout directly, use its source module. In an application with a package resolver, import the same functions from `"contrast-fit"` instead.

```js
import {
  createContrastFit,
  applyPaletteToElement,
} from "./src/contrast-fit.js";

const card = document.querySelector(".card");
const palette = createContrastFit("#777777");
applyPaletteToElement(card, palette);

// Optional: preserve the user's chosen color outside the repaired content.
card.parentElement.style.backgroundColor = palette.inputBackground;
```

```css
.card {
  background: var(--contrast-fit-bg);
  color: var(--contrast-fit-text);
  border: 1px solid var(--contrast-fit-border);
}
.card__secondary { color: var(--contrast-fit-muted); }
.card__metric { background: var(--contrast-fit-metric); }
```

**Apply the resolved background as well as the foregrounds.** Applying the returned text over the original input instead of `palette.background` discards the automatic repair.

### CommonJS

```js
const { createContrastFit, paletteToCssVariables } = require("contrast-fit");

const palette = createContrastFit("#F5F7F9");
const variables = paletteToCssVariables(palette, "report");
```

### Standalone browser script

Copy `node_modules/contrast-fit/dist/contrast-fit.global.js` from the installed package into your application's `dist/` assets directory and serve it alongside your page. From a source checkout, `npm run build:lib` generates the same script; the static site build also includes it under `dist/`.

```html
<script src="./dist/contrast-fit.global.js"></script>
<script>
  const palette = ContrastFit.createContrastFit("#777777");
  ContrastFit.applyPaletteToElement(document.querySelector(".card"), palette);
</script>
```

The global build exposes `globalThis.ContrastFit`. This is a self-hosted file example; it does not depend on a CDN. Browser integration requires a modern browser with the JavaScript features used by the ES2022 build and CSS custom-property support; there is no legacy-browser/polyfill guarantee.

### TypeScript, frameworks, and SSR

```ts
import {
  createContrastFit,
  paletteToCssVariables,
  type ContrastFitPalette,
  type PaletteOptions,
} from "contrast-fit";

const options: PaletteOptions = { textContrast: 8 };
const palette: ContrastFitPalette = createContrastFit("#2B3548", options);
const style = paletteToCssVariables(palette, "report");
// Feed style into your framework's supported style API.
// Its keys include --report-bg, --report-text, and all remaining tokens.
```

The core and `paletteToCssVariables` do not access the DOM, read ambient theme state, or mutate your input options. They can run during server rendering. `applyPaletteToElement` is the optional DOM-writing helper.

Use your renderer's normal attribute escaping and style handling; do not concatenate untrusted values into HTML. Separate React/Vue/Svelte adapter packages are not provided or required. Node.js 22+ is the supported server/tooling baseline; other JavaScript runtimes are not yet part of the verified support matrix.

### Chart identity is more than color

ContrastFit returns three complementary encodings:

| Series | `dashArray` | `marker` |
| --- | --- | --- |
| `seriesA` | `"none"` | `"circle"` |
| `seriesB` | `"9 5"` | `"square"` |
| `seriesC` | `"2 5"` | `"diamond"` |

Apply them to both chart paths and matching legend keys:

```js
for (const [name, encoding] of Object.entries(palette.seriesStyles)) {
  const path = chart.querySelector(`[data-series="${name}"]`);
  path.style.strokeDasharray = encoding.dashArray;
  // Your chart adapter must also render encoding.marker and a matching legend.
}
```

At extreme targets such as 21:1, several series may need the same endpoint color. `meetsTarget.seriesDistinct` remains `false` when color-only separation fails. A `series-encoding` adjustment explains the non-color remedy. **Do not drop the returned styles and claim the lines remain distinguishable.** Include labels and an equivalent data table where appropriate, as the bundled SVG demo does.

## API overview

### `createContrastFit(backgroundHex, options?)`

Accepts an opaque three- or six-digit HEX string, with or without `#`; surrounding whitespace is allowed. It returns a fresh `ContrastFitPalette`.

```js
const palette = createContrastFit("#2B3548", {
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
```

| Option | Default | Constraint |
| --- | --- | --- |
| `backgroundStrategy` | `"auto"` | Fit content automatically, or use `"preserve"` to lock the original background |
| `textContrast` | `8` | Primary text against the resolved content background |
| `mutedContrast` | `4.7` | Secondary text against the resolved content background |
| `accentContrast` | `3.3` | Each chart series against the resolved content background |
| `surfaceTextContrast` | `4.5` | Primary/secondary text on panel and metric surfaces; status text on its own status background |
| `accents.seriesA/B/C` | Built-in accents | Preferred colors, retained when contrast and series-distinctness constraints permit |

Targets must be finite numbers in `[1, 21]`. Options and accents must be plain objects; unknown keys are rejected rather than silently ignored. Unsupported inputs throw. See the [API reference](./docs/api.md) for detailed signatures, utility functions, and error contracts.

### Main return fields

| Field | Meaning |
| --- | --- |
| `inputBackground` | Normalized original input, uppercase `#RRGGBB` |
| `background`, `colors.background` | The actual resolved content background used for the output and measurements |
| `usable` | All measured **numeric contrast targets** pass; not a whole-page or chart-accessibility certification |
| `adjustments` | Applied background, status-pair, and non-color series-encoding remedies, with explanatory messages |
| `colors` | 17 authored CSS colors, as opaque HEX or `rgba(...)` |
| `effectiveColors` | Seven alpha-bearing tokens composited over the resolved background and quantized to opaque HEX |
| `targets`, `metrics`, `meetsTarget` | Requested targets, computed measurements, and individual results, including honest color-only series distinctness |
| `seriesStyles` | Per-series line pattern and marker instructions for your chart adapter |
| `warnings` | Unresolved diagnostics, especially when explicit `preserve` constraints prevent automatic repair |
| `alphas`, `tokens` | Applied transparency and 17 structured display/integration records |
| `isDark` | Whether white offers stronger contrast than black on the resolved background; not a general perceptual theme classifier |

Each token includes `name`, `css`, `color`, `alpha`, `effectiveColor`, and `contrast`, plus compatibility display fields `value` and `swatch`. Use `css` for CSS, not the display-only `value` string. Token names/order are not stable machine identifiers; prefer named fields and CSS variables.

### Explicitly preserve a background

```js
const locked = createContrastFit("#777777", {
  backgroundStrategy: "preserve",
  textContrast: 8,
});

locked.background; // "#777777"
locked.usable;     // false — the locked background cannot support this target
locked.warnings;   // unresolved diagnostics; the target has not been lowered
```

Use this expert mode only when preserving exact pixels is more important than automatic resolution. Your application must handle the unresolved constraint. The default `auto` strategy does not require a manual repair branch for this example.

### CSS helpers

- **`paletteToCssVariables(palette, prefix = "contrast-fit")`** returns a new map containing all 17 CSS custom properties, without reading or writing the DOM.
- **`applyPaletteToElement(element, palette, prefix = "contrast-fit")`** validates the map, calls `element.style.setProperty` for each entry, and returns the same map.

Prefixes must match `[A-Za-z_][A-Za-z0-9_-]*`, for example `contrast-fit`, `report`, or `theme-dark`. Palette/prefix validation happens before DOM writes; a caller-provided style adapter that itself throws is not transactional.

### CSS token reference

| Role | Default variables |
| --- | --- |
| Background and text | `--contrast-fit-bg`, `--contrast-fit-text`, `--contrast-fit-muted` |
| Surfaces | `--contrast-fit-panel`, `--contrast-fit-metric` |
| Structure | `--contrast-fit-border`, `--contrast-fit-grid`, `--contrast-fit-axis` |
| Chart decoration | `--contrast-fit-plot-fill`, `--contrast-fit-bars` |
| Chart series | `--contrast-fit-series-a`, `--contrast-fit-series-b`, `--contrast-fit-series-c` |
| Status pairs | `--contrast-fit-good-bg`, `--contrast-fit-good-text`, `--contrast-fit-warn-bg`, `--contrast-fit-warn-text` |

**Layering is part of the contract.** Transparent tokens are measured as one layer over `palette.background`. Nested translucent surfaces, images, gradients, overlays, and blend modes change the result. Resolve and measure the complete stack, or use an appropriate opaque `effectiveColors` surface. Decorative grid/border/fill/bar tokens do not carry a certified non-text contrast guarantee; the demo uses a measured foreground for data-bearing volume bars.

## Accessibility boundaries

ContrastFit solves a specific color-generation problem. It cannot certify arbitrary markup or compensate for an integration that ignores its output.

- **Measurements:** WCAG relative luminance/contrast ratio, using the sRGB `0.04045` transfer breakpoint and final quantized colors. Panel/metric alpha fitting checks both fractional compositing and the published quantized effective colors.
- **Background fitting:** compares nearby passing quantized candidates on black/white sRGB mixing paths using OKLab distance. It is not a globally minimal search over the entire RGB space.
- **Series separation:** RGB distance ≥32 and OKLab distance ≥0.075 are engineering heuristics, not WCAG requirements or a color-vision-deficiency guarantee. Always use redundant encodings.
- **Input scope:** opaque three-/six-digit HEX only. No RGB/HSL/OKLCH string parsing, alpha HEX, gradients, photographs, or live sampling of arbitrary page backgrounds.
- **Rendering scope:** font size/weight, anti-aliasing, stroke width, focus indicators, adjacent colors, interaction states, semantics, and assistive-technology behavior remain the integrator's responsibility.
- **Validation scope:** Chromium and axe checks cover the tested demo states, not every browser, device, or complete accessibility standard. Manual review of the integrated product is still required.

See [architecture](./docs/architecture.md) for algorithm decisions and [API reference](./docs/api.md) for the exact output contract.

## Development and verification

```bash
npm ci --ignore-scripts
npm run verify
npx --no-install playwright install chromium
npm run test:browser
```

Run browser checks against a current static build. `verify` builds it; after further changes run `npm run build` again.

| Command | Purpose |
| --- | --- |
| `npm test` | Unit and contract tests, including exhaustive 4,096-short-HEX auto/preserve cases |
| `npm run test:coverage` | Core gates: lines ≥95%, branches ≥85%, functions ≥95% |
| `npm run typecheck` | Strict TypeScript declaration and consumer checks |
| `npm run check` | JavaScript syntax checks |
| `npm run check:naming` | Active-name consistency across source, configuration, filenames, and generated assets |
| `npm run build:lib` | Generate ESM, CommonJS, browser-global, and declaration artifacts in `dist/` |
| `npm run build` | Build package/static output and verify local asset references |
| `npm run package:check` | Preview the package file list |
| `npm run package:smoke` | Consume a real tarball from isolated temporary `node_modules`, exercising runtime formats and types |
| `npm run test:browser` | Chromium rendering, interactions, responsive layouts, chart/data consistency, and axe checks |
| `npm run dev` | Serve the demo on loopback only |

The regression suite protects automatic resolution, preserved-input diagnostics, alpha-composite measurements, final CSS values, non-color chart encodings, and invalid-input handling. Coverage thresholds are gates, not reasons to weaken the product's targets.

CI runs Node.js **22, 24, and 26**, with a separate Chromium job. Check the [workflow results](https://github.com/prosody007/contrast-fit/actions/workflows/ci.yml) for the exact commit you consume; a successful local run is not evidence that remote jobs have run. Development tools are pinned; the package runtime has **no dependencies**.

## Build and deploy the demo

```bash
npm ci --ignore-scripts
npm run build
```

The public demo is hosted at <https://prosody007.github.io/contrast-fit/>. On a push to `main`, the CI workflow deploys **only `public/`** to GitHub Pages **after all three Node.js verification jobs and the Chromium job succeed for that exact commit**. Pull requests and manual verification runs do not deploy. Static asset links are relative so the demo also works under the `/contrast-fit/` project path.

You can also deploy `public/` to another static host. The root HTML provides a relative redirect to `examples/studio/`, so project-subpath hosting does not require host-specific redirect rules.

The core and demo use no analytics, application cookies, remote data fetching, or backend service. Static assets still require HTTP requests, hosting providers can add their own behavior, and repository links open GitHub. The workflow deploys the static demo only; it does **not** publish npm packages, tags, or releases.

## Project documentation

- [Product guide](./docs/index.html): problem, workflow, capabilities, and integration boundaries.
- [API reference](./docs/api.md): functions, data shapes, errors, and token semantics.
- [Architecture](./docs/architecture.md): algorithm, quantization, compositing, and trade-offs.
- [Migration guide](./MIGRATING.md): complete pre-release naming/API/CSS transition.
- [Changelog](./CHANGELOG.md): behavior and distribution changes.
- [Contributing](./CONTRIBUTING.md): development and regression expectations.
- [Release process](./RELEASING.md): authorized publication, package ownership, and release gates.
- [Security](./SECURITY.md): vulnerability reporting and supported scope.

## License

[MIT](./LICENSE). The original copyright notice is retained for attribution; active product names use ContrastFit.
