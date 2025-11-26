import type { Handler, Next } from "./types";

export class Onion {
  middlewares: Handler[];
  constructor(middlewares: Handler[]) {
    this.middlewares = middlewares;
  }

  async run(): Promise<void> {
    // Tracks the highest index successfully entered by dispatch.
    // Used to check for duplicate/circular next() calls.
    let lastIndex = -1;

    const dispatch = async (index: number): Promise<void> => {
      // 1. Duplicate next() Check (Your previous addition)
      if (index <= lastIndex) {
        throw new Error("next() called multiple times");
      }
      lastIndex = index;

      // Return if we ran out of middlewares
      if (index >= this.middlewares.length || index < 0) {
        return;
      }

      const middleware = this.middlewares[index];

      // State trackers to ensure middleware awaits call to next
      let nextCalled = false;
      let nextResolved = false;

      // Define the next() function for the current middleware
      const next: Next = async () => {
        // mark the next middlware as called
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
        await middleware!(next);
      } catch (err) {
        // FIXME: support error handling (e.g., context and logging)
        throw err;
      }

      // If next() was called, but the promise inside next() didn't resolve (i.e., was not awaited),
      // then nextResolved will be false, and we throw.
      if (nextCalled && !nextResolved) {
        throw new Error(
          "Middleware resolved before downstream. You are probably missing an await or return.",
        );
      }
    };

    await dispatch(0);
  }
}
