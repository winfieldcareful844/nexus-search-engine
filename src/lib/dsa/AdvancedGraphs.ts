/**
 * Graph Algorithms: Bellman-Ford, Floyd-Warshall, Topological DP
 *
 * Completes the shortest-path trilogy alongside Dijkstra:
 *  - Dijkstra:       O((V+E) log V)  — non-negative weights
 *  - Bellman-Ford:   O(V × E)        — handles negative weights, detects negative cycles
 *  - Floyd-Warshall: O(V³)           — all-pairs shortest paths
 *
 * Also includes:
 *  - 0-1 BFS: O(V+E) with deque for graphs with only 0/1 edge weights
 *  - Topological DP: longest/shortest path in a DAG in O(V+E)
 *
 * Real-world use:
 *  - Bellman-Ford: currency arbitrage detection, network routing (RIP protocol)
 *  - Floyd-Warshall: transitive closure, dense small graphs
 *  - 0-1 BFS: grid problems with free/cost 1 moves (Google interview favourite)
 */

const INF = Infinity;

// ─────────────────────────────────────────────────────────────────────────────
// 1. Bellman-Ford  —  O(V × E)
// ─────────────────────────────────────────────────────────────────────────────
export interface BFEdge { u: number; v: number; w: number; }
export interface BFResult {
  distances: number[];
  previous: (number | null)[];
  hasNegativeCycle: boolean;
}

export function bellmanFord(V: number, edges: BFEdge[], src: number): BFResult {
  const dist = new Array(V).fill(INF);
  const prev: (number | null)[] = new Array(V).fill(null);
  dist[src] = 0;

  // Relax all edges V-1 times
  for (let i = 0; i < V - 1; i++) {
    let updated = false;
    for (const { u, v, w } of edges) {
      if (dist[u] !== INF && dist[u] + w < dist[v]) {
        dist[v] = dist[u] + w;
        prev[v] = u;
        updated = true;
      }
    }
    if (!updated) break; // Early termination
  }

  // V-th relaxation detects negative cycle
  let hasNegativeCycle = false;
  for (const { u, v, w } of edges) {
    if (dist[u] !== INF && dist[u] + w < dist[v]) {
      hasNegativeCycle = true;
      break;
    }
  }

  return { distances: dist, previous: prev, hasNegativeCycle };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Floyd-Warshall All-Pairs Shortest Paths  —  O(V³)
// ─────────────────────────────────────────────────────────────────────────────
export interface FWResult {
  dist: number[][];        // dist[i][j] = shortest path i→j
  next: (number | null)[][]; // for path reconstruction
  hasNegativeCycle: boolean;
}

export function floydWarshall(adjMatrix: number[][]): FWResult {
  const V = adjMatrix.length;
  const dist: number[][] = adjMatrix.map(row => [...row]);
  const next: (number | null)[][] = Array.from({ length: V }, (_, i) =>
    adjMatrix[i].map((w, j) => (w !== INF && i !== j) ? j : null)
  );

  for (let k = 0; k < V; k++) {
    for (let i = 0; i < V; i++) {
      for (let j = 0; j < V; j++) {
        if (dist[i][k] + dist[k][j] < dist[i][j]) {
          dist[i][j] = dist[i][k] + dist[k][j];
          next[i][j] = next[i][k];
        }
      }
    }
  }

  const hasNegativeCycle = dist.some((row, i) => row[i] < 0);
  return { dist, next, hasNegativeCycle };
}

/** Reconstruct path from src to dst using Floyd-Warshall's next matrix */
export function fwPath(next: (number | null)[][], src: number, dst: number): number[] {
  if (next[src][dst] === null) return [];
  const path = [src];
  let cur = src;
  while (cur !== dst) {
    cur = next[cur][dst]!;
    path.push(cur);
  }
  return path;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. 0-1 BFS (Deque BFS)  —  O(V + E)
// ─────────────────────────────────────────────────────────────────────────────
// For graphs where edges have weight 0 or 1 — faster than Dijkstra.
// Strategy: 0-weight edges go to FRONT of deque, 1-weight to BACK.
export interface ZeroOneEdge { to: number; weight: 0 | 1; }

export function zeroOneBFS(graph: ZeroOneEdge[][], src: number): number[] {
  const V = graph.length;
  const dist = new Array(V).fill(INF);
  dist[src] = 0;
  const deque: number[] = [src];

  while (deque.length > 0) {
    const u = deque.shift()!;
    for (const { to: v, weight } of graph[u]) {
      const newDist = dist[u] + weight;
      if (newDist < dist[v]) {
        dist[v] = newDist;
        if (weight === 0) deque.unshift(v); // add to front
        else              deque.push(v);    // add to back
      }
    }
  }

  return dist;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Topological DP — Longest Path in a DAG  —  O(V + E)
// ─────────────────────────────────────────────────────────────────────────────
export function longestPathDAG(graph: number[][], weights: number[], src: number): number[] {
  const V = graph.length;
  const inDegree = new Array(V).fill(0);
  for (let u = 0; u < V; u++)
    for (const v of graph[u]) inDegree[v]++;

  // Kahn's topological order
  const queue: number[] = [];
  const topoOrder: number[] = [];
  for (let v = 0; v < V; v++) if (inDegree[v] === 0) queue.push(v);

  while (queue.length > 0) {
    const u = queue.shift()!;
    topoOrder.push(u);
    for (const v of graph[u]) { if (--inDegree[v] === 0) queue.push(v); }
  }

  // DP in topological order
  const dp = new Array(V).fill(-INF);
  dp[src] = 0;
  for (const u of topoOrder) {
    if (dp[u] === -INF) continue;
    for (const v of graph[u]) {
      if (dp[u] + weights[v] > dp[v]) dp[v] = dp[u] + weights[v];
    }
  }

  return dp;
}
