/**
 * Search Engine WASM Loader
 * Loads the compiled WebAssembly module and provides a JavaScript API
 */

// Type definitions for the WASM module
interface WasmSearchEngine {
  addDocument(id: string, title: string, url: string, content: string, keywords: string[]): void;
  addPageLink(from: string, to: string): void;
  computePageRank(): void;
  search(query: string, maxResults: number): string;
  autocomplete(prefix: string, maxResults: number): string;
  fuzzySearch(query: string, maxDistance: number, maxResults: number): string;
  getStats(): string;
  benchmark(query: string, iterations: number): string;
}

interface WasmModule {
  SearchEngine: new () => WasmSearchEngine;
}

let wasmModule: WasmModule | null = null;
let wasmLoadPromise: Promise<WasmModule> | null = null;

/**
 * Initialize the WebAssembly module
 */
export async function initWasm(): Promise<WasmModule> {
  if (wasmModule) return wasmModule;
  if (wasmLoadPromise) return wasmLoadPromise;
  
  wasmLoadPromise = (async () => {
    try {
      // Dynamic import of the WASM module
      // @ts-ignore - WASM module import
      const wasmMod = await import('/wasm/search_engine.js');
      await wasmMod.default();
      wasmModule = wasmMod;
      return wasmMod;
    } catch (error) {
      console.warn('WASM module not available, using JavaScript fallback:', error);
      return createJsFallback();
    }
  })();
  
  return wasmLoadPromise;
}

/**
 * Create a new search engine instance
 */
export async function createSearchEngine(): Promise<SearchEngineInterface> {
  const mod = await initWasm();
  const engine = new mod.SearchEngine();
  return new WasmSearchEngineWrapper(engine);
}

/**
 * Interface for search engine
 */
export interface SearchEngineInterface {
  addDocument(id: string, title: string, url: string, content: string, keywords: string[]): void;
  addPageLink(from: string, to: string): void;
  computePageRank(): void;
  search(query: string, maxResults?: number): SearchResult;
  autocomplete(prefix: string, maxResults?: number): AutocompleteResult[];
  fuzzySearch(query: string, maxDistance?: number, maxResults?: number): AutocompleteResult[];
  getStats(): EngineStats;
  benchmark(query: string, iterations?: number): BenchmarkResult;
}

export interface SearchResult {
  cached: boolean;
  results: Array<{
    id: string;
    title: string;
    url: string;
    snippet: string;
    bm25Score: number;
    pageRank: number;
    combinedScore: number;
  }>;
  time: number;
}

export interface AutocompleteResult {
  term: string;
  frequency: number;
}

export interface EngineStats {
  trieNodes: number;
  indexTerms: number;
  documents: number;
  avgDocLength: number;
  cacheSize: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  trieMemory: number;
}

export interface BenchmarkResult {
  iterations: number;
  avg: number;
  min: number;
  max: number;
  stdDev: number;
  qps: number;
}

/**
 * Wrapper for WASM search engine
 */
class WasmSearchEngineWrapper implements SearchEngineInterface {
  constructor(private engine: WasmSearchEngine) {}
  
  addDocument(id: string, title: string, url: string, content: string, keywords: string[]): void {
    this.engine.addDocument(id, title, url, content, keywords);
  }
  
  addPageLink(from: string, to: string): void {
    this.engine.addPageLink(from, to);
  }
  
  computePageRank(): void {
    this.engine.computePageRank();
  }
  
  search(query: string, maxResults: number = 20): SearchResult {
    return JSON.parse(this.engine.search(query, maxResults));
  }
  
  autocomplete(prefix: string, maxResults: number = 10): AutocompleteResult[] {
    return JSON.parse(this.engine.autocomplete(prefix, maxResults));
  }
  
  fuzzySearch(query: string, maxDistance: number = 2, maxResults: number = 10): AutocompleteResult[] {
    return JSON.parse(this.engine.fuzzySearch(query, maxDistance, maxResults));
  }
  
  getStats(): EngineStats {
    return JSON.parse(this.engine.getStats());
  }
  
  benchmark(query: string, iterations: number = 100): BenchmarkResult {
    return JSON.parse(this.engine.benchmark(query, iterations));
  }
}

/**
 * JavaScript Fallback Implementation
 * Pure JavaScript implementation when WASM is not available
 */
function createJsFallback(): WasmModule {
  return {
    SearchEngine: JSSearchEngine as unknown as new () => WasmSearchEngine
  };
}

