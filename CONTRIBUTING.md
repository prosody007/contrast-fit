# Contributing

Thanks for helping improve Adaptive Palette.

## Development

```bash
npm run dev
npm run check
npm test
```

## Pull Request Checklist

- Keep the core module framework-agnostic.
- Avoid adding runtime dependencies unless there is a clear reason.
- Add or update tests when changing color calculation behavior.
- Keep the dashboard demo focused on showing adaptive color behavior.
- Run `npm run build` before submitting changes.

## Code Style

- Use modern JavaScript modules.
- Prefer small, named functions over large inline blocks.
- Keep DOM demo code separate from core color logic.
- Use CSS custom properties for visual integration.
