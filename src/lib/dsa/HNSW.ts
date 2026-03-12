/**
 * Hierarchical Navigable Small World (HNSW) Graph
 * 
 * WHAT IT SOLVES:
 *   Standard inverted indexes (like BM25) only match exact keywords.
 *   "Vector Search" allows semantic matching (e.g., "fast vehicle" matches "sports car").
 *   However, finding the EXACT closest vector in high dimensions (e.g. 384D) requires
 *   O(N) operations (comparing query to every single document).
 *   HNSW is the industry-standard algorithm for Approximate Nearest Neighbor (ANN)
 *   search, achieving O(log N) search time with massive scale.
 * 
 * HOW IT WORKS:
 *   It builds a multi-layered proximity graph.
 *   - Layer 0 (Bottom): Contains all nodes, densely connected to nearest neighbors.
 *   - Layer 1, 2, ... : Progressively fewer nodes (like express lanes on a highway).
 *   
 *   Search Algorithm:
 *   1. Drop into the top layer.
 *   2. Greedy routing: Move to the neighbor closest to the query until local minimum.
 *   3. Drop down to the next layer and repeat.
 *   4. At Layer 0, do a slightly wider search (beam search) and return top-K.
 * 
 * REAL-WORLD USAGE:
 *   - Pinecone, Milvus, Qdrant, Weaviate
 *   - PostgreSQL pgvector extension
 *   - FAISS (Facebook AI Similarity Search)
 * 
 * Time:  O(log N) search and insert
 * Space: O(N * M) where M is the max connections per node
 */

export type Vector = number[];

export interface HNSWNode {
    id: string;
    // The dense neural embedding vector
    vector: Vector;
    // Layer index -> Array of neighbor IDs
    neighbors: string[][];
    level: number;
}

export interface HNSWStats {
    totalNodes: number;
    maxLevel: number;
    levelDistribution: number[];
}

export class HNSW {
    private nodes = new Map<string, HNSWNode>();
    private entryPoint: string | null = null;
    private maxLevel: number = 0;

    // HNSW Tuning Parameters
    private M: number;                  // Max connections per node per layer
    private M0: number;                 // Max connections at layer 0 (usually 2*M)
    private efConstruction: number;     // Size of the dynamic candidate list during construction
    private mL: number;                 // Level generation multiplier (1 / ln(M))
    
    constructor(M = 16, efConstruction = 100) {
        this.M = M;
        this.M0 = M * 2;
        this.efConstruction = efConstruction;
        this.mL = 1 / Math.log(M);
    }

    /** Cosine Distance = 1 - Cosine Similarity (Lower is better/closer) */
    static cosineDistance(a: Vector, b: Vector): number {
        if (a.length !== b.length) throw new Error("Vector dimensions mismatch");
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        if (normA === 0 || normB === 0) return 1.0;
        const sim = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
        return 1.0 - sim;
    }

    private randomLevel(): number {
        const r = Math.random();
        // Probability of level l is scaled by mL
        return Math.floor(-Math.log(r) * this.mL);
    }

    /**
     * Search Layer: Greedy Beam Search
     * Finds the `ef` nearest nodes to the query vector starting from `entryPoints`
     */
    private searchLayer(query: Vector, entryPoints: string[], ef: number, layer: number): {id: string, dist: number}[] {
        const visited = new Set<string>();
        for (const ep of entryPoints) visited.add(ep);

        // Candidates to explore (min heap by distance)
        const candidates: {id: string, dist: number}[] = entryPoints.map(id => 
            ({ id, dist: HNSW.cosineDistance(query, this.nodes.get(id)!.vector) })
        );
        candidates.sort((a, b) => a.dist - b.dist);

        // Nearest neighbors found so far (max heap by distance, bounded by ef)
        const results = [...candidates];

        while (candidates.length > 0) {
            // Extract closest candidate
            const current = candidates.shift()!;
            const furthestResultDist = results[results.length - 1].dist;

            // Stop if the closest candidate is further than our furthest known result
            if (current.dist > furthestResultDist) break;

            const currentNode = this.nodes.get(current.id)!;
            const neighbors = currentNode.neighbors[layer] || [];

            for (const neighborId of neighbors) {
                if (!visited.has(neighborId)) {
                    visited.add(neighborId);
                    
                    const neighborNode = this.nodes.get(neighborId)!;
                    const dist = HNSW.cosineDistance(query, neighborNode.vector);

                    const maxResultDist = results.length < ef ? Infinity : results[results.length - 1].dist;

                    if (dist < maxResultDist || results.length < ef) {
                        candidates.push({ id: neighborId, dist });
                        candidates.sort((a, b) => a.dist - b.dist);

                        results.push({ id: neighborId, dist });
                        results.sort((a, b) => a.dist - b.dist);
                        
                        // Keep size bounded to ef
                        if (results.length > ef) {
                            results.pop(); // Remove largest
                        }
                    }
                }
            }
        }
        return results;
    }

