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

describe("Context.searchParams", () => {
  it("should parse basic single parameter", () => {
    const ctx = new Context(new Request("http://localhost/test?name=value"));
    expect(ctx.searchParams.get("name")).toBe("value");
    expect(ctx.searchParams.size).toBe(1);
  });

  it("should parse multiple parameters", () => {
    const ctx = new Context(new Request("http://localhost/test?a=1&b=2&c=3"));
    expect(ctx.searchParams.get("a")).toBe("1");
    expect(ctx.searchParams.get("b")).toBe("2");
    expect(ctx.searchParams.get("c")).toBe("3");
    expect(ctx.searchParams.size).toBe(3);
  });

  it("should parse parameter with dot in key", () => {
    const ctx = new Context(
      new Request("http://localhost/users?hub.token=123"),
    );
    expect(ctx.searchParams.get("hub.token")).toBe("123");
    expect(ctx.searchParams.has("hub.token")).toBe(true);
    expect(ctx.searchParams.size).toBe(1);
  });

  it("should parse parameters with special characters in keys", () => {
    const ctx = new Context(
      new Request(
        "http://localhost/test?user-name=test&user_name=test2&api.key=secret",
      ),
    );
    expect(ctx.searchParams.get("user-name")).toBe("test");
    expect(ctx.searchParams.get("user_name")).toBe("test2");
    expect(ctx.searchParams.get("api.key")).toBe("secret");
    expect(ctx.searchParams.size).toBe(3);
  });

  it("should parse parameters with special characters in values", () => {
    const ctx = new Context(
      new Request("http://localhost/test?message=hello%20world&token=a.b-c_d"),
    );
    expect(ctx.searchParams.get("message")).toBe("hello world");
    expect(ctx.searchParams.get("token")).toBe("a.b-c_d");
    expect(ctx.searchParams.size).toBe(2);
  });

  it("should decode URL-encoded characters", () => {
    const ctx = new Context(
      new Request(
        "http://localhost/test?email=user%40example.com&query=hello%20world",
      ),
    );
    expect(ctx.searchParams.get("email")).toBe("user@example.com");
    expect(ctx.searchParams.get("query")).toBe("hello world");
    expect(ctx.searchParams.size).toBe(2);
  });

  it("should handle empty parameter values", () => {
    const ctx = new Context(
      new Request("http://localhost/test?empty=&key=value"),
    );
    expect(ctx.searchParams.get("empty")).toBe("");
    expect(ctx.searchParams.get("key")).toBe("value");
    expect(ctx.searchParams.has("empty")).toBe(true);
    expect(ctx.searchParams.size).toBe(2);
  });

  it("should return empty Map when no query parameters", () => {
    const ctx = new Context(new Request("http://localhost/test"));
    expect(ctx.searchParams.size).toBe(0);
    expect(ctx.searchParams.get("nonexistent")).toBeUndefined();
  });

  it("should handle duplicate keys with last value winning", () => {
    const ctx = new Context(
      new Request("http://localhost/test?key=first&key=second"),
    );
    expect(ctx.searchParams.get("key")).toBe("second");
    expect(ctx.searchParams.size).toBe(1);
  });

  it("should parse complex real-world example with multiple parameter types", () => {
    const ctx = new Context(
      new Request(
        "http://localhost/users?hub.token=abc123&user-id=456&email=test%40example.com&filter=active&page=1",
      ),
    );
    expect(ctx.searchParams.get("hub.token")).toBe("abc123");
    expect(ctx.searchParams.get("user-id")).toBe("456");
    expect(ctx.searchParams.get("email")).toBe("test@example.com");
    expect(ctx.searchParams.get("filter")).toBe("active");
    expect(ctx.searchParams.get("page")).toBe("1");
    expect(ctx.searchParams.size).toBe(5);
  });
});
