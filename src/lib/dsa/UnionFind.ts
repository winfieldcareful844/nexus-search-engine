/**
 * Union-Find (Disjoint Set Union) with Path Compression + Union by Rank
 *
 * Core insight: Forest of trees where each tree represents a set.
 * - Path compression: during Find, rewire every node on the path directly to root.
 * - Union by rank: always attach smaller tree under the larger one.
 *
 * Both optimizations together give near-O(1) amortized operations:
 *   α(n) — inverse Ackermann function (≤ 5 for any practical n)
 *
 * Time:  Find/Union: O(α(n)) ≈ O(1) amortized
 * Space: O(n)
 *
 * Real-world use:
 *  - Kruskal's MST (detect if adding an edge creates a cycle)
 *  - Connected components in O(E α(V))
 *  - Percolation theory, social network clustering
 *  - Image segmentation
 */

export class UnionFind {
  private parent: number[];
  private rank: number[];
  private _componentCount: number;
  private size: number[];  // size of each component

  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.rank = new Array(n).fill(0);
    this.size = new Array(n).fill(1);
    this._componentCount = n;
  }

  /**
   * Find root of x with path compression  —  O(α(n))
   */
  find(x: number): number {
    if (this.parent[x] !== x) {
      this.parent[x] = this.find(this.parent[x]); // path compression
    }
    return this.parent[x];
  }

  /**
   * Union by rank  —  O(α(n))
   * @returns true if x and y were in different sets (merge happened)
   */
  union(x: number, y: number): boolean {
    const rx = this.find(x), ry = this.find(y);
    if (rx === ry) return false; // already same set

    // Attach smaller rank tree under larger rank
    if (this.rank[rx] < this.rank[ry]) {
      this.parent[rx] = ry;
      this.size[ry] += this.size[rx];
    } else if (this.rank[rx] > this.rank[ry]) {
      this.parent[ry] = rx;
      this.size[rx] += this.size[ry];
    } else {
      this.parent[ry] = rx;
      this.size[rx] += this.size[ry];
      this.rank[rx]++;
    }
    this._componentCount--;
    return true;
  }

  /** Are x and y in the same set? */
  connected(x: number, y: number): boolean { return this.find(x) === this.find(y); }

  /** Number of distinct connected components */
  get componentCount(): number { return this._componentCount; }

  /** Size of the component containing x */
  componentSize(x: number): number { return this.size[this.find(x)]; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Kruskal's Minimum Spanning Tree using UnionFind
// Time: O(E log E)  (sort edges)
// ─────────────────────────────────────────────────────────────────────────────
export interface KruskalEdge { u: number; v: number; weight: number; }
export interface MSTResult { edges: KruskalEdge[]; totalWeight: number; }

export function kruskalMST(n: number, edges: KruskalEdge[]): MSTResult {
  const sorted = [...edges].sort((a, b) => a.weight - b.weight);
  const uf = new UnionFind(n);
  const mstEdges: KruskalEdge[] = [];
  let totalWeight = 0;

  for (const edge of sorted) {
    if (uf.union(edge.u, edge.v)) {
      mstEdges.push(edge);
      totalWeight += edge.weight;
      if (mstEdges.length === n - 1) break; // MST complete
    }
  }

  return { edges: mstEdges, totalWeight };
}
