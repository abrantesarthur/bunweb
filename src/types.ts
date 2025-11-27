export type Next = () => Promise<void>;
export type Middleware = (next: Next) => Promise<void> | (() => Promise<void>);

export enum Method {
  Get = "get",
  Post = "post",
  Put = "put",
  Use = "use",
}

export type RequestHandler = <M extends Middleware = Middleware>(
  path: string,
  ...middlewares: (M | M[])[]
) => void;

export interface Request {
  [Method.Get]: RequestHandler;
  [Method.Post]: RequestHandler;
  [Method.Put]: RequestHandler;
  [Method.Use]: RequestHandler;
}

export interface RouteDefinition {
  path: string;
  middlewares: Middleware[];
}
