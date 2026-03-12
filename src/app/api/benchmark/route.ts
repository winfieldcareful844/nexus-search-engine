import { NextRequest, NextResponse } from 'next/server';
import { getGlobalTrie, resetGlobalTrie } from '@/lib/dsa/Trie';
import { getGlobalEnhancedIndexAsync } from '@/lib/dsa/EnhancedInvertedIndex';
import { getGlobalPageRank, resetGlobalPageRank } from '@/lib/dsa/PageRank';
import { getGlobalWTinyLFU } from '@/lib/dsa/WTinyLFU';
import { getGlobalHNSW } from '@/lib/dsa/HNSW';
import { EmbeddingService } from '@/lib/dsa/EmbeddingService';
import { MinHeap } from '@/lib/dsa/MinHeap';
import { BinarySearch } from '@/lib/dsa/BinarySearch';
import { SkipList } from '@/lib/dsa/SkipList';
import { BloomFilter } from '@/lib/dsa/BloomFilter';
import { CountMinSketch } from '@/lib/dsa/CountMinSketch';
import { benchmarkRunner, complexityAnalyzer, type BenchmarkResult } from '@/lib/benchmark';
import { commonSearchTerms } from '@/lib/dsa/mockData';

interface BenchmarkEntry {
  name: string;
  js: BenchmarkResult;
  description: string;
  complexity: string;
  tradeoff?: string;
  novelty?: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get('type') || 'all';
  const query = searchParams.get('q') || 'algorithm';
  const iterations = parseInt(searchParams.get('iterations') || '100', 10);

  const results: BenchmarkEntry[] = [];

  try {
    // ── Bloom Filter ───────────────────────────────────────────────────
    if (type === 'all' || type === 'bloom') {
      const bloomBench = await benchmarkRunner.benchmark(
        'Bloom Filter',
        () => {
          const bf = new BloomFilter(1000, 0.01);
          for (let i = 0; i < 100; i++) bf.add(`query-${i}`);
          for (let i = 0; i < 100; i++) bf.has(`query-${i}`);
        }
      );
      const stats = BloomFilter.benchmark(10000, 0.01);
      results.push({
        name: 'Bloom Filter',
        js: bloomBench,
        description: 'Probabilistic membership: 10KB vs 80KB HashSet for 10K strings',
        complexity: 'O(k) add/has, O(m) bits total',
        tradeoff: `FPR=${(stats.actualFPR * 100).toFixed(2)}% vs theoretical ${(stats.theoreticalFPR * 100).toFixed(2)}%. Space: ${stats.bytes} bytes (4x smaller than HashMap)`,
        novelty: 'Kirsch-Mitzenmacher double-hashing: 2 base hashes → k independent positions',
      });
    }

    // ── Count-Min Sketch ───────────────────────────────────────────────
    if (type === 'all' || type === 'cms') {
      const cmsBench = await benchmarkRunner.benchmark(
        'Count-Min Sketch',
        () => {
          const cms = new CountMinSketch(0.001, 0.01);
          for (let i = 0; i < 100; i++) cms.updateWithTracking(`query-${i % 20}`);
          for (let i = 0; i < 20; i++) cms.estimate(`query-${i}`);
        }
      );
      const stats = CountMinSketch.benchmark(10000, 0.001, 0.01);
      results.push({
        name: 'Count-Min Sketch',
        js: cmsBench,
        description: 'Approximate frequency counting in O(w×d) fixed space',
        complexity: 'O(d) update/estimate, O(w×d) = O(1) space relative to stream size',
        tradeoff: `Max error ≤ ε×N = ${stats.maxError.toFixed(1)}. Observed: ${stats.maxObservedError}. Guarantee held: ${stats.guaranteeHeld}`,
        novelty: 'ε-δ approximation: error ≤ ε×N with probability ≥ 1-δ (proven). Supports merge() for distributed aggregation.',
      });
    }

    // ── Skip List ──────────────────────────────────────────────────────
    if (type === 'all' || type === 'skiplist') {
      const skipBench = await benchmarkRunner.benchmark(
        'Skip List',
        () => {
          const sl = new SkipList<number, string>();
          for (let i = 0; i < 100; i++) sl.insert(i, `v${i}`);
          for (let i = 0; i < 100; i++) sl.search(i);
          sl.range(25, 75);
        }
      );
      const stats = SkipList.benchmark(10000);
      results.push({
        name: 'Skip List',
        js: skipBench,
        description: 'Probabilistic sorted structure: O(log n) insert+search+delete (vs array: O(n) insert)',
        complexity: 'O(log n) expected all ops, O(n log n) space',
        tradeoff: `Actual levels: ${stats.levels}/${Math.ceil(Math.log2(10000))} expected. Insert: ${stats.insertOpsPerSec.toLocaleString()}/sec vs sorted-array O(n) shifts`,
        novelty: 'Coin-flip promotion: P(level≥k) = p^k. Redis ZSET uses this over AVL trees for lock-free concurrency.',
      });
    }

    // ── Enhanced Inverted Index (with vs without skip pointers) ────────
    if (type === 'all' || type === 'index') {
      const index = await getGlobalEnhancedIndexAsync();
      const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 1);
      const indexBench = await benchmarkRunner.benchmark(
        'Inverted Index (Enhanced BM25+Skip)',
        async () => terms.length > 1 ? await index.queryAND(terms) : await index.queryOR(terms)
      );
      const compStats = index.compressionStats();
      results.push({
        name: 'Inverted Index (Enhanced BM25+Skip)',
        js: indexBench,
        description: 'BM25 with proximity boost, skip-pointer AND, VByte gap compression',
        complexity: 'O(terms × √|posting|) with skips, vs O(terms × |posting|) naive',
        tradeoff: `Compression: ${compStats.totalRawBytes}B raw → ${compStats.totalCompressedBytes}B VByte (${compStats.compressionRatio.toFixed(1)}× ratio). ${compStats.terms} indexed terms.`,
        novelty: 'Phrase queries via positional intersection. Skip pointers every √len for 5-10× AND acceleration.',
      });
    }

