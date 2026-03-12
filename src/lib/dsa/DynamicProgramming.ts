/**
 * Dynamic Programming — Classic Problems
 *
 * Five canonical DP patterns that cover the majority of interview problems:
 *
 *  1. 0/1 Knapsack           — bounded selection with weight/value tradeoff
 *  2. Longest Common Subsequence (LCS) — string edit alignment
 *  3. Edit Distance (Levenshtein)      — minimum string transformations
 *  4. Longest Increasing Subsequence   — patience sorting / binary search
 *  5. Coin Change (unbounded)          — minimum coins for an amount
 *
 * Every function returns both the optimal value AND a traceback for
 * reconstructing the actual solution — not just the scalar answer.
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. 0/1 Knapsack  —  O(n × capacity)  space O(n × capacity) or O(capacity)
// ─────────────────────────────────────────────────────────────────────────────
export interface KnapsackItem { weight: number; value: number; name: string; }
export interface KnapsackResult { maxValue: number; selectedItems: KnapsackItem[]; dp: number[][]; }

export function knapsack(items: KnapsackItem[], capacity: number): KnapsackResult {
  const n = items.length;
  // dp[i][w] = max value using first i items with capacity w
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(capacity + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    const { weight, value } = items[i - 1];
    for (let w = 0; w <= capacity; w++) {
      dp[i][w] = dp[i - 1][w]; // don't take item i
      if (weight <= w) {
        dp[i][w] = Math.max(dp[i][w], dp[i - 1][w - weight] + value); // take item i
      }
    }
  }

  // Traceback to find which items were selected
  const selectedItems: KnapsackItem[] = [];
  let w = capacity;
  for (let i = n; i > 0; i--) {
    if (dp[i][w] !== dp[i - 1][w]) {
      selectedItems.unshift(items[i - 1]);
      w -= items[i - 1].weight;
    }
  }

  return { maxValue: dp[n][capacity], selectedItems, dp };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Longest Common Subsequence  —  O(m × n)
// ─────────────────────────────────────────────────────────────────────────────
export interface LCSResult { length: number; lcs: string; dp: number[][]; }

export function lcs(a: string, b: string): LCSResult {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);

  // Reconstruct LCS string
  let i = m, j = n, result = '';
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) { result = a[i - 1] + result; i--; j--; }
    else if (dp[i - 1][j] > dp[i][j - 1]) i--;
    else j--;
  }

  return { length: dp[m][n], lcs: result, dp };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Edit Distance (Levenshtein)  —  O(m × n)
// ─────────────────────────────────────────────────────────────────────────────
export type EditOp = { op: 'insert' | 'delete' | 'replace' | 'match'; char: string };
export interface EditDistResult { distance: number; ops: EditOp[]; dp: number[][]; }

export function editDistance(a: string, b: string): EditDistResult {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
  );

  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);

  // Traceback
  const ops: EditOp[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.unshift({ op: 'match', char: a[i - 1] }); i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] <= dp[i - 1][j] && dp[i][j - 1] <= dp[i - 1][j - 1])) {
      ops.unshift({ op: 'insert', char: b[j - 1] }); j--;
    } else if (i > 0 && (j === 0 || dp[i - 1][j] <= dp[i][j - 1] && dp[i - 1][j] <= dp[i - 1][j - 1])) {
      ops.unshift({ op: 'delete', char: a[i - 1] }); i--;
    } else {
      ops.unshift({ op: 'replace', char: b[j - 1] }); i--; j--;
    }
  }

  return { distance: dp[m][n], ops, dp };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Longest Increasing Subsequence  —  O(n log n) via patience sorting
// ─────────────────────────────────────────────────────────────────────────────
export interface LISResult { length: number; lis: number[]; }

export function lis(arr: number[]): LISResult {
  if (arr.length === 0) return { length: 0, lis: [] };

  // tails[i] = smallest tail element of all LIS of length i+1
  const tails: number[] = [];
  const indices: number[] = []; // position in tails for each arr element
  const predecessors: number[] = new Array(arr.length).fill(-1);
  const tailIdx: number[] = [];  // arr index that set tails[i]

  for (let i = 0; i < arr.length; i++) {
    // Binary search: first tail >= arr[i]
    let lo = 0, hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      tails[mid] < arr[i] ? (lo = mid + 1) : (hi = mid);
    }
    tails[lo] = arr[i];
    tailIdx[lo] = i;
    indices[i] = lo;
    if (lo > 0) predecessors[i] = tailIdx[lo - 1];
  }

  // Reconstruct
  const lisArr: number[] = [];
  let cur = tailIdx[tails.length - 1];
  while (cur !== -1) {
    lisArr.unshift(arr[cur]);
    cur = predecessors[cur];
  }

  return { length: tails.length, lis: lisArr };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Coin Change (unbounded)  —  O(amount × coins.length)
// ─────────────────────────────────────────────────────────────────────────────
export interface CoinChangeResult { minCoins: number; coins: number[]; }

export function coinChange(denominations: number[], amount: number): CoinChangeResult {
  const INF = Infinity;
  const dp = new Array(amount + 1).fill(INF);
  const lastCoin = new Array(amount + 1).fill(-1);
  dp[0] = 0;

  for (let a = 1; a <= amount; a++) {
    for (const coin of denominations) {
      if (coin <= a && dp[a - coin] + 1 < dp[a]) {
        dp[a] = dp[a - coin] + 1;
        lastCoin[a] = coin;
      }
    }
  }

  if (dp[amount] === INF) return { minCoins: -1, coins: [] };

  // Reconstruct coins used
  const coinsUsed: number[] = [];
  let rem = amount;
  while (rem > 0) {
    coinsUsed.push(lastCoin[rem]);
    rem -= lastCoin[rem];
  }

  return { minCoins: dp[amount], coins: coinsUsed };
}
