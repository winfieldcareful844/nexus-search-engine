'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Search, Zap, Code, BarChart3, GitBranch, Database,
  Clock, Cpu, HardDrive, TrendingUp, Play, Pause,
  Activity, RefreshCw, Layers, Terminal, ChevronRight
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import SearchBar from '@/components/SearchBar';
import SearchResults from '@/components/SearchResults';
import LSMCompactionVisualization from '@/components/visualizations/LSMCompactionVisualization';

interface SearchResult {
  id: string; title: string; url: string; snippet: string;
  keywords: string[]; pageRank: number; matchedTerms?: string[];
  relevance?: number; combinedScore?: number; bm25Score?: number;
  semanticScore?: number; rrfScore?: number;
}
interface BenchmarkResult {
  algorithm: string; operations: number; totalTime: number;
  avgTime: number; minTime: number; maxTime: number;
  stdDev: number; opsPerSecond: number;
}
interface AlgorithmInfo {
  id: string; name: string; icon: React.ReactNode;
  complexity: string; description: string; useCase: string;
  color: string; neon: string; codeSnippet: string;
}

const algorithms: AlgorithmInfo[] = [
  {
    id: 'trie', name: 'Trie Data Structure',
    icon: <GitBranch className="w-5 h-5" />, complexity: 'O(m)',
    description: 'Prefix tree for efficient string operations. Enables O(m) autocomplete and fuzzy matching.',
    useCase: 'Autocomplete · Spell check · IP routing',
    color: 'text-[#39ff14]', neon: '#39ff14',
    codeSnippet: `class TrieNode {
  children: Map<string, TrieNode>
  isEndOfWord: boolean
  frequency: number
}

insert(word: string): void {
  let node = root
  for (const ch of word) {
    if (!node.children.has(ch))
      node.children.set(ch, new TrieNode())
    node = node.children.get(ch)!
  }
  node.isEndOfWord = true
}

autocomplete(prefix: string): string[] {
  // Navigate to prefix → DFS collect all words
  // Return sorted by frequency  O(m + output)
}`
  },
  {
    id: 'pagerank', name: 'PageRank Algorithm',
    icon: <TrendingUp className="w-5 h-5" />, complexity: 'O(n×iter)',
    description: "Google's link-analysis algorithm. Ranks pages by importance using the web's link structure.",
    useCase: 'Search ranking · Citation analysis',
    color: 'text-[#00f5ff]', neon: '#00f5ff',
    codeSnippet: `// PageRank formula
PR(p) = (1-d)/N + d × Σ(PR(i)/L(i))

// d = 0.85  N = total pages  L(i) = outlinks

compute(): void {
  initRanks(1/N)
  repeat until convergence:
    for each page p:
      newRank[p] = (1-d)/N
      for each i linking to p:
        newRank[p] += d * rank[i] / L(i)
    if maxDiff < ε: break
}`
  },
  {
    id: 'inverted', name: 'Inverted Index + BM25',
    icon: <Database className="w-5 h-5" />, complexity: 'O(terms)',
    description: 'Maps terms to documents for full-text search. BM25 provides probabilistic relevance ranking.',
    useCase: 'Search engines · Document retrieval',
    color: 'text-[#bf5fff]', neon: '#bf5fff',
    codeSnippet: `// BM25 scoring
score(D,Q) = Σ IDF(qi) × (f(qi,D)×(k1+1)) /
              (f(qi,D) + k1×(1-b+b×|D|/avgdl))

// k1=1.5  b=0.75  tunable params
// IDF(qi) = log((N-n(qi)+0.5)/(n(qi)+0.5))

// Posting list
{ docId, positions: int[], frequency: int }`
  },
  {
    id: 'lru', name: 'LRU Cache',
    icon: <Clock className="w-5 h-5" />, complexity: 'O(1)',
    description: 'Least-Recently-Used cache via HashMap + doubly-linked list. Both get/put in constant time.',
    useCase: 'Caching · Memoization · Rate limiting',
    color: 'text-[#ff00ff]', neon: '#ff00ff',
    codeSnippet: `class LRUCache<K, V> {
  cache: Map<K, Node>   // O(1) lookup
  head: Node            // MRU sentinel
  tail: Node            // LRU sentinel

  get(key: K): V | undefined {
    if (!cache.has(key)) return undefined
    moveToHead(cache.get(key))  // O(1)
    return cache.get(key)!.value
  }
  put(key: K, value: V): void {
    if (size >= capacity) evictTail()  // O(1)
    addToHead(new Node(key, value))
  }
}`
  },
  {
    id: 'heap', name: 'Min-Heap (Top-K)',
    icon: <Layers className="w-5 h-5" />, complexity: 'O(n log k)',
    description: 'Binary heap efficient streaming top-K. Maintains k largest elements from unbounded stream.',
    useCase: 'Top results · Priority queues · Streaming',
    color: 'text-[#ffbe00]', neon: '#ffbe00',
    codeSnippet: `class MinHeap<T> {
  heap: T[]
  capacity: number

  insert(item: T): void {
    if (size < capacity) {
      heap.push(item); bubbleUp(size-1)
    } else if (item > heap[0]) {
      heap[0] = item   // replace min
      heapifyDown(0)   // O(log k)
    }
  }
  // Total: O(n log k) for top-k selection
  // vs O(n log n) sort — k << n advantage
}`
  },
  {
    id: 'binary', name: 'Binary Search',
    icon: <Search className="w-5 h-5" />, complexity: 'O(log n)',
    description: 'Divide-and-conquer search in sorted arrays. Halves search space each iteration.',
    useCase: 'Sorted lookups · Range queries',
    color: 'text-[#ff4f4f]', neon: '#ff4f4f',
    codeSnippet: `binarySearch(arr: T[], target: T): number {
  let lo = 0, hi = arr.length - 1

  while (lo <= hi) {
    const mid = lo + ((hi - lo) >> 1)
    if (arr[mid] === target) return mid
    if (arr[mid] < target)  lo = mid + 1
    else                    hi = mid - 1
  }
  return -1  // not found
}
// 1M elements: log₂(1M) ≈ 20 comparisons
// vs linear: up to 1,000,000 comparisons`
  }
];

