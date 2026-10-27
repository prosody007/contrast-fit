# ContrastFit architecture

ContrastFit is a deterministic, framework-independent color-token engine with zero runtime dependencies. It separates calculation, serialization, and rendering so that a static page, server renderer, or component system can use the same result.

For signatures and every returned field, see the [API reference](./api.md). For integration entry points, see the [README](../README.md).

## Repository layers

| Layer | Responsibility |
| --- | --- |
| [`src/contrast-fit.js`](../src/contrast-fit.js) | Public functions, validation, fitting, compositing, measurements, and result construction. No DOM reads or framework dependency. |
| [`src/contrast-fit.d.ts`](../src/contrast-fit.d.ts) | Public TypeScript declarations, including `ContrastFitPalette`. |
| `dist/` | Generated ESM, CommonJS, browser-global, and declaration artifacts. Distribution exports are controlled by `package.json`; generated output is not the source of truth. |
| [`examples/dashboard/`](../examples/dashboard/) | Plain HTML/CSS/JavaScript integration: independently themed cards, real SVG chart data, redundant series styles, and data tables. |
| [`docs/`](./index.html) | Product overview, API reference, and algorithm/integration boundaries. |
| `scripts/` | Node-based build, static-link, syntax, package-consumer, and development-server tooling. |
| `test/` | Core behavior, boundary and exhaustive-background regressions, TypeScript consumers, and browser integration checks. |

Runtime dependency-free does not mean tooling-free: the repository uses maintained development tools for declaration checking, build work where needed, browser automation, and axe checks. These are not required by the color engine in a consumer application.

## Data flow

```text
opaque 3/6-digit hex + validated options
                 |
                 v
normalize and retain inputBackground
                 |
                 +-- auto: fit content background if needed
                 |         (black/white paths, OKLab comparison)
                 +-- preserve: keep input pixels; allow unresolved diagnostics
                 |
                 v
select text direction and quantized foreground candidates
                 |
                 +-- derive seven alpha-bearing surfaces
                 +-- fit panel/metric alpha against both text roles
                 +-- fit status foreground/background pairs
                 +-- select contrast-aware series candidates
                 |
                 v
final CSS colors + effective composites + measured metrics
                 |
                 v
numeric target flags + separate series distinctness + adjustments
                 |
                 v
17 semantic tokens + chart dash/marker instructions
                 |
                 +-- CSS map / DOM style-property adapter
                 +-- host renderer applies background, surfaces, and chart encodings
```

The original input and the resolved background are intentionally separate. `inputBackground` records the user's choice. `background` and `colors.background` record the actual content background, and every content measurement/composite uses that resolved value. The CSS serializers export the resolved background; integrators must actually consume it in their styles.

## Fitting algorithm

### 1. Validate before calculation

The engine accepts only opaque three- or six-digit hex, plain-object options, known keys, and finite contrast targets in `[1, 21]`. RGB utilities validate channels, interpolation amounts, and alpha. Strict inputs make results reproducible and catch misspelled settings rather than silently using defaults.

The default targets are 8:1 for text, 4.7:1 for muted text, 3.3:1 for series, and 4.5:1 for panel/metric text and status pairs. These are product defaults, not a statement that every interface needs exactly those thresholds.

### 2. Resolve a feasible content background

In auto mode, the feasibility target is the maximum of all four requested targets. If black or white already reaches that ratio against the input, the input background is kept.

Otherwise, the engine searches two paths: encoded-sRGB mixes from the input toward black and toward white. On each path it performs a bounded binary search (24 iterations), quantizing candidate RGB channels before evaluating contrast against the opposite endpoint. It compares the two passing candidates by Euclidean distance in OKLab and picks the nearer one, preferring the black-path candidate on an exact distance tie.

This is a **near-minimal quantized adjustment along two chosen paths**, not a global optimum over every possible RGB color, not a hue-preservation guarantee, and not a perceptual interpolation algorithm. OKLab is used to compare candidates; the path mixing itself remains encoded sRGB.

For example, the current default calculation resolves `#777777` to `#A0A0A0`, then selects `#000000` text at approximately 8.03:1. A `background` adjustment records the original and resolved colors. A viable input remains unchanged.

Preserve mode skips content-background fitting. It does not lower targets, so a mid-tone background with demanding targets can return `usable: false`. Generated status colors remain independently fitted.

### 3. Fit text and surfaces

The engine selects whichever of white or black has the stronger contrast on the resolved background (`isDark` is true only when white is stronger). It searches background-to-endpoint mixes in 1% steps, beginning at 32%, quantizing every foreground candidate before measuring it.

Text and muted text are fitted to the greater of their own target and the surface target. Seven semantic surface/graphic colors are derived from background-aware mixes: panel, metric, border, grid, axis, plot fill, and bars. Panel and metric alpha are reduced in 1% steps when needed so that **both** text roles satisfy the surface target. The other five alpha values are authored semantic styling values, not separately contrast-certified graphics.

