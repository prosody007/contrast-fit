# ContrastFit security policy

## Scope and supported code

Security fixes target the latest reviewed code on `main`. There is no documented public npm release or long-term-support release line at present. A repository version number alone is not evidence that a package has been published.

ContrastFit's calculation engine runs locally, has zero runtime dependencies, and does not make network requests, read cookies, store data, or call an external model service. The bundled demonstration is a static site: loading its assets and following explicit links are separate from the engine's calculations. A hosting provider or a consuming application may have its own logging, analytics, storage, or privacy policy.

## Reporting a vulnerability

Use [the repository's Security page](https://github.com/prosody007/contrast-fit/security) to find the available reporting channels. If private vulnerability reporting is enabled, prefer it. If no private channel is available, ask the repository owner for a private reporting route without disclosing exploit details publicly.

Do not put secrets, personal data, or a working exploit in a public issue. A useful private report identifies the affected revision, environment, minimal reproduction, impact, and any proposed mitigation. This project does not promise a fixed response time or a bug bounty.

## Input and integration boundaries

- Background and accent strings accept only opaque three- or six-digit hex. Numeric targets and RGB utility inputs are validated.
- CSS prefix syntax and generated palette color fields are checked before DOM writes. Palette serialization is designed for generated data; it is **not** a general HTML/CSS sanitizer.
- `applyPaletteToElement` validates before writing properties, but cannot roll back writes if an application-supplied `setProperty` implementation throws.
- The local development server is intended for loopback use, with an allowlisted static tree. Do not expose it as a production server or put secrets among served files.
- Do not concatenate untrusted chart labels or user content into `innerHTML`, script bodies, or style attributes. Use safe DOM/text APIs and your framework's normal escaping.
- Keep server-side and browser inputs consistent for hydration; validate application-specific data before passing it to rendering code.

The engine does not analyze remote content, gradients, images, or a complete CSS layer stack. `usable`, `effectiveColors`, target flags, and token metadata are calculation results, not a security assessment, whole-page accessibility certificate, or color-vision-deficiency guarantee. See [integration limits](./docs/architecture.md).

## Maintainer practices

Keep development dependencies and the lockfile reviewed. Runtime dependency-free does not remove supply-chain risk from builds or release tooling. Never place npm credentials in tracked files, browser assets, logs, or documentation examples. Follow the separately authorized [release checklist](./RELEASING.md); CI is a verification path, not permission to publish.
