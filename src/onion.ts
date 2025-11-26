import type { Handler, Next } from "./types";

export class Onion {
  middlewares: Handler[];
  constructor(middlewares: Handler[]) {
    this.middlewares = middlewares;
  }

  async run(): Promise<void> {
    // lastIndex is REMOVED

    const dispatch = async (index: number): Promise<void> => {
      // The lastIndex logic is REMOVED from here

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
        // *** 1. New Duplicate next() Check (Replaces lastIndex) ***
        if (nextCalled) {
          throw new Error("next() called multiple times");
        }

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
        throw err;
      }

      // 2. Await Check remains the same
      if (nextCalled && !nextResolved) {
        throw new Error(
          "Middleware resolved before downstream. You are probably missing an await or return.",
        );
      }
    };

    await dispatch(0);
  }
}
