import type { BaseMiddleware } from "./types";

const STATIC_SEGMENT = /^[a-zA-Z0-9._-]+$/;
const DYNAMIC_SEGMENT = /^:[a-zA-Z0-9_]+$/;
const DYNAMIC_KEY = ":";

class Node {
  children: Map<string, Node>;
  middlewares: BaseMiddleware[];
  isDynamic?: boolean;
  paramName?: string;

  constructor() {
    this.children = new Map();
    this.middlewares = [];
  }
}

export enum RouteMatcherMode {
  Exact = "exact",
  Prefix = "prefix",
}

/**
 * Result of a route match containing middlewares and extracted parameters.
 */
export interface MatchResult {
  middlewares: BaseMiddleware[];
  params: Record<string, string>;
}

/**
 * Route matcher that supports static and dynamic (:param) routes.
 * Can operate in exact or prefix matching mode.
 */
export class RouteMatcher {
  private root: Node;
  private mode: RouteMatcherMode;

  /**
   * Creates a new RouteMatcher instance.
   * @param mode - Matching mode: "exact" for exact matches, "prefix" for prefix matches
   */
  constructor(mode: RouteMatcherMode = RouteMatcherMode.Exact) {
    this.root = new Node();
    this.mode = mode;
  }

  /**
   * Inserts a route path with associated middlewares into the matcher.
   * @param path - Route path pattern (e.g., "/users/:id")
   * @param middlewares - Array of middleware functions to execute for this route
   * @throws Error if path contains invalid segments or wildcard characters
   */
  insert(path: string, middlewares: BaseMiddleware[]): void {
    // Check for wildcard character (*) in the path
    const wildcardIndex = path.indexOf("*");
    if (wildcardIndex !== -1) {
      throw new Error(`Unexpected wildcard MODIFIER at ${wildcardIndex}`);
    }

    const segments = this.splitPath(path);
    let current = this.root;

    // traverse the path and ensure each segment has a node
    for (let index = 0; index < segments.length; index++) {
      const segment = segments[index]!;
      const parsed = this.parseSegment(segment);

      let child = current.children.get(parsed.key);
      if (!child) {
        child = new Node();
        current.children.set(parsed.key, child);
      }

      if (parsed.isDynamic) {
        child.isDynamic = true;
        if (!child.paramName) {
          child.paramName = parsed.paramName;
        }
      }

      current = child;
    }

    // append middlewares in the leaf node
    current.middlewares.push(...middlewares);
  }

  /**
   * Matches a path against registered routes and returns middlewares with extracted parameters.
   * @param path - Request path to match (e.g., "/users/123")
   * @returns Match result with middlewares and params, or undefined if no match
   */
  match(path: string): MatchResult | undefined {
    const segments = this.splitPath(path);
    const result =
      this.mode === RouteMatcherMode.Prefix
        ? this.searchPrefix(this.root, segments, 0, [], {})
        : this.searchExact(this.root, segments, 0, {});
    if (!result) {
      return undefined;
    }
    return {
      middlewares: [...result.middlewares],
      params: { ...result.params },
    };
  }

  /**
   * Clears all registered routes from the matcher.
   */
  clear(): void {
    this.root = new Node();
  }

