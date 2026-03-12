/**
 * Skip List — Probabilistic Sorted Data Structure
 *
 * WHAT IT SOLVES:
 *   A sorted container with O(log n) expected time for search, insert,
 *   and delete — without the complexity of balancing (AVL, Red-Black trees).
 *   Achieves balance probabilistically via randomized "levels".
 *
 * WHY NOT BINARY SEARCH ON A SORTED ARRAY:
 *   Sorted array: O(log n) search, O(n) insert (shift elements), O(n) delete.
 *   Skip list:    O(log n) search, O(log n) insert,  O(log n) delete.
 *   BST (unbal):  O(n) worst case — degenerates on sorted input.
 *   Skip list vs. AVL/RB tree: same O(log n) guarantees but simpler to implement
 *   correctly for concurrent use (key insight for DB engineers).
 *
 * THE STRUCTURE:
 *   Multiple linked lists at increasing "express lane" levels.
 *   Level 0 = full sorted list of all elements.
 *   Level k = every element promoted from level k-1 with probability p=0.5.
 *   Expected levels = log_{1/p}(n) = log2(n).
 *
 *   Search: Start at top level, go right until overshoot, drop level.
 *           Expected comparisons: (log_{1/p}(n)) / p ≈ 2 log2(n).
 *
 * REAL-WORLD USAGE:
 *   • Redis ZSET (sorted sets) is implemented as a skip list + hash map
 *   • LevelDB / RocksDB memtable uses a lock-free skip list
 *   • CockroachDB MVCC layer uses skip lists for in-memory keys
 *
 * THIS IMPLEMENTATION:
 *   Generic key-value skip list with configurable max levels.
 *   Additional methods for range queries — critical for posting list ranges.
 *
 * Time:  O(log n) expected for search, insert, delete
 * Space: O(n log n) expected (each element appears in ~2 levels on average)
 */
export class SkipList<K, V> {
    private head: SkipNode<K, V>;
    private readonly maxLevel: number;
    private readonly probability: number;   // promotion probability per level
    private level: number;                  // current highest non-empty level
    private size: number;
    private readonly compare: (a: K, b: K) => number;

    /**
     * @param maxLevel   Maximum number of levels (default: 16 → supports 2^16 = 65536 items)
     * @param probability  Promotion probability (default: 0.5 → expected O(log2 n) levels)
     * @param compare    Comparator: negative if a < b, 0 if equal, positive if a > b
     */
    constructor(
        maxLevel: number = 16,
        probability: number = 0.5,
        compare: (a: K, b: K) => number = (a, b) => (a < b ? -1 : a > b ? 1 : 0)
    ) {
        this.maxLevel = maxLevel;
        this.probability = probability;
        this.compare = compare;
        this.level = 0;
        this.size = 0;

        // Sentinel head node with -Infinity key (never compared to real keys)
        this.head = this.createNode(null as unknown as K, null as unknown as V, maxLevel);
    }

    private createNode(key: K, value: V, level: number): SkipNode<K, V> {
        return {
            key,
            value,
            forward: new Array(level + 1).fill(null),
        };
    }

    /**
     * Coin-flip level generator.
     * P(level ≥ k) = p^k → geometric distribution.
     * Expected max level for n items ≈ log_{1/p}(n).
     */
    private randomLevel(): number {
        let lvl = 0;
        while (Math.random() < this.probability && lvl < this.maxLevel - 1) {
            lvl++;
        }
        return lvl;
    }

    // ── Core API ─────────────────────────────────────────────────────────

    /**
     * Insert key-value pair. O(log n) expected.
     *
     * Algorithm:
     *   1. Find update[] — rightmost nodes at each level whose next key < key
     *   2. Pick a random level for new node
     *   3. Splice the new node in at each appropriate level
     */
    insert(key: K, value: V): void {
        const update: SkipNode<K, V>[] = new Array(this.maxLevel).fill(null);
        let current = this.head;

        // Traverse from highest level down
        for (let i = this.level; i >= 0; i--) {
            while (current.forward[i] !== null &&
                this.compare(current.forward[i]!.key, key) < 0) {
                current = current.forward[i]!;
            }
            update[i] = current;
        }

        current = current.forward[0]!;

        // If key exists, update value (skip list is map-like)
        if (current !== null && this.compare(current.key, key) === 0) {
            current.value = value;
            return;
        }

        // New node
        const newLevel = this.randomLevel();

        // Extend current level if new node goes higher
        if (newLevel > this.level) {
            for (let i = this.level + 1; i <= newLevel; i++) {
                update[i] = this.head;
            }
            this.level = newLevel;
        }

        const newNode = this.createNode(key, value, newLevel);

        // Splice in
        for (let i = 0; i <= newLevel; i++) {
            newNode.forward[i] = update[i].forward[i];
            update[i].forward[i] = newNode;
        }

        this.size++;
    }

