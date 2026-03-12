/**
 * Binary Indexed Tree (Fenwick Tree)
 *
 * Core insight: Store partial sums in a clever bit-trick structure.
 * Each index i is responsible for arr[i - lowbit(i) + 1 .. i].
 * lowbit(i) = i & (-i) — the lowest set bit of i.
 *
 * Simpler to implement than Segment Tree for prefix-sum queries,
 * but limited to invertible aggregates (sum, XOR — not min/max).
 *
 * Time:  Build O(n log n), Prefix sum O(log n), Update O(log n)
 * Space: O(n)
 *
 * Real-world use:
 *  - Inversion count (merge-sort alternative)
 *  - Order statistics
 *  - Competitive programming prefix queries
 */

export class FenwickTree {
  private tree: number[];
  private n: number;

  constructor(n: number);
  constructor(arr: number[]);
  constructor(arg: number | number[]) {
    if (Array.isArray(arg)) {
      this.n = arg.length;
      this.tree = new Array(this.n + 1).fill(0);
      for (let i = 0; i < this.n; i++) this.update(i + 1, arg[i]);
    } else {
      this.n = arg;
      this.tree = new Array(this.n + 1).fill(0);
    }
  }

  /**
   * Add delta to position i (1-indexed)  —  O(log n)
   */
  update(i: number, delta: number): void {
    for (; i <= this.n; i += i & -i) this.tree[i] += delta;
  }

  /**
   * Prefix sum [1 .. i]  —  O(log n)
   */
  prefixSum(i: number): number {
    let s = 0;
    for (; i > 0; i -= i & -i) s += this.tree[i];
    return s;
  }

  /**
   * Range sum [l .. r] (1-indexed, inclusive)  —  O(log n)
   */
  rangeSum(l: number, r: number): number {
    return this.prefixSum(r) - this.prefixSum(l - 1);
  }

  /**
   * Count inversions in array: pairs (i, j) where i < j but arr[i] > arr[j]
   * O(n log n) — equivalent to merge sort's inversion count
   */
  static countInversions(arr: number[]): number {
    // Coordinate compress to [1..n]
    const sorted = [...arr].sort((a, b) => a - b);
    const rank = new Map<number, number>();
    sorted.forEach((v, i) => rank.set(v, i + 1));

    const bit = new FenwickTree(arr.length);
    let inversions = 0;
    for (let i = arr.length - 1; i >= 0; i--) {
      const r = rank.get(arr[i])!;
      inversions += bit.prefixSum(r - 1);  // count elements < arr[i] to the right
      bit.update(r, 1);
    }
    return inversions;
  }
}
