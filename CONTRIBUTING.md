# Contributing to ContrastFit

Thank you for improving ContrastFit. Keep changes reproducible and aligned with its role: a deterministic color-token engine with inspectable contrast fitting, not a universal accessibility guarantee.

## Development setup

Use Node.js 22+ and the checked-in lockfile. The runtime has zero dependencies; development tools provide build/type checking, browser automation, and automated accessibility checks.

```sh
npm ci --ignore-scripts
npm run dev
```

The development server is loopback-only by default. Do not expose it to an untrusted network or place credentials in the static site. Package publication is a separate, explicitly authorized maintainer operation.

## Verification

```sh
npm run verify
npx --no-install playwright install chromium
npm run test:browser
```

Run a current `npm run build` before browser checks if files changed after `verify`. Browser installation is a one-time development prerequisite, not a runtime requirement. The installed development tools are used rather than downloading an unreviewed compiler or writing a custom accessibility auditor.

The configured CI matrix targets Node 22, 24, and 26, with a separate Chromium lane. A configured job is not a passing job: inspect remote results for the exact commit before claiming matrix support has been verified. Local results and remote results must be reported separately.

Core coverage thresholds are at least 95% lines, 85% branches, and 95% functions. Regressions cover all 4,096 short-hex backgrounds, target extremes, input errors, quantization/compositing, CSS serialization, type consumers, and actual packaged consumers. Do not lower a gate simply to make a change pass.

The browser suite checks representative rendered contrast, chart geometry against table data, redundant encodings, keyboard/input behavior, and responsive layouts. Its axe gate blocks serious/critical violations; it is not a promise of zero findings or complete WCAG conformance.

## Public contract checklist

When changing behavior:

- Keep [`src/contrast-fit.js`](./src/contrast-fit.js) deterministic, framework-independent, and free of runtime dependencies. Calculation and CSS-map generation must remain DOM-free.
- Update [`src/contrast-fit.d.ts`](./src/contrast-fit.d.ts), strict TypeScript consumer fixtures, and the [API reference](./docs/api.md) together.
- Exercise the installed tarball, not just source imports or an `npm pack --dry-run` listing. Keep ESM, CommonJS, browser-global, and declaration entry points consistent.
- Keep original `inputBackground` separate from the applied `background`. Test the background actually serialized and rendered.
- Default auto mode should fit the result rather than merely warn or lower requested targets. Preserve mode must honestly expose unresolved constraints.
- Measure final quantized CSS values. For fitted alpha surfaces, cover both fractional and quantized composition at boundary cases.
- Preserve per-series accent identity where contrast and distinctness permit it. Report color-only distinctness separately from numeric contrast.
- Keep `usable` limited to the evaluated numeric contrast targets. It does not validate a host renderer, whole-page accessibility, or color-vision-deficiency suitability.
- Keep the 17 semantic colors, seven alpha/effective-color fields, target flags, token metadata, and adjustment records mutually consistent.
- Use the default `contrast-fit` CSS prefix consistently, including examples and tests. Custom prefixes must remain supported and validated.
- Add invalid-input and boundary regressions for every new option or utility behavior.

## Documentation and demo checklist

- Update the [README](./README.md), [website](./docs/index.html), [API reference](./docs/api.md), [architecture](./docs/architecture.md), and [changelog](./CHANGELOG.md) when relevant; avoid duplicating the full reference in the README.
- Put breaking changes and explicit old-to-new identifiers in [MIGRATING.md](./MIGRATING.md). Do not invent compatibility aliases.
- Keep active product, package, repository, source, and CSS names consistent. Historical names belong only in migration/changelog context, except the exact original MIT copyright notice preserved in `LICENSE`. The naming gate permits that notice only in the source license and its generated static mirror; it does not exempt other license text or paths.
- Use local documentation links or canonical links under `https://github.com/prosody007/contrast-fit`. Do not invent a hosted documentation domain, an npm release, badges for unverified results, or social-preview images.
- Apply series patterns and circle/square/diamond markers to paths and matching legends. Include meaningful chart labels and accessible data access.
- Verify chart path coordinates, axis labels, bars, summaries, and tables describe the same underlying data.
- Test input repair states, invalid drafts, keyboard focus, mobile overflow, and representative light/dark/mid-tone backgrounds.
- Do not turn a numeric contrast pass or an axe result into a universal accessibility claim.

## Scope and style

Use small named functions and reviewable changes. Keep rendering/demo code out of the calculation engine. Prefer maintained tools and established platform APIs over custom compilers, sanitizers, or accessibility checkers. The presence of a build step does not justify adding runtime dependencies or a framework.

For review, include what changed, why, relevant commands and results, known limitations, and any breaking API/CSS changes. Never commit tokens, registry credentials, generated personal data, or unrelated output.

See [RELEASING.md](./RELEASING.md) for manual publication and [SECURITY.md](./SECURITY.md) for vulnerability reporting.