/**
 * Pure JavaScript implementation of the search engine
 * Optimized for performance with advanced DSA algorithms
 */
class JSSearchEngine {
  private trie: JSTrie;
  private index: JSInvertedIndex;
  private cache: JSLRUCache<string, string>;
  private pageRank: JSPageRank;
  private documents: Map<string, { title: string; url: string; snippet: string }>;
  
  constructor() {
    this.trie = new JSTrie();
    this.index = new JSInvertedIndex();
    this.cache = new JSLRUCache(100);
    this.pageRank = new JSPageRank();
    this.documents = new Map();
  }
  
  addDocument(id: string, title: string, url: string, content: string, keywords: string[]): void {
    this.documents.set(id, { title, url, snippet: content });
    this.index.addDocument(id, title + ' ' + content, keywords);
    
    // Add to trie for autocomplete
    const words = (title + ' ' + keywords.join(' ')).toLowerCase().split(/\s+/);
    for (const word of words) {
      if (word.length > 1) {
        this.trie.insert(word, 1);
      }
    }
  }
  
  addPageLink(from: string, to: string): void {
    this.pageRank.addEdge(from, to);
  }
  
  computePageRank(): void {
    this.pageRank.compute();
  }
  
  search(query: string, maxResults: number = 20): string {
    const startTime = performance.now();
    
    // Check cache
    const cached = this.cache.get(query);
    if (cached) {
      return JSON.stringify({
        cached: true,
        results: JSON.parse(cached),
        time: performance.now() - startTime
      });
    }
    
    // Tokenize query
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 1);
    
    // BM25 search
    const bm25Results = this.index.searchBM25(terms);
    
    // Combine with PageRank
    const results = bm25Results.slice(0, maxResults).map(({ docId, score }) => {
      const doc = this.documents.get(docId)!;
      const pr = this.pageRank.getRank(docId);
      return {
        id: docId,
        title: doc.title,
        url: doc.url,
        snippet: doc.snippet,
        bm25Score: score,
        pageRank: pr,
        combinedScore: score + pr * 10
      };
    });
    
    // Cache result
    this.cache.put(query, JSON.stringify(results));
    
    return JSON.stringify({
      cached: false,
      results,
      time: performance.now() - startTime
    });
  }
  
  autocomplete(prefix: string, maxResults: number = 10): string {
    const results = this.trie.autocomplete(prefix, maxResults);
    return JSON.stringify(results.map(r => ({ term: r.word, frequency: r.frequency })));
  }
  
  fuzzySearch(query: string, maxDistance: number = 2, maxResults: number = 10): string {
    const results = this.trie.fuzzySearch(query, maxDistance, maxResults);
    return JSON.stringify(results.map(r => ({ term: r.word, frequency: r.distance })));
  }
  
  getStats(): string {
    return JSON.stringify({
      trieNodes: this.trie.getNodeCount(),
      indexTerms: this.index.getTermCount(),
      documents: this.documents.size,
      avgDocLength: this.index.getAvgDocLength(),
      cacheSize: this.cache.size(),
      cacheHits: this.cache.getHits(),
      cacheMisses: this.cache.getMisses(),
      cacheHitRate: this.cache.getHitRate(),
      trieMemory: this.trie.getMemoryUsage()
    });
  }
  
  benchmark(query: string, iterations: number = 100): string {
    const times: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      this.search(query, 20);
      times.push(performance.now() - start);
    }
    
    const sum = times.reduce((a, b) => a + b, 0);
    const avg = sum / iterations;
    const min = Math.min(...times);
    const max = Math.max(...times);
    const variance = times.reduce((acc, t) => acc + (t - avg) ** 2, 0) / iterations;
    const stdDev = Math.sqrt(variance);
    
    return JSON.stringify({
      iterations,
      avg,
      min,
      max,
      stdDev,
      qps: Math.round(1000 / avg)
    });
  }
}

// ============================================================================
// TRIE IMPLEMENTATION (JavaScript)
// ============================================================================

class JSTrieNode {
  children: Map<string, JSTrieNode> = new Map();
  isEndOfWord = false;
  frequency = 0;
  word = '';
}

class JSTrie {
  private root: JSTrieNode;
  private nodeCount: number;
  
  constructor() {
    this.root = new JSTrieNode();
    this.nodeCount = 1;
  }
  
  insert(word: string, frequency: number = 1): void {
    let current = this.root;
    for (const char of word.toLowerCase()) {
      if (!current.children.has(char)) {
        current.children.set(char, new JSTrieNode());
        this.nodeCount++;
      }
      current = current.children.get(char)!;
    }
    current.isEndOfWord = true;
    current.frequency += frequency;
    current.word = word;
  }
  
