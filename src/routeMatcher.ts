import type { Middleware } from "./types";

const STATIC_SEGMENT = /^[a-zA-Z0-9._-]+$/;
const DYNAMIC_SEGMENT = /^:[a-zA-Z0-9_]+$/;
const DYNAMIC_KEY = ":";
const WILDCARD_SEGMENT = "*";
const WILDCARD_KEY = "*";

export class Node {
  children: Map<string, Node>;
  middlewares: Middleware[];
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
  middlewares: Middleware[];
  params: Record<string, string>;
}

/**
 * Route matcher that supports static, dynamic (:param), and wildcard (*) routes.
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
   * @param path - Route path pattern (e.g., "/users/:id", "/files/*")
   * @param middlewares - Array of middleware functions to execute for this route
   * @throws Error if path contains invalid segments or wildcard is not last
   */
  insert(path: string, middlewares: Middleware[]): void {
    const segments = this.splitPath(path);
    let current = this.root;

    // traverse the path and ensure each segment has a node
    for (let index = 0; index < segments.length; index++) {
      const segment = segments[index]!;
      const parsed = this.parseSegment(segment);

      if (parsed.isWildcard && index !== segments.length - 1) {
        throw new Error(
          'Wildcard "*" must be the last segment in a route path.',
        );
      }

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

  private searchExact(
    node: Node,
    segments: string[],
    index: number,
    params: Record<string, string>,
  ): MatchResult | undefined {
    if (index >= segments.length) {
      if (node.middlewares.length > 0) {
        return { middlewares: node.middlewares, params };
      }

      const wildcardChild = node.children.get(WILDCARD_KEY);
      if (wildcardChild) {
        return { middlewares: wildcardChild.middlewares, params };
      }

      return undefined;
    }

    const segment = segments[index]!;

    const staticChild = node.children.get(segment);
    if (staticChild) {
      const match = this.searchExact(staticChild, segments, index + 1, params);
      if (match) {
        return match;
      }
    }

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

    const wildcardChild = node.children.get(WILDCARD_KEY);
    if (wildcardChild) {
      return { middlewares: wildcardChild.middlewares, params };
    }

    return undefined;
  }

  private splitPath(path: string): string[] {
    return path.split("/").filter(Boolean);
  }

  private searchPrefix(
    node: Node,
    segments: string[],
    index: number,
    collected: Middleware[],
    params: Record<string, string>,
  ): MatchResult | undefined {
    const nextCollected =
      node.middlewares.length > 0
        ? [...collected, ...node.middlewares]
        : collected;

    if (index >= segments.length) {
      const wildcardChild = node.children.get(WILDCARD_KEY);
      if (wildcardChild) {
        return {
          middlewares: [...nextCollected, ...wildcardChild.middlewares],
          params,
        };
      }
      if (nextCollected.length > 0) {
        return { middlewares: nextCollected, params };
      }
      return undefined;
    }

    const segment = segments[index]!;

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
    const wildcardChild = node.children.get(WILDCARD_KEY);

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
        // Check if there are remaining segments that weren't consumed by the dynamic route
        // If wildcard exists and there are remaining segments, prefer wildcard
        const currentSegmentIndex = index + 1;
        const hasRemainingSegments = currentSegmentIndex < segments.length;
        if (hasRemainingSegments && wildcardChild) {
          // This handles the case where /files/:id matches /files/123 but /files/123/nested should match /files/*
          return {
            middlewares: [...nextCollected, ...wildcardChild.middlewares],
            params,
          };
        }
        return match;
      }
    }

    if (wildcardChild) {
      return {
        middlewares: [...nextCollected, ...wildcardChild.middlewares],
        params,
      };
    }

    if (nextCollected.length > 0) {
      return { middlewares: nextCollected, params };
    }
    return undefined;
  }

  private parseSegment(segment: string): {
    key: string;
    isDynamic: boolean;
    isWildcard: boolean;
    paramName?: string;
  } {
    if (segment === WILDCARD_SEGMENT) {
      return { key: WILDCARD_KEY, isDynamic: false, isWildcard: true };
    }

    if (STATIC_SEGMENT.test(segment)) {
      return { key: segment, isDynamic: false, isWildcard: false };
    }

    if (DYNAMIC_SEGMENT.test(segment)) {
      return {
        key: DYNAMIC_KEY,
        isDynamic: true,
        isWildcard: false,
        paramName: segment.slice(1),
      };
    }

    throw new Error(`Invalid route segment: "${segment}"`);
  }
}
