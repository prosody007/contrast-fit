# Changelog

Notable changes to ContrastFit are documented here. The first public npm release below is independently confirmed; earlier repository snapshots were not separate public releases.

## Unreleased

No additional changes yet.

## 0.1.0 — first public release (2026-10-27)

Published as [`contrast-fit@0.1.0`](https://www.npmjs.com/package/contrast-fit/v/0.1.0), using the npm `latest` distribution tag. Official-registry archive bytes and an empty registry-installed ESM/CommonJS/TypeScript/browser consumer were independently verified. `latest` selects the default install; this remains an early-access 0.x API, not a 1.0 stability or accessibility-certification claim.

The annotated [`v0.1.0` tag and release](https://github.com/prosody007/contrast-fit/releases/tag/v0.1.0) identify the exact tested package source `000afc5852abf8399d1c091bb7114e05193bca5f`; confirmed-install documentation was added afterward as a separate commit, without moving the tag. The published archive intentionally retains its candidate-era status prose; current installation instructions are on `main`.

### Breaking changes from unpublished development snapshots

- Rename the product **Adaptive Palette → ContrastFit**, package/repository **`adaptive-palette` → `contrast-fit`**, primary function **`createAdaptivePalette` → `createContrastFit`**, and result type **`AdaptivePalette` → `ContrastFitPalette`**.
- Rename source/declaration paths **`src/adaptive-palette.js` / `.d.ts` → `src/contrast-fit.js` / `.d.ts`**.
- Change the default CSS prefix **`adaptive` → `contrast-fit`**, including **`--adaptive-bg` → `--contrast-fit-bg`** and the other 16 semantic properties.
- Use canonical repository links under `https://github.com/prosody007/contrast-fit`. Historical identifiers are documented here and in [MIGRATING.md](./MIGRATING.md), with the exact original MIT copyright notice also preserved in `LICENSE`; no old-name aliases or compatibility shims are promised.

### Added

- Default automatic contrast repair: retain `inputBackground` while fitting the actual content background when required, without lowering requested targets.
- `usable`, traceable adjustment records, and explicit per-series line/marker styles. Numeric contrast and color-only series distinctness remain separate.
- Explicit `backgroundStrategy: "preserve"` for exact-content-background constraints, with unresolved flags/warnings when targets cannot pass.
- Demo auto-fit preview, applied-background/contrast readout, and original-color frame.
- Public TypeScript declarations and strict consumer fixtures.
- Structured metadata for 17 semantic tokens: authored CSS, opaque source, alpha, effective color, and applicable contrast.
- Seven effective alpha-composited colors and their applied alpha values, explicit target status, and RGB/OKLab series-distance metrics.
- DOM-free `paletteToCssVariables` for server-side and custom-renderer integration.
- ESM, CommonJS, and browser-global build artifacts; the classic browser bundle exposes named functions on `globalThis.ContrastFit`.
- Exhaustive 4,096-short-hex background regressions, coverage gates, and real installed-tarball consumer checks.
- Node 22/24/26 CI configuration plus Chromium/axe browser checks. Release evidence must identify successful jobs for the exact package-source commit.
- Browser checks for representative rendered contrast, chart geometry/data consistency, redundant series styles, inputs/keyboard behavior, and responsive layouts.
- Accessible chart data tables in the dashboard demonstration.
- Lockfile-managed development tools, local development/static-build checks, a migration guide, and a manual authorized release checklist.

### Changed and fixed

- Strictly validate opaque three- and six-digit hex, plain-object options, and known accent keys.
- Reject malformed, non-finite, or out-of-range RGB utility inputs and invalid mix amounts.
- Preserve already-valid per-series accents instead of replacing their identity solely to maximize extra distance.
- Measure final quantized colors rather than favorable intermediate values. Check both fractional and quantized composites during panel/metric alpha fitting.
- Stabilize alpha/channel rounding at quantization boundaries.
- Use Node.js 22+ as the supported server/tooling baseline and modern browsers for client integration; zero runtime dependencies are retained.
- Document the black/white-path background fit as near-minimal along those paths, not a globally optimal RGB solution.
- Define `usable` precisely as the conjunction of measured numeric contrast-target flags, excluding `seriesDistinct`; supplied chart styles must be applied by the host separately.
- Present capabilities and limits explicitly: no whole-page WCAG certification, color-vision-deficiency guarantee, or unverified public registry availability.
- Pin the official public npm registry and public access in package metadata. Publication remains manual; CI does not publish.
- Expand the website around the product workflow, repair example, semantic tokens, portable integration, and honest boundaries; keep detailed signatures and errors in the API reference.

## Earlier repository development (unpublished)

- Initial Adaptive Palette engine and static dashboard demonstration under the former `adaptive-palette` name.
- Development snapshots also used the manifest label `0.1.0`; they were not separate public releases. The first public release above consolidates that work and the subsequent rename/repairs.
