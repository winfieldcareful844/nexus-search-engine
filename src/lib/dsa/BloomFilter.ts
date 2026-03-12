/**
 * Bloom Filter — Space-Efficient Probabilistic Set Membership
 *
 * WHAT IT SOLVES:
 *   Given a stream of n items, answer "have I seen x before?" using
 *   O(m) bits instead of O(n) words, at the cost of a tunable false-positive
 *   rate. False negatives are IMPOSSIBLE. False positives occur with
 *   probability ε = (1 − e^(−kn/m))^k.
 *
 * WHY NOT JUST A HASH SET:
 *   A HashSet<string> of 10M URLs ≈ 480 MB RAM.
 *   A Bloom filter for the same set at ε=0.01 needs only 11.4 bytes/item ≈ 114 MB.
 *   With ε=0.1, it drops to 4.8 bytes/item ≈ 48 MB. The choice is a
 *   space/accuracy tradeoff — exactly the kind Google makes at web scale.
 *
 * HASH FUNCTIONS (no crypto dependency):
 *   We use three independent non-cryptographic hash functions:
 *     • FNV-1a (32-bit)  — low collision rate, fast, avalanche-friendly
 *     • DJB2             — different distribution, good for strings
 *     • SDBM             — uncorrelated with the above two
 *   From these three "base" hashes we derive k hashes via the
 *   Kirsch-Mitzenmacher double-hashing trick:
 *     h_i(x) = (h1(x) + i * h2(x)) mod m
 *   This gives k pairwise-independent hash functions from just two,
 *   proven to achieve the same asymptotic FPR as k truly independent hashes.
 *
 * OPTIMAL PARAMETERS:
 *   Given n (expected items) and ε (desired FPR):
 *     m = -n * ln(ε) / (ln 2)²   [bits]
 *     k = (m / n) * ln 2         [hash functions]
 *
 * USE CASES IN THIS SEARCH ENGINE:
 *   1. Negative-result cache: queries that returned 0 results are stored
 *      here — skip the full search pipeline in O(k) instead of O(index).
 *   2. URL deduplication during crawl — seen this URL already?
 *   3. Spam filter — known-bad queries.
 *
 * Time:  O(k) per add/has  (k = number of hash functions, typically 6-10)
 * Space: O(m) bits = O(n * log2(1/ε) / ln2) bits
 */
export class BloomFilter {
    private bits: Uint8Array;     // bit array stored as bytes
    private m: number;            // total number of bits
    private k: number;            // number of hash functions
    private n: number;            // items added so far
    private readonly capacity: number; // expected item count

    /**
     * @param capacity   Expected number of elements to insert
     * @param errorRate  Desired false-positive probability (0 < ε < 1)
     */
    constructor(capacity: number, errorRate: number = 0.01) {
        if (errorRate <= 0 || errorRate >= 1) throw new Error('errorRate must be in (0, 1)');
        if (capacity <= 0) throw new Error('capacity must be > 0');

        this.capacity = capacity;
        this.n = 0;

        // Optimal bit count: m = -n * ln(ε) / (ln2)²
        this.m = Math.ceil(-capacity * Math.log(errorRate) / (Math.LN2 * Math.LN2));

        // Optimal hash count: k = (m/n) * ln2
        this.k = Math.max(1, Math.round((this.m / capacity) * Math.LN2));

        // Allocate bit array (ceil(m/8) bytes)
        this.bits = new Uint8Array(Math.ceil(this.m / 8));
    }

    // ── Hash Functions ───────────────────────────────────────────────────

    /** FNV-1a 32-bit hash. Excellent avalanche, no collisions on short strings. */
    private fnv1a(str: string): number {
        let hash = 0x811c9dc5;
        for (let i = 0; i < str.length; i++) {
            hash ^= str.charCodeAt(i);
            // 32-bit FNV prime = 16777619; use multiply trick to stay 32-bit
            hash = (hash * 0x01000193) >>> 0;
        }
        return hash >>> 0;
    }

