# Releasing ContrastFit

Publication, Git tags, and GitHub releases are **manual, separately authorized maintainer actions**. Verification or site deployment does not grant permission to publish. CI must not publish automatically.

## Current distribution status

No public npm release is currently documented. Use source imports or a reviewed local tarball as described in the [API reference](./docs/api.md). The intended npm package and GitHub repository slug is `contrast-fit`; the product name is ContrastFit.

Keep these claims distinct in every release report:

- **Local verification:** commands actually completed, environment, revision, and results.
- **Remote CI:** results for the exact proposed commit, not the existence of a workflow.
- **Registry publication:** confirmed package/version/tag after authorized publication, not a manifest or dry run.

Node 22/24/26 are the configured remote verification targets. Their current remote results are **not yet verified by this checklist**; inspect all required jobs before a release. A local pass on one Node version does not establish the other matrix results.

## 1. Confirm ownership, naming, and authorization

- [ ] Obtain explicit approval for the intended version, registry tag, publication, and any Git tag/release. Treat a pre-release identifier change as breaking; review [MIGRATING.md](./MIGRATING.md).
- [ ] Verify npm registry ownership/access for `contrast-fit`, the effective authenticated account, organization policy where applicable, and permission to publish. A name search, availability result, GitHub repository ownership, or matching username does not prove registry ownership.
- [ ] Verify that the canonical repository is `https://github.com/prosody007/contrast-fit`, and that repository/package metadata and issue links resolve as intended.
- [ ] Review naming separately from technical readiness. Domain availability and trademark clearance are **unverified**. A matching non-software brand exists; that fact is not a legal clearance or a conclusion that a conflict exists. Obtain appropriate naming/legal review before making exclusivity or clearance claims.
- [ ] Do not invent a new documentation domain or replace an existing hosting URL merely because the repository slug changes. Review redirects, site settings, social metadata, and deployment status separately.
- [ ] Use npm's normal authenticated workflow and MFA. Keep tokens out of tracked files, scripts, browser assets, logs, and chat. Confirm trusted-publishing/provenance configuration rather than assuming it exists.
- [ ] Start from a reviewed worktree; account for all changes and generated artifacts. Confirm that the intended license and attribution are included.

## 2. Run the local verification gates

With the reviewed lockfile and supported Node.js version:

```sh
npm ci --ignore-scripts
npm run verify
npx --no-install playwright install chromium
npm run test:browser
npm publish --dry-run
```

`verify` is the repository's combined syntax, type-consumer, core-test/coverage, build/static-output, and packaged-consumer gate. Keep it aligned with the current scripts rather than treating this prose as a replacement for their implementation. Run a fresh build if files change before browser tests.

- [ ] Record exact command results and Node/npm versions. Do not report a pending, interrupted, or background-running command as passed.
- [ ] Confirm the coverage gates (95% lines, 85% branches, 95% functions) pass without lowering thresholds.
- [ ] Review all 4,096 short-hex regressions, representative six-digit colors, invalid inputs, custom accents, extreme targets, and fractional/quantized alpha boundaries.
- [ ] Check automatic fitting, original-versus-resolved background handling, preserve-mode unresolved diagnostics, and independent status repairs.
- [ ] Inspect `usable` and color-only distinctness separately, including extreme targets where patterns and markers are essential.
- [ ] Confirm the browser suite exercises actual plotted values, table/axis consistency, rendered contrast, keyboard/input behavior, and responsive layouts. Its axe gate checks serious/critical findings, not all possible accessibility issues.

## 3. Inspect the actual distribution

- [ ] Build and inspect `dist/contrast-fit.js` (ESM), `dist/contrast-fit.cjs` (CommonJS), `dist/contrast-fit.global.js` (browser global), and the shipped declarations. Check `main`, `types`, and conditional `exports` against actual files.
- [ ] Confirm ESM `import { createContrastFit } from "contrast-fit"`, CommonJS `require("contrast-fit")`, and `globalThis.ContrastFit.createContrastFit` expose the intended named API. The public result type is `ContrastFitPalette`.
- [ ] Confirm package consumers do not need the repository's development dependencies; the runtime dependency list must remain empty.
- [ ] Inspect `npm pack` contents and `npm publish --dry-run` output. Ship the intended source/distribution/declarations, manifest, license, and essential docs; exclude credentials, `node_modules`, private files, tests/tooling not intended for consumers, and deployment output.
- [ ] Test a real tarball in an isolated consumer. A file listing alone does not verify resolution, execution, declarations, or browser-global behavior.
- [ ] Verify the default 17 CSS names begin with `--contrast-fit-`, including `--contrast-fit-bg`; check custom-prefix support.
- [ ] Keep local-tarball instructions until a public version is independently confirmed. Never add an unverified CDN URL or suggest an unconfirmed package is already installable from the registry.

## 4. Review documentation, site, and remote CI

- [ ] Update `package.json` and `package-lock.json` versions consistently. Move the relevant Unreleased notes into an accurately dated/versioned [changelog](./CHANGELOG.md) section only when the release is being made; do not invent publication history.
- [ ] Check README, [API reference](./docs/api.md), [architecture](./docs/architecture.md), [migration guide](./MIGRATING.md), demo, metadata, and package exports describe the same contract.
- [ ] Check all local links in the built static output and canonical GitHub links after any remote rename. Avoid a fake canonical site URL, Open Graph image, release badge, or registry claim.
- [ ] Manually inspect light, dark, mid-tone, repaired, and preserve-mode states; keyboard focus, mobile overflow, chart patterns/markers and legends, data tables, and token/adjustment readouts. No automated pass replaces complete accessibility review.
- [ ] Review successful remote results for **Node 22, 24, and 26**, plus the Chromium lane, on the exact reviewed commit. Resolve missing, skipped, pending, or failing jobs rather than reporting the matrix as passed.
- [ ] Confirm no release job or lifecycle script publishes without the explicit authorization from step 1.

## 5. Publish only after explicit approval

The following is an example of a deliberate pre-release-tag publication, not an instruction to run it during development:

```sh
# Only after the reviewed version and registry tag are explicitly authorized:
npm publish --tag next --access public
```

The version and tag must be chosen deliberately. `--tag next` alone does not turn an ordinary version number into a SemVer pre-release. Do not use `latest` for an unapproved stable release. Use provenance where the chosen publishing workflow actually supports and has configured it; do not add a token to work around missing trusted-publishing setup.

After authorized publication:

1. Independently install the exact published version into an empty consumer and verify ESM, CommonJS, TypeScript, and the browser-global asset.
2. Verify registry metadata, integrity, included files, license, and the intended distribution tag.
3. Create only the separately approved Git tag and GitHub release, with notes that distinguish breaking changes, fixes, evidence, and remaining limits.
4. Update distribution-status prose with the confirmed version and tested instructions. Update the website only through its reviewed deployment process.
5. Never overwrite or pretend to replace an already-published version. Handle a bad release with the registry's supported deprecation/remediation process and a new reviewed version.
