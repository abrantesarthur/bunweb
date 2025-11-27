export type Next = () => Promise<void>;
export type Middleware = (
  ctx: Context,
  next: Next,
) => Promise<void> | (() => Promise<void>);

export class Context {
  request: globalThis.Request;
  method: string;
  path: string;
  status: number = 200;
  body: unknown = null;

  constructor(request: globalThis.Request) {
    this.request = request;
    this.method = request.method.toLowerCase();
    const url = new URL(request.url);
    this.path = url.pathname;
  }

  toResponse(): globalThis.Response {
    // Handle different body types
    let responseBody: string | null = null;
    const headers: Record<string, string> = {};

    if (this.body !== null && this.body !== undefined) {
      if (typeof this.body === "string") {
        responseBody = this.body;
        headers["Content-Type"] = "text/plain";
      } else if (this.body instanceof Response) {
        return this.body;
      } else {
        // JSON object
        responseBody = JSON.stringify(this.body);
        headers["Content-Type"] = "application/json";
      }
    }

    return new globalThis.Response(responseBody, {
      status: this.status,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    });
  }
}

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
