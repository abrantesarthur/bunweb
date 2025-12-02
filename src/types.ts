import type { Context } from "./context";

/**
 * Extracts route parameter names from a path string.
 * Example: if P represents, "/users/:id/posts/:postId", then ExtractParams<P> represents { id: string; postId: string }
 */
export type ExtractParams<P extends string> =
  P extends `${infer _Prefix}:${infer Param}/${infer Rest}`
    ? Param extends `${infer Name}`
      ? { [K in Name]: string } & ExtractParams<`/${Rest}`>
      : ExtractParams<`/${Rest}`>
    : P extends `${infer _Prefix}:${infer Param}`
      ? Param extends `${infer Name}`
        ? { [K in Name]: string }
        : Record<string, string>
      : Record<string, string>;

/**
 * Context with typed route parameters.
 */
export type TypedContext<
  Params extends Record<string, string> = Record<string, string>,
> = Omit<Context, "params"> & {
  params: Params;
};

/**
 * A function that calls the next middleware in the chain.
 * Must be awaited to ensure proper middleware execution order.
 */
export type Next = () => Promise<void>;

/**
 * Base middleware type that accepts any Context.
 * Used internally for storage and execution.
 */
export type BaseMiddleware = (ctx: Context, next: Next) => Promise<void>;

/**
 * Middleware function that processes requests and responses with typed route parameters.
 * Typed middleware is compatible with base middleware (structural typing).
 * @param ctx - The context object containing request and response data with typed params
 * @param next - Function to call the next middleware in the chain
 * @returns Promise that resolves when middleware processing is complete
 */
export type Middleware<
  Params extends Record<string, string> = Record<string, string>,
> = (ctx: TypedContext<Params>, next: Next) => Promise<void>;

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
 * @param path - Route path (supports dynamic segments like :id)
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

/**
 * Handler function for registering middleware with the `use` method.
 * Supports both path-specific and global middleware registration.
 * @overload
 * @param path - Route path pattern (uses prefix matching)
 * @param middlewares - One or more middleware functions (can be arrays)
 * @overload
 * @param middlewares - One or more middleware functions (can be arrays) for global middleware
 *
 * @example
 * ```typescript
 * // Path-specific middleware
 * app.use("/api", async (ctx, next) => { await next(); });
 *
 * // Global middleware
 * app.use(async (ctx, next) => { await next(); });
 * ```
 */
export type UseHandler = {
  <
    Path extends string,
    Params extends Record<string, string> = ExtractParams<Path>,
  >(
    path: Path,
    ...middlewares: (Middleware<Params> | Middleware<Params>[])[]
  ): void;
  (
    ...middlewares: (
      | Middleware<Record<string, string>>
      | Middleware<Record<string, string>>[]
    )[]
  ): void;
};

export interface Request {
  [Method.Get]: RequestHandler;
  [Method.Post]: RequestHandler;
  [Method.Put]: RequestHandler;
  [Method.Use]: UseHandler;
}

export interface RouteDefinition {
  path: string;
  middlewares: Middleware[];
}

export enum HttpErrorMessage {
  InternalServerError = "Internal Server Error",
  Forbidden = "Forbidden",
  NotFound = "Not Found",
  NotAllowed = "Not Allowed",
  BadRequest = "Bad Request",
}
