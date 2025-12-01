import {
  Method,
  type BaseMiddleware,
  type Request,
  type RequestHandler,
} from "./types";
import { RouteMatcher, RouteMatcherMode } from "./routeMatcher";
import { Onion } from "./onion";
import { serve, type Server } from "bun";
import { Context } from "./context";

/**
 * Main Bunweb application class implementing a Koa-like web framework.
 * Uses singleton pattern - access via Bunweb.getInstance() or server().
 *
 * @example
 * ```typescript
 * import { server } from "bunweb";
 *
 * const app = server();
 * app.get("/users/:id", async (ctx, next) => {
 *   ctx.body = { userId: ctx.params.id };
 * });
 * app.listen({ port: 3000 });
 * ```
 */
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

  /**
   * Gets the singleton instance of Bunweb.
   * Creates a new instance if one doesn't exist.
   * @returns The Bunweb instance
   */
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

  /**
   * Registers a GET route handler.
   * @param path - Route path pattern
   * @param middlewares - One or more middleware functions
   */
  get: RequestHandler = (path, ...middlewares) =>
    this.registerRoute(
      path,
      Method.Get,
      ...(middlewares as unknown as (BaseMiddleware | BaseMiddleware[])[]),
    );

  /**
   * Registers a POST route handler.
   * @param path - Route path pattern
   * @param middlewares - One or more middleware functions
   */
  post: RequestHandler = (path, ...middlewares) =>
    this.registerRoute(
      path,
      Method.Post,
      ...(middlewares as unknown as (BaseMiddleware | BaseMiddleware[])[]),
    );

  /**
   * Registers a PUT route handler.
   * @param path - Route path pattern
   * @param middlewares - One or more middleware functions
   */
  put: RequestHandler = (path, ...middlewares) =>
    this.registerRoute(
      path,
      Method.Put,
      ...(middlewares as unknown as (BaseMiddleware | BaseMiddleware[])[]),
    );

  /**
   * Registers a middleware that matches all HTTP methods with prefix matching.
   * Use middlewares are executed before method-specific middlewares.
   * @param path - Route path pattern (uses prefix matching)
   * @param middlewares - One or more middleware functions
   */
  use: RequestHandler = (path, ...middlewares) =>
    this.registerRoute(
      path,
      Method.Use,
      ...(middlewares as unknown as (BaseMiddleware | BaseMiddleware[])[]),
    );

  /**
   * Starts the HTTP server and begins listening for requests.
   * @param options - Server options
   * @param options.port - Port number or string to listen on
   * @returns Bun Server instance
   *
   * @example
   * ```typescript
   * const server = app.listen({ port: 3000 });
   * ```
   */
  listen({
    port,
    hostname,
  }: {
    port: string | number;
    hostname?: string;
  }): Server<undefined> {
    return serve({
      port,
      hostname,
      fetch: async (request: globalThis.Request) => {
        try {
          // Extract method and path from request
          const method = request.method.toLowerCase();
          const url = new URL(request.url);
          const path = url.pathname;
          const ctx = new Context(request);

          // Map HTTP method to Method enum
          let methodEnum: Method;
          // FIXME: support more methods
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
              ctx.status = 405;
              return ctx.toResponse();
          }

          // 1. Get method-specific middlewares (exact match)
          const methodMatch =
            this.routeMatchersByMethod[methodEnum].match(path);
          const methodMiddlewares = methodMatch?.middlewares ?? [];
          if (methodMiddlewares.length === 0) {
            ctx.status = 404;
            return ctx.toResponse();
          }
          const methodParams = methodMatch?.params ?? {};

          // Gather middlewares and extract route parameters
          // 2. Get "use" middlewares (prefix match)
          const useMatch = this.routeMatchersByMethod[Method.Use].match(path);
          const useMiddlewares = useMatch?.middlewares ?? [];
          const useParams = useMatch?.params ?? {};

          // Merge method-specific params with prefix params, preserving prefix params when keys conflict
          ctx.params = methodMatch
            ? { ...methodParams, ...useParams }
            : useParams;

          // Compose middlewares using Onion
          const onion = new Onion([useMiddlewares, methodMiddlewares]);

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

  /**⁄
   * Internal method to register a route with the specified method.
   * @param path - Route path pattern
   * @param method - HTTP method
   * @param middlewares - One or more middleware functions
   * @throws Error if any middleware is not a function
   */
  private registerRoute = <M extends BaseMiddleware = BaseMiddleware>(
    path: string,
    method: Method,
    ...middlewares: (M | M[])[]
  ) => {
    const flatMiddlewares = middlewares.reduce<BaseMiddleware[]>(
      (acc, handler) => {
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
      },
      [],
    );

    this.routeMatchersByMethod[method].insert(path, flatMiddlewares);
  };
}

/**
 * FIXME:
 * 7. implement ctx.error(status, message) which:
 *      - create http error object; sets its status and message and throws it
 * 8. ctx.status should be 404 by default!
 * 9. Context.toResponse() should mimick koa's application.js/respond method
 *    Stringify the body instead of trying to transform errors
 * 10. ctx.headers is for reading IncomingHttpHeaders. To set response headers, use ctx.set(header, value)
 *    - ctx.headers should be implemented as a getter
 *    - test that should fail: allows setting custom headers in context
 */
