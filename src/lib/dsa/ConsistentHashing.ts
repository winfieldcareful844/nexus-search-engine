/**
 * Consistent Hashing Ring
 * 
 * WHAT IT SOLVES:
 *   In a distributed crawler/DB, if we partition URLs across N workers using `hash(url) % N`,
 *   what happens if a worker crashes or we scale up to N+1?
 *   The modulo formula completely changes. A massive "remapping storm" occurs where 90%
 *   of existing keys must be moved to new workers.
 * 
 * THE SOLUTION (Consistent Hashing):
 *   Map both the nodes (workers) AND the keys onto the same circular ring [0, 2^32-1].
 *   A key is routed to the first node whose hash is greater than or equal to the key's hash.
 *   If a node is added/removed, only the keys mapped directly to it are affected (1/N of keys).
 * 
 * VIRTUAL NODES (VNodes):
 *   To prevent unbalanced assignment (where one node takes a massive chunk of the ring if nodes
 *   are spaced poorly), we assign every real node multiple "Virtual Nodes" on the ring.
 * 
 * REAL-WORLD USAGE:
 *   - DynamoDB, Cassandra data partitioning
 *   - Memcached / Redis cluster routing
 *   - CDN request routing
 *   
 * Time:  O(log(V)) where V is the total number of Virtual Nodes.
 * Space: O(V) array.
 */

export class ConsistentHashing {
    // Array of { hash, nodeName } sorted by hash
    private ring: { hash: number; node: string }[] = [];
    private nodes = new Set<string>();
    
    /**
     * @param replicas Number of virtual nodes per physical node
     */
    constructor(private replicas: number = 100) {}

    // FNV-1a Hash (32-bit)
    private hash(str: string): number {
        let h = 0x811c9dc5;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = (h * 16777619) >>> 0;
        }
        return h >>> 0;
    }

    addNode(node: string): void {
        if (this.nodes.has(node)) return;
        this.nodes.add(node);

        // Add virtual nodes
        for (let i = 0; i < this.replicas; i++) {
            const vnodeHash = this.hash(`${node}-vnode-${i}`);
            this.ring.push({ hash: vnodeHash, node });
        }

        // Keep the ring sorted (essential for binary search routing)
        this.ring.sort((a, b) => a.hash - b.hash);
    }

    removeNode(node: string): void {
        if (!this.nodes.has(node)) return;
        this.nodes.delete(node);
        // Filter out all vnodes representing this physical node
        this.ring = this.ring.filter(n => n.node !== node);
    }

    /**
     * O(log V) binary search to find the correct node for a given key.
     */
    getNode(key: string): string | null {
        if (this.ring.length === 0) return null;

        const h = this.hash(key);
        
        let left = 0;
        let right = this.ring.length - 1;
        let idx = -1;

        // Binary search for first element with hash >= h
        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            if (this.ring[mid].hash >= h) {
                idx = mid;
                right = mid - 1;
            } else {
                left = mid + 1;
            }
        }

        // If no node has a hash >= h, it wraps around to the first node
        if (idx === -1) {
            return this.ring[0].node;
        }

        return this.ring[idx].node;
    }

    getNodes(): string[] {
        return Array.from(this.nodes);
    }
}
