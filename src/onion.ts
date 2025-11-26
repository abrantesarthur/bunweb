import type { Handler, Next } from "./types";

export class Onion {
  middlewares: Handler[];
  constructor(middlewares: Handler[]) {
    this.middlewares = middlewares;
  }

  async run(): Promise<void> {
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
        await middleware!(next);
      } catch (err) {
        throw err;
      }

      // check that downstream middleware awaits next()
      if (nextCalled && !nextResolved) {
        throw new Error(
          "Middleware resolved before downstream. You are probably missing an await or return.",
        );
      }
    };

    await dispatch(0);
  }
}
