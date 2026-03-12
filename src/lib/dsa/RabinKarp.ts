/**
 * Rabin-Karp Substring Search with Rolling Hash
 *
 * Core insight: Instead of comparing substrings character-by-character
 * (O(n×m)), compute a hash of the current window. Most windows won't
 * match the pattern hash → skip comparison. The "rolling" trick lets us
 * slide the window in O(1) by adding the new character and removing the old.
 *
 * Hash: polynomial rolling hash with double hashing to minimise collisions
 *   H(s) = Σ s[i] × BASE^(m-1-i)  (mod MOD)
 * Slide: H_new = (H_old - s[i] × BASE^(m-1)) × BASE + s[i+m]
 *
 * Time:  Average O(n + m), Worst O(n × m) — worst requires many hash collisions
 * Space: O(1)
 *
 * Real-world use:
 *  - Plagiarism detection (multi-pattern search)
 *  - Repeated substring / duplicate detection
 *  - Document fingerprinting (Rabin fingerprints)
 */

const BASE = 31;
const MOD1 = 1_000_000_007;
const MOD2 = 998_244_353;  // second modulus for double hashing (reduces collision probability)

function code(ch: string): number {
  return ch.charCodeAt(0) - 'a'.charCodeAt(0) + 1;
}

/** Modular multiplication that avoids float precision loss */
function mulmod(a: number, b: number, mod: number): number {
  // Split into high/low 15-bit halves to stay within JS safe integer range
  let result = 0;
  a = a % mod;
  while (b > 0) {
    if (b & 1) result = (result + a) % mod;
    a = (a * 2) % mod;
    b >>= 1;
  }
  return result;
}

/**
 * Find all starting indices of `pattern` in `text`  —  O(n + m) average
 */
export function rabinKarp(text: string, pattern: string): number[] {
  const n = text.length, m = pattern.length;
  if (m > n || m === 0) return [];

  // Precompute BASE^(m-1) mod MODs
  let power1 = 1, power2 = 1;
  for (let i = 0; i < m - 1; i++) {
    power1 = mulmod(power1, BASE, MOD1);
    power2 = mulmod(power2, BASE, MOD2);
  }

  // Compute pattern hash
  let ph1 = 0, ph2 = 0;
  for (let i = 0; i < m; i++) {
    ph1 = (mulmod(ph1, BASE, MOD1) + code(pattern[i])) % MOD1;
    ph2 = (mulmod(ph2, BASE, MOD2) + code(pattern[i])) % MOD2;
  }

  // Compute first window hash
  let wh1 = 0, wh2 = 0;
  for (let i = 0; i < m; i++) {
    wh1 = (mulmod(wh1, BASE, MOD1) + code(text[i])) % MOD1;
    wh2 = (mulmod(wh2, BASE, MOD2) + code(text[i])) % MOD2;
  }

  const matches: number[] = [];

  for (let i = 0; i <= n - m; i++) {
    if (wh1 === ph1 && wh2 === ph2) {
      // Double hash match — verify to guard against remaining collisions
      if (text.slice(i, i + m) === pattern) matches.push(i);
    }

    // Roll the window
    if (i < n - m) {
      wh1 = (mulmod((wh1 - mulmod(code(text[i]), power1, MOD1) + MOD1) % MOD1, BASE, MOD1) + code(text[i + m])) % MOD1;
      wh2 = (mulmod((wh2 - mulmod(code(text[i]), power2, MOD2) + MOD2) % MOD2, BASE, MOD2) + code(text[i + m])) % MOD2;
    }
  }

  return matches;
}

/**
 * Multi-pattern: find ALL patterns simultaneously  —  O(n × k average)
 * Useful for plagiarism detection against k reference documents at once
 */
export function rabinKarpMulti(text: string, patterns: string[]): Map<string, number[]> {
  const results = new Map<string, number[]>();
  for (const p of patterns) results.set(p, rabinKarp(text, p));
  return results;
}

/**
 * Longest repeated substring via binary search + Rabin-Karp  —  O(n log n)
 * Binary search on length: "does any substring of length mid appear at least twice?"
 */
export function longestRepeatedSubstring(s: string): string {
  const n = s.length;
  if (n === 0) return '';

  let lo = 1, hi = n - 1, best = '';

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;

    // Check if any substring of length mid appears twice
    let power1 = 1, power2 = 1;
    for (let i = 0; i < mid - 1; i++) {
      power1 = mulmod(power1, BASE, MOD1);
      power2 = mulmod(power2, BASE, MOD2);
    }

    let h1 = 0, h2 = 0;
    for (let i = 0; i < mid; i++) {
      h1 = (mulmod(h1, BASE, MOD1) + code(s[i])) % MOD1;
      h2 = (mulmod(h2, BASE, MOD2) + code(s[i])) % MOD2;
    }

    const seen = new Map<number, number[]>(); // h1 → [h2 values]
    seen.set(h1, [h2]);
    let found = '';

    for (let i = mid; i < n; i++) {
      h1 = (mulmod((h1 - mulmod(code(s[i - mid]), power1, MOD1) + MOD1) % MOD1, BASE, MOD1) + code(s[i])) % MOD1;
      h2 = (mulmod((h2 - mulmod(code(s[i - mid]), power2, MOD2) + MOD2) % MOD2, BASE, MOD2) + code(s[i])) % MOD2;

      const existing = seen.get(h1);
      if (existing && existing.includes(h2)) {
        found = s.slice(i - mid + 1, i + 1);
        break;
      }
      if (!existing) seen.set(h1, [h2]);
      else existing.push(h2);
    }

    if (found) { best = found; lo = mid + 1; }
    else        { hi = mid - 1; }
  }

  return best;
}
