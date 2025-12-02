# bunweb

> A Koa-like web framework for Bun — minimalist, async-first, and built with zero external dependencies.

[![license](https://img.shields.io/github/license/yourusername/bunweb.svg)](LICENSE)

Expressive HTTP middleware framework for Bun to make web applications and APIs more enjoyable to write. Bunweb's middleware stack flows in a stack-like manner, allowing you to perform actions downstream then filter and manipulate the response upstream.

Only methods that are common to nearly all HTTP servers are integrated directly into Bunweb's small codebase. This includes things like content negotiation, normalization of inconsistencies, redirection, and a few others.

Bunweb is not bundled with any middleware.

## Installation

Bunweb requires **Bun v1.0.0** or higher.

```sh
bun add bunweb
```

## Hello Bunweb

```js
import { server } from "bunweb";

const app = server();

// response
app.get("/", async (ctx, next) => {
  ctx.body = "Hello Bunweb";
});

app.listen({ port: 3000 });
```

## Features

- Express-style routing (`app.get`, `app.put`, `app.post`, etc.)
- Named URL parameters with TypeScript type inference
- Prefix-matching middleware with `app.use()`
- `async/await` support
- Zero external dependencies
- Built for Bun's native performance
- Type-safe route parameters

## Middleware

Bunweb is a middleware framework that takes async functions as middleware.

Here is an example of logger middleware:

### Async functions

```js
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`${ctx.method} ${ctx.path} - ${ms}ms`);
});
```

### Middleware Execution Order

**Important**: Unlike Koa, Bunweb executes `use` middlewares **before** method-specific middlewares. This allows you to set up global middleware (like authentication, logging, CORS) that runs before route-specific handlers.

```js
// This middleware runs FIRST for all matching routes
app.use("/api", async (ctx, next) => {
  console.log("API middleware");
  await next();
});

// This middleware runs SECOND (after use middlewares)
app.get("/api/users", async (ctx, next) => {
  ctx.body = { users: [] };
});
```

The execution order is:

1. All matching `use` middlewares (prefix match)
2. Method-specific middlewares (exact match)

## Context, Request and Response

Each middleware receives a Bunweb `Context` object that encapsulates an incoming
http message and the corresponding response to that message. `ctx` is often used
as the parameter name for the context object.

```js
app.use(async (ctx, next) => {
  await next();
});
```

Bunweb provides a `Context` object that includes:

- `ctx.request` - The original Bun Request object
- `ctx.method` - HTTP method in lowercase
- `ctx.path` - Request pathname
- `ctx.params` - Route parameters (e.g., `{ id: "123" }` from `/users/:id`)
- `ctx.headers` - Request headers (read-only)
- `ctx.searchParams` - URL search parameters as a Map
- `ctx.origin` - Request origin (protocol + host)
- `ctx.host` - Request host with port
- `ctx.hostname` - Request hostname without port
- `ctx.protocol` - Request protocol (http: or https:)
- `ctx.status` - HTTP response status code
- `ctx.body` - Response body (automatically sets status to 200 or 204)
- `ctx.set(header, value)` - Set response headers

Here is an example of accessing request information:

```js
app.get("/users/:id", async (ctx, next) => {
  const userId = ctx.params.id;
  const query = ctx.searchParams.get("include");
  ctx.body = { userId, query };
});
```

Here is an example using response methods:

```js
app.post("/users", async (ctx, next) => {
  ctx.set("Content-Type", "application/json");
  ctx.status = 201;
  ctx.body = { id: 1, name: "John" };
});
```

## API Reference

### `server()`

Creates and returns a Bunweb application instance. Uses singleton pattern - multiple calls return the same instance.

```js
import { server } from "bunweb";

const app = server();
```

### `app.get(path, ...middlewares)`

Registers a GET route handler.

```js
app.get("/users/:id", async (ctx, next) => {
  ctx.body = { userId: ctx.params.id };
});
```

### `app.post(path, ...middlewares)`

Registers a POST route handler.

```js
app.post("/users", async (ctx, next) => {
  // Create user
  ctx.status = 201;
  ctx.body = { id: 1 };
});
```

### `app.put(path, ...middlewares)`

Registers a PUT route handler.

```js
app.put("/users/:id", async (ctx, next) => {
  // Update user
  ctx.body = { id: ctx.params.id, updated: true };
});
```

### `app.use(path, ...middlewares)`

Registers a middleware that matches all HTTP methods with prefix matching. Use middlewares are executed **before** method-specific middlewares.

```js
// Global middleware (matches all routes)
app.use(async (ctx, next) => {
  console.log(`${ctx.method} ${ctx.path}`);
  await next();
});

// Prefix middleware (matches all routes starting with /api)
app.use("/api", async (ctx, next) => {
  // Authentication, logging, etc.
  await next();
});
```

### `app.listen(options)`

Starts the HTTP server and begins listening for requests.

```js
const server = app.listen({ port: 3000 });

// With hostname
const server = app.listen({ port: 3000, hostname: "0.0.0.0" });
```

Returns a Bun `Server` instance.

## TypeScript Support

Bunweb is written in TypeScript and provides full type safety, including typed route parameters:

```ts
import { server } from "bunweb";

const app = server();

// TypeScript infers ctx.params.id as string
app.get("/users/:id", async (ctx, next) => {
  ctx.params.id; // ✅ TypeScript knows this exists
  ctx.params.name; // ❌ TypeScript error - doesn't exist
});
```

## Examples

### Basic routing

```js
import { server } from "bunweb";

const app = server();

app.get("/", async (ctx, next) => {
  ctx.body = "Hello World";
});

app.get("/users/:id", async (ctx, next) => {
  ctx.body = { userId: ctx.params.id };
});

app.post("/users", async (ctx, next) => {
  ctx.status = 201;
  ctx.body = { message: "User created" };
});

app.listen({ port: 3000 });
```

### Multiple middlewares

```js
const logger = async (ctx, next) => {
  console.log(`${ctx.method} ${ctx.path}`);
  await next();
};

const auth = async (ctx, next) => {
  const token = ctx.headers["authorization"];
  if (!token) {
    ctx.status = 401;
    ctx.body = { error: "Unauthorized" };
    return;
  }
  await next();
};

app.use("/api", logger, auth);
app.get("/api/users", async (ctx, next) => {
  ctx.body = { users: [] };
});
```

### Error handling

```js
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    ctx.status = 500;
    ctx.body = {
      error: err.message,
    };
  }
});
```

### JSON responses

```js
app.get("/api/data", async (ctx, next) => {
  ctx.body = { data: [1, 2, 3] }; // Automatically serialized as JSON
  // Status automatically set to 200
});
```

### Setting headers

```js
app.get("/download", async (ctx, next) => {
  ctx.set("Content-Type", "application/octet-stream");
  ctx.set("Content-Disposition", "attachment; filename=file.txt");
  ctx.body = "file content";
});
```

## License

[MIT](LICENSE)
