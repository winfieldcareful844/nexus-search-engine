import { CountMinSketch } from './CountMinSketch';

/**
 * Window Tiny LFU (W-TinyLFU)
 * 
 * WHAT IT SOLVES:
 *   Standard LRU suffers from "scan resistance". A large sequential read (e.g., a DB scan)
 *   will evict all frequently accessed "hot" items with items that are only read once.
 *   LFU (Least Frequently Used) solves this but requires O(N) memory for counters.
 * 
 * THE SOLUTION (Used in Java's Caffeine Cache):
 *   Combines LRU for recency and a Count-Min Sketch (TinyLFU) for frequency.
 *   
 * ARCHITECTURE:
 *   1. Window Cache (1% size): Pure LRU. Absorbs bursts of new items so they get a chance
 *      to build up frequency before being judged.
 *   2. Main Cache (99% size):
 *      - Probation Segment (20% of Main): LRU. Candidates evicted from Window try to enter here.
 *      - Protected Segment (80% of Main): LRU. Items accessed while in Probation are promoted here.
 * 
 * ADMISSION CONTROL:
 *   When Window Cache evicts an item, it becomes a candidate for the Main Cache.
 *   If the Main Cache is full, the candidate's frequency is compared against the
 *   victim's (the LRU item in Probation). ONLY if candidate frequency > victim frequency
 *   is the candidate admitted.
 */

// Simple LRU backed by JS Map (which preserves insertion order)
class MapLRU<K, V> {
    public map = new Map<K, V>();
    constructor(public capacity: number) {}

    get(key: K): V | undefined {
        if (!this.map.has(key)) return undefined;
        const val = this.map.get(key)!;
        // Move to most-recently-used (end of map)
        this.map.delete(key);
        this.map.set(key, val);
        return val;
    }

    /** 
     * Puts an item, returns the evicted item if capacity was exceeded.
     */
    put(key: K, value: V): { evictedKey?: K, evictedValue?: V } {
        if (this.map.has(key)) {
            this.map.delete(key);
            this.map.set(key, value);
            return {};
        }
        
        this.map.set(key, value);
        
        if (this.map.size > this.capacity) {
            // Evict least-recently-used (first item in map)
            const first = this.map.entries().next().value;
            if (first) {
                this.map.delete(first[0]);
                return { evictedKey: first[0], evictedValue: first[1] };
            }
        }
        return {};
    }

    delete(key: K) {
        this.map.delete(key);
    }
    
    has(key: K) { return this.map.has(key); }
    size() { return this.map.size; }
    
    // Returns the lowest priority key without modifying the cache
    getVictimKey(): K | undefined {
        if (this.map.size === 0) return undefined;
        return this.map.keys().next().value;
    }
}

export class WTinyLFUCache<K extends string = string, V = string> {
    private windowCache: MapLRU<K, V>;
    private probationCache: MapLRU<K, V>;
    private protectedCache: MapLRU<K, V>;
    
    // Use the existing sketch technique to estimate frequency. 
    // In Caffeine, this resides directly in the cache.
    private sketch: CountMinSketch;
    
    private hits = 0;
    private misses = 0;

    constructor(totalCapacity: number) {
        // Window = 1%, Probation = ~20%, Protected = ~79%
        const windowCap = Math.max(1, Math.floor(totalCapacity * 0.01));
        const mainCap = totalCapacity - windowCap;
        const probationCap = Math.max(1, Math.floor(mainCap * 0.2));
        const protectedCap = Math.max(1, mainCap - probationCap);

        this.windowCache = new MapLRU(windowCap);
        this.probationCache = new MapLRU(probationCap);
        this.protectedCache = new MapLRU(protectedCap);

        // 1% error bounded Sketch
        this.sketch = new CountMinSketch(0.01, 0.01);
    }

    get(key: K): V | undefined {
        this.sketch.update(key); // Record access frequency

        // Check Window Cache
        let val = this.windowCache.get(key);
        if (val !== undefined) {
            this.hits++;
            return val;
        }

        // Check Protected Cache
        val = this.protectedCache.get(key);
        if (val !== undefined) {
            this.hits++;
            return val;
        }

        // Check Probation Cache
        val = this.probationCache.get(key);
        if (val !== undefined) {
            this.hits++;
            // Hit in Probation triggers PROMOTION to Protected!
            this.probationCache.delete(key);
            const { evictedKey, evictedValue } = this.protectedCache.put(key, val);
            
            // If Protected was full, its evicted item drops back to Probation
            if (evictedKey !== undefined && evictedValue !== undefined) {
                this.probationCache.put(evictedKey, evictedValue);
            }
            return val;
        }

        this.misses++;
        return undefined;
    }

    put(key: K, value: V): void {
        this.sketch.update(key);

        // Update if exists anywhere (without triggering promotion logic)
        if (this.windowCache.has(key)) { this.windowCache.put(key, value); return; }
        if (this.protectedCache.has(key)) { this.protectedCache.put(key, value); return; }
        if (this.probationCache.has(key)) { this.probationCache.put(key, value); return; }

        // New Item -> Always enters Window Cache first
        const windowEvict = this.windowCache.put(key, value);

        if (windowEvict.evictedKey !== undefined && windowEvict.evictedValue !== undefined) {
            this.admitToMain(windowEvict.evictedKey, windowEvict.evictedValue);
        }
    }

    /**
     * TinyLFU Admission Policy
     * Decides if a candidate from the Window Cache deserves to enter the Main Cache
     */
    private admitToMain(candidateKey: K, candidateValue: V): void {
        // If probation isn't full, accept immediately
        if (this.probationCache.size() < this.probationCache.capacity) {
            this.probationCache.put(candidateKey, candidateValue);
            return;
        }

        // Probation is full. Must decide between Candidate and the Victim (Probation's LRU)
        const victimKey = this.probationCache.getVictimKey();
        if (!victimKey) return; // Should not happen 

        const candidateFreq = this.sketch.estimate(candidateKey);
        const victimFreq = this.sketch.estimate(victimKey);

        if (candidateFreq > victimFreq) {
            // Admission accepts Candidate! Victim is destroyed.
            this.probationCache.put(candidateKey, candidateValue);
        } 
        // Else: Admission rejects Candidate. It dies, Victim survives.
    }

    getStats() {
        const totalReq = this.hits + this.misses;
        return {
            hits: this.hits,
            misses: this.misses,
            hitRate: totalReq === 0 ? 0 : this.hits / totalReq,
            windowSize: this.windowCache.size(),
            probationSize: this.probationCache.size(),
            protectedSize: this.protectedCache.size()
        };
    }
}

// Global Singleton
let globalWTinyLFU: WTinyLFUCache | null = null;

export function getGlobalWTinyLFU(capacity: number = 1000): WTinyLFUCache {
    if (!globalWTinyLFU) {
        globalWTinyLFU = new WTinyLFUCache(capacity);
    }
    return globalWTinyLFU;
}

export function resetGlobalWTinyLFU(): void {
    globalWTinyLFU = null;
}
