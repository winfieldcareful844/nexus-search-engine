/**
 * Backtracking — N-Queens & Subset/Permutation Generation
 *
 * Core insight: Systematically explore all possible solutions by building
 * candidates incrementally and abandoning ("pruning") branches that cannot
 * lead to valid solutions.
 *
 * Time complexity depends on the branching factor and depth, but pruning
 * dramatically cuts practical runtime vs. brute force.
 *
 * Patterns covered:
 *  1. N-Queens  — classic constraint satisfaction
 *  2. Subsets (Power Set)  — O(2^n)
 *  3. Permutations  — O(n!)
 *  4. Combination Sum  — O(2^n) with early termination
 *  5. Sudoku Solver  — backtracking on a grid
 *
 * Real-world use:
 *  - Constraint satisfaction solvers
 *  - Game AI (chess, Go move generation)
 *  - Compiler: register allocation
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. N-Queens  —  place N queens on N×N board, none attacking each other
// ─────────────────────────────────────────────────────────────────────────────
export function solveNQueens(n: number): string[][] {
  const solutions: string[][] = [];
  const cols = new Set<number>();
  const diag1 = new Set<number>(); // row - col (top-left to bottom-right)
  const diag2 = new Set<number>(); // row + col (top-right to bottom-left)
  const board: number[] = []; // board[row] = col of queen

  function backtrack(row: number): void {
    if (row === n) {
      solutions.push(board.map(c => '.'.repeat(c) + 'Q' + '.'.repeat(n - c - 1)));
      return;
    }
    for (let col = 0; col < n; col++) {
      if (cols.has(col) || diag1.has(row - col) || diag2.has(row + col)) continue;
      cols.add(col); diag1.add(row - col); diag2.add(row + col); board.push(col);
      backtrack(row + 1);
      cols.delete(col); diag1.delete(row - col); diag2.delete(row + col); board.pop();
    }
  }

  backtrack(0);
  return solutions;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Power Set (all subsets)  —  O(2^n)
// ─────────────────────────────────────────────────────────────────────────────
export function subsets<T>(nums: T[]): T[][] {
  const result: T[][] = [];
  const current: T[] = [];

  function backtrack(start: number): void {
    result.push([...current]);
    for (let i = start; i < nums.length; i++) {
      current.push(nums[i]);
      backtrack(i + 1);
      current.pop();
    }
  }

  backtrack(0);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. All Permutations  —  O(n!)
// ─────────────────────────────────────────────────────────────────────────────
export function permutations<T>(nums: T[]): T[][] {
  const result: T[][] = [];
  const used = new Array(nums.length).fill(false);
  const current: T[] = [];

  function backtrack(): void {
    if (current.length === nums.length) { result.push([...current]); return; }
    for (let i = 0; i < nums.length; i++) {
      if (used[i]) continue;
      used[i] = true; current.push(nums[i]);
      backtrack();
      used[i] = false; current.pop();
    }
  }

  backtrack();
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Combination Sum (unlimited reuse)
// ─────────────────────────────────────────────────────────────────────────────
export function combinationSum(candidates: number[], target: number): number[][] {
  const result: number[][] = [];
  const sorted = [...candidates].sort((a, b) => a - b);

  function backtrack(start: number, remaining: number, current: number[]): void {
    if (remaining === 0) { result.push([...current]); return; }
    for (let i = start; i < sorted.length; i++) {
      if (sorted[i] > remaining) break; // pruning — sorted, so no point continuing
      current.push(sorted[i]);
      backtrack(i, remaining - sorted[i], current); // i (not i+1) — can reuse same element
      current.pop();
    }
  }

  backtrack(0, target, []);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Sudoku Solver  —  backtrack + constraint propagation
// ─────────────────────────────────────────────────────────────────────────────
export function solveSudoku(board: string[][]): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] !== '.') continue;
      for (let d = 1; d <= 9; d++) {
        const ch = String(d);
        if (isValid(board, r, c, ch)) {
          board[r][c] = ch;
          if (solveSudoku(board)) return true;
          board[r][c] = '.'; // backtrack
        }
      }
      return false; // no digit worked
    }
  }
  return true; // all cells filled
}

function isValid(board: string[][], row: number, col: number, ch: string): boolean {
  for (let i = 0; i < 9; i++) {
    if (board[row][i] === ch) return false;
    if (board[i][col] === ch) return false;
    const br = 3 * Math.floor(row / 3) + Math.floor(i / 3);
    const bc = 3 * Math.floor(col / 3) + (i % 3);
    if (board[br][bc] === ch) return false;
  }
  return true;
}
