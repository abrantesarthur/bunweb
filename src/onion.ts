import type { Handler, Next } from "./types";

export class Onion {
  middlewares: Handler[];
  constructor(middlewares: Handler[]) {
    this.middlewares = middlewares;
  }

  async run(): Promise<void> {
    let lastIndex = -1;
    const dispatch = async (index: number): Promise<void> => {
      if (index <= lastIndex) {
        throw new Error("next() called multiple times");
      }

      lastIndex = index;

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