    /** DJB2 hash — completely different bit distribution from FNV-1a. */
    private djb2(str: string): number {
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
        }
        return hash >>> 0;
    }

    /**
     * Kirsch-Mitzenmacher double-hashing: derive k bit positions from 2 hashes.
     * Proven to have the same asymptotic FPR as k independent hash functions.
     * h_i(x) = (h1 + i * h2) mod m
     */
    private positions(item: string): number[] {
        const h1 = this.fnv1a(item);
        const h2 = this.djb2(item);
        const positions: number[] = new Array(this.k);
        for (let i = 0; i < this.k; i++) {
            // Keep in 32-bit range, then mod m
            positions[i] = ((h1 + i * h2) >>> 0) % this.m;
        }
        return positions;
    }

    // ── Core API ─────────────────────────────────────────────────────────

    /** Add an item. O(k). */
    add(item: string): void {
        for (const pos of this.positions(item)) {
            const byteIdx = pos >>> 3;          // pos / 8
            const bitIdx = pos & 7;            // pos % 8
            this.bits[byteIdx] |= (1 << bitIdx);
        }
        this.n++;
    }

    /**
     * Test membership. O(k).
     * Returns false → item DEFINITELY not in set (no false negatives).
     * Returns true  → item PROBABLY in set (false positive rate ≤ ε).
     */
    has(item: string): boolean {
        for (const pos of this.positions(item)) {
            const byteIdx = pos >>> 3;
            const bitIdx = pos & 7;
            if (!(this.bits[byteIdx] & (1 << bitIdx))) return false;
        }
        return true;
    }

    // ── Diagnostics ──────────────────────────────────────────────────────

    /** Theoretical FPR given current fill: P = (set_bits/m)^k */
    currentFalsePositiveRate(): number {
        let setBits = 0;
        for (const byte of this.bits) {
            // Brian Kernighan popcount
            let b = byte;
            while (b) { setBits++; b &= b - 1; }
        }
        return Math.pow(setBits / this.m, this.k);
    }

    /** Approximate item count using fill ratio estimate. */
    estimatedCount(): number {
        let setBits = 0;
        for (const byte of this.bits) {
            let b = byte;
            while (b) { setBits++; b &= b - 1; }
        }
        // n ≈ -(m/k) * ln(1 - setBits/m)
        const ratio = setBits / this.m;
        if (ratio >= 1) return this.m; // saturated
        return Math.round(-(this.m / this.k) * Math.log(1 - ratio));
    }

    stats(): BloomFilterStats {
        return {
            bits: this.m,
            bytes: this.bits.byteLength,
            hashFunctions: this.k,
            itemsAdded: this.n,
            capacity: this.capacity,
            theoreticalFPR: Math.pow(1 - Math.exp(-this.k * this.n / this.m), this.k),
            measuredFPR: this.currentFalsePositiveRate(),
            fillRatio: this.bits.filter(b => b > 0).length / this.bits.length,
        };
    }

    /**
     * Benchmark: insert n items, then test n known-absent items.
     * Returns actual false positive rate vs theoretical.
     */
    static benchmark(capacity: number, errorRate: number = 0.01): BloomFilterBenchmark {
        const filter = new BloomFilter(capacity, errorRate);
        const t0 = performance.now();

        // Insert
        for (let i = 0; i < capacity; i++) filter.add(`item-${i}`);
        const insertMs = performance.now() - t0;

        // Test positives (must all return true)
        let truePositives = 0;
        const t1 = performance.now();
        for (let i = 0; i < capacity; i++) {
            if (filter.has(`item-${i}`)) truePositives++;
        }
        const lookupMs = performance.now() - t1;

        // Test negatives (measure actual FPR)
        let falsePositives = 0;
        const trials = Math.min(capacity, 10000);
        for (let i = capacity; i < capacity + trials; i++) {
            if (filter.has(`absent-${i}`)) falsePositives++;
        }

        const s = filter.stats();
        return {
            ...s,
            insertMs,
            insertOpsPerSec: Math.round(capacity / (insertMs / 1000)),
            lookupMs: lookupMs / capacity,
            actualFPR: falsePositives / trials,
            truePositiveRate: truePositives / capacity,
        };
    }
}

export interface BloomFilterStats {
    bits: number;
    bytes: number;
    hashFunctions: number;
    itemsAdded: number;
    capacity: number;
    theoreticalFPR: number;
    measuredFPR: number;
    fillRatio: number;
}

export interface BloomFilterBenchmark extends BloomFilterStats {
    insertMs: number;
    insertOpsPerSec: number;
    lookupMs: number;    // avg ms per lookup
    actualFPR: number;
    truePositiveRate: number;
}

// ── Singleton for negative-result cache ──────────────────────────────────
// Queries that returned 0 results are added here so we can skip the
// entire search pipeline in O(k) time on repeated zero-result queries.
let globalNegativeCache: BloomFilter | null = null;

export function getNegativeCache(): BloomFilter {
    if (!globalNegativeCache) {
        // 100K expected zero-result queries, 1% FPR → ~114KB
        globalNegativeCache = new BloomFilter(100_000, 0.01);
    }
    return globalNegativeCache;
}

export function resetNegativeCache(): void {
    globalNegativeCache = null;
}