    /**
     * Search for exact key. O(log n) expected.
     * Returns undefined if not found.
     */
    search(key: K): V | undefined {
        let current = this.head;

        for (let i = this.level; i >= 0; i--) {
            while (current.forward[i] !== null &&
                this.compare(current.forward[i]!.key, key) < 0) {
                current = current.forward[i]!;
            }
        }

        current = current.forward[0]!;
        if (current !== null && this.compare(current.key, key) === 0) {
            return current.value;
        }
        return undefined;
    }

    /**
     * Delete a key. O(log n) expected.
     * Returns true if the key existed and was removed.
     */
    delete(key: K): boolean {
        const update: SkipNode<K, V>[] = new Array(this.maxLevel).fill(null);
        let current = this.head;

        for (let i = this.level; i >= 0; i--) {
            while (current.forward[i] !== null &&
                this.compare(current.forward[i]!.key, key) < 0) {
                current = current.forward[i]!;
            }
            update[i] = current;
        }

        current = current.forward[0]!;

        if (current === null || this.compare(current.key, key) !== 0) {
            return false; // not found
        }

        for (let i = 0; i <= this.level; i++) {
            if (update[i].forward[i] !== current) break;
            update[i].forward[i] = current.forward[i];
        }

        // Shrink level if top levels are now empty
        while (this.level > 0 && this.head.forward[this.level] === null) {
            this.level--;
        }

        this.size--;
        return true;
    }

    /**
     * Range query: return all [key, value] pairs where lo ≤ key ≤ hi.
     * O(log n + k) where k = number of results. Core to posting list range queries.
     */
    range(lo: K, hi: K): { key: K; value: V }[] {
        const results: { key: K; value: V }[] = [];
        let current = this.head;

        // Skip to first key ≥ lo using upper levels
        for (let i = this.level; i >= 0; i--) {
            while (current.forward[i] !== null &&
                this.compare(current.forward[i]!.key, lo) < 0) {
                current = current.forward[i]!;
            }
        }

        // Traverse level 0 from lo to hi
        current = current.forward[0]!;
        while (current !== null && this.compare(current.key, hi) <= 0) {
            results.push({ key: current.key, value: current.value });
            current = current.forward[0]!;
        }

        return results;
    }

    /** In-order traversal: all elements sorted. O(n). */
    toSortedArray(): { key: K; value: V }[] {
        const result: { key: K; value: V }[] = [];
        let current = this.head.forward[0];
        while (current !== null) {
            result.push({ key: current.key, value: current.value });
            current = current.forward[0];
        }
        return result;
    }

    getSize(): number { return this.size; }
    getLevel(): number { return this.level; }

    /**
     * Internal structure for debugging / visualization — returns the
     * "tower heights" distribution, which should be geometric.
     */
    levelDistribution(): number[] {
        const dist: number[] = new Array(this.maxLevel).fill(0);
        let node = this.head.forward[0];
        while (node !== null) {
            dist[node.forward.length - 1]++;
            node = node.forward[0];
        }
        return dist;
    }

    /**
     * Benchmark: insert n sorted items (worst case for many structures),
     * then search n items, then delete n/2 items.
     */
    static benchmark(n: number = 100_000): SkipListBenchmark {
        const sl = new SkipList<number, string>();

        // Insert sorted (BST killer — skip list handles this fine)
        const t0 = performance.now();
        for (let i = 0; i < n; i++) sl.insert(i, `value-${i}`);
        const insertMs = performance.now() - t0;

        // Search
        const t1 = performance.now();
        let hits = 0;
        for (let i = 0; i < n; i++) if (sl.search(i) !== undefined) hits++;
        const searchMs = performance.now() - t1;

        // Range query (middle 10%)
        const t2 = performance.now();
        const rangeResults = sl.range(Math.floor(n * 0.45), Math.floor(n * 0.55));
        const rangeMs = performance.now() - t2;

        // Delete
        const t3 = performance.now();
        for (let i = 0; i < n; i += 2) sl.delete(i);
        const deleteMs = performance.now() - t3;

        return {
            n,
            levels: sl.getLevel() + 1,
            levelDistribution: sl.levelDistribution(),
            insertMs,
            insertOpsPerSec: Math.round(n / (insertMs / 1000)),
            searchMs: searchMs / n,
            rangeResults: rangeResults.length,
            rangeMs,
            deleteMs,
            deleteOpsPerSec: Math.round((n / 2) / (deleteMs / 1000)),
            remainingSize: sl.getSize(),
        };
    }
}

interface SkipNode<K, V> {
    key: K;
    value: V;
    forward: (SkipNode<K, V> | null)[];
}

export interface SkipListBenchmark {
    n: number;
    levels: number;
    levelDistribution: number[];
    insertMs: number;
    insertOpsPerSec: number;
    searchMs: number;
    rangeResults: number;
    rangeMs: number;
    deleteMs: number;
    deleteOpsPerSec: number;
    remainingSize: number;
}
