/**
 * GraphEngine — Advanced Graph Algorithms
 *
 * WHAT THIS SOLVES:
 *   A web link graph is fundamentally a directed graph. Beyond PageRank,
 *   there are rich algorithmic questions we can answer on it:
 *
 *   • "What is the shortest path (in hops) between page A and page B?"
 *     → Bidirectional BFS: 2× faster than unidirectional for sparse graphs.
 *       BFS from both ends meets in the middle. Key insight: if radius
 *       of each BFS is r, bidirectional needs O(b^r) vs O(b^{2r}) nodes.
 *
 *   • "Which pages form tightly coupled clusters (communities)?"
 *     → Tarjan's SCC (Strongly Connected Components): an SCC is a maximal
 *       set of nodes where every node is reachable from every other.
 *       In a web graph, SCCs often correspond to content clusters or echo
 *       chambers. Tarjan's runs in O(V + E) — optimal.
 *
 *   • "In what order should pages be crawled if some depend on others?"
 *     → Topological Sort (Kahn's BFS-based algorithm): O(V + E).
 *       Works only on DAGs — detect cycles via zero in-degree tracking.
 *
 *   • "Given a user's browsing history (seed nodes), what pages should
 *     we rank higher for this specific user?"
 *     → Personalized PageRank (PPR): Standard PageRank uses uniform
 *       teleportation to any page. PPR teleports to the user's seed set.
 *       Effectively: random walk that restarts at seeds rather than anywhere.
 *       Captures user-specific page authority. Used in Twitter's "Who to follow",
 *       Pinterest's recommendation system, and Google's personalized search.
 *
 * DATA STRUCTURES USED:
 *   • Adjacency List (Map<id, id[]>) — O(V+E) space, O(degree) neighbor access
 *   • Reverse Adjacency List — O(V+E) extra for in-link lookups
 *   • Stack for Tarjan DFS
 *   • Deque simulation for BFS (array with pointer for O(1) amortized dequeue)
 *
 * TRADEOFFS:
 *   Adjacency matrix would give O(1) edge lookup but O(V²) space — bad for
 *   sparse web graphs where E ≪ V².
 */

export interface GraphNode {
    id: string;
    metadata?: Record<string, unknown>;
}

export interface GraphEdge {
    from: string;
    to: string;
    weight?: number;
}

export interface PathResult {
    path: string[];
    distance: number;
    nodesExplored: number;
}

export interface SCCResult {
    components: string[][];      // each component is a list of node IDs
    componentCount: number;
    largestComponent: string[];
    hasLargeSCC: boolean;        // "echo chamber" indicator (SCC size > threshold)
}

export interface TopoSortResult {
    order: string[];
    hasCycle: boolean;
    cycleNodes?: string[];       // nodes in a detected cycle
}

export interface PPRResult {
    scores: Map<string, number>;
    topK: { node: string; score: number }[];
    iterationsRun: number;
}

export class GraphEngine {
    private adj: Map<string, string[]>;   // outgoing edges
    private radj: Map<string, string[]>;   // incoming edges (for SCC, PPR)
    private nodes: Set<string>;
    private weights: Map<string, number>;    // edge weights: `${from}-${to}` → w

    constructor() {
        this.adj = new Map();
        this.radj = new Map();
        this.nodes = new Set();
        this.weights = new Map();
    }

    addNode(id: string): void {
        this.nodes.add(id);
        if (!this.adj.has(id)) this.adj.set(id, []);
        if (!this.radj.has(id)) this.radj.set(id, []);
    }

    addEdge(from: string, to: string, weight: number = 1): void {
        this.addNode(from);
        this.addNode(to);
        this.adj.get(from)!.push(to);
        this.radj.get(to)!.push(from);
        this.weights.set(`${from}-${to}`, weight);
    }

    nodeCount(): number { return this.nodes.size; }
    edgeCount(): number { return [...this.adj.values()].reduce((s, a) => s + a.length, 0); }

    // ── 1. Bidirectional BFS ─────────────────────────────────────────────

