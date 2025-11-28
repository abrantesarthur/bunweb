import { describe, expect, it } from "bun:test";
import { Onion } from "../src/onion";
import { type Middleware } from "../src/types";
import { Context } from "../src/context";

describe("Onion.run", () => {
  it("awaits middlewares in onion order when each awaits next", async () => {
    const calls: string[] = [];
    const m1: Middleware = async (ctx, next) => {
      calls.push("m1 before");
      await next?.();
      calls.push("m1 after");
    };
    const m2: Middleware = async (ctx, next) => {
      calls.push("m2 before");
      await next?.();
      calls.push("m2 after");
    };
    const m3: Middleware = async (ctx, next) => {
      calls.push("m3");
    };
    const onion = new Onion([m1, m2, m3]);
    const ctx = new Context(new Request("http://localhost/test"));

    await onion.run(ctx);

    expect(calls).toEqual([
      "m1 before",
      "m2 before",
      "m3",
      "m2 after",
      "m1 after",
    ]);
  });

  it("stops the chain when a middleware does not call next", async () => {
    const calls: string[] = [];
    const m1: Middleware = async () => {
      calls.push("stop");
    };
    const m2: Middleware = async () => {
      calls.push("skipped");
    };
    const onion = new Onion([m1, m2]);
    const ctx = new Context(new Request("http://localhost/test"));

    await onion.run(ctx);

    expect(calls).toEqual(["stop"]);
  });

  it("throws when a middleware calls next more than once", async () => {
    const onion = new Onion([
      async (ctx, next) => {
        await next();
        await next();
      },
      async () => {},
    ]);
    const ctx = new Context(new Request("http://localhost/test"));

    await expect(onion.run(ctx)).rejects.toThrow(
      "next() called multiple times",
    );
  });

  it("throws when next is not awaited", async () => {
    const onion = new Onion([
      async (ctx, next) => {
        next();
      },
      async () => {},
    ]);
    const ctx = new Context(new Request("http://localhost/test"));

    expect(onion.run(ctx)).rejects.toThrow(
      "Middleware resolved before downstream. You are probably missing an await or return.",
    );
  });

  it("lets upstream await downstream completion", async () => {
    const calls: string[] = [];
    const onion = new Onion([
      async (ctx, next) => {
        calls.push("layer1 start");
        await next();
        calls.push("layer1 end");
      },
      async (ctx, next) => {
        calls.push("layer2 start");
        await next();
        calls.push("layer2 after-next");
      },
      async () => {
        calls.push("layer3 start");
        await Bun.sleep(5);
        calls.push("layer3 end");
      },
    ]);
    const ctx = new Context(new Request("http://localhost/test"));

    await onion.run(ctx);

    expect(calls).toEqual([
      "layer1 start",
      "layer2 start",
      "layer3 start",
      "layer3 end",
      "layer2 after-next",
      "layer1 end",
    ]);
  });

  it("stores errors in context instead of throwing", async () => {
    const calls: string[] = [];
    const onion = new Onion([
      async (ctx, next) => {
        calls.push("before error");
        await next();
        calls.push("after error");
        if (ctx.error) {
          calls.push(`error handled: ${ctx.error.message}`);
        }
      },
      async (ctx, next) => {
        calls.push("throwing middleware");
        throw new Error("Runtime error");
      },
      async () => {
        calls.push("this should not run");
      },
    ]);
    const ctx = new Context(new Request("http://localhost/test"));

    await onion.run(ctx);

    expect(calls).toEqual([
      "before error",
      "throwing middleware",
      "after error",
      "error handled: Runtime error",
    ]);
    expect(ctx.error).toBeDefined();
    expect(ctx.error?.message).toBe("Runtime error");
  });

  it("allows downstream middleware to handle errors", async () => {
    const calls: string[] = [];
    const onion = new Onion([
      async (ctx, next) => {
        calls.push("handler 1 start");
        await next();
        if (ctx.error) {
          calls.push("handler 1 caught error");
          ctx.error = undefined; // Clear error
        }
        calls.push("handler 1 end");
      },
      async (ctx, next) => {
        calls.push("handler 2 start");
        await next();
        calls.push("handler 2 end");
      },
      async () => {
        calls.push("error source");
        throw new Error("Error occurred");
      },
    ]);
    const ctx = new Context(new Request("http://localhost/test"));

    await onion.run(ctx);

    expect(calls).toEqual([
      "handler 1 start",
      "handler 2 start",
      "error source",
      "handler 2 end",
      "handler 1 caught error",
      "handler 1 end",
    ]);
    // Error should be cleared by handler 1
    expect(ctx.error).toBeUndefined();
  });

  it("accepts arrays of middlewares and flattens them", async () => {
    const calls: string[] = [];
    const m1: Middleware = async (ctx, next) => {
      calls.push("m1");
      await next();
    };
    const m2: Middleware = async (ctx, next) => {
      calls.push("m2");
      await next();
    };
    const m3: Middleware = async (ctx, next) => {
      calls.push("m3");
      await next();
    };
    const m4: Middleware = async (ctx, next) => {
      calls.push("m4");
      await next();
    };

    // Pass middlewares as arrays and individual functions
    const onion = new Onion([m1, [m2, m3], m4]);
    const ctx = new Context(new Request("http://localhost/test"));

    await onion.run(ctx);

    expect(calls).toEqual(["m1", "m2", "m3", "m4"]);
  });

  it("automatically sets status to 500 if error exists and status is still 200", async () => {
    const onion = new Onion([
      async () => {
        throw new Error("Something failed");
      },
    ]);
    const ctx = new Context(new Request("http://localhost/test"));

    await onion.run(ctx);

    expect(ctx.error).toBeDefined();
    expect(ctx.error?.message).toBe("Something failed");
    expect(ctx.status).toBe(500);
  });

  it("does not override status if middleware already set it", async () => {
    const onion = new Onion([
      async (ctx, next) => {
        await next();
        if (ctx.error) {
          ctx.status = 400; // Middleware handles error as client error
        }
      },
      async () => {
        throw new Error("Validation failed");
      },
    ]);
    const ctx = new Context(new Request("http://localhost/test"));

    await onion.run(ctx);

    expect(ctx.error).toBeDefined();
    expect(ctx.status).toBe(400); // Should keep middleware-set status, not change to 500
  });
});
