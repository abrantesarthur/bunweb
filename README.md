# bunweb

A koa-like web framework based on Bun's server.

## Similarities to Koa

- Supports async next and enforces it was called

## Differences from Koa

- In koa, handlers execute strictly according to registration order. For us, hanlers registered with use() always run before any method-specific route handlers, even when the use() handlers were registered later. However, just like koa, within use handlers or get/put/post handlers, they run according to registration order. There is no static over dynamic priority.

## Similarities to express

- The core middleware and router are merged into one package.

## Limitations

- Does not support specifying middlewares with wildcards (e.g., .use(/x/y/:id\*) is forbidden)

## Development

### Git Hooks

This repository includes pre-commit hooks that run code quality checks. To set them up, run:

```bash
bun run setup-hooks
```

Or manually:

```bash
git config core.hooksPath .githooks
```

The pre-commit hook will:

- Check for console statements
- Check for TODO/FIXME comments (warning only)
- Run TypeScript type checking
- Run ESLint on staged files
- Check Prettier formatting
- Run tests (with minimal output)

## Future Improvements

- Improve error handling. Instead of propagating raw errors, introduce a final ctx.onerror handler that treats erros accordingly. Take koa's error handling as inspiration. See koa/lib/application.js' handleRequest for inspiration.