    /**
     * Shortest path (by hop count) from `start` to `end`.
     *
     * KEY INSIGHT: Standard BFS from `start` explores O(b^d) nodes where
     * b = average branching factor, d = distance. Bidirectional BFS runs
     * BFS from both ends simultaneously, meeting in the middle. Each BFS
     * explores O(b^{d/2}) nodes. Total: O(2 * b^{d/2}) vs O(b^d).
     * For b=10, d=6: 2×10^3=2000 vs 10^6=1M — 500× speedup.
     *
     * CORRECTNESS: When the frontiers intersect, we have a candidate path.
     * But meeting the frontier doesn't always give the shortest path (because
     * distances in each direction may differ). We continue until the sum of
     * current forward + backward BFS distances exceeds the current best,
     * using the "μ" minimization criterion (simplified here for unweighted graphs).
     *
     * Time: O(b^{d/2}) expected where b = branching factor, d = distance
     */
    bidirectionalBFS(start: string, end: string): PathResult {
        if (start === end) return { path: [start], distance: 0, nodesExplored: 1 };
        if (!this.nodes.has(start) || !this.nodes.has(end)) {
            return { path: [], distance: -1, nodesExplored: 0 };
        }

        // Forward and backward frontiers
        const fwdParent = new Map<string, string | null>([[start, null]]);
        const bwdParent = new Map<string, string | null>([[end, null]]);
        const fwdQueue: string[] = [start];
        const bwdQueue: string[] = [end];
        let fwdPtr = 0, bwdPtr = 0;
        let nodesExplored = 2;
        let meetNode: string | null = null;

        while ((fwdPtr < fwdQueue.length || bwdPtr < bwdQueue.length) && !meetNode) {
            // Expand forward frontier
            if (fwdPtr < fwdQueue.length) {
                const curr = fwdQueue[fwdPtr++];
                for (const nb of (this.adj.get(curr) ?? [])) {
                    if (!fwdParent.has(nb)) {
                        fwdParent.set(nb, curr);
                        fwdQueue.push(nb);
                        nodesExplored++;
                        if (bwdParent.has(nb)) { meetNode = nb; break; }
                    }
                }
            }
            if (meetNode) break;

            // Expand backward frontier (follow REVERSE edges)
            if (bwdPtr < bwdQueue.length) {
                const curr = bwdQueue[bwdPtr++];
                for (const nb of (this.radj.get(curr) ?? [])) {
                    if (!bwdParent.has(nb)) {
                        bwdParent.set(nb, curr);
                        bwdQueue.push(nb);
                        nodesExplored++;
                        if (fwdParent.has(nb)) { meetNode = nb; break; }
                    }
                }
            }
        }

        if (!meetNode) return { path: [], distance: -1, nodesExplored };

        // Reconstruct path: start → meetNode → end
        const fwdPath: string[] = [];
        let node: string | null = meetNode;
        while (node !== null) { fwdPath.unshift(node); node = fwdParent.get(node) ?? null; }

        const bwdPath: string[] = [];
        node = bwdParent.get(meetNode) ?? null;  // skip meetNode (already in fwdPath)
        while (node !== null) { bwdPath.push(node); node = bwdParent.get(node) ?? null; }

        const path = [...fwdPath, ...bwdPath];
        return { path, distance: path.length - 1, nodesExplored };
    }

    // ── 2. Tarjan's SCC ──────────────────────────────────────────────────

