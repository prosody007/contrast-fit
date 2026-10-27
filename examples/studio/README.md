# ContrastFit Studio

A source-driven, framework-free interactive workspace for ContrastFit 0.1.0. The site root redirects here with a relative URL, including on GitHub Pages under `/contrast-fit/`. The [original dashboard](../dashboard/index.html) and its browser regression remain intact.

## Feature map

| Studio surface | Real engine behavior |
| --- | --- |
| Background field, native picker, six presets | Opaque short/full hex normalization, live valid drafts, explicit validation, last-valid-state retention, Enter/blur normalization, Escape recovery |
| Auto-fit / Preserve | `backgroundStrategy`; original chosen color on the frame, resolved content on the preview; honest unresolved targets in preserve mode |
| Four advanced numeric fields | `textContrast`, `mutedContrast`, `accentContrast`, `surfaceTextContrast`, accepted in `[1, 21]`; atomic stress-test preset at 21:1 |
| Three custom seed fields | `options.accents`; identical-seed experiment; adjacent actual applied color chips/hex plus Seed retained / Adjusted compared with each last-valid preference |
| Interface scene | Actual text, muted copy, metric and panel surfaces, dividers, positive and attention status pairs, using `applyPaletteToElement` |
| Analytics scene | Six-period illustrative fixture, labeled axes, shared score scale, three paths, returned dash/marker encodings in paths and legend, opaque resolved-background knockouts behind each data mark, accessible equivalent data table |
| Before / after | Explicitly naive fixed white/muted/series palette on the chosen background; actual ContrastFit output on the resolved background; both sets of ratios computed with the exported contrast utility |
| Token explorer | All 17 authored colors, semantic relationships, CSS names, source hex, alpha, effective composite, measured ratio where defined |
| Measurements | All 11 numeric flags with actual/target values; separate RGB/OKLab distances and `seriesDistinct`; original adjustment and warning records |
| Export | CSS variables, full version/options/palette/variables JSON, runnable browser JavaScript; validated custom CSS prefix; clipboard, legacy fallback, manual-copy recovery, local downloads |
| Mobile result access | Compact live applied background / numeric-check hint and a real See result fragment link that scrolls and focuses the preview heading |
| Integration | Published `0.1.0` install command; runnable ESM + DOM adapter example that explicitly consumes both background and foreground; links to docs, npm, source, and legacy example |

Every preview and export derives from imports of [`src/contrast-fit.js`](../../src/contrast-fit.js). No engine code, algorithm, API, dependency, release version, or package publication is changed for the Studio. Export prefixes affect the exported contract, not the Studio's own fixed-prefix preview styles. Input drafts never get injected as HTML. No runtime libraries, fonts, images, analytics, persistence, or remote color services are used.

## Verification

```sh
npm run verify
npm run test:browser
npm run package:smoke -- --browser
```

`test:browser` runs the retained dashboard/docs gate **and** the new Studio gate. The latter serves the built site at a real `/contrast-fit/` mount, verifies root navigation, compares source-engine results to JSON and computed preview colors, exercises targets/seeds/warnings/scenes/exports/input recovery, tests keyboard and narrow layouts, and runs axe serious/critical checks. Independent target cases cover gray primary12, slate surface12 with the other targets1, accent-only21, black status10/21, and identical seeds on black. For source-only iteration: `node test/browser/studio-smoke.mjs --source`.

The chart gate decodes actual Chromium PNG screenshots through a canvas. It samples real line/marker/legend pixels and the real backing at the same coordinates, temporarily hiding only foreground data marks while keeping their opaque knockouts and decoration in place. Default, accent-only21, and all-targets21 cases must meet their requested contrast with an independent sRGB/WCAG calculation, including every data/grid intersection. Grid/axis boundaries must remain visibly rendered. This deliberately tests the compositing boundary, not just CSS stroke hex or engine metrics.

Optional local screenshot capture (not committed): `node test/browser/studio-smoke.mjs --screenshots=/absolute/artifact/directory`. It captures desktop 1440, mobile 375, and mobile 320 defaults plus analytics, comparison, and measurements states.

## Honest limits

- Fixture project counts, scores, and labels are illustrative—not a backend, live account, or a tested production application. Preview labels are intentionally not dead interactive controls.
- The naive comparison is an SVG image sample with a measured accessible description and equivalent ratio readout, not an accessible UI recommendation. Its colors can deliberately fail. It uses fixed text `#FFFFFF`, muted `#A1A1AA`, and series A `#18B7A6`; it is not an earlier engine output.
- Ratios shown to two decimals are display-only; pass/fail uses the unrounded values returned by the engine. Targets below WCAG text requirements are allowed for experimentation and can produce intentionally low-contrast previews.
- `usable` excludes color-only series separation. RGB 32 / OKLab 0.075 are selection heuristics, not color-vision-deficiency simulations or certification. Patterns/markers supplement color, not guarantee complete chart accessibility.
- Transparent surfaces are each applied once over the resolved background, never nested over another translucent panel. Effective colors are quantized composites; arbitrary integration layering must be remeasured.
- Grid, axis, border, plot-fill, and decorative bar tokens do not have certified non-text contrast targets. Plot Fill is available in the token explorer only, not beneath meaningful chart marks. Each line/marker is immediately preceded by an opaque resolved-background backing (6 units for lines, 4 for markers), so grid/axis/other-series crossings do not change its evaluated backdrop—even for exact 21:1. Knockouts disable edge antialiasing; the foreground lines and markers retain smooth edges. Compact 2-unit chart markers avoid the nearby P6 series backing erasing a neighbor's center. This applies to opaque interiors; antialiased edges are not independent full-color samples. Bars are explicitly decorative period accents, **not** data-bearing bars; three line/marker series and the table carry data. The legacy dashboard retains its separately measured data-bearing bar implementation.
- The adjustment log describes returned background/status/series-encoding decisions, not every foreground candidate or alpha-fitting step. Adjacent seed outputs show actual substitutions even when that log is empty.
- Existing 0.1.0 cross-runtime observation: with background `#000000` and all three seeds `#18B7A6` (otherwise default options), Node 26 and Chromium 156 return the same distinct color set `#18B7A6 / #7635DB / #B54708`, but A/B assignment can swap. Floating-point tie ordering is a possible cause, not a proven diagnosis. The Studio presents the actual browser-engine result; it does not promise bit-identical per-series ordering across runtimes. The focused browser test compares exact per-series UI/export output with a fresh same-browser engine call and separately asserts the expected color set. Source algorithms and general source tests are unchanged; cross-runtime tie handling belongs to a separate engine investigation.
- CSS exports contain only colors; chart geometry and `seriesStyles` still need an adapter. JavaScript export is a runnable module for a browser toolchain that resolves the installed package, not a bare-script CDN promise. JSON includes the current complete options and resolved result.
- Clipboard APIs may be denied, including in insecure contexts. The copy action tries a user-gesture legacy fallback, then selects the code with an explicit manual-copy instruction. Download preparation is not proof a browser saved a file.
- Automated Chromium/axe checks cover tested states, not every possible low-target experiment or whole-page WCAG compliance. Check semantics, sizes, focus, composition, and assistive technology in your actual integration. The 0.x API is early access.
