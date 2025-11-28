import type { Context, BaseMiddleware, Next } from "./types";

/**
 * Middleware composer that executes middlewares in onion-like fashion.
 * Errors are stored in ctx.error and the chain continues, allowing
 * downstream middleware to handle errors.
 */
export class Onion {
  /** Array of middleware functions to execute */
  middlewares: BaseMiddleware[];

  /**
   * Creates a new Onion instance with the given middlewares.
   * Accepts middlewares as individual functions or arrays of functions.
   * @param middlewares - Middleware functions or arrays of middleware functions
   */
  constructor(middlewares: (BaseMiddleware | BaseMiddleware[])[]) {
    // Flatten nested arrays and filter out non-functions
    this.middlewares = middlewares.flatMap((mw) =>
      Array.isArray(mw) ? mw : [mw],
    );
  }

  /**
   * Executes all middlewares in order, wrapping the context.
   * Errors are caught and stored in ctx.error instead of being rethrown immediately.
   * If an error exists and status is still 200 after all middleware executes,
   * the status is automatically set to 500 (unhandled server error).
   * @param ctx - Context object passed through the middleware chain
   */
  async run(ctx: Context): Promise<void> {
    const dispatch = async (index: number): Promise<void> => {
      // Return if we ran out of middlewares
      if (index >= this.middlewares.length || index < 0) {
        return;
      }

      const middleware = this.middlewares[index];

      // State trackers to ensure middleware does not double calls and awaits next()
      let nextCalled = false;
      let nextResolved = false;

      // Define the next() function for the current middleware
      const next: Next = async () => {
        if (nextCalled) {
          throw new Error("next() called multiple times");
        }

        nextCalled = true;

        try {
          // Call the next middleware in the chain
          return await dispatch(index + 1);
        } finally {
          // mark as resolved ONLY after the downstream execution returns
          nextResolved = true;
        }
      };

      // Execute the current middleware
      try {
        await middleware!(ctx, next);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        // Programming errors should still throw (these indicate bugs)
        const isProgrammingError =
          error.message === "next() called multiple times" ||
          error.message.includes("Middleware resolved before downstream");
        if (isProgrammingError) {
          throw error;
        }
        // Koa-style error handling: store runtime errors in context
        // This allows downstream middleware to handle the error.
        // If multiple middlewares throw erros, only the first one is stored.
        if (!ctx.error) {
          ctx.error = error;
        }
      }

      // check that downstream middleware awaits next()
      if (nextCalled && !nextResolved) {
        throw new Error(
          "Middleware resolved before downstream. You are probably missing an await or return.",
        );
      }
    };

    await dispatch(0);

    // If an error exists and status is still 200, set it to 500 (unhandled server error)
    // This ensures errors always have error status codes
    // Middleware can override by setting their own status (e.g., 400 for client errors)
    if (ctx.error && ctx.status === 200) {
      ctx.status = 500;
    }
  }
}