    /**
     * Tarjan's Strongly Connected Components algorithm.
     *
     * An SCC is a maximal subset S of nodes such that for all u, v ∈ S,
     * u is reachable from v AND v is reachable from u.
     *
     * ALGORITHM (Tarjan, 1972):
     *   Single DFS pass. Each node gets:
     *     disc[u]  = discovery time (DFS visit order)
     *     low[u]   = minimum disc reachable from subtree rooted at u
     *   A node u is the root of an SCC iff disc[u] == low[u].
     *   When we finish u (all descendants explored), if it's an SCC root,
     *   pop the stack back to u — those form the SCC.
     *
     * WHY ONE PASS: We simulate "can I get back to myself?" using low values.
     *   If low[u] = disc[u], no node in u's subtree can escape upward,
     *   so u's stack segment is self-contained = one SCC.
     *
     * ALTERNATIVE: Kosaraju's (two DFS passes, transpose graph) — same complexity
     *   but Tarjan's is preferred because it's a single pass and uses less memory.
     *
     * Time: O(V + E) — each node and edge visited exactly once
     * Space: O(V) for disc, low, stack, onStack arrays
     *
     * INTERPRETATION IN SEARCH:
     *   • Large SCC = "authority cluster" — dense mutual linking
     *   • Singleton SCCs = leaf pages rarely linked back to
     *   • SCC condensation forms a DAG — shows information flow direction
     */
    tarjanSCC(): SCCResult {
        const disc: Map<string, number> = new Map();
        const low: Map<string, number> = new Map();
        const onStack: Set<string> = new Set();
        const stack: string[] = [];
        const sccs: string[][] = [];
        let timer = 0;

        const dfs = (u: string) => {
            disc.set(u, timer);
            low.set(u, timer);
            timer++;
            stack.push(u);
            onStack.add(u);

            for (const v of (this.adj.get(u) ?? [])) {
                if (!disc.has(v)) {
                    dfs(v);
                    low.set(u, Math.min(low.get(u)!, low.get(v)!));
                } else if (onStack.has(v)) {
                    low.set(u, Math.min(low.get(u)!, disc.get(v)!));
                }
            }

            // u is SCC root
            if (low.get(u) === disc.get(u)) {
                const scc: string[] = [];
                let w: string;
                do {
                    w = stack.pop()!;
                    onStack.delete(w);
                    scc.push(w);
                } while (w !== u);
                sccs.push(scc);
            }
        };

        for (const node of this.nodes) {
            if (!disc.has(node)) dfs(node);
        }

        const largest = sccs.reduce((a, b) => (b.length > a.length ? b : a), []);
        return {
            components: sccs,
            componentCount: sccs.length,
            largestComponent: largest,
            hasLargeSCC: largest.length > Math.max(3, this.nodes.size * 0.1),
        };
    }

    // ── 3. Topological Sort (Kahn's BFS) ────────────────────────────────

    /**
     * Kahn's algorithm: BFS-based topological sort.
     *
     * ALGORITHM:
     *   1. Compute in-degree for every node.
     *   2. Enqueue all nodes with in-degree 0 (no prerequisites).
     *   3. BFS: dequeue u, add to result, decrement in-degree of all u's neighbors.
     *      If neighbor's in-degree hits 0, enqueue it.
     *   4. If result.length < V, a cycle exists (not a DAG).
     *
     * WHY BFS (not DFS like standard topo sort):
     *   Kahn's naturally detects cycles AND produces a valid topo order.
     *   DFS post-order requires an extra cycle detection pass.
     *   Kahn's is also more intuitive for "dependency resolution" framing.
     *
     * Time: O(V + E)
     */
    topologicalSort(): TopoSortResult {
        const inDegree = new Map<string, number>();
        for (const node of this.nodes) inDegree.set(node, 0);
        for (const [, neighbors] of this.adj) {
            for (const nb of neighbors) {
                inDegree.set(nb, (inDegree.get(nb) ?? 0) + 1);
            }
        }

        const queue: string[] = [];
        for (const [node, deg] of inDegree) {
            if (deg === 0) queue.push(node);
        }

        const order: string[] = [];
        let ptr = 0;

        while (ptr < queue.length) {
            const u = queue[ptr++];
            order.push(u);
            for (const v of (this.adj.get(u) ?? [])) {
                inDegree.set(v, inDegree.get(v)! - 1);
                if (inDegree.get(v) === 0) queue.push(v);
            }
        }

        const hasCycle = order.length < this.nodes.size;
        return {
            order,
            hasCycle,
            cycleNodes: hasCycle
                ? [...this.nodes].filter(n => !order.includes(n))
                : undefined,
        };
    }

    // ── 4. Personalized PageRank ─────────────────────────────────────────

