import { describe, expect, it } from "bun:test";
import { Context } from "../src/context";

describe("Context.status", () => {
  it("should throw error when setting status code less than 100", () => {
    const ctx = new Context(new Request("http://localhost/test"));
    expect(() => {
      ctx.status = 99;
    }).toThrow("Status code must be a number between 100 and 999, got: 99");
  });

  it("should throw error when setting status code greater than 999", () => {
    const ctx = new Context(new Request("http://localhost/test"));
    expect(() => {
      ctx.status = 1000;
    }).toThrow("Status code must be a number between 100 and 999, got: 1000");
  });

  it("should throw error when setting status code at boundary 99", () => {
    const ctx = new Context(new Request("http://localhost/test"));
    expect(() => {
      ctx.status = 99;
    }).toThrow("Status code must be a number between 100 and 999, got: 99");
  });

  it("should throw error when setting status code at boundary 1000", () => {
    const ctx = new Context(new Request("http://localhost/test"));
    expect(() => {
      ctx.status = 1000;
    }).toThrow("Status code must be a number between 100 and 999, got: 1000");
  });

  it("should accept valid status codes at lower boundary 100", () => {
    const ctx = new Context(new Request("http://localhost/test"));
    ctx.status = 100;
    expect(ctx.status).toBe(100);
  });

  it("should accept valid status codes at upper boundary 999", () => {
    const ctx = new Context(new Request("http://localhost/test"));
    ctx.status = 999;
    expect(ctx.status).toBe(999);
  });

  it("should accept valid status codes between 100 and 999", () => {
    const ctx = new Context(new Request("http://localhost/test"));
    ctx.status = 200;
    expect(ctx.status).toBe(200);
    ctx.status = 404;
    expect(ctx.status).toBe(404);
    ctx.status = 500;
    expect(ctx.status).toBe(500);
  });
});

