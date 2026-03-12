/**
 * Segment Tree — Range Query + Point Update
 *
 * Core insight: Represent array as a complete binary tree where each node
 * stores the aggregate (sum/min/max) of its subtree's range. Updates and
 * queries take O(log n) by traversing from root to leaf.
 *
 * Time:  Build O(n), Query O(log n), Update O(log n)
 * Space: O(n) — tree stores 4n nodes for n-element array
 *
 * Real-world use:
 *  - Database range aggregate queries
 *  - Range minimum query (RMQ) — used in LCA algorithms
 *  - Competitive programming: inversion count, k-th order statistics
 */

export type SegTreeOp = 'sum' | 'min' | 'max';

export class SegmentTree {
  private tree: number[];
  private n: number;
  private readonly op: SegTreeOp;
  private readonly identity: number; // neutral element for op

  constructor(arr: number[], op: SegTreeOp = 'sum') {
    this.n = arr.length;
    this.op = op;
    this.identity = op === 'sum' ? 0 : op === 'min' ? Infinity : -Infinity;
    this.tree = new Array(4 * this.n).fill(this.identity);
    if (this.n > 0) this._build(arr, 1, 0, this.n - 1);
  }

  private _combine(a: number, b: number): number {
    switch (this.op) {
      case 'sum': return a + b;
      case 'min': return Math.min(a, b);
      case 'max': return Math.max(a, b);
    }
  }

  private _build(arr: number[], node: number, start: number, end: number): void {
    if (start === end) {
      this.tree[node] = arr[start];
      return;
    }
    const mid = (start + end) >> 1;
    this._build(arr, 2 * node,     start, mid);
    this._build(arr, 2 * node + 1, mid + 1, end);
    this.tree[node] = this._combine(this.tree[2 * node], this.tree[2 * node + 1]);
  }

  /**
   * Point update: set arr[idx] = val    — O(log n)
   */
  update(idx: number, val: number): void {
    this._update(1, 0, this.n - 1, idx, val);
  }

  private _update(node: number, start: number, end: number, idx: number, val: number): void {
    if (start === end) {
      this.tree[node] = val;
      return;
    }
    const mid = (start + end) >> 1;
    if (idx <= mid) this._update(2 * node,     start, mid,     idx, val);
    else            this._update(2 * node + 1, mid + 1, end,   idx, val);
    this.tree[node] = this._combine(this.tree[2 * node], this.tree[2 * node + 1]);
  }

  /**
   * Range query: aggregate over [l, r]  — O(log n)
   */
  query(l: number, r: number): number {
    return this._query(1, 0, this.n - 1, l, r);
  }

  private _query(node: number, start: number, end: number, l: number, r: number): number {
    if (r < start || end < l) return this.identity;       // completely outside
    if (l <= start && end <= r) return this.tree[node];   // completely inside
    const mid = (start + end) >> 1;
    return this._combine(
      this._query(2 * node,     start, mid,     l, r),
      this._query(2 * node + 1, mid + 1, end, l, r)
    );
  }

  get size(): number { return this.n; }
}