    /**
     * Add a document vector to the HNSW Graph
     */
    add(id: string, vector: Vector): void {
        const level = this.randomLevel();
        const newNode: HNSWNode = { id, vector, neighbors: [], level };
        for (let i = 0; i <= level; i++) newNode.neighbors.push([]);
        
        this.nodes.set(id, newNode);

        if (!this.entryPoint) {
            this.entryPoint = id;
            this.maxLevel = level;
            return;
        }

        let currentEntry = this.entryPoint;
        let epDist = HNSW.cosineDistance(vector, this.nodes.get(currentEntry)!.vector);

        // Phase 1: From maxLevel down to new level + 1, do greedy search (ef=1) to find nearest entry
        for (let l = this.maxLevel; l > level; l--) {
            let changed = true;
            while (changed) {
                changed = false;
                const entryNode = this.nodes.get(currentEntry)!;
                const neighbors = entryNode.neighbors[l] || [];
                
                for (const neighborId of neighbors) {
                    const dist = HNSW.cosineDistance(vector, this.nodes.get(neighborId)!.vector);
                    if (dist < epDist) {
                        epDist = dist;
                        currentEntry = neighborId;
                        changed = true;
                    }
                }
            }
        }

        // Phase 2: From min(maxLevel, level) down to 0, connect neighbors
        let entryPoints = [currentEntry];
        const maxIterLevel = Math.min(this.maxLevel, level);

        for (let l = maxIterLevel; l >= 0; l--) {
            // Find efConstruction nearest neighbors
            const nearest = this.searchLayer(vector, entryPoints, this.efConstruction, l);
            entryPoints = nearest.map(n => n.id);
            
            // Connect to nearest M neighbors
            const M_max = l === 0 ? this.M0 : this.M;
            const linkCount = Math.min(nearest.length, this.M);
            
            for (let i = 0; i < linkCount; i++) {
                const neighborId = nearest[i].id;
                newNode.neighbors[l].push(neighborId);
                
                // Bidirectional link
                const neighborNode = this.nodes.get(neighborId)!;
                neighborNode.neighbors[l].push(id);
                
                // Shrink neighbor connections if they exceed M_max
                if (neighborNode.neighbors[l].length > M_max) {
                    // Simple logic: sort by distance to neighborNode, keep closest M_max
                    // (Real HNSW uses a complex heuristic here to maintain graph diversity,
                    // but simple distance sorting works well for demo scale)
                    const distances = neighborNode.neighbors[l].map(nid => ({
                        id: nid,
                        dist: HNSW.cosineDistance(neighborNode.vector, this.nodes.get(nid)!.vector)
                    }));
                    distances.sort((a, b) => a.dist - b.dist);
                    neighborNode.neighbors[l] = distances.slice(0, M_max).map(d => d.id);
                }
            }
        }

        // Update entry point if new node is higher
        if (level > this.maxLevel) {
            this.maxLevel = level;
            this.entryPoint = id;
        }
    }

    /**
     * Approximate Nearest Neighbor (ANN) search
     * @param query The query vector
     * @param k Number of results to return
     * @param ef Search queue size (higher = more accurate but slower)
     */
    search(query: Vector, k: number = 10, ef: number = 50): {id: string, score: number}[] {
        if (!this.entryPoint) return [];
        const trueEf = Math.max(ef, k);

        let currentEntry = this.entryPoint;
        let epDist = HNSW.cosineDistance(query, this.nodes.get(currentEntry)!.vector);

        // Drop down to layer 0 finding best entry point
        for (let l = this.maxLevel; l > 0; l--) {
            let changed = true;
            while (changed) {
                changed = false;
                const entryNode = this.nodes.get(currentEntry)!;
                const neighbors = entryNode.neighbors[l] || [];
                
                for (const neighborId of neighbors) {
                    const dist = HNSW.cosineDistance(query, this.nodes.get(neighborId)!.vector);
                    if (dist < epDist) {
                        epDist = dist;
                        currentEntry = neighborId;
                        changed = true;
                    }
                }
            }
        }

        // Search layer 0
        const nearest = this.searchLayer(query, [currentEntry], trueEf, 0);
        
        // Convert distance to a similarity score [0, 1] (Score = 1 - Distance)
        // Higher score indicates better semantic match
        return nearest.slice(0, k).map(n => ({
            id: n.id,
            score: 1.0 - n.dist // Cosine Similarity
        }));
    }

    stats(): HNSWStats {
        const distr = new Array(this.maxLevel + 1).fill(0);
        for (const node of this.nodes.values()) {
            distr[node.level]++;
        }
        return {
            totalNodes: this.nodes.size,
            maxLevel: this.maxLevel,
            levelDistribution: distr
        };
    }
}

// ── Drop-in replacement for existing global index ────────────────────────
import { mockWebPages } from './mockData';
import { EmbeddingService } from './EmbeddingService';

let globalHNSW: HNSW | null = null;

export function getGlobalHNSW(): HNSW {
    if (!globalHNSW) {
        globalHNSW = new HNSW(16, 100);
        
        // Build the HNSW graph with simulated embeddings of the dataset
        for (const page of mockWebPages) {
            const vector = EmbeddingService.embed(page.title + ' ' + page.snippet + ' ' + page.keywords.join(' '));
            globalHNSW.add(page.id, vector);
        }
    }
    return globalHNSW;
}

export function resetGlobalHNSW(): void {
    globalHNSW = null;
}
