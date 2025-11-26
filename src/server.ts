import {
  Method,
  type Middleware,
  type Request,
  type RequestHandler,
} from "./types";

interface RouteLayer {
  method: Method;
  path: string;
  stack: Middleware[];
}

// get the singleton instance
export const server = () => Bunweb.getInstance();

class Bunweb implements Request {
  private static instance: Bunweb;
  private routes: RouteLayer[] = [];

  private constructor() {} // forbid new Bunweb()

  static getInstance(): Bunweb {
    if (!Bunweb.instance) {
      Bunweb.instance = new Bunweb();
    }
    return Bunweb.instance;
  }

  get: RequestHandler = (path, ...handlers) =>
    this.registerRoute(path, Method.Get, ...handlers);
  post: RequestHandler = (path, ...handlers) =>
    this.registerRoute(path, Method.Post, ...handlers);
  put: RequestHandler = (path, ...handlers) =>
    this.registerRoute(path, Method.Put, ...handlers);

  private registerRoute = <M extends Middleware = Middleware>(
    path: string,
    method: Method,
    ...handlers: (M | M[])[]
  ) => {
    const stack = handlers.reduce<Middleware[]>((acc, handler) => {
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

      if (typeof handler === "function") {
        acc.push(handler);
      }

      return acc;
    }, []);

    this.routes.push({
      method,
      path,
      stack,
    });
  };
}