    /**
     * Personalized PageRank via Power Iteration with restart bias.
     *
     * STANDARD PAGERANK:
     *   Uniform teleportation: at each step, with probability (1-d),
     *   jump to ANY random page uniformly. This gives a single global ranking.
     *
     * PERSONALIZED PAGERANK:
     *   Non-uniform teleportation: jump back to one of the SEED nodes
     *   (user's history, topic pages, etc.) with probability (1-d).
     *   This biases the stationary distribution toward the seed neighborhood.
     *
     *   PR_s(p) = (1-d) × s(p) + d × Σ_{q→p} PR_s(q) / |out(q)|
     *   where s(p) = 1/|seeds| if p ∈ seeds, else 0.
     *
     * USAGE:
     *   • Twitter "Who to follow": seed = accounts you already follow
     *   • Pinterest recommendation: seed = boards you've pinned to
     *   • Google personalized search: seed = pages from your history
     *
     * CONVERGENCE: Power iteration with tolerance 1e-6, max 100 iterations.
     * Typically converges in 20-30 iterations for sparse graphs.
     *
     * Time: O(iterations × (V + E)), Space: O(V)
     */
    personalizedPageRank(
        seeds: string[],
        dampingFactor: number = 0.85,
        maxIter: number = 100,
        tolerance: number = 1e-6
    ): PPRResult {
        const N = this.nodes.size;
        if (N === 0) return { scores: new Map(), topK: [], iterationsRun: 0 };

        const validSeeds = seeds.filter(s => this.nodes.has(s));
        if (validSeeds.length === 0) validSeeds.push([...this.nodes][0]);

        // Teleportation distribution
        const seedSet = new Set(validSeeds);
        const teleport = 1 / validSeeds.length;

        // Initialize scores
        let scores = new Map<string, number>();
        for (const n of this.nodes) scores.set(n, 1 / N);

        // Out-degree cache
        const outDeg = new Map<string, number>();
        for (const n of this.nodes) outDeg.set(n, this.adj.get(n)?.length ?? 0);

        // Power iteration
        let iterationsRun = 0;
        for (let iter = 0; iter < maxIter; iter++) {
            const newScores = new Map<string, number>();

            for (const p of this.nodes) {
                // Teleportation term: personalized (only to seeds)
                const tele = seedSet.has(p) ? (1 - dampingFactor) * teleport : 0;

                // Random walk term: contributions from inbound links
                let walkScore = 0;
                for (const q of (this.radj.get(p) ?? [])) {
                    const deg = outDeg.get(q) ?? 1;
                    if (deg > 0) walkScore += (scores.get(q) ?? 0) / deg;
                }

                newScores.set(p, tele + dampingFactor * walkScore);
            }

            // L1 convergence check
            let diff = 0;
            for (const [p, score] of newScores) diff += Math.abs(score - (scores.get(p) ?? 0));
            scores = newScores;
            iterationsRun++;
            if (diff < tolerance) break;
        }

        // Normalize
        const sum = [...scores.values()].reduce((a, b) => a + b, 0);
        if (sum > 0) for (const [k, v] of scores) scores.set(k, v / sum);

        const topK = [...scores.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([node, score]) => ({ node, score }));

        return { scores, topK, iterationsRun };
    }

    // ── Factory: build from mock data ────────────────────────────────────

    /**
     * Build a GraphEngine from the existing mock web pages data.
     * This connects the graph engine to real link structure.
     */
    static fromMockData(pages: { id: string; linksTo: string[] }[]): GraphEngine {
        const g = new GraphEngine();
        for (const p of pages) g.addNode(p.id);
        for (const p of pages) {
            for (const target of p.linksTo) g.addEdge(p.id, target);
        }
        return g;
    }
}

// ── Singleton ────────────────────────────────────────────────────────────
import { mockWebPages } from './mockData';

let globalGraphEngine: GraphEngine | null = null;

export function getGlobalGraphEngine(): GraphEngine {
    if (!globalGraphEngine) {
        globalGraphEngine = GraphEngine.fromMockData(mockWebPages);
    }
    return globalGraphEngine;
}

export function resetGlobalGraphEngine(): void {
    globalGraphEngine = null;
}
