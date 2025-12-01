import type { BaseMiddleware, Next } from "./types";
import { Context } from "./context";

/**
 * Middleware composer that executes middlewares in onion-like fashion.
 * Errors propagate normally and can be caught by middleware using try-catch.
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
      Array.isArray(mw) ? mw : [mw]
    );
  }

  /**
   * Executes all middlewares in order, wrapping the context.
   * Errors propagate normally and can be caught by middleware using try-catch.
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
      await middleware!(ctx, next);

      // check that downstream middleware awaits next()
      if (nextCalled && !nextResolved) {
        throw new Error(
          "Middleware resolved before downstream. You are probably missing an await or return."
        );
      }
    };

    await dispatch(0);
  }
}
