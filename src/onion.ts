import type { Handler, Next } from "./types";

export class Onion {
  middlewares: Handler[];
  constructor(middlewares: Handler[]) {
    this.middlewares = middlewares;
  }

  async run(): Promise<void> {
    // tracks the most recently dispatched middleware
    let lastIndex = -1;

    const dispatch = async (index: number): Promise<void> => {
      /**
       * Prevent against double next() within the same middleware.
       * If middleware i calls next(), it executes dispatch(i + 1).
       * When i+1 is passed, it is checked against lastIndex, which
       * is currently i, so this check passes and lastIndex becomes i+1.
       * At a second, however, next() calls dispatch(i + 1) again, but
       * now lastIndex is already i + 1, so the check fails.
       */
      if (index <= lastIndex) {
        throw new Error("next() called multiple times");
      }

      lastIndex = index;

      // return to upstream if ran out of middlewares to execute
      if (index >= this.middlewares.length || index < 0) {
        return;
      }

      const middleware = this.middlewares[index];

      const next: Next = () => dispatch(index + 1);

      await middleware!(next);
    };
    await dispatch(0);
  }
}
