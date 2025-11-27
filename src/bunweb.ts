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
