/**
 * Dijkstra's Single-Source Shortest Path Algorithm
 *
 * Core insight: Among all unvisited nodes, greedily process the one with
 * the smallest tentative distance — this is always safe because edge weights
 * are non-negative (Bellman-Ford handles negatives).
 *
 * Time:  O((V + E) log V) with a binary min-heap priority queue
 * Space: O(V + E)
 *
 * Real-world use:
 *  - Google Maps / Waze routing
 *  - Internet routing protocols (OSPF)
 *  - Network shortest paths
 */

export interface DijkstraEdge {
  to: number;
  weight: number;
}

export interface DijkstraResult {
  distances: number[];       // distances[v] = shortest dist from src to v
  previous: (number | null)[];  // for path reconstruction
  visited: number[];         // order nodes were finalized
}

// Min-heap node for priority queue
interface PQNode { dist: number; vertex: number; }

class MinPriorityQueue {
  private heap: PQNode[] = [];

  push(node: PQNode): void {
    this.heap.push(node);
    this._bubbleUp(this.heap.length - 1);
  }

  pop(): PQNode | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._siftDown(0);
    }
    return top;
  }

  get size(): number { return this.heap.length; }

  private _bubbleUp(i: number): void {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.heap[p].dist <= this.heap[i].dist) break;
      [this.heap[p], this.heap[i]] = [this.heap[i], this.heap[p]];
      i = p;
    }
  }

  private _siftDown(i: number): void {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this.heap[l].dist < this.heap[smallest].dist) smallest = l;
      if (r < n && this.heap[r].dist < this.heap[smallest].dist) smallest = r;
      if (smallest === i) break;
      [this.heap[i], this.heap[smallest]] = [this.heap[smallest], this.heap[i]];
      i = smallest;
    }
  }
}

/**
 * Dijkstra's algorithm
 * @param graph adjacency list: graph[u] = [{to, weight}, ...]
 * @param src   source vertex
 * @returns distances and predecessor array
 */
export function dijkstra(graph: DijkstraEdge[][], src: number): DijkstraResult {
  const V = graph.length;
  const INF = Infinity;
  const distances = new Array(V).fill(INF);
  const previous: (number | null)[] = new Array(V).fill(null);
  const visited: number[] = [];

  distances[src] = 0;
  const pq = new MinPriorityQueue();
  pq.push({ dist: 0, vertex: src });

  while (pq.size > 0) {
    const { dist, vertex: u } = pq.pop()!;

    // Stale entry — a shorter path was already found
    if (dist > distances[u]) continue;
    visited.push(u);

    for (const { to: v, weight } of graph[u]) {
      const newDist = distances[u] + weight;
      if (newDist < distances[v]) {
        distances[v] = newDist;
        previous[v] = u;
        pq.push({ dist: newDist, vertex: v });
      }
    }
  }

  return { distances, previous, visited };
}

/**
 * Reconstruct the shortest path from src to dst
 */
export function reconstructPath(previous: (number | null)[], dst: number): number[] {
  const path: number[] = [];
  let cur: number | null = dst;
  while (cur !== null) {
    path.unshift(cur);
    cur = previous[cur];
  }
  return path;
}