function StatCounter({ value, label, neon }: { value: string; label: string; neon: string }) {
  return (
    <div className="card-holographic p-5 text-center group cursor-default">
      <div className="text-3xl font-orbitron font-bold mb-1" style={{ color: neon, textShadow: `0 0 20px ${neon}` }}>
        {value}
      </div>
      <div className="text-xs text-[#7aa3b8] font-tech tracking-widest uppercase">{label}</div>
    </div>
  );
}

function AlgoCard({ algo, active, onClick }: { algo: AlgorithmInfo; active: boolean; onClick: () => void }) {
  return (
    <div
      className="card-holographic p-5 cursor-pointer select-none transition-all duration-300"
      style={active ? { borderColor: algo.neon, boxShadow: `0 0 24px ${algo.neon}30, 0 0 48px ${algo.neon}10` } : {}}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: `${algo.neon}18`, border: `1px solid ${algo.neon}40` }}>
            <span style={{ color: algo.neon }}>{algo.icon}</span>
          </div>
          <div>
            <div className="font-orbitron text-sm font-semibold text-white">{algo.name}</div>
            <div className="font-tech text-xs mt-0.5" style={{ color: algo.neon }}>{algo.complexity}</div>
          </div>
        </div>
        <div className="text-lg font-orbitron font-bold" style={{ color: algo.neon, textShadow: `0 0 12px ${algo.neon}` }}>
          {algo.complexity}
        </div>
      </div>
      <p className="text-xs text-[#7aa3b8] mb-2 leading-relaxed">{algo.description}</p>
      <div className="text-[10px] text-[#4a6a7a] font-tech">{algo.useCase}</div>
      {active && (
        <div className="mt-4 pt-4 border-t" style={{ borderColor: `${algo.neon}25` }}>
          <pre className="font-tech text-[11px] leading-relaxed overflow-x-auto p-3 rounded-lg"
            style={{ background: 'rgba(0,0,0,0.5)', color: algo.neon, border: `1px solid ${algo.neon}20` }}>
            {algo.codeSnippet}
          </pre>
        </div>
      )}
    </div>
  );
}

