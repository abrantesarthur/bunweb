import { afterEach, beforeAll, describe, expect, it } from "bun:test";
import { RouteMatcher } from "../src/routeMatcher";
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

      expect(matcher.match("/unknown")).toBeUndefined();
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
      expect(matcher.match("/users/1")).toBeUndefined();
      expect(matcher.match("/ping")).toBeUndefined();

      matcher.insert("/users/profile", [c]);
      expect(matcher.match("/users/profile")).toEqual([c]);
    });
  });
});
