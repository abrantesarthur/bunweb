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
  /** HTTP response status code */
  status!: number;
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
    const { method, url } = request;
    const { pathname, origin, host, hostname, protocol } = new URL(url);
    this.request = request;
    this.method = method.toLowerCase();
    this.path = pathname;
    this.origin = origin;
    this.host = host;
    this.hostname = hostname;
    this.protocol = protocol;
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
