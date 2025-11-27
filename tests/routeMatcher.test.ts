import { afterEach, beforeAll, describe, expect, it } from "bun:test";
import { RouteMatcher, RouteMatcherMode } from "../src/routeMatcher";
import type { Middleware } from "../src/types";

describe("RouteMatcher", () => {
  describe("insert() and match()", () => {
    describe("prioritizes static segments over dynamic ones", () => {
      const matcher = new RouteMatcher();
      let staticHandler: Middleware;
      let dynamicHandler: Middleware;

      beforeAll(() => {
        staticHandler = async () => {};
        dynamicHandler = async () => {};
      });

      afterEach(() => {
        matcher.clear();
      });

      it("one segment", () => {
        matcher.insert("/users", [staticHandler]);
        matcher.insert("/:id", [dynamicHandler]);

        expect(matcher.match("/users")).toEqual([staticHandler]);
        expect(matcher.match("/123")).toEqual([dynamicHandler]);
      });
      it("two segments", () => {
        matcher.insert("/users/profile", [staticHandler]);
        matcher.insert("/users/:id", [dynamicHandler]);

        expect(matcher.match("/users/profile")).toEqual([staticHandler]);
        expect(matcher.match("/users/123")).toEqual([dynamicHandler]);
      });
      it("three segment", () => {
        matcher.insert("/users/profile/name", [staticHandler]);
        matcher.insert("/users/:id/name", [dynamicHandler]);

        expect(matcher.match("/users/profile/name")).toEqual([staticHandler]);
        expect(matcher.match("/users/123/name")).toEqual([dynamicHandler]);
      });
    });

    it("appends duplicate static and dynamic route handlers in registration order", () => {
      const matcher = new RouteMatcher();
      const a: Middleware = async () => {};
      const b: Middleware = async () => {};
      const c: Middleware = async () => {};
      const d: Middleware = async () => {};

      matcher.insert("/ping", [a]);
      matcher.insert("/ping", [b]);
      matcher.insert("/users/:id", [c]);
      matcher.insert("/users/:id", [d]);

      expect(matcher.match("/ping")).toEqual([a, b]);
      expect(matcher.match("/users/1")).toEqual([c, d]);
    });

    it("prefers earlier registration when dynamic routes have equal specificity", () => {
      const matcher = new RouteMatcher();
      const first: Middleware = async () => {};
      const second: Middleware = async () => {};

      matcher.insert("/post/:id", [first]);
      matcher.insert("/post/:slug", [second]);

      expect(matcher.match("/post/abc")).toEqual([first, second]);
    });

    it("prefers earlier registration when dynamic routes have equal specificity", () => {
      const matcher = new RouteMatcher();
      const first: Middleware = async () => {};
      const second: Middleware = async () => {};

      matcher.insert("/post/id", [first]);
      matcher.insert("/post/id", [second]);

      expect(matcher.match("/post/id")).toEqual([first, second]);
    });

    it("prefers more specific dynamic routes (more static segments)", () => {
      const matcher = new RouteMatcher();
      const specific: Middleware = async () => {};
      const generic: Middleware = async () => {};

      matcher.insert("/users/:id/orders/:orderId", [specific]);
      matcher.insert("/users/:id/:extra", [generic]);

      expect(matcher.match("/users/5/orders/9")).toEqual([specific]);
      expect(matcher.match("/users/5/foo")).toEqual([generic]);
    });

    it("falls back to dynamic routes when a static branch has no leaf", () => {
      const matcher = new RouteMatcher();
      const dynamicHandler: Middleware = async () => {};
      const deepStatic: Middleware = async () => {};

      matcher.insert("/users/:id", [dynamicHandler]);
      matcher.insert("/users/profile/settings", [deepStatic]);

      expect(matcher.match("/users/profile")).toEqual([dynamicHandler]);
      expect(matcher.match("/users/profile/settings")).toEqual([deepStatic]);
    });

    it("throws for invalid path segments", () => {
      const matcher = new RouteMatcher();
      const handler: Middleware = async () => {};

      expect(() => matcher.insert("/users/bad*", [handler])).toThrow(
        'Invalid route segment: "bad*"',
      );
    });

    it("returns undefined when no routes match", () => {
      const matcher = new RouteMatcher();
      const handler: Middleware = async () => {};
      matcher.insert("/users/:id", [handler]);

      expect(matcher.match("/unknown")).toBeEmpty();
    });

    it("prefers dynamic routes over wildcard routes", () => {
      const matcher = new RouteMatcher();
      const dynamicHandler: Middleware = async () => {};
      const wildcardHandler: Middleware = async () => {};

      matcher.insert("/files/:name", [dynamicHandler]);
      matcher.insert("/files/*", [wildcardHandler]);

      expect(matcher.match("/files/readme")).toEqual([dynamicHandler]);
      expect(matcher.match("/files/readme/nested")).toEqual([wildcardHandler]);
    });

    it("falls back to wildcard routes when no static or dynamic match exists", () => {
      const matcher = new RouteMatcher();
      const staticHandler: Middleware = async () => {};
      const wildcardHandler: Middleware = async () => {};

      matcher.insert("/assets/app.js", [staticHandler]);
      matcher.insert("/assets/*", [wildcardHandler]);

      expect(matcher.match("/assets/app.js")).toEqual([staticHandler]);
      expect(matcher.match("/assets/missing.png")).toEqual([wildcardHandler]);
      expect(matcher.match("/assets/images/icon.png")).toEqual([
        wildcardHandler,
      ]);
    });

    it('throws when "*" is not the final segment', () => {
      const matcher = new RouteMatcher();
      const handler: Middleware = async () => {};

      expect(() => matcher.insert("/oops/*/tail", [handler])).toThrow(
        'Wildcard "*" must be the last segment in a route path.',
      );
    });
  });

  describe("clear()", () => {
    it("clears all registered routes", () => {
      const matcher = new RouteMatcher();
      const a: Middleware = async () => {};
      const b: Middleware = async () => {};
      const c: Middleware = async () => {};

      matcher.insert("/users/:id", [a]);
      matcher.insert("/ping", [b]);
      expect(matcher.match("/users/1")).toEqual([a]);
      expect(matcher.match("/ping")).toEqual([b]);

      matcher.clear();
      expect(matcher.match("/users/1")).toBeEmpty();
      expect(matcher.match("/ping")).toBeEmpty();

      matcher.insert("/users/profile", [c]);
      expect(matcher.match("/users/profile")).toEqual([c]);
    });
  });
});

describe("RouteMatcher (prefix mode)", () => {
  const matcher = new RouteMatcher(RouteMatcherMode.Prefix);

  afterEach(() => {
    matcher.clear();
  });

  it("accumulates prefix middlewares along the matched path", () => {
    const api: Middleware = async () => {};
    const users: Middleware = async () => {};
    const users2: Middleware = async () => {};
    const user: Middleware = async () => {};

    matcher.insert("/api", [api]);
    matcher.insert("/api/users", [users]);
    matcher.insert("/api/users", [users2]);
    matcher.insert("/api/users/:id", [user]);

    expect(matcher.match("/api")).toEqual([api]);
    expect(matcher.match("/api/users")).toEqual([api, users, users2]);
    expect(matcher.match("/api/users/123")).toEqual([api, users, users2, user]);
  });

  it("returns empty when no prefix matches", () => {
    const handler: Middleware = async () => {};

    matcher.insert("/api", [handler]);

    expect(matcher.match("/other")).toBeEmpty();
  });
});
