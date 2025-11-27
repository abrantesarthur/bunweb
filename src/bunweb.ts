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
