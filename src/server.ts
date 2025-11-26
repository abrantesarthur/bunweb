import {
  Method,
  type Middleware,
  type Request,
  type RequestHandler,
} from "./types";

// get the singleton instance
export const server = () => Bunweb.getInstance();

class Bunweb implements Request {
  private static instance: Bunweb;

  private constructor() {} // forbid new Bunweb()

  static getInstance(): Bunweb {
    if (!Bunweb.instance) {
      Bunweb.instance = new Bunweb();
    }
    return Bunweb.instance;
  }

  get: RequestHandler = (path, ...handlers) =>
    this.delegate(path, Method.Get, ...handlers);
  post: RequestHandler = (path, ...handlers) =>
    this.delegate(path, Method.Post, ...handlers);
  put: RequestHandler = (path, ...handlers) =>
    this.delegate(path, Method.Put, ...handlers);

  private delegate = <M extends Middleware = Middleware>(
    path: string,
    method: Method,
    ...handlers: (M | M[])[]
  ) => {};
}
