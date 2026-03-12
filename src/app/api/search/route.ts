import { NextRequest, NextResponse } from 'next/server';
import { mockWebPages } from '@/lib/dsa/mockData';
import { getGlobalTrie } from '@/lib/dsa/Trie';
import { getGlobalPageRank } from '@/lib/dsa/PageRank';
import { getGlobalWTinyLFU } from '@/lib/dsa/WTinyLFU';
import { findTopK } from '@/lib/dsa/MinHeap';
import { benchmarkRunner, type BenchmarkResult } from '@/lib/benchmark';
import { getNegativeCache } from '@/lib/dsa/BloomFilter';
import { getQuerySketch } from '@/lib/dsa/CountMinSketch';
import { getGlobalEnhancedIndexAsync } from '@/lib/dsa/EnhancedInvertedIndex';
import { getGlobalHNSW } from '@/lib/dsa/HNSW';
import { EmbeddingService } from '@/lib/dsa/EmbeddingService';

/**
 * Enhanced Search Pipeline
 *
 * Request flow (all steps timed individually):
 *
 *  1. Bloom Filter negative-cache check          O(k) hash functions
 *     → Skip entire pipeline for known-zero queries
 *
 *  2. LRU Cache hit check                        O(1)
 *     → Return cached results instantly
 *
 *  3. Count-Min Sketch: record query frequency   O(d) hash functions
 *     → Track hot queries for analytics
 *
 *  4. Trie autocorrect / query expansion         O(m) where m = query len
 *     → Expand short prefixes to best matching terms
 *
 *  5. EnhancedInvertedIndex query                O(terms × √|posting|) w/ skip ptrs
 *     → Phrase query if quoted, AND with skips if multi-term, OR otherwise
 *     → BM25 + proximity bonus scoring
 *
 *  6. PageRank integration                       O(k) map lookups
 *     → Multiply BM25 × PageRank for final combined score
 *
 *  7. MinHeap top-K selection                    O(n log k)
 *     → Extract top 20 results from potentially large candidate set
 *
 *  8. If zero results: add query to Bloom filter O(k)
 *     → Future identical queries skip to step 1
 *
 *  9. LRU Cache write                            O(1)
 *     → Store serialized results
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = (searchParams.get('q') || '').trim();
  const doBench = searchParams.get('benchmark') === 'true';
  const isPhraseQ = query.startsWith('"') && query.endsWith('"');

  if (!query) return NextResponse.json({ results: [], totalResults: 0 });

  const pipelineTiming: Record<string, number> = {};
  const pipelineStart = performance.now();

  // ── Step 1: Bloom Filter negative cache ──────────────────────────────
  const t1 = performance.now();
  const negCache = getNegativeCache();
  const isKnownZero = negCache.has(query);
  pipelineTiming['bloomFilter_ns'] = (performance.now() - t1) * 1e6;

  if (isKnownZero) {
    return NextResponse.json({
      results: [],
      totalResults: 0,
      searchTime: performance.now() - pipelineStart,
      cached: false,
      pipelineShortCircuit: 'bloom_filter_negative_cache',
      bloomFilter: negCache.stats(),
    });
  }

  // ── Step 2: LRU cache check ───────────────────────────────────────────
  const t2 = performance.now();
  const cache = getGlobalWTinyLFU();
  const cachedRaw = cache.get(query);
  pipelineTiming['wTinyLFU_ns'] = (performance.now() - t2) * 1e6;

  if (cachedRaw) {
    const parsed = JSON.parse(cachedRaw);
    return NextResponse.json({
      results: parsed,
      totalResults: parsed.length,
      searchTime: performance.now() - pipelineStart,
      cached: true,
      cacheStats: cache.getStats(),
      pipelineTiming,
    });
  }

  // ── Step 3: Count-Min Sketch frequency tracking ───────────────────────
  const t3 = performance.now();
  const sketch = getQuerySketch();
  sketch.updateWithTracking(query);
  const queryFrequency = sketch.estimate(query);
  const hotQueryThresh = sketch.stats().totalCount * 0.001; // top 0.1%
  const isHot = queryFrequency > hotQueryThresh;
  pipelineTiming['countMinSketch_ns'] = (performance.now() - t3) * 1e6;

  // ── Step 4: Trie query expansion ─────────────────────────────────────
  const t4 = performance.now();
  const trie = getGlobalTrie();
  const terms = query
    .replace(/^"|"$/g, '') // strip phrase quotes
    .toLowerCase()
    .split(/\s+/)
    .filter(t => t.length > 1);

  // If query is short (1 term ≤ 4 chars), try autocomplete expansion
  let expandedTerms = [...terms];
  if (terms.length === 1 && terms[0].length <= 4) {
    const suggestions = trie.autocomplete(terms[0], 3);
    if (suggestions.length > 0) expandedTerms = [...terms, ...suggestions];
  }
  pipelineTiming['trie_ns'] = (performance.now() - t4) * 1e6;

  // ── Step 5: Dual Search (Lexical + Semantic) ─────────────────────────
  const t5 = performance.now();
  const enhancedIndex = await getGlobalEnhancedIndexAsync();
  const vectorDb = getGlobalHNSW();

  let lexicalResults;
  if (isPhraseQ) {
    lexicalResults = await enhancedIndex.queryPhrase(terms);
  } else if (terms.length > 1) {
    const andResults = await enhancedIndex.queryAND(terms);
    lexicalResults = andResults.length > 0 ? andResults : await enhancedIndex.queryOR(expandedTerms);
  } else {
    lexicalResults = await enhancedIndex.queryOR(expandedTerms);
  }

  // Generate embedding for query
  const queryVector = EmbeddingService.embed(query);
  const semanticResults = vectorDb.search(queryVector, 50, 50);

  pipelineTiming['search_execution_ns'] = (performance.now() - t5) * 1e6;

  // ── Step 5b: Reciprocal Rank Fusion (RRF) ──────────────────────────
  const t5b = performance.now();
  
  // RRF Constant k (usually 60)
  const RRF_K = 60;
  
  // Map to accumulate RRF scores
  const rrfScores = new Map<string, { rrfScore: number, lexicalScore: number, semanticScore: number, matchedTerms: string[], phraseMatch: boolean, proximityBonus: number }>();

  // Add Lexical Ranks
  lexicalResults.forEach((result, index) => {
    const rank = index + 1;
    const rrf = 1.0 / (RRF_K + rank);
    rrfScores.set(result.docId, {
      rrfScore: rrf,
      lexicalScore: result.score,
      semanticScore: 0,
      matchedTerms: result.matchedTerms,
      phraseMatch: result.phraseMatch || false,
      proximityBonus: result.proximityBonus || 0
    });
  });

  // Add Semantic Ranks
  semanticResults.forEach((result, index) => {
    const rank = index + 1;
    const rrf = 1.0 / (RRF_K + rank);
    
    if (rrfScores.has(result.id)) {
      const entry = rrfScores.get(result.id)!;
      entry.rrfScore += rrf;
      entry.semanticScore = result.score;
    } else {
      rrfScores.set(result.id, {
        rrfScore: rrf,
        lexicalScore: 0,
        semanticScore: result.score,
        matchedTerms: [],
        phraseMatch: false,
        proximityBonus: 0
      });
    }
  });

  pipelineTiming['rrf_fusion_ns'] = (performance.now() - t5b) * 1e6;

  // ── Step 6: PageRank integration ─────────────────────────────────────
  const t6 = performance.now();
  const pageRank = getGlobalPageRank();

  const combinedResults = Array.from(rrfScores.entries()).map(([docId, data]) => {
    const page = mockWebPages.find(p => p.id === docId);
    const prScore = pageRank.getRank(docId);

    // Final Score combines RRF score heavily weighted, plus a small fraction of PageRank
    // RRF scores are typically small (e.g., 0.03 + 0.01 = 0.04)
    const combinedScore = (data.rrfScore * 100) + (prScore * 5);

    return {
      id: docId,
      title: page?.title || 'Unknown',
      url: page?.url || '',
      snippet: page?.snippet || '',
      keywords: page?.keywords || [],
      pageRank: prScore,
      bm25Score: data.lexicalScore,
      semanticScore: data.semanticScore,
      rrfScore: data.rrfScore,
      matchedTerms: data.matchedTerms,
      combinedScore,
      phraseMatch: data.phraseMatch,
      proximityBonus: data.proximityBonus,
    };
  });
  pipelineTiming['pagerank_ns'] = (performance.now() - t6) * 1e6;

  // ── Step 7: MinHeap top-K ─────────────────────────────────────────────
  const t7 = performance.now();
  const topKResult = findTopK(
    combinedResults.map(r => ({ ...r, score: r.combinedScore })),
    20
  );
  const results = topKResult.topK.sort((a: any, b: any) => b.combinedScore - a.combinedScore);
  pipelineTiming['minHeap_ns'] = (performance.now() - t7) * 1e6;

  // ── Step 8: Zero-result negative caching ─────────────────────────────
  if (results.length === 0) {
    negCache.add(query);
  }

  // ── Step 9: W-TinyLFU Write ─────────────────────────────────────────
  const t9 = performance.now();
  cache.put(query, JSON.stringify(results));
  pipelineTiming['cacheWrite_ns'] = (performance.now() - t9) * 1e6;

  const searchTime = performance.now() - pipelineStart;

  // ── Optional: benchmarks ─────────────────────────────────────────────
  let benchmarkResults: Record<string, BenchmarkResult> | undefined;
  if (doBench) {
    const [trieBench, indexBench, prBench, heapBench] = await Promise.all([
      benchmarkRunner.benchmark('Trie Autocomplete',
        () => trie.autocomplete(query, 10)),
      benchmarkRunner.benchmark('Inverted Index (Enhanced BM25+Skip)',
        async () => await enhancedIndex.queryOR(terms)),
      benchmarkRunner.benchmark('PageRank Lookup',
        () => { for (const r of lexicalResults.slice(0, 20)) pageRank.getRank(r.docId); }),
      benchmarkRunner.benchmark('MinHeap Top-K',
        () => findTopK(combinedResults.map(r => ({ ...r, score: r.combinedScore })), 20)),
    ]);

    benchmarkResults = {
      'Trie Autocomplete': trieBench,
      'Inverted Index (Enhanced BM25+Skip)': indexBench,
      'PageRank Algorithm': prBench,
      'MinHeap Top-K Selection': heapBench,
    };
  }

  return NextResponse.json({
    results,
    totalResults: results.length,
    searchTime,
    cached: false,
    queryMeta: {
      original: query,
      isPhraseQuery: isPhraseQ,
      terms,
      expandedTerms,
      frequency: queryFrequency,
      isHotQuery: isHot,
      queryMode: isPhraseQ ? 'PHRASE' : terms.length > 1 ? 'AND→OR' : 'OR',
    },
    pipelineTiming,        // nanosecond breakdown of each step
    cacheStats: cache.getStats(),
    bloomFilter: negCache.stats(),
    sketchStats: sketch.stats(),
    compressionStats: enhancedIndex.compressionStats(),
    benchmark: benchmarkResults,
    pageRankTopPages: pageRank.getTopPages(5),
  });
}
