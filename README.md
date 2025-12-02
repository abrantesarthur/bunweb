<img src="/docs/bunweb.png" alt="Bunweb middleware framework for bun"/>

# bunweb

> Koa-inspired web framework for Bun — minimal, async-first, zero dependencies.

[![license](https://img.shields.io/github/license/abrantesarthur/bunway.svg)](LICENSE)

An expressive HTTP middleware framework built for Bun's native performance. Middleware flows stack-style: perform actions downstream, then filter and manipulate responses upstream.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Features](#features)
- [Middleware](#middleware)
  - [Execution Order](#execution-order)
- [Context API](#context-api)
- [Routing](#routing)
  - [app.get / post / put / delete](#appget--post--put--delete)
  - [app.use](#appuse)
  - [app.listen](#applisten)
- [TypeScript Support](#typescript-support)
- [Examples](#examples)
- [License](#license)

## Installation

Requires **Bun v1.0.0+**

```sh
bun add bunweb
```

## Quick Start

```js
import { server } from "bunweb";

const app = server();

app.get("/", async (ctx, next) => {
  ctx.body = "Hello Bunweb";
});

app.listen({ port: 3000 });
```

## Features

- Express-style routing (`app.get`, `app.put`, `app.post`, etc.)
- Named URL parameters with TypeScript inference
- Prefix-matching middleware via `app.use()`
- Native `async/await` support
- Zero external dependencies
- Built for Bun's performance

## Middleware

Bunweb accepts async functions as middleware:

```js
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  console.log(`${ctx.method} ${ctx.path} - ${Date.now() - start}ms`);
});
```

### Execution Order

**Important**: Unlike Koa, `use` middlewares run **before** method-specific handlers. This enables global middleware (auth, logging, CORS) to execute first.

```js
app.use("/api", async (ctx, next) => {
  console.log("1. API middleware");
  await next();
});

app.get("/api/users", async (ctx, next) => {
  console.log("2. Route handler");
  ctx.body = { users: [] };
});
```

Order: `use` middlewares (prefix match) → method handlers (exact match)

## Context API

Each middleware receives a `Context` object encapsulating the request and response:

| Property           | Description                              |
| ------------------ | ---------------------------------------- |
| `ctx.request`      | Original Bun Request object              |
| `ctx.method`       | HTTP method (lowercase)                  |
| `ctx.path`         | Request pathname                         |
| `ctx.params`       | Route parameters (e.g., `{ id: "123" }`) |
| `ctx.headers`      | Request headers (read-only)              |
| `ctx.searchParams` | URL search parameters (Map)              |
| `ctx.origin`       | Protocol + host                          |
| `ctx.host`         | Host with port                           |
| `ctx.hostname`     | Host without port                        |
| `ctx.protocol`     | `http:` or `https:`                      |
| `ctx.status`       | Response status code                     |
| `ctx.body`         | Response body (auto-sets status 200/204) |
| `ctx.set(h, v)`    | Set response header                      |

```js
app.get("/users/:id", async (ctx, next) => {
  ctx.set("Content-Type", "application/json");
  ctx.status = 200;
  ctx.body = {
    userId: ctx.params.id,
    query: ctx.searchParams.get("include"),
  };
});
```

## Routing

### `app.get / post / put / delete`

Register method-specific route handlers:

```js
app.get("/users/:id", async (ctx, next) => {
  ctx.body = { userId: ctx.params.id };
});

app.post("/users", async (ctx, next) => {
  ctx.status = 201;
  ctx.body = { id: 1 };
});
```

### `app.use`

Register middleware with prefix matching. Executes before method handlers.

```js
// Global middleware (all routes)
app.use(async (ctx, next) => {
  console.log(`${ctx.method} ${ctx.path}`);
  await next();
});

// Prefix middleware (routes starting with /api)
app.use("/api", async (ctx, next) => {
  // auth, logging, etc.
  await next();
});
```

### `app.listen`

Start the HTTP server:

```js
const srv = app.listen({ port: 3000 });
const srv = app.listen({ port: 3000, hostname: "0.0.0.0" });
```

Returns a Bun `Server` instance.

## TypeScript Support

Full type safety with inferred route parameters:

```ts
app.get("/users/:id", async (ctx, next) => {
  ctx.params.id; // ✅ TypeScript knows this exists
  ctx.params.name; // ❌ TypeScript error
});
```

## Examples

### Multiple middlewares

```js
const logger = async (ctx, next) => {
  console.log(`${ctx.method} ${ctx.path}`);
  await next();
};

const auth = async (ctx, next) => {
  if (!ctx.headers["authorization"]) {
    ctx.status = 401;
    ctx.body = { error: "Unauthorized" };
    return;
  }
  await next();
};

app.use("/api", logger, auth);
app.get("/api/users", async (ctx) => {
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
    ctx.body = { error: err.message };
  }
});
```

### File download

```js
app.get("/download", async (ctx, next) => {
  ctx.set("Content-Type", "application/octet-stream");
  ctx.set("Content-Disposition", "attachment; filename=file.txt");
  ctx.body = "file content";
});
```

## License

[MIT](LICENSE)