  /**
   * Recursively searches the route tree for an exact match.
   * An exact match requires that all path segments are consumed and a route with middlewares is found.
   *
   * Search strategy (tried in order):
   * 1. Static segment match - matches exact segment name (e.g., "users" matches "users")
   * 2. Dynamic segment match - matches any segment and captures it as a parameter (e.g., ":id" matches "123")
   *
   * @param node - Current node in the route tree
   * @param segments - Path segments to match (e.g., ["users", "123"])
   * @param index - Current segment index being processed
   * @param params - Accumulated route parameters from dynamic segments
   * @returns Match result with middlewares and params if exact match found, undefined otherwise
   */
  private searchExact(
    node: Node,
    segments: string[],
    index: number,
    params: Record<string, string>,
  ): MatchResult | undefined {
    // Base case: all segments consumed
    if (index >= segments.length) {
      // Check if current node has middlewares (exact route match)
      if (node.middlewares.length > 0) {
        return { middlewares: node.middlewares, params };
      }

      return undefined;
    }

    const segment = segments[index]!;

    // Try static segment match first (most specific)
    const staticChild = node.children.get(segment);
    if (staticChild) {
      const match = this.searchExact(staticChild, segments, index + 1, params);
      if (match) {
        return match;
      }
    }

    // Try dynamic segment match (e.g., :id matches any value)
    const dynamicChild = node.children.get(DYNAMIC_KEY);
    if (dynamicChild && dynamicChild.paramName) {
      const newParams = { ...params, [dynamicChild.paramName]: segment };
      const match = this.searchExact(
        dynamicChild,
        segments,
        index + 1,
        newParams,
      );
      if (match) {
        return match;
      }
    }

    return undefined;
  }

  private splitPath(path: string): string[] {
    return path.split("/").filter(Boolean);
  }

  /**
   * Recursively searches the route tree for a prefix match.
   * A prefix match succeeds if middlewares are found at any point during traversal,
   * even if not all path segments are consumed. This allows matching "/users" when
   * searching for "/users/123".
   *
   * Search strategy (tried in order):
   * 1. Static segment match - matches exact segment name
   * 2. Dynamic segment match - matches any segment and captures it as a parameter
   * 3. Return collected middlewares if any were found (prefix match success)
   *
   * @param node - Current node in the route tree
   * @param segments - Path segments to match (e.g., ["users", "123"])
   * @param index - Current segment index being processed
   * @param collected - Accumulated middlewares from matched route prefixes
   * @param params - Accumulated route parameters from dynamic segments
   * @returns Match result with collected middlewares and params if prefix match found, undefined otherwise
   */
  private searchPrefix(
    node: Node,
    segments: string[],
    index: number,
    collected: BaseMiddleware[],
    params: Record<string, string>,
  ): MatchResult | undefined {
    // Collect middlewares from current node (prefix matching collects as we traverse)
    const nextCollected =
      node.middlewares.length > 0
        ? [...collected, ...node.middlewares]
        : collected;

    // Base case: all segments consumed
    if (index >= segments.length) {
      // Return collected middlewares if any were found (prefix match success)
      if (nextCollected.length > 0) {
        return { middlewares: nextCollected, params };
      }
      return undefined;
    }

    const segment = segments[index]!;

    // Try static segment match first (most specific)
    const staticChild = node.children.get(segment);
    if (staticChild) {
      const match = this.searchPrefix(
        staticChild,
        segments,
        index + 1,
        nextCollected,
        params,
      );
      if (match) {
        return match;
      }
    }

    const dynamicChild = node.children.get(DYNAMIC_KEY);

    // Try dynamic segment match (e.g., :id matches any value)
    if (dynamicChild && dynamicChild.paramName) {
      const newParams = { ...params, [dynamicChild.paramName]: segment };
      const match = this.searchPrefix(
        dynamicChild,
        segments,
        index + 1,
        nextCollected,
        newParams,
      );
      if (match) {
        return match;
      }
    }

    // Prefix match: return collected middlewares if any were found
    // This allows matching "/users" when searching for "/users/123"
    if (nextCollected.length > 0) {
      return { middlewares: nextCollected, params };
    }
    return undefined;
  }

  private parseSegment(segment: string): {
    key: string;
    isDynamic: boolean;
    paramName?: string;
  } {
    if (STATIC_SEGMENT.test(segment)) {
      return { key: segment, isDynamic: false };
    }

    if (DYNAMIC_SEGMENT.test(segment)) {
      return {
        key: DYNAMIC_KEY,
        isDynamic: true,
        paramName: segment.slice(1),
      };
    }

    throw new Error(`Invalid route segment: "${segment}"`);
  }
}
