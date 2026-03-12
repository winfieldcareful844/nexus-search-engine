/**
 * Monotonic Stack & Sliding Window Maximum
 *
 * Two related patterns that appear constantly in Google/Meta interviews:
 *
 * A. Monotonic Stack — O(n) for "next greater / previous smaller" problems
 *    Invariant: stack is always monotonically increasing or decreasing.
 *    Each element enters and exits the stack at most once → O(n) total.
 *
 * B. Sliding Window Maximum — O(n) via monotonic deque
 *    Classic hard problem: max subarray of length k for all positions.
 *    Deque front = max of current window. Pop from front when out of range,
 *    pop from back when a larger element enters.
 *
 * Real-world use:
 *  - Stock span / price analysis
 *  - Histogram largest rectangle (used in OCR, image processing)
 *  - Stream processing windows (real-time analytics)
 */

// ─────────────────────────────────────────────────────────────────────────────
// A. Monotonic Stack Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * For each position, find the index of the next greater element.
 * Returns -1 if no greater element exists.  —  O(n)
 *
 * Example: [2, 1, 2, 4, 3] → [3, 2, 3, -1, -1]
 */
export function nextGreaterElement(arr: number[]): number[] {
  const n = arr.length;
  const result = new Array(n).fill(-1);
  const stack: number[] = []; // indices, decreasing by arr value

  for (let i = 0; i < n; i++) {
    while (stack.length > 0 && arr[stack[stack.length - 1]] < arr[i]) {
      result[stack.pop()!] = i;
    }
    stack.push(i);
  }
  return result;
}

/**
 * For each position, find the index of the previous smaller element.
 * Returns -1 if none.  —  O(n)
 */
export function previousSmallerElement(arr: number[]): number[] {
  const n = arr.length;
  const result = new Array(n).fill(-1);
  const stack: number[] = [];

  for (let i = 0; i < n; i++) {
    while (stack.length > 0 && arr[stack[stack.length - 1]] >= arr[i]) {
      stack.pop();
    }
    result[i] = stack.length > 0 ? stack[stack.length - 1] : -1;
    stack.push(i);
  }
  return result;
}

/**
 * Largest Rectangle in Histogram  —  O(n)
 *
 * For each bar: find how far left/right it can extend as the shortest bar.
 * left[i] = previous smaller bar index, right[i] = next smaller bar index.
 * area[i] = height[i] × (right[i] - left[i] - 1)
 */
export function largestRectangleHistogram(heights: number[]): { area: number; left: number; right: number } {
  const n = heights.length;
  const left  = previousSmallerElement(heights);
  const right = nextGreaterElement(heights).map((v, i) => v === -1 ? n : v);
  // For this problem we want "next smaller", not "next greater"
  // Recompute with correct monotonic direction:
  const nse  = new Array(n).fill(n); // next smaller element index
  const stack: number[] = [];
  for (let i = 0; i < n; i++) {
    while (stack.length > 0 && heights[stack[stack.length - 1]] > heights[i]) {
      nse[stack.pop()!] = i;
    }
    stack.push(i);
  }

  let maxArea = 0, bestL = 0, bestR = 0;
  for (let i = 0; i < n; i++) {
    const l = left[i] + 1;
    const r = nse[i] - 1;
    const area = heights[i] * (r - l + 1);
    if (area > maxArea) { maxArea = area; bestL = l; bestR = r; }
  }
  return { area: maxArea, left: bestL, right: bestR };
}

// ─────────────────────────────────────────────────────────────────────────────
// B. Sliding Window Maximum  —  O(n)  (monotonic deque)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns max of each window of size k sliding over arr.  —  O(n)
 *
 * Deque invariant: indices stored in decreasing order of arr value.
 * - Front = index of current window max
 * - Elements smaller than the new element can never be the future max → pop back
 */
export function slidingWindowMax(arr: number[], k: number): number[] {
  const n = arr.length;
  if (n === 0 || k <= 0) return [];

  const deque: number[] = []; // stores indices
  const result: number[] = [];

  for (let i = 0; i < n; i++) {
    // Remove indices out of window
    while (deque.length > 0 && deque[0] < i - k + 1) deque.shift();
    // Maintain decreasing order — pop elements smaller than arr[i]
    while (deque.length > 0 && arr[deque[deque.length - 1]] < arr[i]) deque.pop();
    deque.push(i);
    // Window is full
    if (i >= k - 1) result.push(arr[deque[0]]);
  }

  return result;
}

/**
 * Minimum window substring  —  O(n + m)
 * Find shortest substring of text that contains all chars of pattern.
 * Classic two-pointer / sliding window with frequency map.
 */
export function minimumWindowSubstring(text: string, pattern: string): string {
  if (pattern.length === 0) return '';
  const need = new Map<string, number>();
  for (const c of pattern) need.set(c, (need.get(c) ?? 0) + 1);

  let have = 0, required = need.size;
  let lo = 0, bestLen = Infinity, bestL = 0;
  const window = new Map<string, number>();

  for (let hi = 0; hi < text.length; hi++) {
    const c = text[hi];
    window.set(c, (window.get(c) ?? 0) + 1);
    if (need.has(c) && window.get(c) === need.get(c)) have++;

    while (have === required) {
      if (hi - lo + 1 < bestLen) { bestLen = hi - lo + 1; bestL = lo; }
      const lc = text[lo];
      window.set(lc, window.get(lc)! - 1);
      if (need.has(lc) && window.get(lc)! < need.get(lc)!) have--;
      lo++;
    }
  }

  return bestLen === Infinity ? '' : text.slice(bestL, bestL + bestLen);
}
