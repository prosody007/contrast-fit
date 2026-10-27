# Changelog

Notable changes to ContrastFit are documented here. Repository history and planned distribution changes are not proof of npm publication; no public npm release is currently documented.

## Unreleased

### Breaking pre-release rename

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
- Node 22/24/26 CI configuration plus Chromium/axe browser checks. Configured jobs do not establish passing remote results for the current revision.
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
- Present capabilities and limits explicitly: no whole-page WCAG certification, color-vision-deficiency guarantee, or implied public registry availability.
- Expand the website around the product workflow, repair example, semantic tokens, portable integration, and honest boundaries; keep detailed signatures and errors in the API reference.

## 0.1.0 — initial repository version

- Initial Adaptive Palette engine and static dashboard demonstration under the former `adaptive-palette` name.
- This section records the repository's initial version label; it does not assert an npm publication date or a public registry release.
