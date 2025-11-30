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
  /** Tracks whether status was explicitly set */
  private _explicitStatus: boolean = false;
  /** Internal status storage */
  private _status: number;
  /** HTTP response status code */
  get status(): number {
    return this._status;
  }
  set status(value: number) {
    if (typeof value !== "number" || value < 100 || value > 999) {
      throw new Error(
        `Status code must be a number between 100 and 999, got: ${value}`,
      );
    }
    this._explicitStatus = true;
    this._status = value;
  }
  /** Internal body storage */
  private _body: unknown = null;
  /** Response body to be sent */
  get body(): unknown {
    return this._body;
  }
  set body(value: unknown) {
    if (!this._explicitStatus) {
      if (value === null) {
        this._status = 204;
      } else {
        this._status = 200;
      }
    }
    this._body = value;
  }
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
    this._status = 404;
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
