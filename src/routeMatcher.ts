import type { Middleware } from "./types";

const STATIC_SEGMENT = /^[a-zA-Z0-9_-]+$/;
const DYNAMIC_SEGMENT = /^:[a-zA-Z0-9_]+$/;
const DYNAMIC_KEY = ":";

export class Node {
  children: Map<string, Node>;
  exactMiddlewares: Middleware[];
  prefixMiddlewares: Middleware[];
  isDynamic?: boolean;
  paramName?: string;

  constructor() {
    this.children = new Map();
    this.exactMiddlewares = [];
    this.prefixMiddlewares = [];
  }
}

enum MiddlewareKind {
  Exact = "exact",
  Prefix = "prefix",
}

export class RouteMatcher {
  private root: Node;

  constructor() {
    this.root = new Node();
  }

  insert(
    path: string,
    middlewares: Middleware[],
    middlewareKind: MiddlewareKind = MiddlewareKind.Exact,
  ): void {
    const segments = this.splitPath(path);
    let current = this.root;

    // traverse the path and ensure each segment has a node
    for (const segment of segments) {
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
    (middlewareKind === MiddlewareKind.Exact
      ? current.exactMiddlewares
      : current.prefixMiddlewares
    ).push(...middlewares);
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
      return node.exactMiddlewares;
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

    return [];
  }

  private splitPath(path: string): string[] {
    return path.split("/").filter(Boolean);
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
