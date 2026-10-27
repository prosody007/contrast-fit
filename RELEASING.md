# Releasing ContrastFit

Publication, Git tags, and GitHub releases are **manual, separately authorized maintainer actions**. Verification or site deployment does not grant permission to publish. CI must not publish automatically.

## Current distribution status

[`contrast-fit@0.1.0`](https://www.npmjs.com/package/contrast-fit/v/0.1.0) was published on 2026-10-27 and independently verified from the official registry. Install with `npm install contrast-fit` or pin `npm install contrast-fit@0.1.0`; see the [API reference](./docs/api.md) for ESM, CommonJS, TypeScript and self-hosted browser-script examples. The npm package and GitHub repository slug is `contrast-fit`; the product name is ContrastFit.

The completed first release uses npm **`latest`**, annotated **`v0.1.0`**, and a normal (not draft, not SemVer-prerelease) [GitHub release](https://github.com/prosody007/contrast-fit/releases/tag/v0.1.0). `latest` is a default-install channel, not a promise of 1.0 API stability. This first usable 0.x release is early access; its APIs and fitted colors may evolve. Do not claim WCAG certification, universal browser support, or legal naming clearance.

### First-release evidence

- Package-source commit: `000afc5852abf8399d1c091bb7114e05193bca5f`; [all five exact-source CI jobs passed](https://github.com/prosody007/contrast-fit/actions/runs/40491320212): Node 22/24/26, Chromium, Pages.
- Normal owner-authenticated npm CLI plus 2FA; no token bypass or local-CLI provenance claim. npm briefly processed a registry staging placeholder before `0.1.0` became visible; no alternate version was deliberately published by this release process.
- Official registry `latest` = `0.1.0`, maintainer `prosody007`, MIT, zero runtime dependencies, 17 files, 46,897-byte archive. Registry bytes exactly match the reviewed archive.
- SHA-256: `65e2b67c0b188347c5cd783eb55ec1a4db384c68e8269b1ae755946f9fc95814`.
- Registry integrity: `sha512-FmRfeP+EODZVAqqCwl3+ssl0CM1bLa9Vh1HYw66g3oXlqmj2augkJUKmhFEUQl2ZHAgdnWWbfdmI3jZY2yonNA==`.
- Empty official-registry install passed ESM, CommonJS, strict TypeScript NodeNext import/typed require, and classic-browser global/DOM adapter checks. The archive, checksum and source mapping are GitHub release assets; registry `gitHead` was absent for this exact-tarball publication.
- The release tag remains at the package-source commit. This confirmed-install documentation is a separate later commit; the immutable published archive retains its truthful pre-publication candidate prose. Future releases must update source and version deliberately, not republish `0.1.0`.

Keep these claims distinct in every release report:

- **Local verification:** commands actually completed, environment, revision, and results.
- **Remote CI:** results for the exact proposed commit, not the existence of a workflow.
- **Registry publication:** confirmed package/version/tag after authorized publication, not a manifest or dry run.

Node 22/24/26 are the configured remote verification targets. Their package-source results are verified above; inspect all required jobs for each new proposed commit before a release. A local pass on one Node version does not establish the other matrix results.

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
npm run package:smoke -- --browser
npm publish --dry-run --registry=https://registry.npmjs.org --tag latest --access public
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

For the authorized first release, use the maintained npm CLI with normal authentication/MFA. Confirm the effective account with `npm whoami --registry=https://registry.npmjs.org`, and reconcile `npm view contrast-fit --json --registry=https://registry.npmjs.org` plus existing remote tags/releases before publishing. An unauthenticated 404 means absent metadata, not ownership. If an unexpected package/version or maintainer exists, stop for a decision; do not choose another name/version or overwrite it.

1. Commit and push the reviewed package source normally. Require **all five jobs** (Node 22/24/26, Chromium, Pages) to succeed for that exact SHA.
2. From that clean tested commit, run `npm pack --pack-destination /absolute/path/to/release-artifacts`. Record the source SHA, npm version, exact file list, SHA-256 and SHA-512 integrity of the resulting `contrast-fit-0.1.0.tgz`. Inspect the actual archive for secrets and unintended files, and exercise that archive in an empty consumer. Keep the reviewed bytes unchanged.
3. Dry-run and publish **the reviewed archive**, not a newly rebuilt directory:

   ```sh
   npm publish /absolute/path/to/contrast-fit-0.1.0.tgz --dry-run --registry=https://registry.npmjs.org --tag latest --access public
   # Only after the dry run, exact-head CI and normal authenticated/MFA checks pass:
   npm publish /absolute/path/to/contrast-fit-0.1.0.tgz --registry=https://registry.npmjs.org --tag latest --access public
   ```

Use provenance only where the actual publishing workflow supports and has configured it. This local CLI path does not claim provenance; do not add a long-lived token or bypass MFA to manufacture it. Never put credentials or short-lived authentication URLs in release artifacts, Git, public notes, or logs shared with others.

After authorized publication:

1. Independently fetch registry metadata and install `contrast-fit@0.1.0` from the official registry into an empty consumer (not from the local archive). Verify ESM, CommonJS, strict TypeScript NodeNext import/typed require, browser-global execution and the DOM adapter.
2. Verify `latest` resolves to `0.1.0`, the effective maintainer, zero runtime dependencies, MIT license, declarations/files, and registry `dist.integrity` against the exact reviewed archive. Record `gitHead` when present; an external source-SHA/checksum record is authoritative if archive publication omits that field.
3. Create the annotated `v0.1.0` tag **at the tested package-source commit**, push normally, and publish the authorized GitHub release with truthful maturity, features, breaking development-snapshot changes, verification, and limits. Attach the exact published archive and checksums when useful; verify the tag's dereferenced SHA and the public non-draft release/assets.
4. Only after registry verification, update active README/API/migration/security/site distribution prose with the confirmed version and `npm install contrast-fit` instructions. Keep this as a **separate documentation commit**; do not move `v0.1.0` away from the published package source. Re-run the appropriate local checks and the complete exact-head CI/Pages pipeline for this final documentation commit.
5. Never overwrite or pretend to replace an already-published version. Handle a bad release with the registry's supported deprecation/remediation process and a new reviewed version. If authentication blocks publication, retain candidate wording, report the prepared source/checksums and concrete login action, and do not announce an npm release that does not exist.
