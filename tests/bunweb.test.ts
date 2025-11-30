import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { server } from "../src/server";
import { RouteMatcher, RouteMatcherMode } from "../src/routeMatcher";
import { Method, type Middleware } from "../src/types";
import type { Server } from "bun";

// bypass private property type checks
type BunwebInternal = {
  registerRoute: (
    path: string,
    method: Method,
    ...middlewares: (Middleware | Middleware[] | unknown)[]
  ) => void;
  routeMatchersByMethod: Record<Method, RouteMatcher>;
  clear: () => void; // private method accessed via type assertion
  use: (path: string, ...middlewares: (Middleware | Middleware[])[]) => void;
  get: (path: string, ...middlewares: (Middleware | Middleware[])[]) => void;
  post: (path: string, ...middlewares: (Middleware | Middleware[])[]) => void;
  put: (path: string, ...middlewares: (Middleware | Middleware[])[]) => void;
  listen: (options: { port: number }) => Server<undefined>;
};

describe("Bunweb.registerRoute", () => {
  const bunweb = server() as unknown as BunwebInternal;

  beforeEach(() => {
    for (const method of [Method.Get, Method.Post, Method.Put]) {
      bunweb.routeMatchersByMethod[method] = new RouteMatcher();
    }
    bunweb.routeMatchersByMethod[Method.Use] = new RouteMatcher(
      RouteMatcherMode.Prefix,
    );
  });

  it.skip("stores the route on the matching method with flattened middlewares", () => {
    const h1: Middleware = async (ctx, next) => {};
    const h2: Middleware = async (ctx, next) => {};
    const h3: Middleware = async (ctx, next) => {};

    bunweb.registerRoute("/flatten", Method.Get, h1, [h2, h3]);

    expect(bunweb.routeMatchersByMethod[Method.Get].match("/flatten")).toEqual({
      middlewares: [h1, h2, h3],
      params: {},
    });
    expect(
      bunweb.routeMatchersByMethod[Method.Post].match("/flatten"),
    ).toBeUndefined();
    expect(
      bunweb.routeMatchersByMethod[Method.Put].match("/flatten"),
    ).toBeUndefined();
  });

  it.skip("throws when a middleware array contains a non-function entry", () => {
    const handler: Middleware = async (ctx, next) => {};

    expect(() =>
      bunweb.registerRoute("/bad", Method.Post, [handler, "oops" as unknown]),
    ).toThrow('The path "/bad" contains a non-functional "post" handler.');

    expect(
      bunweb.routeMatchersByMethod[Method.Post].match("/bad"),
    ).toBeUndefined();
  });

  it.skip("throws when non-function middleware arguments are provided outside arrays", () => {
    const handler: Middleware = async (ctx, next) => {};

    expect(() =>
      bunweb.registerRoute("/skip", Method.Put, handler, null),
    ).toThrow('The path "/skip" contains a non-functional "put" handler.');

    expect(
      bunweb.routeMatchersByMethod[Method.Put].match("/skip"),
    ).toBeUndefined();
  });

  it.skip("stores the route on Method.Use with flattened middlewares", () => {
    const h1: Middleware = async (ctx, next) => {};
    const h2: Middleware = async (ctx, next) => {};
    const h3: Middleware = async (ctx, next) => {};

    bunweb.registerRoute("/flatten-use", Method.Use, h1, [h2, h3]);

    expect(
      bunweb.routeMatchersByMethod[Method.Use].match("/flatten-use"),
    ).toEqual({
      middlewares: [h1, h2, h3],
      params: {},
    });
    expect(
      bunweb.routeMatchersByMethod[Method.Get].match("/flatten-use"),
    ).toBeUndefined();
    expect(
      bunweb.routeMatchersByMethod[Method.Post].match("/flatten-use"),
    ).toBeUndefined();
    expect(
      bunweb.routeMatchersByMethod[Method.Put].match("/flatten-use"),
    ).toBeUndefined();
  });

  it.skip("throws when a middleware array contains a non-function entry for Method.Use", () => {
    const handler: Middleware = async (ctx, next) => {};

    expect(() =>
      bunweb.registerRoute("/bad-use", Method.Use, [
        handler,
        "oops" as unknown,
      ]),
    ).toThrow('The path "/bad-use" contains a non-functional "use" handler.');

    expect(
      bunweb.routeMatchersByMethod[Method.Use].match("/bad-use"),
    ).toBeUndefined();
  });

  it.skip("throws when non-function middleware arguments are provided outside arrays for Method.Use", () => {
    const handler: Middleware = async (ctx, next) => {};

    expect(() =>
      bunweb.registerRoute("/skip-use", Method.Use, handler, null),
    ).toThrow('The path "/skip-use" contains a non-functional "use" handler.');

    expect(
      bunweb.routeMatchersByMethod[Method.Use].match("/skip-use"),
    ).toBeUndefined();
  });
});

