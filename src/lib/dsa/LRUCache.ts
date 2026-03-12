// LRU Cache Implementation using Hash Map + Doubly Linked List
// Time Complexity: O(1) for both get and put operations

export interface CacheNode<K, V> {
  key: K;
  value: V;
  prev: CacheNode<K, V> | null;
  next: CacheNode<K, V> | null;
  timestamp: number;
}

export interface LRUCacheVisualizationStep {
  type: 'get' | 'put' | 'evict';
  operation: string;
  key: string;
  value?: string;
  hit: boolean;
  cacheState: { key: string; value: string }[];
  description: string;
  highlightKey: string | null;
}

export class LRUCache<K = string, V = string> {
  private capacity: number;
  private cache: Map<K, CacheNode<K, V>>;
  private head: CacheNode<K, V> | null; // Most recently used
  private tail: CacheNode<K, V> | null; // Least recently used
  private visualizationSteps: LRUCacheVisualizationStep[];
  private hits: number;
  private misses: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.cache = new Map();
    this.head = null;
    this.tail = null;
    this.visualizationSteps = [];
    this.hits = 0;
    this.misses = 0;
  }

  // Get value by key - O(1)
  get(key: K): V | undefined {
    const node = this.cache.get(key);

    if (!node) {
      this.misses++;
      this.visualizationSteps.push({
        type: 'get',
        operation: `GET(${String(key)})`,
        key: String(key),
        hit: false,
        cacheState: this.getCacheState(),
        description: `Cache MISS: Key '${String(key)}' not found in cache`,
        highlightKey: null
      });
      return undefined;
    }

    // Move to front (most recently used)
    this.moveToFront(node);
    this.hits++;

    this.visualizationSteps.push({
      type: 'get',
      operation: `GET(${String(key)})`,
      key: String(key),
      value: String(node.value),
      hit: true,
      cacheState: this.getCacheState(),
      description: `Cache HIT: Key '${String(key)}' found, moved to front (most recently used)`,
      highlightKey: String(key)
    });

    return node.value;
  }

  // Put key-value pair - O(1)
  put(key: K, value: V): void {
    const existingNode = this.cache.get(key);

    if (existingNode) {
      // Update existing node
      existingNode.value = value;
      existingNode.timestamp = Date.now();
      this.moveToFront(existingNode);

      this.visualizationSteps.push({
        type: 'put',
        operation: `PUT(${String(key)}, ${String(value)})`,
        key: String(key),
        value: String(value),
        hit: true,
        cacheState: this.getCacheState(),
        description: `Updated existing key '${String(key)}' with new value, moved to front`,
        highlightKey: String(key)
      });
      return;
    }

    // Create new node
    const newNode: CacheNode<K, V> = {
      key,
      value,
      prev: null,
      next: null,
      timestamp: Date.now()
    };

    // Check if cache is full
    if (this.cache.size >= this.capacity) {
      // Evict LRU (tail)
      const evictedKey = this.tail?.key;
      this.removeTail();
      
      this.visualizationSteps.push({
        type: 'evict',
        operation: `EVICT(${String(evictedKey)})`,
        key: String(evictedKey),
        hit: false,
        cacheState: this.getCacheState(),
        description: `Cache full! Evicted least recently used key '${String(evictedKey)}'`,
        highlightKey: null
      });
    }

    // Add new node to front
    this.addToFront(newNode);
    this.cache.set(key, newNode);

    this.visualizationSteps.push({
      type: 'put',
      operation: `PUT(${String(key)}, ${String(value)})`,
      key: String(key),
      value: String(value),
      hit: false,
      cacheState: this.getCacheState(),
      description: `Added new entry '${String(key)}' to cache`,
      highlightKey: String(key)
    });
  }

  // Move node to front of the list
  private moveToFront(node: CacheNode<K, V>): void {
    if (node === this.head) return;

    // Remove from current position
    this.removeNode(node);

    // Add to front
    this.addToFront(node);
  }

  // Add node to front of the list
  private addToFront(node: CacheNode<K, V>): void {
    node.prev = null;
    node.next = this.head;

    if (this.head) {
      this.head.prev = node;
    }

    this.head = node;

    if (!this.tail) {
      this.tail = node;
    }
  }

  // Remove node from the list
  private removeNode(node: CacheNode<K, V>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
  }

  // Remove tail (LRU node)
  private removeTail(): void {
    if (!this.tail) return;

    const key = this.tail.key;
    this.cache.delete(key);
    this.removeNode(this.tail);
  }

  // Get current cache state as array (from most to least recently used)
  getCacheState(): { key: string; value: string }[] {
    const state: { key: string; value: string }[] = [];
    let current = this.head;

    while (current) {
      state.push({
        key: String(current.key),
        value: String(current.value)
      });
      current = current.next;
    }

    return state;
  }

  // Get visualization steps
  getVisualizationSteps(): LRUCacheVisualizationStep[] {
    return this.visualizationSteps;
  }

  // Clear visualization steps
  clearVisualizationSteps(): void {
    this.visualizationSteps = [];
  }

  // Get cache statistics
  getStats(): { size: number; capacity: number; hits: number; misses: number; hitRate: string } {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      capacity: this.capacity,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? `${((this.hits / total) * 100).toFixed(1)}%` : '0%'
    };
  }

  // Check if key exists
  has(key: K): boolean {
    return this.cache.has(key);
  }

  // Get current size
  size(): number {
    return this.cache.size;
  }

  // Clear the cache
  clear(): void {
    this.cache.clear();
    this.head = null;
    this.tail = null;
    this.hits = 0;
    this.misses = 0;
    this.visualizationSteps = [];
  }

  // Get linked list structure for visualization
  getLinkedListStructure(): {
    nodes: { key: string; value: string; isHead: boolean; isTail: boolean }[];
    edges: { from: string; to: string; type: 'next' | 'prev' }[];
  } {
    const nodes: { key: string; value: string; isHead: boolean; isTail: boolean }[] = [];
    const edges: { from: string; to: string; type: 'next' | 'prev' }[] = [];

    let current = this.head;
    while (current) {
      nodes.push({
        key: String(current.key),
        value: String(current.value),
        isHead: current === this.head,
        isTail: current === this.tail
      });

      if (current.next) {
        edges.push({
          from: String(current.key),
          to: String(current.next.key),
          type: 'next'
        });
      }

      if (current.prev) {
        edges.push({
          from: String(current.key),
          to: String(current.prev.key),
          type: 'prev'
        });
      }

      current = current.next;
    }

    return { nodes, edges };
  }
}

// Create a global LRU cache for recent searches
let globalLRUCache: LRUCache<string, string> | null = null;

export function getGlobalLRUCache(): LRUCache<string, string> {
  if (!globalLRUCache) {
    globalLRUCache = new LRUCache<string, string>(10);
  }
  return globalLRUCache;
}

export function resetGlobalLRUCache(): void {
  globalLRUCache = null;
}
