import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { server } from "../src/server";
import { RouteMatcher } from "../src/routeMatcher";
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
  });

  it("stores the route on the matching method with flattened middlewares", () => {
    const h1: Middleware = async (ctx, next) => {};
    const h2: Middleware = async (ctx, next) => {};
    const h3: Middleware = async (ctx, next) => {};

    bunweb.registerRoute("/flatten", Method.Get, h1, [h2, h3]);

    expect(bunweb.routeMatchersByMethod[Method.Get].match("/flatten")).toEqual([
      h1,
      h2,
      h3,
    ]);
    expect(
      bunweb.routeMatchersByMethod[Method.Post].match("/flatten"),
    ).toBeEmpty();
    expect(
      bunweb.routeMatchersByMethod[Method.Put].match("/flatten"),
    ).toBeEmpty();
  });

  it("throws when a middleware array contains a non-function entry", () => {
    const handler: Middleware = async (ctx, next) => {};

    expect(() =>
      bunweb.registerRoute("/bad", Method.Post, [handler, "oops" as unknown]),
    ).toThrow('The path "/bad" contains a non-functional "post" handler.');

    expect(bunweb.routeMatchersByMethod[Method.Post].match("/bad")).toBeEmpty();
  });

  it("throws when non-function middleware arguments are provided outside arrays", () => {
    const handler: Middleware = async (ctx, next) => {};

    expect(() =>
      bunweb.registerRoute("/skip", Method.Put, handler, null),
    ).toThrow('The path "/skip" contains a non-functional "put" handler.');

    expect(bunweb.routeMatchersByMethod[Method.Put].match("/skip")).toBeEmpty();
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
  });

  it("executes use middlewares before method-specific middlewares for GET, POST, PUT", async () => {
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

    app.use("/test", use1, use2);
    app.get("/test", get1);
    app.post("/test", post1);
    app.put("/test", put1);

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

  it("executes nested use middlewares for all prefix paths, then method-specific middleware", async () => {
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

  it("executes middlewares according to registration order", async () => {
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

  it("runs use middlewares even when no method-specific middleware is registered", async () => {
    const use1: Middleware = async (ctx, next) => {
      calls.push("use1");
      ctx.body = "use middleware executed";
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

  it("executes middlewares according to precedence (static before dynamic before wildcards)", async () => {
    const staticMiddleware: Middleware = async (ctx, next) => {
      calls.push("static");
      await next();
    };
    const dynamicMiddleware: Middleware = async (ctx, next) => {
      calls.push("dynamic");
      await next();
    };
    const wildcardMiddleware: Middleware = async (ctx, next) => {
      calls.push("wildcard");
      await next();
    };

    // Register in reverse order to test precedence
    app.use("/files/*", wildcardMiddleware);
    app.use("/files/:id", dynamicMiddleware);
    app.use("/files/static", staticMiddleware);

    testServer = app.listen({ port: 0 });
    const port = (testServer as any).port || 0;

    // Test static path - should match static, not dynamic or wildcard
    const staticResponse = await fetch(
      `http://localhost:${port}/files/static`,
      { method: "GET" },
    );
    expect(staticResponse.status).toBe(200);
    expect(calls).toEqual(["static"]);
    calls.length = 0;

    // Test dynamic path - should match dynamic, not wildcard
    const dynamicResponse = await fetch(`http://localhost:${port}/files/123`, {
      method: "GET",
    });
    expect(dynamicResponse.status).toBe(200);
    expect(calls).toEqual(["dynamic"]);
    calls.length = 0;

    // Test wildcard path - should match wildcard
    const wildcardResponse = await fetch(
      `http://localhost:${port}/files/123/nested`,
      { method: "GET" },
    );
    expect(wildcardResponse.status).toBe(200);
    expect(calls).toEqual(["wildcard"]);
  });
});
