# Security Policy

Adaptive Palette is a static, client-side project. It does not run a backend, store user data, or make network requests in the demo.

## Supported Versions

Security fixes target the latest version on `main`.

## Reporting a Vulnerability

If you find a security issue, please open a private report or contact the repository owner directly.

## Notes for Integrators

The core library accepts color strings and validates them as hex colors. If your product extends the demo to accept arbitrary user content, remote JSON, or generated chart labels, do not render that content with `innerHTML` unless it has been safely escaped or sanitized.
