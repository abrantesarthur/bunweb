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

export class RouteMatcher {
  private root: Node;
  private mode: RouteMatcherMode;

  constructor(mode: RouteMatcherMode = RouteMatcherMode.Exact) {
    this.root = new Node();
    this.mode = mode;
  }

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

  match(path: string): Middleware[] | undefined {
    const segments = this.splitPath(path);
    const result = this.search(this.root, segments, 0);
    return result ? [...result] : result;
  }

  clear(): void {
    this.root = new Node();
  }

  private search(node: Node, segments: string[], index: number): Middleware[] {
    if (index >= segments.length) {
      if (node.middlewares.length > 0) {
        return node.middlewares;
      }

      const wildcardChild = node.children.get(WILDCARD_KEY);
      if (wildcardChild) {
        return wildcardChild.middlewares;
      }

      return [];
    }

    const segment = segments[index];

    const staticChild = node.children.get(segment!);
    if (staticChild) {
      const match = this.search(staticChild, segments, index + 1);
      if (match.length > 0) {
        return match;
      }
    }

    const dynamicChild = node.children.get(DYNAMIC_KEY);
    if (dynamicChild) {
      const match = this.search(dynamicChild, segments, index + 1);
      if (match.length > 0) {
        return match;
      }
    }

    const wildcardChild = node.children.get(WILDCARD_KEY);
    if (wildcardChild) {
      return wildcardChild.middlewares;
    }

    return [];
  }

  private splitPath(path: string): string[] {
    return path.split("/").filter(Boolean);
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
