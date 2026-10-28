# ContrastFit Studio

A framework-free gallery of four simple color previews. **Project, Commerce, Reading and Analytics are all rendered on initial load**, in ordinary document flow. Scroll to explore; there are no example tabs, carousels or hidden previews. The root redirect works under a GitHub Pages project subpath. [Legacy dashboards](../dashboard/index.html) and their original regression remain available.

## Four independent palettes

| Example | Curated background | Static color fixture |
|---|---|---|
| Project workspace | Slate `#243044` | Three static project/status rows, one metric surface and one panel |
| Commerce desk | Oat `#F4EFE5` | Three authored SVG object studies, prices, muted descriptions and a collection note |
| Reading room | Paper `#FCFCF9` | Short serif article and a single panel callout |
| Analytics | Midnight `#101D29` | Six-period team scores, shared labeled 0–100 scale, data-backed summary, actual returned line/marker encodings and legend, equivalent data table |

The previews contain no business buttons, selects, links, task details, categories, cart/order state or reading-list/TOC controls. Static rows/cards are not clickable or disabled control imitations. The chart retains only keyboard scrolling and an equivalent data disclosure.

Each has its own labeled picker/hex field, three useful presets, Reset and concise repair/error feedback. Short/full hex, typing, Enter/blur normalization and Escape recovery retain the last valid transaction. Editing/resetting one palette cannot alter another palette or static content. Reset restores that example's curated starting palette; text, artwork shapes and chart values remain stable. Palette state is page-local and resets on reload.

`scenes.js` initializes three static product nodes once. Palette rendering applies actual [`src/contrast-fit.js`](../../src/contrast-fit.js) output without replacing project/product/reading content. Only Analytics palette changes rebuild chart graphics; unrelated example edits cannot recolor or rebuild the chart.

## Color-only controls

Background picker, hex field, presets and Reset are the complete Studio interaction model. There is no inspector, target/strategy/seed editor, comparison panel or export workflow. Library capabilities such as custom options, measurements and CSS serialization remain supported through the [API](../../docs/api.md); removing demo controls does not change the engine or its exports.

## Verification

```sh
npm run verify
npm run test:browser
npm run package:smoke -- --browser
```

`test:browser` runs the unchanged dashboard/docs regression plus Studio, served from a real `/contrast-fit/` mount. Studio asserts that the retired markup, links, scripts and styles are absent, rather than hidden. No production test hook or alternate tool screen is provided.

`studio-scenarios.mjs` verifies four examples in normal flow on initial load, reload and palette edits; distinct curated defaults; independent picker, short/full hex, presets, reset, invalid last-valid transactions and Enter/blur/Escape recovery; stable text/artwork/data/node identity; real computed background/text/muted/surfaces/status/series versus a same-browser engine import; and focus/caret preservation. Layout gates cover 1440×900, 1280×900, 768×1024, 375×812 and 320×740, with readable first-fold content and controls, no page overflow, keyboard chart scrolling, data disclosure and serious/critical axe checks.

The color matrix independently composites ancestor backgrounds and measures **27 foreground/backdrop roles** in curated defaults, all preset positions, diverse full-hex backgrounds, shorthand, native picker, repaired mid-gray, invalid-draft retention, Escape, blur, Enter and reset states. Default targets and original numeric tolerance remain unchanged; removed options are not represented as reachable states.

The Analytics gate decodes real Chromium PNGs across dark, light, repaired gray and saturated backgrounds. It retains the default 3.3:1 target, 18 markers, all three lines and legends, opaque same-coordinate backdrops, decorative grid/axis presence and 13 grid intersections per case. Ratios use an independent sRGB/WCAG calculation and the original thresholds. Extreme 21:1 options, preserve diagnostics, seeds and CSS/API export contracts remain covered by unchanged core and packed-package tests; no retired controls are recreated for those tests.

For source iteration: `node test/browser/studio-smoke.mjs --source`. For optional uncommitted captures: `node test/browser/studio-smoke.mjs --screenshots=/absolute/artifact/directory`. Captures include all five widths, every preview and actual computed/raster proof.

## Boundaries

- Fixtures are static—not business simulations, real accounts, live backend data, checkout/payment or cross-reload persistence. Artwork is authored local SVG/CSS; no runtime images/fonts/services/dependencies are fetched. No engine/API/version/dependency/release change is needed for the gallery.
- Body text uses measured base/text pairs; palette controls stay in the neutral shell. Status chips use their corresponding opaque foreground/background pair. Series colors are not ordinary body text or white-on-series CTA fills. Focus uses an isolated black/white ring.
- Metric/panel surfaces are applied once directly over the resolved base. Computed, quantized effective backdrops are independently measured. Nesting translucent surfaces changes the result and is not supported by the supplied metric.
- `usable` excludes color-only series separation and does not certify a whole page. Studio uses the engine defaults and keeps concise repair/error feedback in its neutral shell. Decorative border/grid/axis/fill/bar tokens have no general non-text contrast guarantee.
