import { describe, expect, it } from "bun:test";
import { Onion } from "../src/onion";
import type { Handler, Next } from "../src/types";

describe("Onion.run", () => {
  it("awaits middlewares in onion order when each awaits next", async () => {
    const calls: string[] = [];
    const m1: Handler = async (next) => {
      calls.push("m1 before");
      await next?.();
      calls.push("m1 after");
    };
    const m2: Handler = async (next) => {
      calls.push("m2 before");
      await next?.();
      calls.push("m2 after");
    };
    const m3: Handler = async (next) => {
      calls.push("m3");
    };
    const onion = new Onion([m1, m2, m3]);

    await onion.run();

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
    const m1: Handler = async () => {
      calls.push("stop");
    };
    const m2: Handler = async () => {
      calls.push("skipped");
    };
    const onion = new Onion([m1, m2]);

    await onion.run();

    expect(calls).toEqual(["stop"]);
  });

  it("runs downstream even when next is not awaited", async () => {
    const calls: string[] = [];
    const m1: Handler = async (next) => {
      calls.push("outer before");
      next();
      calls.push("outer after immediate");
    };
    const m2: Handler = async () => {
      calls.push("inner before");
      await Bun.sleep(5);
      calls.push("inner after");
    };
    const onion = new Onion([m1, m2]);

    await onion.run();
    expect(calls).toEqual([
      "outer before",
      "inner before",
      "outer after immediate",
    ]);

    await Bun.sleep(10);

    expect(calls).toEqual([
      "outer before",
      "inner before",
      "outer after immediate",
      "inner after",
    ]);
  });

  it("lets upstream await even when a downstream middleware returns early", async () => {
    const calls: string[] = [];
    const onion = new Onion([
      async (next) => {
        calls.push("layer1 start");
        await next();
        calls.push("layer1 end");
      },
      async (next) => {
        calls.push("layer2 start");
        next();
        calls.push("layer2 after-next");
      },
      async () => {
        calls.push("layer3 start");
        await Bun.sleep(5);
        calls.push("layer3 end");
      },
    ]);

    await onion.run();

    expect(calls).toEqual([
      "layer1 start",
      "layer2 start",
      "layer3 start",
      "layer2 after-next",
      "layer1 end",
    ]);

    await Bun.sleep(10);

    expect(calls).toEqual([
      "layer1 start",
      "layer2 start",
      "layer3 start",
      "layer2 after-next",
      "layer1 end",
      "layer3 end",
    ]);
  });
});