A panel or metric alpha may reach zero at an extreme target. Reaching the requested contrast takes precedence over retaining a particular translucent appearance.

### 4. Fit status pairs independently

Good and warning status pairs use their own opaque backgrounds. The engine first fits a foreground toward the preferred status text direction, strengthens it toward a readable black/white endpoint if needed, and repairs that status background if the requested ratio still cannot be reached. `status` adjustment records make these repairs visible.

Status foreground ratios are measured against their own status backgrounds, not against the content background.

### 5. Select series colors and redundant encodings

Each preferred accent is retained if it passes the accent target; otherwise it is mixed toward the stronger black/white endpoint in 1% steps. If the resulting series are insufficiently separated, a bounded candidate set combines the supplied accents, defaults, and fallback colors. Candidate triples are ranked by contrast passes, number of unique colors, passing pair distances, preservation of per-series preferences, and extra perceptual separation.

The current color-only distinctness heuristic requires every pair to have RGB Euclidean distance at least `32` and OKLab distance at least `0.075`. This is neither a WCAG rule nor a color-vision-deficiency simulation.

Every result also includes:

- Series A: solid (`"none"`) with circle markers.
- Series B: `"9 5"` dashes with square markers.
- Series C: `"2 5"` dashes with diamond markers.

At extreme contrast targets, multiple series may necessarily converge to one color. `meetsTarget.seriesDistinct` remains false; a `series-encoding` adjustment calls for the patterns and markers. No artificial color-distinctness pass is substituted. The host must render the patterns consistently in paths, markers, and legends.

## Quantization and alpha measurement

Intermediate RGB values can be fractional, but exported hex channels are integers and authored `rgba(...)` values use rounded channels and alpha. Measurements must describe those delivered values, not a more favorable intermediate calculation.

For an alpha-bearing token, the engine:

1. Quantizes its source RGB to the channels written in CSS.
2. Composites that source over the resolved background using the applied alpha.
3. Produces a quantized opaque `effectiveColor` for inspection and returned metrics.
4. During panel/metric alpha fitting, checks foreground contrast against **both the fractional composite and the quantized composite**, avoiding a pass that depends only on rounding.

Returned opaque-color metrics and effective-surface metrics use final quantized values. A browser can retain fractional channel values during composition; the dual check in alpha fitting is important for boundaries, while real rendering tests remain necessary. Neither calculation models all rasterization, antialiasing, display profiles, or overlapping page layers.

Each token exposes `css`, `color`, `alpha`, and `effectiveColor`, making the authored value and the measurement basis inspectable. `effectiveColors` assumes exactly one translucent layer directly over the resolved content background. Nesting translucent panels or adding overlays changes that basis.

## Meaning of success

`usable` is the conjunction of the numeric `meetsTarget` flags, excluding `seriesDistinct`. It does not examine DOM markup or confirm that a renderer used the provided styles. Keep these questions separate:

1. **Do the measured numeric targets pass?** Inspect `usable`, `metrics`, and individual flags.
2. **Are the colors distinct under the engine's heuristic?** Inspect `meetsTarget.seriesDistinct` and pair distances.
3. **Does the actual product communicate accessibly?** Apply redundant styles, labels and semantics, then test the rendered interface with representative users and tools.

Adjustment records summarize selected repairs and rendering instructions; they are not a full solver trace. Warning strings describe unresolved constraints, principally useful in preserve mode. Neither warning count nor a single flag is a certification.

## Verification layers and limits

Core tests cover invalid inputs, final-color measurements, extreme targets, alpha boundaries, all 4,096 short-hex backgrounds, and serialization. Consumer fixtures check type declarations and packaged imports. Browser checks use actual chart geometry/data, computed style contrast on representative elements, keyboard interaction, responsive layouts, and an axe serious/critical-violation gate.

Those checks have different scopes. An exhaustive short-hex test is not an exhaustive test of all backgrounds/options; a rendered sample is not every possible layer combination; no serious/critical axe findings is not zero findings or universal accessibility. Configured remote CI jobs are not evidence that the latest commit has passed them—see the [release checklist](../RELEASING.md).

## Integration boundaries

- No CSS-function parser, image/gradient analysis, or arbitrary layer-stack resolver.
- No general page auditor, automatic DOM restyling, chart geometry generator, or typography evaluator.
- No bundled React/Vue adapters, WASM module, or CLI. The named JavaScript API can be called from framework code without such adapters.
- No network access, model service, runtime storage, or framework dependency in the calculation engine.
- No reliance on `mix-blend-mode` as a readability mechanism; blend effects are not a stable contrast contract for dense UI.

The host remains responsible for applying the resolved background, meaningful chart labels, readable non-text graphics, keyboard behavior, focus treatment, interaction states, and complete accessibility review.
