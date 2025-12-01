import type { BaseMiddleware } from "./types";

const INVALID_CHARS = /[^A-Za-z0-9\/._:-]/;
const STATIC_SEGMENT = /^[a-zA-Z0-9._-]+$/;
const DYNAMIC_SEGMENT = /^:[a-zA-Z0-9_]+$/;
const DYNAMIC_KEY = ":";

class Node {
  children: Map<string, Node>;
  middlewares: BaseMiddleware[];
  isDynamic?: boolean;
  paramName?: string;
  index: number;

  constructor(index: number) {
    this.children = new Map();
    this.middlewares = [];
    this.index = index;
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
    this.root = new Node(0);
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
    const invalidChar = INVALID_CHARS.exec(path);
    if (invalidChar) {
      throw new Error(`Unexpected MODIFIER at ${invalidChar.index}`);
    }

    const segments = this.splitPath(path);
    let current = this.root;

    // traverse the path and ensure each segment has a node
    for (let index = 0; index < segments.length; index++) {
      const segment = segments[index]!;
      const parsed = this.parseSegment(segment);

      let child = current.children.get(parsed.key);
      const childrenSize = current.children.size;
      if (!child) {
        child = new Node(childrenSize);
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
    this.root = new Node(0);
  }

  /**
   * Recursively searches the route tree for an exact match.
   * An exact match requires that all path segments are consumed and a route with middlewares is found.
   *
   * Search strategy (collects all matches):
   * Iterates over children in registration order to collect all matching routes (both static and dynamic).
   * All matches are aggregated, maintaining registration order.
   *
   * @param node - Current node in the route tree
   * @param segments - Path segments to match (e.g., ["users", "123"])
   * @param index - Current segment index being processed
   * @param params - Accumulated route parameters from dynamic segments
   * @returns Match result with aggregated middlewares and merged params if exact match found, undefined otherwise
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

    // Collect matches in the order routes were registered
    const matchingChildren = this.getMatchingChildren(node, segment);
    const matches: MatchResult[] = matchingChildren.flatMap(
      ({ child, isDynamic }) => {
        const childParams = isDynamic
          ? { ...params, [child.paramName!]: segment }
          : params;
        const match = this.searchExact(child, segments, index + 1, childParams);
        return match ? [match] : [];
      },
    );

    return this.aggregateMatches(matches, params);
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
   * Search strategy (collects all matches):
   * Iterates over children in registration order to collect all matching routes (both static and dynamic).
   * All matches are aggregated, maintaining registration order.
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

    // Collect matches in the order routes were registered
    const matchingChildren = this.getMatchingChildren(node, segment);
    const matches: MatchResult[] = matchingChildren.flatMap(
      ({ child, isDynamic }) => {
        const childParams = isDynamic
          ? { ...params, [child.paramName!]: segment }
          : params;
        const match = this.searchPrefix(
          child,
          segments,
          index + 1,
          nextCollected,
          childParams,
        );
        return match ? [match] : [];
      },
    );

    const aggregated = this.aggregateMatches(matches, params);
    if (aggregated) {
      return aggregated;
    }

    // Prefix match: return collected middlewares if any were found
    // This allows matching "/users" when searching for "/users/123"
    if (nextCollected.length > 0) {
      return { middlewares: nextCollected, params };
    }
    return undefined;
  }

  /**
   * Gets matching children (static and dynamic) for a given segment, sorted by registration order.
   * @param node - Current node in the route tree
   * @param segment - Path segment to match
   * @returns Array of matching children with their dynamic flag, sorted by registration order
   */
  private getMatchingChildren(
    node: Node,
    segment: string,
  ): Array<{ child: Node; isDynamic: boolean }> {
    const staticChild = node.children.get(segment);
    const dynamicChild = node.children.get(DYNAMIC_KEY);
    return [
      ...(staticChild ? [{ child: staticChild, isDynamic: false }] : []),
      ...(dynamicChild && dynamicChild.paramName
        ? [{ child: dynamicChild, isDynamic: true }]
        : []),
    ].sort((c1, c2) => c1.child.index - c2.child.index);
  }

  /**
   * Aggregates multiple match results into a single match result.
   * Merges middlewares and params from all matches, maintaining registration order.
   * @param matches - Array of match results to aggregate
   * @param baseParams - Base parameters to start with
   * @returns Aggregated match result, or undefined if no matches
   */
  private aggregateMatches(
    matches: MatchResult[],
    baseParams: Record<string, string>,
  ): MatchResult | undefined {
    if (matches.length === 0) {
      return undefined;
    }

    const aggregatedMiddlewares: BaseMiddleware[] = [];
    const aggregatedParams: Record<string, string> = { ...baseParams };

    for (const match of matches) {
      aggregatedMiddlewares.push(...match.middlewares);
      Object.assign(aggregatedParams, match.params);
    }

    return {
      middlewares: aggregatedMiddlewares,
      params: aggregatedParams,
    };
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