  autocomplete(prefix: string, maxResults: number = 10): Array<{ word: string; frequency: number }> {
    let node = this.root;
    for (const char of prefix.toLowerCase()) {
      if (!node.children.has(char)) return [];
      node = node.children.get(char)!;
    }
    
    const results: Array<{ word: string; frequency: number }> = [];
    this.collectWords(node, prefix.toLowerCase(), results);
    
    results.sort((a, b) => b.frequency - a.frequency);
    return results.slice(0, maxResults);
  }
  
  fuzzySearch(query: string, maxDistance: number, maxResults: number): Array<{ word: string; distance: number }> {
    const results: Array<{ word: string; distance: number }> = [];
    const currentRow = Array.from({ length: query.length + 1 }, (_, i) => i);
    
    for (const [char, child] of this.root.children) {
      this.fuzzySearchRecursive(child, char, query.toLowerCase(), currentRow, results, maxDistance);
    }
    
    results.sort((a, b) => a.distance - b.distance);
    return results.slice(0, maxResults);
  }
  
  getNodeCount(): number {
    return this.nodeCount;
  }
  
  getMemoryUsage(): number {
    return this.nodeCount * 100; // Approximate
  }
  
  private collectWords(node: JSTrieNode, prefix: string, results: Array<{ word: string; frequency: number }>): void {
    if (node.isEndOfWord) {
      results.push({ word: node.word || prefix, frequency: node.frequency });
    }
    for (const [char, child] of node.children) {
      this.collectWords(child, prefix + char, results);
    }
  }
  
  private fuzzySearchRecursive(
    node: JSTrieNode,
    ch: string,
    query: string,
    previousRow: number[],
    results: Array<{ word: string; distance: number }>,
    maxDistance: number
  ): void {
    const columns = query.length + 1;
    const currentRow: number[] = [previousRow[0] + 1];
    
    for (let i = 1; i < columns; i++) {
      const insertCost = currentRow[i - 1] + 1;
      const deleteCost = previousRow[i] + 1;
      const replaceCost = previousRow[i - 1] + (query[i - 1] !== ch ? 1 : 0);
      currentRow.push(Math.min(insertCost, deleteCost, replaceCost));
    }
    
    if (currentRow[columns - 1] <= maxDistance && node.isEndOfWord) {
      results.push({ word: node.word, distance: currentRow[columns - 1] });
    }
    
    if (Math.min(...currentRow) <= maxDistance) {
      for (const [char, child] of node.children) {
        this.fuzzySearchRecursive(child, char, query, currentRow, results, maxDistance);
      }
    }
  }
}

// ============================================================================
// INVERTED INDEX WITH BM25 (JavaScript)
// ============================================================================

class JSInvertedIndex {
  private index: Map<string, Array<{ docId: string; frequency: number; positions: number[] }>> = new Map();
  private documents: Map<string, { content: string; length: number }> = new Map();
  private totalTerms = 0;
  
  addDocument(docId: string, content: string, keywords: string[]): void {
    const terms = this.tokenize(content + ' ' + keywords.join(' '));
    const termPositions: Map<string, number[]> = new Map();
    
    terms.forEach((term, idx) => {
      if (!termPositions.has(term)) termPositions.set(term, []);
      termPositions.get(term)!.push(idx);
    });
    
    for (const [term, positions] of termPositions) {
      if (!this.index.has(term)) this.index.set(term, []);
      this.index.get(term)!.push({
        docId,
        frequency: positions.length,
        positions
      });
    }
    
    this.documents.set(docId, { content, length: terms.length });
    this.totalTerms += terms.length;
  }
  
  searchBM25(terms: string[], k1 = 1.5, b = 0.75): Array<{ docId: string; score: number }> {
    const N = this.documents.size;
    const avgLen = this.totalTerms / N;
    const scores: Map<string, number> = new Map();
    
    for (const term of terms) {
      const postings = this.index.get(term);
      if (!postings) continue;
      
      const df = postings.length;
      const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);
      
      for (const posting of postings) {
        const doc = this.documents.get(posting.docId);
        if (!doc) continue;
        
        const tf = posting.frequency;
        const numerator = tf * (k1 + 1);
        const denominator = tf + k1 * (1 - b + b * doc.length / avgLen);
        
        const currentScore = scores.get(posting.docId) || 0;
        scores.set(posting.docId, currentScore + idf * numerator / denominator);
      }
    }
    