describe("Bunweb.listen", () => {
  let testServer: Server<undefined> | null = null;
  const calls: string[] = [];
  const app = server() as unknown as BunwebInternal;

  beforeEach(() => {
    calls.length = 0;
    // Clear all routes before each test
    app.clear();
  });

  afterEach(() => {
    if (testServer) {
      testServer.stop();
      testServer = null;
    }
    calls.length = 0;
  });

  it("returns not found if no method-specific middlewares are registered", async () => {
    const use: Middleware = async (ctx, next) => {
      ctx.body = { message: "ok" };
      calls.push("use");
      await next();
    };

    app.use("/test", use);

    testServer = app.listen({ port: 0 });
    const port = (testServer as any).port || 0;

    // Test GET
    const response = await fetch(`http://localhost:${port}/test`, {
      method: "GET",
    });
    expect(response.status).toBe(404);
    expect(calls).toEqual([]);
  });

  it("should return 404 for unmatched routes", async () => {
    testServer = app.listen({ port: 0 });
    const port = (testServer as any).port || 0;

    // Test GET
    const getResponse = await fetch(`http://localhost:${port}/test`, {
      method: "GET",
    });
    expect(getResponse.status).toBe(404);
    expect(getResponse.body).toBeNull;
  });

  it("should return 404 for matched routes without body written and without status set", async () => {
    const get: Middleware = async (ctx, next) => {
      calls.push("get");
      await next();
    };

    app.get("/test", get);

    testServer = app.listen({ port: 0 });
    const port = (testServer as any).port || 0;

    // Test GET
    const getResponse = await fetch(`http://localhost:${port}/test`, {
      method: "GET",
    });
    expect(getResponse.status).toBe(404);
    expect(getResponse.body).toBeNull;
    expect(calls).toEqual(["get"]);
  });

  it("should return status for matched routes without body written but with status set", async () => {
    const get: Middleware = async (ctx, next) => {
      calls.push("get");
      ctx.status = 203;
      await next();
    };

    app.get("/test", get);

    testServer = app.listen({ port: 0 });
    const port = (testServer as any).port || 0;

    // Test GET
    const getResponse = await fetch(`http://localhost:${port}/test`, {
      method: "GET",
    });
    expect(getResponse.status).toBe(203);
    expect(getResponse.body).toBeNull;
    expect(calls).toEqual(["get"]);
  });

  it("should return 200 for matched routes with body written but status not set", async () => {
    const get: Middleware = async (ctx, next) => {
      calls.push("get");
      ctx.body = { message: "ok" };
      await next();
    };

    app.get("/test", get);

    testServer = app.listen({ port: 0 });
    const port = (testServer as any).port || 0;

    // Test GET
    const getResponse = await fetch(`http://localhost:${port}/test`, {
      method: "GET",
    });
    expect(getResponse.status).toBe(200);
    const json = await getResponse.json();
    expect(json).toEqual({ message: "ok" });
    expect(calls).toEqual(["get"]);
  });

  it("should accept valid status codes between 100 and 999", async () => {
    const get: Middleware = async (ctx, next) => {
      ctx.status = 201;
      ctx.body = { message: "created" };
      await next();
    };

    app.get("/test", get);

    testServer = app.listen({ port: 0 });
    const port = (testServer as any).port || 0;

    const getResponse = await fetch(`http://localhost:${port}/test`, {
      method: "GET",
    });
    expect(getResponse.status).toBe(201);
    const json = await getResponse.json();
    expect(json).toEqual({ message: "created" });
  });

  it.skip("executes use middlewares before method-specific middlewares for GET, POST, PUT", async () => {
    const use1: Middleware = async (ctx, next) => {
      calls.push("use1");
      await next();
    };
    const use2: Middleware = async (ctx, next) => {
      calls.push("use2");
      await next();
    };
    const get1: Middleware = async (ctx, next) => {
      calls.push("get1");
      await next();
    };
    const post1: Middleware = async (ctx, next) => {
      calls.push("post1");
      await next();
    };
    const put1: Middleware = async (ctx, next) => {
      calls.push("put1");
      await next();
    };

    app.get("/test", get1);
    app.post("/test", post1);
    app.put("/test", put1);
    app.use("/test", use1, use2);

    testServer = app.listen({ port: 0 });
    const port = (testServer as any).port || 0;

    // Test GET
    const getResponse = await fetch(`http://localhost:${port}/test`, {
      method: "GET",
    });
    expect(getResponse.status).toBe(200);
    expect(calls).toEqual(["use1", "use2", "get1"]);
    calls.length = 0;

    // Test POST
    const postResponse = await fetch(`http://localhost:${port}/test`, {
      method: "POST",
    });
    expect(postResponse.status).toBe(200);
    expect(calls).toEqual(["use1", "use2", "post1"]);
    calls.length = 0;

    // Test PUT
    const putResponse = await fetch(`http://localhost:${port}/test`, {
      method: "PUT",
    });
    expect(putResponse.status).toBe(200);
    expect(calls).toEqual(["use1", "use2", "put1"]);
  });

  it.skip("OK executes nested use middlewares for all prefix paths, then method-specific middleware", async () => {
    const usePath: Middleware = async (ctx, next) => {
      calls.push("use-/path");
      await next();
    };
    const usePathX: Middleware = async (ctx, next) => {
      calls.push("use-/path/x");
      await next();
    };
    const usePathXY: Middleware = async (ctx, next) => {
      calls.push("use-/path/x/y");
      await next();
    };
    const getPathXYZ: Middleware = async (ctx, next) => {
      calls.push("get-/path/x/y/z");
      await next();
    };
    const postPathXYZ: Middleware = async (ctx, next) => {
      calls.push("post-/path/x/y/z");
      await next();
    };
    const putPathXYZ: Middleware = async (ctx, next) => {
      calls.push("put-/path/x/y/z");
      await next();
    };

    app.use("/path", usePath);
    app.use("/path/x", usePathX);
    app.use("/path/x/y", usePathXY);
    app.get("/path/x/y/z", getPathXYZ);
    app.post("/path/x/y/z", postPathXYZ);
    app.put("/path/x/y/z", putPathXYZ);

    testServer = app.listen({ port: 0 });
    const port = (testServer as any).port || 0;

    // Test GET
    const getResponse = await fetch(`http://localhost:${port}/path/x/y/z`, {
      method: "GET",
    });
    expect(getResponse.status).toBe(200);
    expect(calls).toEqual([
      "use-/path",
      "use-/path/x",
      "use-/path/x/y",
      "get-/path/x/y/z",
    ]);
    calls.length = 0;

    // Test POST
    const postResponse = await fetch(`http://localhost:${port}/path/x/y/z`, {
      method: "POST",
    });
    expect(postResponse.status).toBe(200);
    expect(calls).toEqual([
      "use-/path",
      "use-/path/x",
      "use-/path/x/y",
      "post-/path/x/y/z",
    ]);
    calls.length = 0;

    // Test PUT
    const putResponse = await fetch(`http://localhost:${port}/path/x/y/z`, {
      method: "PUT",
    });
    expect(putResponse.status).toBe(200);
    expect(calls).toEqual([
      "use-/path",
      "use-/path/x",
      "use-/path/x/y",
      "put-/path/x/y/z",
    ]);
  });

  it.skip("OK executes middlewares according to registration order", async () => {
    const use1: Middleware = async (ctx, next) => {
      calls.push("use1");
      await next();
    };
    const use2: Middleware = async (ctx, next) => {
      calls.push("use2");
      await next();
    };
    const use3: Middleware = async (ctx, next) => {
      calls.push("use3");
      await next();
    };
    const get1: Middleware = async (ctx, next) => {
      calls.push("get1");
      await next();
    };
    const get2: Middleware = async (ctx, next) => {
      calls.push("get2");
      await next();
    };
    const get3: Middleware = async (ctx, next) => {
      calls.push("get3");
      await next();
    };

    // Register use middlewares in order
    app.use("/test", use1);
    app.use("/test", use2);
    app.use("/test", use3);

    // Register get middlewares in order
    app.get("/test", get1);
    app.get("/test", get2);
    app.get("/test", get3);

    testServer = app.listen({ port: 0 });
    const port = (testServer as any).port || 0;

    const response = await fetch(`http://localhost:${port}/test`, {
      method: "GET",
    });
    expect(response.status).toBe(200);
    expect(calls).toEqual(["use1", "use2", "use3", "get1", "get2", "get3"]);
  });

  it.skip("SF runs use middlewares even when no method-specific middleware is registered", async () => {
    const use1: Middleware = async (ctx, next) => {
      ctx.body = "use middleware executed";
      calls.push("use1");
      await next();
    };
    const use2: Middleware = async (ctx, next) => {
      calls.push("use2");
      await next();
    };

    app.use("/test", use1, use2);
    // No .get("/test") registered

    testServer = app.listen({ port: 0 });
    const port = (testServer as any).port || 0;

    const response = await fetch(`http://localhost:${port}/test`, {
      method: "GET",
    });
    expect(response.status).toBe(200);
    expect(calls).toEqual(["use1", "use2"]);
    const text = await response.text();
    expect(text).toBe("use middleware executed");
  });

  it.skip("SF (point 3) executes middlewares according to precedence (static before dynamic)", async () => {
    const staticMiddleware: Middleware = async (ctx, next) => {
      calls.push("static");
      await next();
    };
    const dynamicMiddleware: Middleware = async (ctx, next) => {
      calls.push("dynamic");
      await next();
    };

    // Register in reverse order to test precedence
    app.use("/files/:id", dynamicMiddleware);
    app.use("/files/static", staticMiddleware);

    testServer = app.listen({ port: 0 });
    const port = (testServer as any).port || 0;

    // Test static path - should match static, not dynamic
    const staticResponse = await fetch(
      `http://localhost:${port}/files/static`,
      { method: "GET" },
    );
    expect(staticResponse.status).toBe(200);
    expect(calls).toEqual(["static"]);
    calls.length = 0;

    // Test dynamic path - should match dynamic
    const dynamicResponse = await fetch(`http://localhost:${port}/files/123`, {
      method: "GET",
    });
    expect(dynamicResponse.status).toBe(200);
    expect(calls).toEqual(["dynamic"]);
  });

  it.skip("OK extracts route parameters and makes them available in context", async () => {
    const handler: Middleware = async (ctx, next) => {
      ctx.body = { params: ctx.params };
      await next();
    };

    app.get("/users/:id", handler);

    testServer = app.listen({ port: 0 });
    const port = (testServer as any).port || 0;

    const response = await fetch(`http://localhost:${port}/users/123`, {
      method: "GET",
    });
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({ params: { id: "123" } });
  });

  it.skip("OK extracts multiple route parameters", async () => {
    let capturedParams: Record<string, string> = {};
    const handler: Middleware = async (ctx, next) => {
      capturedParams = ctx.params;
      ctx.body = ctx.params;
      await next();
    };

    app.get("/users/:userId/posts/:postId", handler);

    testServer = app.listen({ port: 0 });
    const port = (testServer as any).port || 0;

    const response = await fetch(
      `http://localhost:${port}/users/123/posts/456`,
      { method: "GET" },
    );
    expect(response.status).toBe(200);
    expect(capturedParams).toEqual({ userId: "123", postId: "456" });
    const json = await response.json();
    expect(json).toEqual({ userId: "123", postId: "456" });
  });

  it.skip("SF method-specific route parameters override prefix route parameters", async () => {
    let capturedParams: Record<string, string> = {};
    const useHandler: Middleware = async (ctx, next) => {
      await next();
    };
    const getHandler: Middleware = async (ctx, next) => {
      capturedParams = ctx.params;
      ctx.body = ctx.params;
      await next();
    };

    app.use("/users/:id", useHandler);
    app.get("/users/:userId", getHandler);

    testServer = app.listen({ port: 0 });
    const port = (testServer as any).port || 0;

    const response = await fetch(`http://localhost:${port}/users/123`, {
      method: "GET",
    });
    expect(response.status).toBe(200);
    // Method-specific params should override prefix params
    expect(capturedParams).toEqual({ userId: "123" });
  });

  it.skip("OK provides base URL properties in context", async () => {
    let capturedContext: any = {};
    const handler: Middleware = async (ctx, next) => {
      capturedContext = {
        origin: ctx.origin,
        host: ctx.host,
        hostname: ctx.hostname,
        protocol: ctx.protocol,
      };
      ctx.body = capturedContext;
      await next();
    };

    app.get("/test", handler);

    testServer = app.listen({ port: 0 });
    const port = (testServer as any).port || 0;

    const response = await fetch(`http://localhost:${port}/test`, {
      method: "GET",
    });
    expect(response.status).toBe(200);
    expect(capturedContext.origin).toBe(`http://localhost:${port}`);
    expect(capturedContext.host).toBe(`localhost:${port}`);
    expect(capturedContext.hostname).toBe("localhost");
    expect(capturedContext.protocol).toBe("http:");
  });

  it.skip("SF handles errors in middleware and stores them in context", async () => {
    const errorHandler: Middleware = async (ctx, next) => {
      await next();
      if (ctx.error) {
        ctx.status = 500;
        ctx.body = { error: ctx.error.message };
      }
    };
    const failingMiddleware: Middleware = async (ctx, next) => {
      throw new Error("Something went wrong");
    };

    app.use("/error", errorHandler);
    app.get("/error", failingMiddleware);

    testServer = app.listen({ port: 0 });
    const port = (testServer as any).port || 0;

    const response = await fetch(`http://localhost:${port}/error`, {
      method: "GET",
    });
    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json).toEqual({ error: "Something went wrong" });
  });

  it.skip("SF handles Error objects in response body", async () => {
    const handler: Middleware = async (ctx, next) => {
      ctx.body = new Error("Test error");
      ctx.status = 500;
      await next();
    };

    app.get("/error-body", handler);

    testServer = app.listen({ port: 0 });
    const port = (testServer as any).port || 0;

    const response = await fetch(`http://localhost:${port}/error-body`, {
      method: "GET",
    });
    expect(response.status).toBe(500);
    const json = (await response.json()) as { error: string; stack?: string };
    expect(json).toHaveProperty("error");
    expect(json.error).toBe("Test error");
    expect(json).toHaveProperty("stack");
  });

  it.skip("SF allows setting custom headers in context", async () => {
    const handler: Middleware = async (ctx, next) => {
      ctx.headers["X-Custom-Header"] = "custom-value";
      ctx.headers["X-Another-Header"] = "another-value";
      ctx.body = "test";
      await next();
    };

    app.get("/headers", handler);

    testServer = app.listen({ port: 0 });
    const port = (testServer as any).port || 0;

    const response = await fetch(`http://localhost:${port}/headers`, {
      method: "GET",
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Custom-Header")).toBe("custom-value");
    expect(response.headers.get("X-Another-Header")).toBe("another-value");
    expect(response.headers.get("Content-Type")).toBe("text/plain");
  });
});
