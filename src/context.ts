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
  /**
   * Creates a new Context instance from an HTTP request.
   * @param request - The HTTP request object
   */
  constructor(request: globalThis.Request) {
    const { method, url } = request;
    const urlObj = new URL(url);
    const { pathname, origin, host, hostname, protocol } = urlObj;
    this.request = request;
    this.method = method.toLowerCase();
    this.path = pathname;
    this.origin = origin;
    this.host = host;
    this.hostname = hostname;
    this.protocol = protocol;
    this._status = 404;
    this.setSearchParams(urlObj);
  }

  /**
   * Mapping from HTTP status code to status text.
   * Based on the mappings from helpers.ts.
   */
  private static readonly STATUS_CODE_TO_TEXT: Record<number, string> = {
    400: "Bad Request",
    401: "Unauthorized",
    402: "Payment Required",
    403: "Forbidden",
    404: "Not Found",
    405: "Method Not Allowed",
    406: "Not Acceptable",
    407: "Proxy Authentication Required",
    408: "Request Timeout",
    409: "Conflict",
    410: "Gone",
    411: "Length Required",
    412: "Precondition Failed",
    413: "Payload Too Large",
    414: "URI Too Long",
    415: "Unsupported Media Type",
    416: "Range Not Satisfiable",
    417: "Expectation Failed",
    418: "I'm A Teapot",
    421: "Misdirected Request",
    422: "Unprocessable Entity",
    423: "Locked",
    424: "Failed Dependency",
    425: "Too Early",
    426: "Upgrade Required",
    428: "Precondition Required",
    429: "Too Many Requests",
    431: "Request Header Fields Too Large",
    451: "Unavailable For Legal Reasons",
    500: "Internal Server Error",
    501: "Not Implemented",
    502: "Bad Gateway",
    503: "Service Unavailable",
    504: "Gateway Timeout",
    505: "HTTP Version Not Supported",
    506: "Variant Also Negotiates",
    507: "Insufficient Storage",
    508: "Loop Detected",
    509: "Bandwidth Limit Exceeded",
    510: "Not Extended",
    511: "Network Authentication Required",
  };

  /**
   * Gets the status text for a given status code.
   * Returns undefined if no mapping exists.
   */
  private static getStatusText(statusCode: number): string | undefined {
    return Context.STATUS_CODE_TO_TEXT[statusCode];
  }

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
        `Status code must be a number between 100 and 999, got: ${value}`
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
  /** Request origin (protocol + host, e.g., "http://localhost:3000") */
  origin: string;
  /** Request host with port (e.g., "localhost:3000") */
  host: string;
  /** Request hostname without port (e.g., "localhost") */
  hostname: string;
  /** Request protocol (e.g., "http:" or "https:") */
  protocol: string;
  /** Internal storage for response headers */
  private _responseHeaders: Record<string, string> = {};
  /** Internal storage for search parameters */
  private _searchParams: Map<string, string> = new Map();
  /** Request headers (read-only) */
  get headers(): Record<string, string> {
    const headers: Record<string, string> = {};
    this.request.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return headers;
  }

  /**
   * Sets a response header.
   * @param header - Header name
   * @param value - Header value
   */
  set(header: string, value: string): void {
    this._responseHeaders[header] = value;
  }

  /**
   * Extracts search parameters from the URL and stores them in _searchParams.
   * @param url - The URL object containing search parameters
   */
  private setSearchParams(url: URL): void {
    this._searchParams.clear();
    url.searchParams.forEach((value, key) => {
      this._searchParams.set(key, value);
    });
  }

  /**
   * Gets the search parameters from the URL query string.
   * @returns Map of search parameter key-value pairs
   */
  get searchParams(): Map<string, string> {
    return this._searchParams;
  }

  /**
   * Converts the context to an HTTP Response object.
   * Handles different body types (string, JSON objects, Response, Error).
   * @returns HTTP Response object ready to be sent
   */
  toResponse(): globalThis.Response {
    let responseBody: string | null = null;
    const headers: Record<string, string> = { ...this._responseHeaders };

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

    const statusText = Context.getStatusText(this.status);
    return new globalThis.Response(responseBody, {
      status: this.status,
      ...(statusText && { statusText }),
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    });
  }
}
