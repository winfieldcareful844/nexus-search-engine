/**
 * HyperLogLog (HLL) — O(1) Space Cardinality Estimation
 * 
 * WHAT IT SOLVES:
 *   How do you count the number of UNIQUE elements in a stream of 10 billion events?
 *   A HashSet of IPs/URLs requires gigabytes of RAM.
 *   HyperLogLog estimates the unique count using only a few kilobytes, with typically ~2% error.
 * 
 * HOW IT WORKS (Flajolet et al., 2007):
 *   1. Hash the incoming item into a uniform 32-bit (or 64-bit) integer.
 *   2. Use the first 'p' bits of the hash to pick a register (bucket).
 *      Number of registers m = 2^p.
 *   3. Look at the remaining bits: count the number of leading zeros (let's call it 'z').
 *   4. Store Math.max(z + 1, current_register_val) in that register.
 *   5. The intuition: observing a hash starting with k consecutive zeros is a 1-in-2^k event.
 *      If the max leading zeros seen in a bucket is 5, we guess ~2^5 items hashed to it.
 *   6. Aggregate all 'm' registers using the Harmonic Mean to eliminate outlier bias.
 * 
 * REAL-WORLD USAGE:
 *   - Redis `PFADD` / `PFCOUNT` (uses 12KB to count up to 2^64 items with 0.81% error).
 *   - Used here to quickly estimate "How many unique URLs have our distributed crawlers seen?"
 */

export class HyperLogLog {
    private readonly p: number; // precision bits
    private readonly m: number; // number of registers (2^p)
    private readonly registers: Uint8Array;
    private readonly alpha: number;

    /**
     * @param p Precision (bits used for bucketing).
     *          Using p=14 → m=16384 registers → ~16KB of space, ~1.04% error.
     *          Using p=10 → m=1024 registers → ~1KB of space, ~3.25% error.
     */
    constructor(p: number = 10) {
        if (p < 4 || p > 16) throw new Error("Precision p must be between 4 and 16");
        this.p = p;
        this.m = 1 << p;
        this.registers = new Uint8Array(this.m);

        // Correction constant based on 'm'
        if (this.m === 16) {
            this.alpha = 0.673;
        } else if (this.m === 32) {
            this.alpha = 0.697;
        } else if (this.m === 64) {
            this.alpha = 0.709;
        } else {
            this.alpha = 0.7213 / (1 + 1.079 / this.m);
        }
    }

    // FNV-1a Hash (32-bit)
    private hash(item: string): number {
        let h = 0x811c9dc5;
        for (let i = 0; i < item.length; i++) {
            h ^= item.charCodeAt(i);
            h = (h * 16777619) >>> 0;
        }
        return h >>> 0;
    }

    add(item: string): void {
        const x = this.hash(item);
        
        // Use first 'p' bits for the register index
        const index = x >>> (32 - this.p);
        
        // The remaining bits used to find leading zeros
        // We isolate the bottom (32-p) bits. To avoid MSB issues, we shift left.
        const w = (x << this.p) >>> 0; 
        
        // Count leading zeros. Math.clz32 is hardware-accelerated.
        const zeros = Math.clz32(w);
        
        // Rank = leading zeros + 1 (limited by remaining bits)
        // If w is 0 (all remaining bits are 0), rank is max possible
        const rank = w === 0 ? (32 - this.p + 1) : zeros + 1;

        // Keep the maximum rank
        if (rank > this.registers[index]) {
            this.registers[index] = rank;
        }
    }

    estimate(): number {
        let sum = 0;
        let zeroRegisters = 0;

        // Harmonic mean of (2^register_val)
        for (let i = 0; i < this.m; i++) {
            const val = this.registers[i];
            sum += 1.0 / (1 << val); // 2^(-val)
            if (val === 0) zeroRegisters++;
        }

        let e = (this.alpha * this.m * this.m) / sum;

        // Linear Counting correction for small counts
        if (e <= (5.0 / 2.0) * this.m) {
            if (zeroRegisters > 0) {
                e = this.m * Math.log(this.m / zeroRegisters);
            }
        }
        // (Large range correction omitted here for simplicity; 32-bit hash limits to 2^32 anyway)

        return Math.round(e);
    }

    stats() {
        return {
            precisionBits: this.p,
            registers: this.m,
            memoryBytes: this.m,
            theoreticalErrorRatio: 1.04 / Math.sqrt(this.m),
            currentEstimate: this.estimate()
        };
    }
}
