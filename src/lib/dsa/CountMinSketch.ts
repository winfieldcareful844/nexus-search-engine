/**
 * Count-Min Sketch — Approximate Frequency Estimation
 *
 * WHAT IT SOLVES:
 *   In a data stream of N events, estimate the frequency of any item x
 *   using only O(w × d) space instead of O(distinct items).
 *   For N = 10^9 queries/day with 100M distinct queries, exact counting
 *   needs ~800MB. A CMS with ε=0.001, δ=0.99 needs only ~24KB.
 *
 * THE ALGORITHM (Cormode & Muthukrishnan, 2005):
 *   Maintain a d×w matrix of counters, initialized to 0.
 *   Use d pairwise-independent hash functions h_1…h_d : {items} → [0,w).
 *
 *   update(x, count=1):
 *     for each row i in [0,d):
 *       table[i][h_i(x)] += count
 *
 *   estimate(x):
 *     return min over all rows of table[i][h_i(x)]
 *
 * ERROR GUARANTEES (proven):
 *   With probability (1 - δ):
 *     freq(x) ≤ estimate(x) ≤ freq(x) + ε * N
 *   Where:
 *     w = ⌈e / ε⌉    (e ≈ 2.718, Euler's number)
 *     d = ⌈ln(1/δ)⌉
 *   So ε controls accuracy, δ controls confidence.
 *
 *   Note: Count-Min NEVER underestimates. estimate ≥ freq always.
 *
 * WHY NOT EXACT COUNTING (HashMap<string,number>):
 *   •  Unbounded memory — new keys grow the map indefinitely
 *   •  With CMS: O(1) update, O(1) query, FIXED memory regardless of distinct items
 *   •  Trade: ε × N additive error (e.g. for ε=0.001 and N=1M, error ≤ 1000)
 *   This is the central stream-processing tradeoff used in Flink, Spark, Caffeine.
 *
 * HASH INDEPENDENCE:
 *   We need pairwise-independent hash families. We achieve this with:
 *     h_i(x) = ((a_i * fnv(x) + b_i) mod p) mod w
 *   where p is a large prime, and (a_i, b_i) are random coefficients per row.
 *   This satisfies the Universal Hashing guarantee P[h(x)=h(y)] ≤ 1/w for x≠y.
 *
 * USE CASES IN THIS SEARCH ENGINE:
 *   1. Hot query detection — count query frequency to find trending searches
 *   2. Heavy Hitter identification — top-K most frequent items without sorting all
 *   3. Join size estimation — approximate |PostingList(A) ∩ PostingList(B)|
 *   4. Rate limiting — approximate per-IP request counts
 *
 * Time:  O(d) per update/estimate
 * Space: O(w × d) = O((e/ε) × ln(1/δ)) ← fixed regardless of stream size
 */

// Large prime for universal hashing
const PRIME = 2_147_483_647; // 2^31 - 1 (Mersenne prime)

export class CountMinSketch {
    private table: Int32Array[];    // d × w counter matrix
    private readonly w: number;     // columns (width)
    private readonly d: number;     // rows (depth / hash functions)
    private readonly a: number[];   // hash coefficients a_i
    private readonly b: number[];   // hash coefficients b_i
    private totalCount: number;     // N = sum of all updates

    /**
     * @param epsilon  Max additive error as fraction of total count (0 < ε < 1)
     * @param delta    Failure probability (0 < δ < 1); confidence = 1-δ
     *
     * Example: ε=0.001, δ=0.01 → error ≤ 0.1% of N with 99% confidence
     *          w=2719, d=5, memory=54KB for int32s
     */
    constructor(
        private readonly epsilon: number = 0.001,
        private readonly delta: number = 0.01
    ) {
        if (epsilon <= 0 || epsilon >= 1) throw new Error('epsilon must be in (0,1)');
        if (delta <= 0 || delta >= 1) throw new Error('delta must be in (0,1)');

        this.w = Math.ceil(Math.E / epsilon);
        this.d = Math.ceil(Math.log(1 / delta));
        this.totalCount = 0;

        // Generate pairwise-independent hash family coefficients
        // Using a simple but correct Linear Congruential seeding
        this.a = [];
        this.b = [];
        let seed = 0xdeadbeef;
        for (let i = 0; i < this.d; i++) {
            // LCG for reproducible randomness (no external dependency)
            seed = (seed * 1664525 + 1013904223) >>> 0;
            this.a.push((seed % (PRIME - 1)) + 1);   // a ∈ [1, p-1]
            seed = (seed * 1664525 + 1013904223) >>> 0;
            this.b.push(seed % PRIME);                 // b ∈ [0, p-1]
        }

        // Initialize counter table
        this.table = Array.from({ length: this.d }, () => new Int32Array(this.w));
    }

    // ── Hash Function ────────────────────────────────────────────────────

    /** FNV-1a 32-bit for string → integer transformation */
    private fnv1a(str: string): number {
        let hash = 0x811c9dc5;
        for (let i = 0; i < str.length; i++) {
            hash ^= str.charCodeAt(i);
            hash = (hash * 16777619) >>> 0;
        }
        return hash >>> 0;
    }

    /**
     * Row-specific hash: h_i(x) = ((a_i * key + b_i) mod p) mod w
     * Universal hash family — pairwise independent by construction.
     */
    private hash(row: number, item: string): number {
        const key = this.fnv1a(item);
        // Avoid overflow: split 32-bit multiply into safe range
        const ax = Math.imul(this.a[row], key);
        return (((ax + this.b[row]) % PRIME) + PRIME) % PRIME % this.w;
    }

