import { afterEach, beforeAll, describe, expect, it } from "bun:test";
import {
  RouteMatcher,
  RouteMatcherMode,
  type MatchResult,
} from "../src/routeMatcher";
import type { Middleware } from "../src/types";

describe("RouteMatcher", () => {
  describe("insert() and match()", () => {
    describe("prioritizes static segments over dynamic ones", () => {
      const matcher = new RouteMatcher();
      let staticHandler: Middleware;
      let dynamicHandler: Middleware;

      beforeAll(() => {
        staticHandler = async (ctx, next) => {};
        dynamicHandler = async (ctx, next) => {};
      });

      afterEach(() => {
        matcher.clear();
      });

      it("one segment", () => {
        matcher.insert("/users", [staticHandler]);
        matcher.insert("/:id", [dynamicHandler]);

        expect(matcher.match("/users")).toEqual({
          middlewares: [staticHandler],
          params: {},
        });
        expect(matcher.match("/123")).toEqual({
          middlewares: [dynamicHandler],
          params: { id: "123" },
        });
      });
      it("two segments", () => {
        matcher.insert("/users/profile", [staticHandler]);
        matcher.insert("/users/:id", [dynamicHandler]);

        expect(matcher.match("/users/profile")).toEqual({
          middlewares: [staticHandler],
          params: {},
        });
        expect(matcher.match("/users/123")).toEqual({
          middlewares: [dynamicHandler],
          params: { id: "123" },
        });
      });
      it("three segment", () => {
        matcher.insert("/users/profile/name", [staticHandler]);
        matcher.insert("/users/:id/name", [dynamicHandler]);

        expect(matcher.match("/users/profile/name")).toEqual({
          middlewares: [staticHandler],
          params: {},
        });
        expect(matcher.match("/users/123/name")).toEqual({
          middlewares: [dynamicHandler],
          params: { id: "123" },
        });
      });
    });

    it("appends duplicate static and dynamic route handlers in registration order", () => {
      const matcher = new RouteMatcher();
      const a: Middleware = async (ctx, next) => {};
      const b: Middleware = async (ctx, next) => {};
      const c: Middleware = async (ctx, next) => {};
      const d: Middleware = async (ctx, next) => {};

      matcher.insert("/ping", [a]);
      matcher.insert("/ping", [b]);
      matcher.insert("/users/:id", [c]);
      matcher.insert("/users/:id", [d]);

      expect(matcher.match("/ping")).toEqual({
        middlewares: [a, b],
        params: {},
      });
      expect(matcher.match("/users/1")).toEqual({
        middlewares: [c, d],
        params: { id: "1" },
      });
    });

    it("prefers earlier registration when dynamic routes have equal specificity", () => {
      const matcher = new RouteMatcher();
      const first: Middleware = async (ctx, next) => {};
      const second: Middleware = async (ctx, next) => {};

      matcher.insert("/post/:id", [first]);
      matcher.insert("/post/:slug", [second]);

      expect(matcher.match("/post/abc")).toEqual({
        middlewares: [first, second],
        params: { id: "abc" },
      });
    });

    it("prefers earlier registration when dynamic routes have equal specificity (duplicate)", () => {
      const matcher = new RouteMatcher();
      const first: Middleware = async (ctx, next) => {};
      const second: Middleware = async (ctx, next) => {};

      matcher.insert("/post/id", [first]);
      matcher.insert("/post/id", [second]);

      expect(matcher.match("/post/id")).toEqual({
        middlewares: [first, second],
        params: {},
      });
    });

    it("prefers more specific dynamic routes (more static segments)", () => {
      const matcher = new RouteMatcher();
      const specific: Middleware = async (ctx, next) => {};
      const generic: Middleware = async (ctx, next) => {};

      matcher.insert("/users/:id/orders/:orderId", [specific]);
      matcher.insert("/users/:id/:extra", [generic]);

      expect(matcher.match("/users/5/orders/9")).toEqual({
        middlewares: [specific],
        params: { id: "5", orderId: "9" },
      });
      expect(matcher.match("/users/5/foo")).toEqual({
        middlewares: [generic],
        params: { id: "5", extra: "foo" },
      });
    });

    it("falls back to dynamic routes when a static branch has no leaf", () => {
      const matcher = new RouteMatcher();
      const dynamicHandler: Middleware = async (ctx, next) => {};
      const deepStatic: Middleware = async (ctx, next) => {};

      matcher.insert("/users/:id", [dynamicHandler]);
      matcher.insert("/users/profile/settings", [deepStatic]);

      expect(matcher.match("/users/profile")).toEqual({
        middlewares: [dynamicHandler],
        params: { id: "profile" },
      });
      expect(matcher.match("/users/profile/settings")).toEqual({
        middlewares: [deepStatic],
        params: {},
      });
    });

    it('throws "Unexpected MODIFIER at X" for invalid path segments containing "*"', () => {
      const matcher = new RouteMatcher();
      const handler: Middleware = async (ctx, next) => {};

      expect(() => matcher.insert("/users/bad*", [handler])).toThrow(
        "Unexpected MODIFIER at 10",
      );
    });

    it("returns undefined when no routes match", () => {
      const matcher = new RouteMatcher();
      const handler: Middleware = async (ctx, next) => {};
      matcher.insert("/users/:id", [handler]);

      expect(matcher.match("/unknown")).toBeUndefined();
    });

    it('throws "Unexpected MODIFIER at X" when path contains "*" at the beginning', () => {
      const matcher = new RouteMatcher();
      const handler: Middleware = async (ctx, next) => {};

      expect(() => matcher.insert("/*", [handler])).toThrow(
        "Unexpected MODIFIER at 1",
      );
    });

    it('throws "Unexpected MODIFIER at X" when path contains "*" in the middle', () => {
      const matcher = new RouteMatcher();
      const handler: Middleware = async (ctx, next) => {};

      expect(() => matcher.insert("/users/*", [handler])).toThrow(
        "Unexpected MODIFIER at 7",
      );
    });

    it('throws "Unexpected MODIFIER at X" when path contains "*" in a segment', () => {
      const matcher = new RouteMatcher();
      const handler: Middleware = async (ctx, next) => {};

      expect(() => matcher.insert("/files/*/nested", [handler])).toThrow(
        "Unexpected MODIFIER at 7",
      );
    });

    it('throws "Unexpected MODIFIER at X" when path contains "*" within a segment', () => {
      const matcher = new RouteMatcher();
      const handler: Middleware = async (ctx, next) => {};

      expect(() => matcher.insert("/test*path", [handler])).toThrow(
        "Unexpected MODIFIER at 5",
      );
    });

    it('throws "Unexpected MODIFIER at X" for first occurrence when path contains multiple "*"', () => {
      const matcher = new RouteMatcher();
      const handler: Middleware = async (ctx, next) => {};

      expect(() => matcher.insert("/test*path*more", [handler])).toThrow(
        "Unexpected MODIFIER at 5",
      );
    });
  });

  describe("clear()", () => {
    it("clears all registered routes", () => {
      const matcher = new RouteMatcher();
      const a: Middleware = async (ctx, next) => {};
      const b: Middleware = async (ctx, next) => {};
      const c: Middleware = async (ctx, next) => {};

      matcher.insert("/users/:id", [a]);
      matcher.insert("/ping", [b]);
      expect(matcher.match("/users/1")).toEqual({
        middlewares: [a],
        params: { id: "1" },
      });
      expect(matcher.match("/ping")).toEqual({
        middlewares: [b],
        params: {},
      });

      matcher.clear();
      expect(matcher.match("/users/1")).toBeUndefined();
      expect(matcher.match("/ping")).toBeUndefined();

      matcher.insert("/users/profile", [c]);
      expect(matcher.match("/users/profile")).toEqual({
        middlewares: [c],
        params: {},
      });
    });
  });
});

describe("RouteMatcher (prefix mode)", () => {
  const matcher = new RouteMatcher(RouteMatcherMode.Prefix);

  afterEach(() => {
    matcher.clear();
  });

  it("accumulates prefix middlewares along the matched path", () => {
    const api: Middleware = async (ctx, next) => {};
    const users: Middleware = async (ctx, next) => {};
    const users2: Middleware = async (ctx, next) => {};
    const user: Middleware = async (ctx, next) => {};

    matcher.insert("/api", [api]);
    matcher.insert("/api/users", [users]);
    matcher.insert("/api/users", [users2]);
    matcher.insert("/api/users/:id", [user]);

    expect(matcher.match("/api")).toEqual({
      middlewares: [api],
      params: {},
    });
    expect(matcher.match("/api/users")).toEqual({
      middlewares: [api, users, users2],
      params: {},
    });
    expect(matcher.match("/api/users/123")).toEqual({
      middlewares: [api, users, users2, user],
      params: { id: "123" },
    });
  });

  it("returns empty when no prefix matches", () => {
    const handler: Middleware = async (ctx, next) => {};

    matcher.insert("/api", [handler]);

    expect(matcher.match("/other")).toBeUndefined();
  });
});
