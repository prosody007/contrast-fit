# Migrating to ContrastFit

This is a **breaking pre-release rename**, not an announcement of an npm publication. ContrastFit is the active product name; `contrast-fit` is the intended package name and repository slug. No public npm release is currently documented. Use a reviewed local tarball or source checkout until publication is explicitly confirmed.

This guide is the deliberate historical mapping for existing checkouts and integrations. There are no promised compatibility aliases, old-name re-exports, deprecated shims, or preserved old CSS properties.

## Identifier mapping

| Previous identifier | Current identifier | What to change |
| --- | --- | --- |
| Adaptive Palette | ContrastFit | Product labels, documentation titles, metadata, and integration references. |
| `adaptive-palette` | `contrast-fit` | Package name, package imports, local dependency keys, and tarball references. |
| `https://github.com/prosody007/adaptive-palette` | `https://github.com/prosody007/contrast-fit` | Repository, issues, and source links. Do not depend on an old-slug redirect. |
| `createAdaptivePalette` | `createContrastFit` | Named function imports and calls. |
| `AdaptivePalette` | `ContrastFitPalette` | Type-only imports, annotations, and wrappers. |
| `src/adaptive-palette.js` | `src/contrast-fit.js` | Direct source imports, test fixtures, and build references. |
| `src/adaptive-palette.d.ts` | `src/contrast-fit.d.ts` | Source declaration references; installed consumers should resolve types through the package. |
| Default prefix `adaptive` | Default prefix `contrast-fit` | CSS property references and any code expecting serializer keys. |
| `--adaptive-bg`, `--adaptive-text`, etc. | `--contrast-fit-bg`, `--contrast-fit-text`, etc. | All 17 default custom-property names; suffix meanings are unchanged. |

Other public utility function names remain unchanged: `normalizeHex`, `parseHex`, `toHex`, `rgba`, `mix`, `relativeLuminance`, `contrastRatio`, `readableTone`, `readableAccent`, `paletteToCssVariables`, and `applyPaletteToElement`.

## 1. Update imports and types

For an application with a locally installed package:

```ts
// Before:
import { createAdaptivePalette, type AdaptivePalette } from "adaptive-palette";

// After:
import { createContrastFit, type ContrastFitPalette } from "contrast-fit";

const palette: ContrastFitPalette = createContrastFit("#123456");
```

For repository-root source imports:

```js
// Before:
import { createAdaptivePalette } from "./src/adaptive-palette.js";

// After:
import { createContrastFit } from "./src/contrast-fit.js";
```

Update the application's local dependency reference and lockfile with its normal package workflow. Do not blindly replace a dependency with a registry install: the new name is not evidence that a public version exists. See [local tarball instructions](./docs/api.md).

A local checkout directory does not need to be renamed for the API to work. The directory name is not an exported identifier. If you rename your checkout, update absolute paths in your own editor, scripts, and deployment settings deliberately.

## 2. Update CSS consumers

Both serializers now default to the `contrast-fit` prefix:

```css
/* Before */
.card {
  background: var(--adaptive-bg);
  color: var(--adaptive-text);
}

/* After */
.card {
  background: var(--contrast-fit-bg);
  color: var(--contrast-fit-text);
}
```

The same rename applies to muted, panel, metric, border, grid, axis, plot-fill, bars, series-a/b/c, good-bg/text, and warn-bg/text. Update SVG styles, SSR property maps, test expectations, and any consuming stylesheet—not only the function import.

Custom prefixes remain supported. If an application already passes `"card"`, its `--card-*` names do not change:

```js
const variables = paletteToCssVariables(palette, "card");
applyPaletteToElement(element, palette, "card");
```

Keep the serializer prefix and consuming CSS aligned. No automatic old/new property duplication is provided.

## 3. Use the supported distribution entry point

The source remains ESM. Built distributions provide:

- `dist/contrast-fit.js`: ESM, used by the package's import entry.
- `dist/contrast-fit.cjs`: CommonJS, used by the package's require entry.
- `dist/contrast-fit.global.js`: classic browser script exposing `globalThis.ContrastFit`.
- TypeScript declarations resolved through the manifest's type/conditional export entries.

Prefer package-root imports after installing a reviewed tarball. Do not depend on undeclared deep package imports. For a source checkout, update the explicit source filename. For a script-tag integration, copy the built global file into your own assets and call `globalThis.ContrastFit.createContrastFit`; the bundle does not automatically theme the DOM.

## 4. Check the current fitting contract

This pre-release work also formalizes automatic contrast repair and measured result metadata. If you are upgrading from an earlier warning-only integration, do not assume the input color remains the content background:

```js
const palette = createContrastFit("#777777");
palette.inputBackground; // "#777777": normalized original choice
palette.background;      // "#A0A0A0": current default resolved background
palette.colors.text;     // "#000000", approximately 8.03:1 on that background
```

Apply `background`/`colors.background` to the content through `--contrast-fit-bg`; keep `inputBackground` only where the original choice is appropriate, such as an input control or surrounding frame. Exact repaired colors may evolve with a documented algorithm change.

If exact content pixels are mandatory, opt in explicitly:

```js
const palette = createContrastFit("#777777", {
  backgroundStrategy: "preserve",
});
// background remains #777777; usable may be false. Handle flags and warnings.
```

Targets remain 8, 4.7, 3.3, and 4.5 by default and are never silently reduced. Unknown keys and malformed inputs are rejected. Use the [complete API and error reference](./docs/api.md) to audit application assumptions.

## 5. Verify rendering, not only compilation

- Confirm all 17 variables are applied and consumed, including the resolved content background.
- Keep seven alpha-bearing surfaces directly over the resolved background when relying on their supplied measurements; nested translucency changes the result.
- Apply the supplied solid/dashed/dotted line patterns and circle/square/diamond markers to paths and matching legend keys. Color-only distinctness is reported separately.
- Treat `usable` as “all measured numeric contrast targets pass.” It does not include `seriesDistinct`, prove the host rendered the styles, certify a page, or guarantee color-vision-deficiency suitability.
- Exercise invalid input, preserve-mode failures, high contrast targets, light/dark/mid-tone colors, keyboard interactions, and representative rendered layers.
- Verify the actual tarball and distribution formats needed by your application, including declaration resolution.
- Update repository/deployment links after the authorized remote rename and review CI on the exact revision. Do not infer successful remote runs from configured jobs.

See [CHANGELOG.md](./CHANGELOG.md) for the change summary and [RELEASING.md](./RELEASING.md) for ownership, naming, verification, and publication gates.
