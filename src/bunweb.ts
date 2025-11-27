import {
  Method,
  type Middleware,
  type Request,
  type RequestHandler,
} from "./types";
import { RouteMatcher } from "./routeMatcher";

export class Bunweb implements Request {
  private static instance: Bunweb;
  private routesByMethod: Record<Method, RouteMatcher> = {
    [Method.Get]: new RouteMatcher(),
    [Method.Post]: new RouteMatcher(),
    [Method.Put]: new RouteMatcher(),
  };

  private constructor() {} // forbid new Bunweb()

  static getInstance(): Bunweb {
    if (!Bunweb.instance) {
      Bunweb.instance = new Bunweb();
    }
    return Bunweb.instance;
  }

  // FIXME: support use

  get: RequestHandler = (path, ...middlewares) =>
    this.registerRoute(path, Method.Get, ...middlewares);
  post: RequestHandler = (path, ...middlewares) =>
    this.registerRoute(path, Method.Post, ...middlewares);
  put: RequestHandler = (path, ...middlewares) =>
    this.registerRoute(path, Method.Put, ...middlewares);

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

    this.routesByMethod[method].insert(path, flatMiddlewares);
  };
}

/**
RULES
Dynamic routes with equal specificity fall back to registration order.
Example:
/post/:id (registered first)
/post/:slug (registered second)
Request: /post/abc → matches the first one registered.

Duplicate static routes append all middlewares (order preserved).
Example:
router.get("/ping", A);
router.get("/ping", B);
Request: /ping → executes A then B.

Duplicate dynamic routes also append all middlewares.
Example:
router.get("/users/:id", A);
router.get("/users/:id", B);
Request: /users/10 → executes A then B.

Wildcards only match if no static or dynamic route matches.
Example:
/assets/app.js
/assets/*
Request: /assets/app.js → matches static, not wildcard.
Request: /assets/missing.png → matches wildcard.

If multiple routes match the same request, all matching handlers run in registration order.
Example:
router.get("/users", A);
router.get("/users", B);

Request: /users → runs A, then B.

Parameter names do not affect matching; only pattern specificity and order matter.
Example:
/item/:id
/item/:slug
Both patterns are identical → whichever was registered first wins.



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