    // ── Trie ──────────────────────────────────────────────────────────
    if (type === 'all' || type === 'trie') {
      const trie = getGlobalTrie();
      const trieBench = await benchmarkRunner.benchmark(
        'Trie Autocomplete',
        () => trie.autocomplete(query, 10)
      );
      results.push({
        name: 'Trie Autocomplete',
        js: trieBench,
        description: 'Prefix tree: O(m) autocomplete where m = query length',
        complexity: 'O(m) search/insert, O(ALPHABET×m×N) space',
        tradeoff: 'vs HashMap: same O(m) lookup but O(prefix) autocomplete vs O(n) scan',
      });
    }

    // ── PageRank ──────────────────────────────────────────────────────
    if (type === 'all' || type === 'pagerank') {
      resetGlobalPageRank();
      const pageRank = getGlobalPageRank();
      const prBench = await benchmarkRunner.benchmark(
        'PageRank Algorithm',
        () => { pageRank.compute(100, 0.0001); }
      );
      results.push({
        name: 'PageRank Algorithm',
        js: prBench,
        description: 'Power iteration convergence: initialize 1/N, iterate until ε<0.0001',
        complexity: 'O(V+E) per iteration × iterations to converge ≈ O(k(V+E))',
        tradeoff: 'Damping d=0.85 balances between "always random jump" (d=0) and "always follow links" (d=1)',
      });
    }

    // ── W-TinyLFU Cache ───────────────────────────────────────────────
    if (type === 'all' || type === 'cache') {
      const cache = getGlobalWTinyLFU();
      for (let i = 0; i < 50; i++) cache.put(`key${i}`, `value${i}`);
      const lruBench = await benchmarkRunner.benchmark(
        'W-TinyLFU Cache',
        () => { cache.get('key25'); cache.put(`k${Date.now()}`, 'v'); }
      );
      results.push({
        name: 'W-TinyLFU Cache',
        js: lruBench,
        description: 'Segmented LRU with Count-Min Sketch admission control',
        complexity: 'O(1) amortized for put/get. O(d) for sketch frequency estimation',
        tradeoff: 'Resists cache scanning attacks! New huge sequential scans will not evict your frequently accessed hot set.',
      });
    }

    // ── HNSW Vector Index ─────────────────────────────────────────────
    if (type === 'all' || type === 'hnsw') {
      const hnsw = getGlobalHNSW();
      const queryVec = EmbeddingService.embed(query);
      const hnswBench = await benchmarkRunner.benchmark(
        'HNSW Vector Search',
        () => hnsw.search(queryVec, 10, 50)
      );
      
      const stats = hnsw.stats();
      results.push({
        name: 'HNSW Semantic Search',
        js: hnswBench,
        description: 'Hierarchical Navigable Small World (ANN Vector Search)',
        complexity: 'O(log N) expected greedy-routing search time in high dimensions',
        tradeoff: `Graph holds ${stats.totalNodes} vectors. Max layer drops from ${stats.maxLevel} to 0. efConstruction bounds beam width.`,
        novelty: 'Enables "semantic" matching via vectors instead of absolute keyword matching. O(log N) instead of O(N) naive distance calculations.',
      });
    }

    // ── MinHeap ───────────────────────────────────────────────────────
    if (type === 'all' || type === 'heap') {
      const heapBench = await benchmarkRunner.benchmark(
        'MinHeap Top-K Selection',
        () => {
          const heap = new MinHeap(20);
          for (let i = 0; i < 1000; i++) {
            heap.insert({ id: `d${i}`, title: `Doc ${i}`, score: Math.random() * 100 });
          }
        }
      );
      results.push({
        name: 'MinHeap Top-K Selection',
        js: heapBench,
        description: 'Streaming top-K: O(n log k) vs O(n log n) sort',
        complexity: 'O(log k) insert, O(n log k) for n items, O(k) space',
        tradeoff: 'k=20, n=1000: 1000×log(20)≈4300 ops vs 1000×log(1000)≈10000 for sort. 2.3× faster.',
      });
    }

    // ── Binary Search ─────────────────────────────────────────────────
    if (type === 'all' || type === 'binary') {
      const bs = new BinarySearch();
      const sortedArray = commonSearchTerms.map(t => t.term).sort();
      const target = sortedArray[Math.floor(sortedArray.length / 2)];
      const bsBench = await benchmarkRunner.benchmark(
        'Binary Search',
        () => bs.search(sortedArray, target)
      );
      results.push({
        name: 'Binary Search',
        js: bsBench,
        description: 'Classic O(log n) search on sorted array',
        complexity: 'O(log n) — each iteration halves the search space',
        tradeoff: `n=${sortedArray.length}: ceil(log₂(n))=${Math.ceil(Math.log2(sortedArray.length))} comparisons max vs ${sortedArray.length} linear`,
      });
    }

    return NextResponse.json({
      benchmarks: results,
      systemInfo: {
        platform: typeof process !== 'undefined' ? process.platform : 'browser',
        nodeVersion: typeof process !== 'undefined' ? process.version : 'N/A',
        iterations,
        timestamp: Date.now(),
      },
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Benchmark failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      benchmarks: results,
    }, { status: 500 });
  }
}