    return Array.from(scores.entries())
      .map(([docId, score]) => ({ docId, score }))
      .sort((a, b) => b.score - a.score);
  }
  
  getTermCount(): number {
    return this.index.size;
  }
  
  getAvgDocLength(): number {
    return this.documents.size > 0 ? this.totalTerms / this.documents.size : 0;
  }
  
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1);
  }
}

// ============================================================================
// LRU CACHE (JavaScript)
// ============================================================================

class JSLRUCache<K, V> {
  private cache: Map<K, { value: V; prev: K | null; next: K | null }> = new Map();
  private head: K | null = null;
  private tail: K | null = null;
  private hits = 0;
  private misses = 0;
  
  constructor(private capacity: number) {}
  
  get(key: K): V | undefined {
    const node = this.cache.get(key);
    if (!node) {
      this.misses++;
      return undefined;
    }
    this.hits++;
    this.moveToHead(key);
    return node.value;
  }
  
  put(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.get(key)!.value = value;
      this.moveToHead(key);
      return;
    }
    
    if (this.cache.size >= this.capacity) {
      this.evictLRU();
    }
    
    this.cache.set(key, { value, prev: null, next: this.head });
    if (this.head !== null) {
      this.cache.get(this.head)!.prev = key;
    }
    this.head = key;
    if (this.tail === null) this.tail = key;
  }
  
  size(): number {
    return this.cache.size;
  }
  
  getHits(): number {
    return this.hits;
  }
  
  getMisses(): number {
    return this.misses;
  }
  
  getHitRate(): number {
    const total = this.hits + this.misses;
    return total > 0 ? this.hits / total : 0;
  }
  
  private moveToHead(key: K): void {
    if (key === this.head) return;
    
    const node = this.cache.get(key)!;
    
    // Remove from current position
    if (node.prev !== null) {
      this.cache.get(node.prev)!.next = node.next;
    }
    if (node.next !== null) {
      this.cache.get(node.next)!.prev = node.prev;
    }
    if (key === this.tail) {
      this.tail = node.prev;
    }
    
    // Move to head
    node.prev = null;
    node.next = this.head;
    if (this.head !== null) {
      this.cache.get(this.head)!.prev = key;
    }
    this.head = key;
  }
  
  private evictLRU(): void {
    if (this.tail === null) return;
    
    const tailNode = this.cache.get(this.tail)!;
    const newTail = tailNode.prev;
    
    this.cache.delete(this.tail);
    this.tail = newTail;
    
    if (this.tail !== null) {
      this.cache.get(this.tail)!.next = null;
    } else {
      this.head = null;
    }
  }
}

// ============================================================================
// PAGERANK (JavaScript)
// ============================================================================

class JSPageRank {
  private graph: Map<string, string[]> = new Map();
  private reverseGraph: Map<string, string[]> = new Map();
  private ranks: Map<string, number> = new Map();
  
  addEdge(from: string, to: string): void {
    if (!this.graph.has(from)) this.graph.set(from, []);
    this.graph.get(from)!.push(to);
    
    if (!this.reverseGraph.has(to)) this.reverseGraph.set(to, []);
    this.reverseGraph.get(to)!.push(from);
    
    if (!this.ranks.has(from)) this.ranks.set(from, 0);
    if (!this.ranks.has(to)) this.ranks.set(to, 0);
  }
  
  compute(damping = 0.85, maxIterations = 100, tolerance = 1e-6): void {
    const N = this.ranks.size;
    if (N === 0) return;
    
    const initialRank = 1 / N;
    for (const key of this.ranks.keys()) {
      this.ranks.set(key, initialRank);
    }
    
    for (let iter = 0; iter < maxIterations; iter++) {
      const newRanks: Map<string, number> = new Map();
      let diff = 0;
      
      for (const [page] of this.ranks) {
        let rankSum = 0;
        const inlinks = this.reverseGraph.get(page) || [];
        
        for (const inlink of inlinks) {
          const outlinks = this.graph.get(inlink)?.length || 1;
          rankSum += this.ranks.get(inlink)! / outlinks;
        }
        
        const newRank = (1 - damping) / N + damping * rankSum;
        newRanks.set(page, newRank);
        diff += Math.abs(newRank - this.ranks.get(page)!);
      }
      
      this.ranks = newRanks;
      if (diff < tolerance) break;
    }
  }
  
  getRank(page: string): number {
    return this.ranks.get(page) || 0;
  }
}
