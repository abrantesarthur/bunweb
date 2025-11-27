import { beforeEach, describe, expect, it } from "bun:test";
import { server } from "../src/server";
import { RouteMatcher } from "../src/routeMatcher";
import { Method, type Middleware } from "../src/types";

// bypass private property type checks
type BunwebInternal = {
  registerRoute: (
    path: string,
    method: Method,
    ...middlewares: (Middleware | Middleware[] | unknown)[]
  ) => void;
  routesByMethod: Record<Method, RouteMatcher>;
};

describe("Bunweb.registerRoute", () => {
  const bunweb = server() as unknown as BunwebInternal;

  beforeEach(() => {
    for (const method of [Method.Get, Method.Post, Method.Put]) {
      bunweb.routesByMethod[method] = new RouteMatcher();
    }
  });

  it("stores the route on the matching method with flattened middlewares", () => {
    const h1: Middleware = async () => {};
    const h2: Middleware = async () => {};
    const h3: Middleware = async () => {};

    bunweb.registerRoute("/flatten", Method.Get, h1, [h2, h3]);

    expect(bunweb.routesByMethod[Method.Get].match("/flatten")).toEqual([
      h1,
      h2,
      h3,
    ]);
    expect(bunweb.routesByMethod[Method.Post].match("/flatten")).toBeUndefined();
    expect(bunweb.routesByMethod[Method.Put].match("/flatten")).toBeUndefined();
  });

  it("throws when a middleware array contains a non-function entry", () => {
    const handler: Middleware = async () => {};

    expect(() =>
      bunweb.registerRoute("/bad", Method.Post, [handler, "oops" as unknown]),
    ).toThrow('The path "/bad" contains a non-functional "post" handler.');

    expect(bunweb.routesByMethod[Method.Post].match("/bad")).toBeUndefined();
  });

  it("throws when non-function middleware arguments are provided outside arrays", () => {
    const handler: Middleware = async () => {};

    expect(() =>
      bunweb.registerRoute("/skip", Method.Put, handler, null),
    ).toThrow('The path "/skip" contains a non-functional "put" handler.');

    expect(bunweb.routesByMethod[Method.Put].match("/skip")).toBeUndefined();
  });
});
