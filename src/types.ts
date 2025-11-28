/**
 * Extracts route parameter names from a path string.
 * Example: "/users/:id/posts/:postId" -> { id: string; postId: string }
 */
export type ExtractParams<P extends string> =
  P extends `${infer _Prefix}:${infer Param}/${infer Rest}`
    ? Param extends `${infer Name}`
      ? { [K in Name]: string } & ExtractParams<`/${Rest}`>
      : ExtractParams<`/${Rest}`>
    : P extends `${infer _Prefix}:${infer Param}`
    ? Param extends `${infer Name}`
      ? { [K in Name]: string }
      : {}
    : {};

/**
 * A function that calls the next middleware in the chain.
 * Must be awaited to ensure proper middleware execution order.
 */
export type Next = () => Promise<void>;

/**
 * Context with typed route parameters.
 */
export type TypedContext<
  Params extends Record<string, string> = Record<string, string>,
> = Omit<Context, "params"> & {
  params: Params;
};

/**
 * Base middleware type that accepts any Context.
 * Used internally for storage and execution.
 */
export type BaseMiddleware = (
  ctx: Context,
  next: Next,
) => Promise<void> | (() => Promise<void>);

/**
 * Middleware function that processes requests and responses with typed route parameters.
 * Typed middleware is compatible with base middleware (structural typing).
 * @param ctx - The context object containing request and response data with typed params
 * @param next - Function to call the next middleware in the chain
 * @returns Promise that resolves when middleware processing is complete
 */
export type Middleware<
  Params extends Record<string, string> = Record<string, string>,
> = (
  ctx: TypedContext<Params> & Context,
  next: Next,
) => Promise<void> | (() => Promise<void>);

/**
 * Context object that encapsulates the HTTP request and response.
 * Provides access to request information and methods to set response data.
 *
 * @example
 * ```typescript
 * app.get("/users/:id", async (ctx, next) => {
 *   const userId = ctx.params.id;
 *   ctx.body = { userId };
 *   ctx.status = 200;
 * });
 * ```
 */
export class Context {
  /** The original HTTP request object */
  request: globalThis.Request;
  /** HTTP method in lowercase (e.g., "get", "post") */
  method: string;
  /** Request path (e.g., "/users/123") */
  path: string;
  /** HTTP response status code (default: 200) */
  status: number = 200;
  /** Response body to be sent */
  body: unknown = null;
  /** Route parameters extracted from the path (e.g., { id: "123" } from "/users/:id") */
  params: Record<string, string> = {};
  /** Error object if an error occurred during middleware execution */
  error?: Error;
  /** Request origin (protocol + host, e.g., "http://localhost:3000") */
  origin: string;
  /** Request host with port (e.g., "localhost:3000") */
  host: string;
  /** Request hostname without port (e.g., "localhost") */
  hostname: string;
  /** Request protocol (e.g., "http:" or "https:") */
  protocol: string;
  /** Custom response headers */
  headers: Record<string, string> = {};

  /**
   * Creates a new Context instance from an HTTP request.
   * @param request - The HTTP request object
   */
  constructor(request: globalThis.Request) {
    this.request = request;
    this.method = request.method.toLowerCase();
    const url = new URL(request.url);
    this.path = url.pathname;
    this.origin = url.origin;
    this.host = url.host;
    this.hostname = url.hostname;
    this.protocol = url.protocol;
  }

  /**
   * Converts the context to an HTTP Response object.
   * Handles different body types (string, JSON objects, Response, Error).
   * @returns HTTP Response object ready to be sent
   */
  toResponse(): globalThis.Response {
    let responseBody: string | null = null;
    const headers: Record<string, string> = { ...this.headers };

    if (this.body !== null && this.body !== undefined) {
      if (typeof this.body === "string") {
        responseBody = this.body;
        if (!headers["Content-Type"]) {
          headers["Content-Type"] = "text/plain";
        }
      } else if (this.body instanceof Response) {
        return this.body;
      } else if (this.body instanceof Error) {
        // Handle Error objects
        responseBody = JSON.stringify({
          error: this.body.message,
          stack: this.body.stack,
        });
        if (!headers["Content-Type"]) {
          headers["Content-Type"] = "application/json";
        }
      } else {
        // JSON object
        responseBody = JSON.stringify(this.body);
        if (!headers["Content-Type"]) {
          headers["Content-Type"] = "application/json";
        }
      }
    }

    return new globalThis.Response(responseBody, {
      status: this.status,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    });
  }
}

/**
 * HTTP methods supported by Bunweb.
 */
export enum Method {
  Get = "get",
  Post = "post",
  Put = "put",
  Use = "use",
}

/**
 * Handler function for registering routes with middlewares.
 * Infers route parameters from the path string for type safety.
 * @param path - Route path (supports dynamic segments like :id and wildcards *)
 * @param middlewares - One or more middleware functions (can be arrays)
 *
 * @example
 * ```typescript
 * app.get("/users/:id", async (ctx, next) => {
 *   ctx.params.id; // TypeScript knows 'id' exists
 * });
 * ```
 */
export type RequestHandler = <
  Path extends string,
  Params extends Record<string, string> = ExtractParams<Path>,
>(
  path: Path,
  ...middlewares: (Middleware<Params> | Middleware<Params>[])[]
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
