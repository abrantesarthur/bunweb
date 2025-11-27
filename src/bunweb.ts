import {
  Method,
  type Middleware,
  type Request,
  type RequestHandler,
} from "./types";
import { RouteMatcher, RouteMatcherMode } from "./routeMatcher";

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

  get: RequestHandler = (path, ...middlewares) =>
    this.registerRoute(path, Method.Get, ...middlewares);
  post: RequestHandler = (path, ...middlewares) =>
    this.registerRoute(path, Method.Post, ...middlewares);
  put: RequestHandler = (path, ...middlewares) =>
    this.registerRoute(path, Method.Put, ...middlewares);
  use: RequestHandler = (path, ...middlewares) =>
    this.registerRoute(path, Method.Use, ...middlewares);

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
