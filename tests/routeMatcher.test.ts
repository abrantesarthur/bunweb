import { afterEach, beforeAll, describe, expect, it } from "bun:test";
import {
  RouteMatcher,
  RouteMatcherMode,
  type MatchResult,
} from "../src/routeMatcher";
import type { Middleware } from "../src/types";

describe("RouteMatcher", () => {
  describe("insert() and match()", () => {
    describe("aggregates static and dynamic route matches", () => {
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

      it("one segment - aggregates both matches in registration order", () => {
        matcher.insert("/users", [staticHandler]);
        matcher.insert("/:id", [dynamicHandler]);

        // Matching "/users" should return both handlers in registration order
        expect(matcher.match("/users")).toEqual({
          middlewares: [staticHandler, dynamicHandler],
          params: { id: "users" },
        });
        // Matching "/123" only matches dynamic route
        expect(matcher.match("/123")).toEqual({
          middlewares: [dynamicHandler],
          params: { id: "123" },
        });
      });
      it("two segments - aggregates both matches in registration order", () => {
        matcher.insert("/users/profile", [staticHandler]);
        matcher.insert("/users/:id", [dynamicHandler]);

        // Matching "/users/profile" should return both handlers in registration order
        expect(matcher.match("/users/profile")).toEqual({
          middlewares: [staticHandler, dynamicHandler],
          params: { id: "profile" },
        });
        // Matching "/users/123" only matches dynamic route
        expect(matcher.match("/users/123")).toEqual({
          middlewares: [dynamicHandler],
          params: { id: "123" },
        });
      });
      it("three segment - aggregates both matches in registration order", () => {
        matcher.insert("/users/profile/name", [staticHandler]);
        matcher.insert("/users/:id/name", [dynamicHandler]);

        // Matching "/users/profile/name" should return both handlers in registration order
        expect(matcher.match("/users/profile/name")).toEqual({
          middlewares: [staticHandler, dynamicHandler],
          params: { id: "profile" },
        });
        // Matching "/users/123/name" only matches dynamic route
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

    it("aggregates both static and dynamic route matches in registration order", () => {
      const matcher = new RouteMatcher();
      const m1: Middleware = async (ctx, next) => {};
      const m2: Middleware = async (ctx, next) => {};

      // Register dynamic route first, then static route
      matcher.insert("/:dynamic", [m1]);
      matcher.insert("/static", [m2]);

      // Matching "/static" should return both m1 and m2 in registration order
      expect(matcher.match("/static")).toEqual({
        middlewares: [m1, m2],
        params: { dynamic: "static" },
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

  describe("insert() - invalid character validation", () => {
    it('throws "Unexpected MODIFIER at X" for hash character (#)', () => {
      const matcher = new RouteMatcher();
      const handler: Middleware = async (ctx, next) => {};

      expect(() => matcher.insert("/users#123", [handler])).toThrow(
        "Unexpected MODIFIER at 6",
      );
    });

    it('throws "Unexpected MODIFIER at X" for question mark (?)', () => {
      const matcher = new RouteMatcher();
      const handler: Middleware = async (ctx, next) => {};

      expect(() => matcher.insert("/search?q=test", [handler])).toThrow(
        "Unexpected MODIFIER at 7",
      );
    });

    it('throws "Unexpected MODIFIER at X" for ampersand (&)', () => {
      const matcher = new RouteMatcher();
      const handler: Middleware = async (ctx, next) => {};

      expect(() => matcher.insert("/users&admins", [handler])).toThrow(
        "Unexpected MODIFIER at 6",
      );
    });

    it('throws "Unexpected MODIFIER at X" for percent sign (%)', () => {
      const matcher = new RouteMatcher();
      const handler: Middleware = async (ctx, next) => {};

      expect(() => matcher.insert("/files%20name", [handler])).toThrow(
        "Unexpected MODIFIER at 6",
      );
    });

    it('throws "Unexpected MODIFIER at X" for at sign (@)', () => {
      const matcher = new RouteMatcher();
      const handler: Middleware = async (ctx, next) => {};

      expect(() => matcher.insert("/user@domain", [handler])).toThrow(
        "Unexpected MODIFIER at 5",
      );
    });

    it('throws "Unexpected MODIFIER at X" for exclamation mark (!)', () => {
      const matcher = new RouteMatcher();
      const handler: Middleware = async (ctx, next) => {};

      expect(() => matcher.insert("/important!", [handler])).toThrow(
        "Unexpected MODIFIER at 10",
      );
    });

    it('throws "Unexpected MODIFIER at X" for space character', () => {
      const matcher = new RouteMatcher();
      const handler: Middleware = async (ctx, next) => {};

      expect(() => matcher.insert("/my path", [handler])).toThrow(
        "Unexpected MODIFIER at 3",
      );
    });

    it('throws "Unexpected MODIFIER at X" for square brackets ([)', () => {
      const matcher = new RouteMatcher();
      const handler: Middleware = async (ctx, next) => {};

      expect(() => matcher.insert("/users[123]", [handler])).toThrow(
        "Unexpected MODIFIER at 6",
      );
    });

    it('throws "Unexpected MODIFIER at X" for square brackets (])', () => {
      const matcher = new RouteMatcher();
      const handler: Middleware = async (ctx, next) => {};

      expect(() => matcher.insert("/users]123", [handler])).toThrow(
        "Unexpected MODIFIER at 6",
      );
    });

    it('throws "Unexpected MODIFIER at X" for curly braces ({)', () => {
      const matcher = new RouteMatcher();
      const handler: Middleware = async (ctx, next) => {};

      expect(() => matcher.insert("/users{123}", [handler])).toThrow(
        "Unexpected MODIFIER at 6",
      );
    });

    it('throws "Unexpected MODIFIER at X" for curly braces (})', () => {
      const matcher = new RouteMatcher();
      const handler: Middleware = async (ctx, next) => {};

      expect(() => matcher.insert("/users}123", [handler])).toThrow(
        "Unexpected MODIFIER at 6",
      );
    });

    it('throws "Unexpected MODIFIER at X" for parentheses (()', () => {
      const matcher = new RouteMatcher();
      const handler: Middleware = async (ctx, next) => {};

      expect(() => matcher.insert("/users(123)", [handler])).toThrow(
        "Unexpected MODIFIER at 6",
      );
    });

    it('throws "Unexpected MODIFIER at X" for parentheses ())', () => {
      const matcher = new RouteMatcher();
      const handler: Middleware = async (ctx, next) => {};

      expect(() => matcher.insert("/users)123", [handler])).toThrow(
        "Unexpected MODIFIER at 6",
      );
    });

    it('throws "Unexpected MODIFIER at X" for plus sign (+)', () => {
      const matcher = new RouteMatcher();
      const handler: Middleware = async (ctx, next) => {};

      expect(() => matcher.insert("/users+admins", [handler])).toThrow(
        "Unexpected MODIFIER at 6",
      );
    });

    it('throws "Unexpected MODIFIER at X" for equals sign (=)', () => {
      const matcher = new RouteMatcher();
      const handler: Middleware = async (ctx, next) => {};

      expect(() => matcher.insert("/users=123", [handler])).toThrow(
        "Unexpected MODIFIER at 6",
      );
    });

    it('throws "Unexpected MODIFIER at X" for pipe character (|)', () => {
      const matcher = new RouteMatcher();
      const handler: Middleware = async (ctx, next) => {};

      expect(() => matcher.insert("/users|admins", [handler])).toThrow(
        "Unexpected MODIFIER at 6",
      );
    });

    it('throws "Unexpected MODIFIER at X" for tilde (~)', () => {
      const matcher = new RouteMatcher();
      const handler: Middleware = async (ctx, next) => {};

      expect(() => matcher.insert("/users~123", [handler])).toThrow(
        "Unexpected MODIFIER at 6",
      );
    });

    it('throws "Unexpected MODIFIER at X" for backtick (`)', () => {
      const matcher = new RouteMatcher();
      const handler: Middleware = async (ctx, next) => {};

      expect(() => matcher.insert("/users`123", [handler])).toThrow(
        "Unexpected MODIFIER at 6",
      );
    });

    it('throws "Unexpected MODIFIER at X" for dollar sign ($)', () => {
      const matcher = new RouteMatcher();
      const handler: Middleware = async (ctx, next) => {};

      expect(() => matcher.insert("/users$123", [handler])).toThrow(
        "Unexpected MODIFIER at 6",
      );
    });

    it('throws "Unexpected MODIFIER at X" for caret (^)', () => {
      const matcher = new RouteMatcher();
      const handler: Middleware = async (ctx, next) => {};

      expect(() => matcher.insert("/users^123", [handler])).toThrow(
        "Unexpected MODIFIER at 6",
      );
    });

    it('throws "Unexpected MODIFIER at X" for comma (,)', () => {
      const matcher = new RouteMatcher();
      const handler: Middleware = async (ctx, next) => {};

      expect(() => matcher.insert("/users,123", [handler])).toThrow(
        "Unexpected MODIFIER at 6",
      );
    });

    it('throws "Unexpected MODIFIER at X" for semicolon (;)', () => {
      const matcher = new RouteMatcher();
      const handler: Middleware = async (ctx, next) => {};

      expect(() => matcher.insert("/users;123", [handler])).toThrow(
        "Unexpected MODIFIER at 6",
      );
    });

    it('throws "Unexpected MODIFIER at X" at correct index for invalid character at start of path', () => {
      const matcher = new RouteMatcher();
      const handler: Middleware = async (ctx, next) => {};

      expect(() => matcher.insert("#invalid", [handler])).toThrow(
        "Unexpected MODIFIER at 0",
      );
    });

    it('throws "Unexpected MODIFIER at X" at correct index for invalid character in middle of path', () => {
      const matcher = new RouteMatcher();
      const handler: Middleware = async (ctx, next) => {};

      expect(() => matcher.insert("/api/users#admin", [handler])).toThrow(
        "Unexpected MODIFIER at 10",
      );
    });

    it('throws "Unexpected MODIFIER at X" at correct index for invalid character at end of path', () => {
      const matcher = new RouteMatcher();
      const handler: Middleware = async (ctx, next) => {};

      expect(() => matcher.insert("/users/", [handler])).not.toThrow();
      expect(() => matcher.insert("/users#", [handler])).toThrow(
        "Unexpected MODIFIER at 6",
      );
    });

    it("allows valid characters: letters, numbers, slashes, dots, underscores, colons, hyphens", () => {
      const matcher = new RouteMatcher();
      const handler: Middleware = async (ctx, next) => {};

      expect(() => matcher.insert("/users", [handler])).not.toThrow();
      expect(() => matcher.insert("/users/123", [handler])).not.toThrow();
      expect(() => matcher.insert("/users/:id", [handler])).not.toThrow();
      expect(() => matcher.insert("/users.profile", [handler])).not.toThrow();
      expect(() => matcher.insert("/users_profile", [handler])).not.toThrow();
      expect(() => matcher.insert("/users-admin", [handler])).not.toThrow();
      expect(() =>
        matcher.insert("/api/v1/users/:id", [handler]),
      ).not.toThrow();
    });
  });

  describe("match() - invalid character validation", () => {
    const matcher = new RouteMatcher();
    const handler: Middleware = async (ctx, next) => {};

    beforeAll(() => {
      matcher.insert("/users", [handler]);
    });

    it('throws "Unexpected MODIFIER at X" for hash character (#)', () => {
      expect(() => matcher.match("/users#123")).toThrow(
        "Unexpected MODIFIER at 6",
      );
    });

    it('throws "Unexpected MODIFIER at X" for question mark (?)', () => {
      expect(() => matcher.match("/users?name=arthur")).toThrow(
        "Unexpected MODIFIER at 6",
      );
    });

    it('throws "Unexpected MODIFIER at X" for ampersand (&)', () => {
      expect(() => matcher.match("/users&admins")).toThrow(
        "Unexpected MODIFIER at 6",
      );
    });

    it('throws "Unexpected MODIFIER at X" for percent sign (%)', () => {
      expect(() => matcher.match("/files%20name")).toThrow(
        "Unexpected MODIFIER at 6",
      );
    });

    it('throws "Unexpected MODIFIER at X" for at sign (@)', () => {
      expect(() => matcher.match("/user@domain")).toThrow(
        "Unexpected MODIFIER at 5",
      );
    });

    it('throws "Unexpected MODIFIER at X" for exclamation mark (!)', () => {
      expect(() => matcher.match("/important!")).toThrow(
        "Unexpected MODIFIER at 10",
      );
    });

    it('throws "Unexpected MODIFIER at X" for space character', () => {
      expect(() => matcher.match("/my path")).toThrow(
        "Unexpected MODIFIER at 3",
      );
    });

    it('throws "Unexpected MODIFIER at X" for square brackets ([)', () => {
      expect(() => matcher.match("/users[123]")).toThrow(
        "Unexpected MODIFIER at 6",
      );
    });

    it('throws "Unexpected MODIFIER at X" for square brackets (])', () => {
      expect(() => matcher.match("/users]123")).toThrow(
        "Unexpected MODIFIER at 6",
      );
    });

    it('throws "Unexpected MODIFIER at X" for curly braces ({)', () => {
      expect(() => matcher.match("/users{123}")).toThrow(
        "Unexpected MODIFIER at 6",
      );
    });

    it('throws "Unexpected MODIFIER at X" for curly braces (})', () => {
      expect(() => matcher.match("/users}123")).toThrow(
        "Unexpected MODIFIER at 6",
      );
    });

    it('throws "Unexpected MODIFIER at X" for parentheses (()', () => {
      expect(() => matcher.match("/users(123)")).toThrow(
        "Unexpected MODIFIER at 6",
      );
    });

    it('throws "Unexpected MODIFIER at X" for parentheses ())', () => {
      expect(() => matcher.match("/users)123")).toThrow(
        "Unexpected MODIFIER at 6",
      );
    });

    it('throws "Unexpected MODIFIER at X" for plus sign (+)', () => {
      expect(() => matcher.match("/users+admins")).toThrow(
        "Unexpected MODIFIER at 6",
      );
    });

    it('throws "Unexpected MODIFIER at X" for equals sign (=)', () => {
      expect(() => matcher.match("/users=123")).toThrow(
        "Unexpected MODIFIER at 6",
      );
    });

    it('throws "Unexpected MODIFIER at X" for pipe character (|)', () => {
      expect(() => matcher.match("/users|admins")).toThrow(
        "Unexpected MODIFIER at 6",
      );
    });

    it('throws "Unexpected MODIFIER at X" for tilde (~)', () => {
      expect(() => matcher.match("/users~123")).toThrow(
        "Unexpected MODIFIER at 6",
      );
    });

    it('throws "Unexpected MODIFIER at X" for backtick (`)', () => {
      expect(() => matcher.match("/users`123")).toThrow(
        "Unexpected MODIFIER at 6",
      );
    });

    it('throws "Unexpected MODIFIER at X" for dollar sign ($)', () => {
      expect(() => matcher.match("/users$123")).toThrow(
        "Unexpected MODIFIER at 6",
      );
    });

    it('throws "Unexpected MODIFIER at X" for caret (^)', () => {
      expect(() => matcher.match("/users^123")).toThrow(
        "Unexpected MODIFIER at 6",
      );
    });

    it('throws "Unexpected MODIFIER at X" for comma (,)', () => {
      expect(() => matcher.match("/users,123")).toThrow(
        "Unexpected MODIFIER at 6",
      );
    });

    it('throws "Unexpected MODIFIER at X" for semicolon (;)', () => {
      expect(() => matcher.match("/users;123")).toThrow(
        "Unexpected MODIFIER at 6",
      );
    });

    it('throws "Unexpected MODIFIER at X" for wildcard (*)', () => {
      expect(() => matcher.match("/users/*")).toThrow(
        "Unexpected MODIFIER at 7",
      );
    });

    it('throws "Unexpected MODIFIER at X" at correct index for invalid character at start of path', () => {
      expect(() => matcher.match("#invalid")).toThrow(
        "Unexpected MODIFIER at 0",
      );
    });

    it('throws "Unexpected MODIFIER at X" at correct index for invalid character in middle of path', () => {
      expect(() => matcher.match("/api/users#admin")).toThrow(
        "Unexpected MODIFIER at 10",
      );
    });

    it('throws "Unexpected MODIFIER at X" at correct index for invalid character at end of path', () => {
      expect(() => matcher.match("/users#")).toThrow(
        "Unexpected MODIFIER at 6",
      );
    });

    it("allows valid characters: letters, numbers, slashes, dots, underscores, colons, hyphens", () => {
      expect(() => matcher.match("/users")).not.toThrow();
      expect(() => matcher.match("/users/123")).not.toThrow();
      expect(() => matcher.match("/users/:id")).not.toThrow();
      expect(() => matcher.match("/users.profile")).not.toThrow();
      expect(() => matcher.match("/users_profile")).not.toThrow();
      expect(() => matcher.match("/users-admin")).not.toThrow();
      expect(() => matcher.match("/api/v1/users/:id")).not.toThrow();
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

  it("aggregates both static and dynamic route matches in prefix mode", () => {
    const m1: Middleware = async (ctx, next) => {};
    const m2: Middleware = async (ctx, next) => {};

    // Register dynamic route first, then static route
    matcher.insert("/:dynamic", [m1]);
    matcher.insert("/static", [m2]);

    // Matching "/static" should return both m1 and m2 in registration order
    expect(matcher.match("/static")).toEqual({
      middlewares: [m1, m2],
      params: { dynamic: "static" },
    });
  });
});
