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
