import {
  Context,
  Method,
  type Middleware,
  type Request,
  type RequestHandler,
} from "./types";
import { RouteMatcher, RouteMatcherMode } from "./routeMatcher";
import { Onion } from "./onion";
import { serve, type Server } from "bun";

export class Bunweb implements Request {
  private static instance: Bunweb;
  private routeMatchersByMethod: Record<Method, RouteMatcher>;

  private constructor() {
    this.routeMatchersByMethod = {
      [Method.Get]: new RouteMatcher(),
      [Method.Post]: new RouteMatcher(),
      [Method.Put]: new RouteMatcher(),
      [Method.Use]: new RouteMatcher(RouteMatcherMode.Prefix),
    };
  } // forbid new Bunweb()

  static getInstance(): Bunweb {
    if (!Bunweb.instance) {
      Bunweb.instance = new Bunweb();
    }
    return Bunweb.instance;
  }

  private clear(): void {
    for (const method of Object.values(Method)) {
      this.routeMatchersByMethod[method].clear();
    }
  }

  get: RequestHandler = (path, ...middlewares) =>
    this.registerRoute(path, Method.Get, ...middlewares);
  post: RequestHandler = (path, ...middlewares) =>
    this.registerRoute(path, Method.Post, ...middlewares);
  put: RequestHandler = (path, ...middlewares) =>
    this.registerRoute(path, Method.Put, ...middlewares);
  // FIXME: support use router!
  use: RequestHandler = (path, ...middlewares) =>
    this.registerRoute(path, Method.Use, ...middlewares);

  listen({ port }: { port: string | number }): Server<undefined> {
    return serve({
      port,
      fetch: async (request: globalThis.Request) => {
        try {
          // Extract method and path from request
          const method = request.method.toLowerCase();
          const url = new URL(request.url);
          const path = url.pathname;

          // Map HTTP method to Method enum
          let methodEnum: Method | null = null;
          switch (method) {
            case "get":
              methodEnum = Method.Get;
              break;
            case "post":
              methodEnum = Method.Post;
              break;
            case "put":
              methodEnum = Method.Put;
              break;
            default:
              // Unsupported method
              return new globalThis.Response("Method Not Allowed", {
                status: 405,
              });
          }

          // Gather middlewares
          // 1. Get "use" middlewares (prefix match)
          const useMiddlewares =
            this.routeMatchersByMethod[Method.Use].match(path) ?? [];

          // 2. Get method-specific middlewares (exact match)
          const methodMiddlewares = methodEnum
            ? this.routeMatchersByMethod[methodEnum].match(path) ?? []
            : [];

          // Combine: use middlewares first, then method-specific
          const allMiddlewares = [...useMiddlewares, ...methodMiddlewares];

          // If no middlewares matched, return 404
          if (allMiddlewares.length === 0) {
            return new globalThis.Response("Not Found", { status: 404 });
          }

          // Create context
          const ctx = new Context(request);

          // Compose middlewares using Onion
          const onion = new Onion(allMiddlewares);

          // Execute the middleware chain
          await onion.run(ctx);

          // Convert context to Response
          return ctx.toResponse();
        } catch (error) {
          // Error handling: return 500 if middleware throws
          console.error("Server error:", error);
          return new globalThis.Response("Internal Server Error", {
            status: 500,
          });
        }
      },
    });
  }

  private registerRoute = <M extends Middleware = Middleware>(
    path: string,
    method: Method,
    ...middlewares: (M | M[])[]
  ) => {
    const flatMiddlewares = middlewares.reduce<Middleware[]>((acc, handler) => {
      if (Array.isArray(handler)) {
        const fns = handler.filter((fn): fn is M => typeof fn === "function");
        if (fns.length !== handler.length) {
          throw new Error(
            `The path "${path}" contains a non-functional "${method}" handler.`,
          );
        }
        acc.push(...handler);
        return acc;
      }

      if (typeof handler !== "function") {
        throw new Error(
          `The path "${path}" contains a non-functional "${method}" handler.`,
        );
      }

      acc.push(handler);

      return acc;
    }, []);

    this.routeMatchersByMethod[method].insert(path, flatMiddlewares);
  };
}

/**
 * FIXMES
 * - Routing properties and differences between .use() and .get/post/put() to do!
 *    1. .use runs for all methods.
 *        ex
 *          .use(/path) runs for .get(/path), .post(/path), and .put(/path)
 *          .get(/path) runs only for .get(/path)
 *        data structure
 *          add a dedicated useMatcher: RouteMatcher on Bunweb that only stores prefix middlewares
 *          implement matchPrefixes and matchExact into RouteMatcher class.
 *          On registration:
 *            .use inserts into useMatcher;
 *            .get/.post/.put insert into their per-method matchers.
 *          On request, resolve:
 *          const prefixes = useMatcher.matchPrefixes(path);
 *          const exact = methodMatcher.matchExact(path); return [...prefixes, ...exact];
 *    2. .use runs a prefix match. .get/post/put runs for the exact one route match
 *        ex:
 *          .use(/path) runs for /path, /path/x, etc.
 *          .get/post/put(/path) runs for /path only.
 *        data strucutre
 *          Node has prefixMiddlewares from .use and exactMiddlewares from .get/put/post.
 *          During match, we accumulate all prefixMiddlewares as we walk down and only
 *          accummulate exactMiddlewares when the path is fully consumed.
 *    3. .use(/path) always runs before .get/post/put(/path)
 *        data structure
 *          as we acccummulate prefixes down the tree, always push all collected
 *          prefixMiddlewares first, then exactMiddlewares from the final node.
 *    4. Registration order
 *        data structure
 *          We append middlewares in both prefixMiddlewares and exactMiddlewares in
 *          registration order so duplicate .use or .get calls preserve sequencing.
 *    5. Matchin with no leaft
 *        the current matcher returns undefined if no exact leaf is found. With prefixes,
 *        we need to return the accumulated prefixMiddlewares even when there’s no exact
 *        match (e.g., .use("/api") + GET /api/missing should still run)
 *    6. Traversal and precedence
 *        keep the same path-choice rules (static before dynamic, tie by registration order)
 *        while accumulating prefixes along the chosen path. That way a prefix on /users/profile
 *        doesn’t get skipped by a dynamic branch at /users/:id.
 *
 */