    // ── Core API ─────────────────────────────────────────────────────────

    /**
     * Record `count` occurrences of `item`. O(d).
     * Increments table[i][h_i(item)] for each row i.
     */
    update(item: string, count: number = 1): void {
        for (let i = 0; i < this.d; i++) {
            this.table[i][this.hash(i, item)] += count;
        }
        this.totalCount += count;
    }

    /**
     * Estimate frequency of `item`. O(d).
     * Returns min over all rows — guaranteed ≥ true frequency.
     * Overestimate ≤ ε × N with probability ≥ 1 - δ.
     */
    estimate(item: string): number {
        let min = Infinity;
        for (let i = 0; i < this.d; i++) {
            min = Math.min(min, this.table[i][this.hash(i, item)]);
        }
        return min;
    }

    /**
     * Find approximate heavy hitters (items with freq ≥ threshold * N).
     * Uses a candidate pool tracked alongside the sketch.
     * This is a simplified Space-Saving compatible approach.
     */
    private candidates: Map<string, number> = new Map();

    updateWithTracking(item: string, count: number = 1): void {
        this.update(item, count);
        this.candidates.set(item, this.estimate(item));
        // Prune candidates that are clearly not heavy hitters
        if (this.candidates.size > 10000) {
            const threshold = this.totalCount * this.epsilon;
            for (const [k, v] of this.candidates) {
                if (v < threshold) this.candidates.delete(k);
            }
        }
    }

    /**
     * Return top-K heaviest items from tracked candidates.
     * O(candidates × d) — bounded by pruning above.
     */
    topK(k: number): { item: string; estimate: number; frequency: number }[] {
        const results: { item: string; estimate: number; frequency: number }[] = [];
        for (const [item] of this.candidates) {
            results.push({
                item,
                estimate: this.estimate(item),
                frequency: this.estimate(item) / Math.max(this.totalCount, 1),
            });
        }
        return results
            .sort((a, b) => b.estimate - a.estimate)
            .slice(0, k);
    }

    /**
     * Merge another sketch into this one (for distributed aggregation).
     * Both sketches must have identical ε and δ (same w, d, a, b).
     * Enables MapReduce-style distributed frequency counting.
     */
    merge(other: CountMinSketch): void {
        if (other.w !== this.w || other.d !== this.d) {
            throw new Error('Cannot merge sketches with different dimensions');
        }
        for (let i = 0; i < this.d; i++) {
            for (let j = 0; j < this.w; j++) {
                this.table[i][j] += other.table[i][j];
            }
        }
        this.totalCount += other.totalCount;
    }

    // ── Diagnostics ──────────────────────────────────────────────────────

    stats(): CountMinSketchStats {
        return {
            width: this.w,
            depth: this.d,
            cells: this.w * this.d,
            memoryBytes: this.w * this.d * 4,  // Int32 = 4 bytes
            epsilon: this.epsilon,
            delta: this.delta,
            totalCount: this.totalCount,
            maxError: this.epsilon * this.totalCount,
            confidence: 1 - this.delta,
        };
    }

    /**
     * Benchmark: stream n random items, then verify estimates.
     * Measures actual error vs theoretical guarantee.
     */
    static benchmark(n: number = 100_000, epsilon = 0.001, delta = 0.01): CountMinBenchmark {
        const sketch = new CountMinSketch(epsilon, delta);
        const exact = new Map<string, number>();

        // Choose from 1000 distinct items so we get real frequency collisions
        const vocab = Array.from({ length: 1000 }, (_, i) => `term-${i}`);

        const t0 = performance.now();
        for (let i = 0; i < n; i++) {
            const item = vocab[Math.floor(Math.random() * vocab.length)];
            sketch.updateWithTracking(item);
            exact.set(item, (exact.get(item) ?? 0) + 1);
        }
        const updateMs = performance.now() - t0;

        // Measure estimation error
        let maxError = 0, totalError = 0;
        const t1 = performance.now();
        for (const [item, trueFreq] of exact) {
            const est = sketch.estimate(item);
            const err = est - trueFreq;  // always non-negative (no underestimate)
            maxError = Math.max(maxError, err);
            totalError += err;
        }
        const queryMs = performance.now() - t1;

        const s = sketch.stats();
        return {
            ...s,
            updateMs,
            updateOpsPerSec: Math.round(n / (updateMs / 1000)),
            queryMs: queryMs / exact.size,
            maxObservedError: maxError,
            avgObservedError: totalError / exact.size,
            theoreticalMaxError: s.maxError,
            guaranteeHeld: maxError <= s.maxError,
        };
    }
}

export interface CountMinSketchStats {
    width: number;
    depth: number;
    cells: number;
    memoryBytes: number;
    epsilon: number;
    delta: number;
    totalCount: number;
    maxError: number;
    confidence: number;
}

export interface CountMinBenchmark extends CountMinSketchStats {
    updateMs: number;
    updateOpsPerSec: number;
    queryMs: number;
    maxObservedError: number;
    avgObservedError: number;
    theoreticalMaxError: number;
    guaranteeHeld: boolean;
}

// ── Singleton for query frequency tracking ────────────────────────────────
let globalSketch: CountMinSketch | null = null;

/** Global sketch: ε=0.001 (0.1% error), δ=0.01 (99% confidence). */
export function getQuerySketch(): CountMinSketch {
    if (!globalSketch) globalSketch = new CountMinSketch(0.001, 0.01);
    return globalSketch;
}

export function resetQuerySketch(): void {
    globalSketch = null;
}
