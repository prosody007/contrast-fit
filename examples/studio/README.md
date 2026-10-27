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

Each has its own labeled picker/hex field, three useful presets, Reset and concise repair/error feedback. Short/full hex, typing, Enter/blur normalization and Escape recovery retain the last valid transaction. Editing/resetting one palette cannot alter another palette, its advanced options or static content. Reset restores that example's curated starting palette; text, artwork shapes and chart values remain stable. Palette state is page-local and resets on reload.

`scenes.js` initializes three static product nodes once. Palette rendering applies actual [`src/contrast-fit.js`](../../src/contrast-fit.js) output without replacing project/product/reading content. Only Analytics palette changes rebuild chart graphics; unrelated example edits cannot recolor or rebuild the chart.

## One secondary tool surface

The collapsed **Palette tools** disclosure contains a named example target. Selection changes only the inspected record and controls; it never hides examples or automatically scrolls the page. Each example's Inspect button opens the tools and focuses their heading intentionally.

All source-engine capabilities remain discoverable:

- Auto-fit / preserve, four independent numeric targets in `[1,21]`, three series seed preferences, all21 and identical-seed experiments.
- Original chosen background on the frame; actual resolved content colors; unrounded pass/fail, all **11 numeric checks**, warnings and adjustments.
- All **17 semantic tokens**, source CSS, alpha/effective color and relationship, with semantic identity retained even when colors collapse.
- RGB/OKLab separation values and honest `seriesDistinct`; not a CVD simulation or certification. Applied seed chips/hex and Seed retained / Adjusted compare with last-valid preferences.
- CSS, complete version/options/palette/variables JSON, and **self-contained runnable JavaScript** consuming both background and foreground. A prefix belongs to the selected example's exports, not the fixed-prefix preview or internal token metadata. Copy has modern/fallback/manual recovery; Download saves the current exact output.
- A measured, explicitly naive fixed-white comparison in the tools—not a hidden fifth application or earlier engine output. Its SVG sample has measured descriptions and equivalent ratios.

Independent options, prefixes, valid values, draft strings and validation errors survive inspector target changes. The large token/diagnostic workspace is not duplicated four times. Repeated integration pitches and fixture explanations were removed; the runnable export and Docs supply integration guidance.

## Verification

```sh
npm run verify
npm run test:browser
npm run package:smoke -- --browser
```

`test:browser` runs the unchanged dashboard/docs regression plus Studio. Studio is served from a real `/contrast-fit/` mount. The suite retains exact source-engine/JSON/CSS/rendered-color comparison, independent primary12/surface12/accent21/status10/21 states, invalid-draft transactions, custom/similar/identical seeds, numeric rounding honesty, all exports/prefixes/clipboard/downloads, keyboard and axe serious/critical checks.

`studio-scenarios.mjs` verifies all four examples remain visible with no hidden ancestors after reload, palette edits and inspector changes; distinct curated defaults; independent picker/short/full/invalid color transactions and per-example advanced drafts/options/prefixes; absence of business controls, stable fixture text/artwork/data/node identity, real computed background/text/muted/surface/series updates and palette-control focus/caret/reset; readable first-fold status content plus palette control at 1440×900, 1280×900, 768×1024, 375×812 and 320×740; ordinary full-width scrolling rather than miniature contact sheets; no page overflow; and **27 actual foreground/backdrop roles × six states (including curated defaults)**. Intentionally low-target color failures are scoped only to `.live-preview`; shell and control semantics are never blanket exempted.

The Analytics gate decodes actual Chromium PNGs. It checks opaque data pixels, same-coordinate backdrops with only foreground temporarily hidden, 18 markers, three lines/legends and 13 grid intersections per case. Default3.3, accent-only21 and all21 must meet the requested ratios with an independent sRGB/WCAG calculation while grid/axes remain rendered. Opaque knockouts immediately precede each data mark; no translucent chart area changes the measured data backing.

For source iteration: `node test/browser/studio-smoke.mjs --source`. For optional uncommitted captures: `node test/browser/studio-smoke.mjs --screenshots=/absolute/artifact/directory`. Captures include all five widths, every preview and actual computed/raster proof.

## Boundaries

- Fixtures are static—not business simulations, real accounts, live backend data, checkout/payment or cross-reload persistence. Artwork is authored local SVG/CSS; no runtime images/fonts/services/dependencies are fetched. No engine/API/version/dependency/release change is needed for the gallery.
- Body text uses measured base/text pairs; palette controls stay in the neutral shell. Status chips use their corresponding opaque foreground/background pair. Series colors are not ordinary body text or white-on-series CTA fills. Focus uses an isolated black/white ring.
- Metric/panel surfaces are applied once directly over the resolved base. Computed, quantized effective backdrops are independently measured. Nesting translucent surfaces changes the result and is not supported by the supplied metric.
- `usable` excludes color-only series separation and does not certify a whole page. Low targets can deliberately produce low-contrast examples; repair/unresolved/experimental feedback and neutral-shell tools remain readable. Decorative border/grid/axis/fill/bar tokens have no general non-text contrast guarantee.
- Identical seeds on black may swap A/B assignment between Node26 and Chromium156 while keeping the same expected color set (`#18B7A6`, `#7635DB`, `#B54708`). The suite checks exact same-browser engine/UI/export agreement, repeated browser determinism and the independent expected set; no source algorithm was changed. Floating-point tie ordering is a possible, unproven cause.