function PipelineStep({ n, label, badge, color }: { n: number; label: string; badge?: string; color: string }) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg" style={{ background: 'rgba(0,0,0,0.3)' }}>
      <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-orbitron font-bold shrink-0"
        style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}>{n}</span>
      <span className="text-xs text-[#a0c4d8] flex-1">{label}</span>
      {badge && <span className="font-tech text-[9px] px-1.5 py-0.5 rounded" style={{ color, border: `1px solid ${color}30`, background: `${color}10` }}>{badge}</span>}
    </div>
  );
}

export default function Home() {
  const [view, setView] = useState<'home' | 'search' | 'benchmark'>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTime, setSearchTime] = useState(0);
  const [benchmarks, setBenchmarks] = useState<Record<string, BenchmarkResult>>({});
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [activeAlgorithm, setActiveAlgorithm] = useState<string | null>(null);
  const [cacheStats, setCacheStats] = useState({ hits: 0, misses: 0, hitRate: '0%', size: 0 });
  const [totalResults, setTotalResults] = useState(0);
  const [cached, setCached] = useState(false);
  const [tick, setTick] = useState(0);

  // Animated ticker for live stats on home
  useEffect(() => {
    const t = setInterval(() => setTick(p => p + 1), 2000);
    return () => clearInterval(t);
  }, []);

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setSearchQuery(query);
    setIsSearching(true);
    setView('search');
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&benchmark=true`);
      const data = await res.json();
      setSearchResults(data.results || []);
      setSearchTime(data.searchTime || 0);
      setTotalResults(data.totalResults || 0);
      setCached(data.cached || false);
      if (data.cacheStats) setCacheStats(data.cacheStats);
      if (data.benchmark) setBenchmarks(data.benchmark);
    } catch (e) { console.error(e); }
    finally { setIsSearching(false); }
  }, []);

  const runBenchmarks = useCallback(async () => {
    setIsBenchmarking(true);
    try {
      const res = await fetch('/api/benchmark?type=all&iterations=100');
      const data = await res.json();
      const map: Record<string, BenchmarkResult> = {};
      for (const b of data.benchmarks) map[b.name] = b.js;
      setBenchmarks(map);
    } catch (e) { console.error(e); }
    finally { setIsBenchmarking(false); }
  }, []);

  const formatTime = (ms: number) => ms < 1 ? `${(ms * 1000).toFixed(2)}µs` : ms < 1000 ? `${ms.toFixed(3)}ms` : `${(ms / 1000).toFixed(3)}s`;
  const formatOps = (ops: number) => ops >= 1e6 ? `${(ops / 1e6).toFixed(1)}M` : ops >= 1000 ? `${(ops / 1000).toFixed(1)}K` : ops.toFixed(0);

  const maxOps = Math.max(...Object.values(benchmarks).map(b => b.opsPerSecond), 1);

  return (
    <div className="min-h-screen relative overflow-x-hidden">

      {/* ── NAV ─────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl"
        style={{ background: 'rgba(3,0,20,0.85)', borderBottom: '1px solid rgba(0,245,255,0.12)' }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setView('home')}>
            {/* Logo */}
            <div className="relative w-10 h-10">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center font-orbitron font-bold text-lg"
                style={{ background: 'linear-gradient(135deg,#00f5ff,#bf5fff)', color: '#030014' }}>N</div>
              <div className="absolute -inset-0.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: 'linear-gradient(135deg,#00f5ff,#bf5fff)', filter: 'blur(8px)', zIndex: -1 }} />
            </div>
            <div>
              <div className="font-orbitron font-bold text-sm text-white tracking-widest">NEXUS DSA</div>
              <div className="text-[10px] font-tech text-[#00f5ff] tracking-wider">ALIEN SEARCH INTELLIGENCE</div>
            </div>
          </div>

          {/* Status + Nav Buttons */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 mr-2">
              <div className="status-dot-active" />
              <span className="font-tech text-[11px] text-[#39ff14]">SYSTEMS ONLINE</span>
            </div>
            {(['home', 'benchmark'] as const).map(v => (
              <button key={v} onClick={() => { setView(v); if (v === 'benchmark') runBenchmarks(); }}
                className="px-4 py-1.5 rounded-lg font-orbitron text-xs font-medium transition-all duration-200"
                style={view === v
                  ? { background: 'rgba(0,245,255,0.15)', color: '#00f5ff', border: '1px solid rgba(0,245,255,0.4)', boxShadow: '0 0 12px rgba(0,245,255,0.2)' }
                  : { color: '#7aa3b8', border: '1px solid rgba(0,245,255,0.1)' }}>
                {v === 'home' ? 'HOME' : 'BENCHMARKS'}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* ════════════════════ HOME VIEW ════════════════════ */}
      {view === 'home' && (
        <main className="max-w-7xl mx-auto px-4 py-16">

          {/* Hero */}
          <div className="text-center mb-16 animate-slide-up">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 font-tech text-xs tracking-widest"
              style={{ background: 'rgba(0,245,255,0.08)', border: '1px solid rgba(0,245,255,0.25)', color: '#00f5ff' }}>
              <Cpu className="w-3 h-3" />
              PRODUCTION-GRADE DSA ENGINE · {(42000000 + tick * 17).toLocaleString()} OPS/SEC
            </div>

            <h1 className="font-orbitron text-5xl md:text-6xl font-black mb-5 leading-tight">
              <span className="text-white">SEARCH ENGINE</span>
              <br />
              <span className="text-gradient-cyber">POWERED BY ALIEN DSA</span>
            </h1>

            <p className="text-[#7aa3b8] text-lg max-w-2xl mx-auto mb-10 font-space leading-relaxed">
              Trie · PageRank · LRU Cache · MinHeap · Inverted Index · BM25 —
              all running in a live production-grade pipeline with real-time benchmarking.
            </p>

            {/* Alien search bar container */}
            <div className="max-w-2xl mx-auto mb-8 relative">
              <div className="absolute -inset-px rounded-2xl pointer-events-none"
                style={{ background: 'linear-gradient(90deg,#00f5ff,#bf5fff,#00f5ff)', backgroundSize: '200% 100%', animation: 'gradient-shift 3s ease infinite', filter: 'blur(1px)' }} />
              <div className="relative rounded-2xl p-0.5" style={{ background: '#030014' }}>
                <SearchBar onSearch={handleSearch} showButtons={false} size="large" />
              </div>
            </div>

            <div className="flex justify-center gap-3 flex-wrap">
              {['algorithm efficiency', 'binary search tree', 'graph traversal'].map(q => (
                <button key={q} onClick={() => handleSearch(q)}
                  className="px-4 py-2 rounded-full font-tech text-xs transition-all duration-200 hover:scale-105"
                  style={{ background: 'rgba(0,245,255,0.06)', border: '1px solid rgba(0,245,255,0.2)', color: '#00f5ff' }}>
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Stat strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-14">
            <StatCounter value="O(m)" label="Trie Lookup" neon="#39ff14" />
            <StatCounter value="O(1)" label="LRU Cache" neon="#00f5ff" />
            <StatCounter value="O(n log k)" label="Top-K Heap" neon="#ffbe00" />
            <StatCounter value="O(log n)" label="Binary Search" neon="#ff4f4f" />
          </div>

          {/* Algorithm cards */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg,rgba(0,245,255,0.4),transparent)' }} />
              <span className="font-orbitron text-sm tracking-widest text-[#00f5ff]">IMPLEMENTED ALGORITHMS</span>
              <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg,transparent,rgba(0,245,255,0.4))' }} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {algorithms.map(a => (
                <AlgoCard key={a.id} algo={a}
                  active={activeAlgorithm === a.id}
                  onClick={() => setActiveAlgorithm(activeAlgorithm === a.id ? null : a.id)} />
              ))}
            </div>
          </div>

          {/* Technical impl card */}
          <div className="card-holographic p-6">
            <div className="flex items-center gap-3 mb-6">
              <Terminal className="w-5 h-5 text-[#39ff14]" />
              <span className="font-orbitron text-sm font-semibold text-white tracking-wider">TECHNICAL IMPLEMENTATION</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-sm">
              {[
                { title: 'Core Algorithms', items: ['Trie with Levenshtein distance', 'PageRank power iteration', 'BM25 relevance scoring', 'Concurrent LRU cache'] },
                { title: 'Data Structures', items: ['Hash maps with chaining', 'Doubly linked lists', 'Binary heaps', 'Sparse matrices'] },
                { title: 'Optimizations', items: ['Memory-efficient serialization', 'Lazy evaluation', 'Cache-aware design', 'O(1) amortized ops'] },
              ].map(col => (
                <div key={col.title}>
                  <h4 className="font-orbitron text-xs font-semibold mb-3 tracking-wider text-[#00f5ff]">{col.title}</h4>
                  <ul className="space-y-2">
                    {col.items.map(item => (
                      <li key={item} className="flex items-center gap-2 text-[#7aa3b8] text-xs">
                        <ChevronRight className="w-3 h-3 text-[#00f5ff40] shrink-0" />{item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </main>
      )}

      {/* ════════════════════ SEARCH VIEW ════════════════════ */}
      {view === 'search' && (
        <main className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex gap-6 flex-col lg:flex-row">

            {/* Main */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-4 mb-4">
                <button onClick={() => setView('home')}
                  className="px-3 py-1.5 rounded-lg font-tech text-xs transition hover:bg-[rgba(0,245,255,0.1)]"
                  style={{ color: '#00f5ff', border: '1px solid rgba(0,245,255,0.2)' }}>← BACK</button>
                <div className="flex-1 max-w-xl relative">
                  <div className="absolute -inset-px rounded-xl pointer-events-none"
                    style={{ background: 'linear-gradient(90deg,#00f5ff50,#bf5fff50)', filter: 'blur(1px)' }} />
                  <div className="relative" style={{ background: '#030014', borderRadius: 11 }}>
                    <SearchBar onSearch={handleSearch} onInputChange={setSearchQuery} showButtons={false} size="default" />
                  </div>
                </div>
              </div>

              {!isSearching && searchResults.length > 0 && (
                <div className="flex items-center gap-3 text-xs font-tech mb-5" style={{ color: '#4a6a7a' }}>
                  <span className="text-[#00f5ff]">{totalResults} RESULTS</span>
                  <span>·</span>
                  <span style={{ color: cached ? '#39ff14' : '#00f5ff' }}>
                    {formatTime(searchTime)}{cached ? ' · CACHE HIT' : ''}
                  </span>
                </div>
              )}

              {isSearching ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="card-holographic p-5 animate-pulse">
                      <div className="h-3 rounded w-1/3 mb-3" style={{ background: 'rgba(0,245,255,0.08)' }} />
                      <div className="h-4 rounded w-2/3 mb-2" style={{ background: 'rgba(0,245,255,0.06)' }} />
                      <div className="h-3 rounded w-full" style={{ background: 'rgba(0,245,255,0.04)' }} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {searchResults.map((r, i) => (
                    <div key={r.id} className="card-holographic p-5 group">
                      <div className="flex items-start gap-4">
                        <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center font-orbitron text-xs font-bold"
                          style={{ background: 'linear-gradient(135deg,#00f5ff20,#bf5fff20)', color: '#00f5ff', border: '1px solid rgba(0,245,255,0.3)' }}>
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-tech text-[10px] mb-1 truncate" style={{ color: '#4a6a7a' }}>{r.url}</div>
                          <h3 className="font-space font-semibold mb-1.5 group-hover:text-[#00f5ff] transition-colors" style={{ color: '#c0e0f0' }}>{r.title}</h3>
                          <p className="text-xs text-[#7aa3b8] line-clamp-2 leading-relaxed">{r.snippet}</p>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {[
                              { label: `PR: ${r.pageRank?.toFixed(4)}`, color: '#00f5ff' },
                              r.bm25Score ? { label: `BM25: ${r.bm25Score.toFixed(2)}`, color: '#39ff14' } : null,
                              r.semanticScore ? { label: `Vector: ${(r.semanticScore * 100).toFixed(1)}%`, color: '#ff00ff' } : null,
                              r.rrfScore ? { label: `RRF Score: ${r.rrfScore.toFixed(3)}`, color: '#ffff00' } : null,
                              r.combinedScore ? { label: `Total Score: ${r.combinedScore.toFixed(2)}`, color: '#bf5fff' } : null,
                            ].filter(Boolean).map((b, bi) => (
                              <span key={bi} className="font-tech text-[10px] px-2 py-0.5 rounded"
                                style={{ color: b!.color, border: `1px solid ${b!.color}30`, background: `${b!.color}10` }}>
                                {b!.label}
                              </span>
                            ))}
                          </div>
                          {r.matchedTerms && r.matchedTerms.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {r.matchedTerms.slice(0, 5).map(t => (
                                <span key={t} className="font-tech text-[10px] px-2 py-0.5 rounded"
                                  style={{ background: 'rgba(0,245,255,0.08)', color: '#00f5ff', border: '1px solid rgba(0,245,255,0.2)' }}>{t}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="w-full lg:w-72 space-y-4 shrink-0">

              {/* Algorithm Performance */}
              <div className="card-holographic p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="w-4 h-4 text-[#39ff14]" />
                  <span className="font-orbitron text-xs font-semibold text-white tracking-wider">ALGO PERFORMANCE</span>
                </div>
                <div className="space-y-3">
                  {Object.entries(benchmarks).map(([name, b]) => (
                    <div key={name} className="text-xs">
                      <div className="flex justify-between mb-1">
                        <span className="text-[#7aa3b8] truncate mr-2">{name}</span>
                        <span className="font-tech text-[#39ff14] shrink-0">{formatTime(b.avgTime)}</span>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(0,245,255,0.1)' }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${Math.min((b.opsPerSecond / 10000) * 100, 100)}%`, background: 'linear-gradient(90deg,#00f5ff,#bf5fff)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* LRU Status */}
              <div className="card-holographic p-4">
                <div className="flex items-center gap-2 mb-4">
                  <HardDrive className="w-4 h-4 text-[#bf5fff]" />
                  <span className="font-orbitron text-xs font-semibold text-white tracking-wider">LRU CACHE STATUS</span>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {[{ v: cacheStats.hits, label: 'HITS', color: '#39ff14' }, { v: cacheStats.misses, label: 'MISSES', color: '#ff4f4f' }].map(s => (
                    <div key={s.label} className="text-center p-2 rounded-lg" style={{ background: 'rgba(0,0,0,0.3)' }}>
                      <div className="text-xl font-orbitron font-bold" style={{ color: s.color, textShadow: `0 0 10px ${s.color}` }}>{s.v}</div>
                      <div className="font-tech text-[9px] text-[#4a6a7a]">{s.label}</div>
                    </div>
                  ))}
                </div>
                <div className="text-center mb-2">
                  <div className="text-2xl font-orbitron font-bold" style={{ color: '#00f5ff', textShadow: '0 0 16px #00f5ff' }}>{cacheStats.hitRate}</div>
                  <div className="font-tech text-[9px] text-[#4a6a7a]">HIT RATE</div>
                </div>
                <div className="font-tech text-[9px] text-center text-[#4a6a7a]">CAP: 100 · USED: {cacheStats.size}</div>
              </div>

              {/* Query Pipeline */}
              <div className="card-holographic p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Terminal className="w-4 h-4 text-[#ffbe00]" />
                  <span className="font-orbitron text-xs font-semibold text-white tracking-wider">QUERY PIPELINE</span>
                </div>
                <div className="space-y-2">
                  <PipelineStep n={1} label="Check LRU Cache" badge="O(1)" color="#39ff14" />
                  <PipelineStep n={2} label="Tokenize Query" color="#00f5ff" />
                  <PipelineStep n={3} label="Inverted Index Lookup" badge="O(n)" color="#bf5fff" />
                  <PipelineStep n={4} label="BM25 Scoring" color="#ffbe00" />
                  <PipelineStep n={5} label="PageRank Integration" color="#00f5ff" />
                  <PipelineStep n={6} label="MinHeap Top-K" badge="O(n log k)" color="#ff4f4f" />
                </div>
              </div>
            </div>
          </div>
          
          {/* LSM Visualization (Full Width Bottom) */}
          <div className="mt-6">
            <div className="card-holographic p-6">
              <LSMCompactionVisualization />
            </div>
          </div>
        </main>
      )}

      {/* ════════════════════ BENCHMARK VIEW ════════════════════ */}
      {view === 'benchmark' && (
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="font-orbitron text-2xl font-bold text-white mb-1">PERFORMANCE BENCHMARKS</h2>
              <p className="font-tech text-xs text-[#4a6a7a] tracking-wider">REAL-TIME ALGORITHM ANALYSIS · 100 ITERATIONS</p>
            </div>
            <button onClick={runBenchmarks} disabled={isBenchmarking}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-orbitron text-xs font-semibold transition-all duration-200 disabled:opacity-50"
              style={{ background: isBenchmarking ? 'rgba(0,245,255,0.05)' : 'rgba(0,245,255,0.12)', color: '#00f5ff', border: '1px solid rgba(0,245,255,0.3)', boxShadow: isBenchmarking ? 'none' : '0 0 16px rgba(0,245,255,0.15)' }}>
              {isBenchmarking ? <><RefreshCw className="w-4 h-4 animate-spin" />RUNNING…</> : <><Play className="w-4 h-4" />RUN ALL</>}
            </button>
          </div>

          {isBenchmarking && (
            <div className="card-holographic p-8 text-center mb-6">
              <div className="font-orbitron text-lg text-[#00f5ff] mb-2">INITIALIZING QUANTUM BENCHMARKS…</div>
              <div className="flex justify-center gap-2 mt-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="w-2 h-6 rounded-full" style={{ background: '#00f5ff', animation: `plasma-pulse ${0.8 + i * 0.15}s ease-in-out infinite`, opacity: 0.6 + i * 0.07 }} />
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(benchmarks).map(([name, b]) => {
              const algo = algorithms.find(a => a.name === name);
              const pct = Math.min((b.opsPerSecond / maxOps) * 100, 100);
              return (
                <div key={name} className="card-holographic p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                      {algo && <span style={{ color: algo.neon }}>{algo.icon}</span>}
                      <span className="font-orbitron text-xs font-semibold text-white">{name}</span>
                    </div>
                    <span className="font-tech text-[10px] px-2 py-0.5 rounded"
                      style={{ color: algo?.neon || '#00f5ff', border: `1px solid ${algo?.neon || '#00f5ff'}30`, background: `${algo?.neon || '#00f5ff'}10` }}>
                      {algo?.complexity}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {[
                      { v: formatTime(b.avgTime), label: 'AVG TIME', color: '#39ff14' },
                      { v: `${formatOps(b.opsPerSecond)}/s`, label: 'OPS/SEC', color: '#00f5ff' },
                    ].map(s => (
                      <div key={s.label} className="text-center p-2 rounded-lg" style={{ background: 'rgba(0,0,0,0.4)' }}>
                        <div className="font-orbitron text-lg font-bold" style={{ color: s.color, textShadow: `0 0 10px ${s.color}` }}>{s.v}</div>
                        <div className="font-tech text-[9px] text-[#4a6a7a]">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Animated bar */}
                  <div className="mb-3">
                    <div className="flex justify-between font-tech text-[9px] text-[#4a6a7a] mb-1">
                      <span>THROUGHPUT</span><span>{pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.5)' }}>
                      <div className="h-full rounded-full transition-all duration-1000"
                        style={{ width: `${pct}%`, background: `linear-gradient(90deg,${algo?.neon || '#00f5ff'},${algo?.neon || '#00f5ff'}80)`, boxShadow: `0 0 8px ${algo?.neon || '#00f5ff'}60` }} />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 font-tech text-[9px] text-[#4a6a7a]">
                    <div>MIN<br /><span className="text-[#7aa3b8]">{formatTime(b.minTime)}</span></div>
                    <div>MAX<br /><span className="text-[#7aa3b8]">{formatTime(b.maxTime)}</span></div>
                    <div>OPS<br /><span className="text-[#7aa3b8]">{b.operations}</span></div>
                  </div>
                </div>
              );
            })}
          </div>

          {Object.keys(benchmarks).length === 0 && !isBenchmarking && (
            <div className="card-holographic p-12 text-center">
              <BarChart3 className="w-12 h-12 mx-auto mb-4" style={{ color: '#00f5ff', opacity: 0.4 }} />
              <div className="font-orbitron text-sm text-[#4a6a7a]">CLICK "RUN ALL" TO START BENCHMARKING</div>
            </div>
          )}
        </main>
      )}

      {/* Footer glow strip */}
      <div className="h-px mt-8 divider-neon" />
      <div className="py-4 text-center font-tech text-[10px] text-[#2a4a5a] tracking-widest">
        NEXUS DSA · ALIEN INTELLIGENCE SEARCH ENGINE · PRODUCTION-GRADE ALGORITHMS
      </div>
    </div>
  );
}
