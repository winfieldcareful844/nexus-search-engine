'use client';

import { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Code } from 'lucide-react';
import TrieVisualization from './visualizations/TrieVisualization';
import PageRankVisualization from './visualizations/PageRankVisualization';
import LRUCacheVisualization from './visualizations/LRUCacheVisualization';
import MinHeapVisualization from './visualizations/MinHeapVisualization';
import InvertedIndexVisualization from './visualizations/InvertedIndexVisualization';
import LSMCompactionVisualization from './visualizations/LSMCompactionVisualization';

interface DSAPanelProps {
  searchQuery: string;
  isSearching: boolean;
  searchResults: Array<{
    id: string;
    title: string;
    url: string;
    pageRank: number;
  }>;
  cacheState: { key: string; value: string }[];
  cacheStats?: {
    hits: number;
    misses: number;
    hitRate: string;
  };
}

// Code snippets for each algorithm
const codeSnippets = {
  trie: `class TrieNode {
  children: Map<string, TrieNode>
  isEndOfWord: boolean
  frequency: number
}

// Insert: O(m) where m = key length
insert(word: string) {
  let current = this.root
  for (const char of word) {
    if (!current.children.has(char)) {
      current.children.set(char, new TrieNode())
    }
    current = current.children.get(char)
  }
  current.isEndOfWord = true
}

// Autocomplete: O(m + output)
autocomplete(prefix: string) {
  // Navigate to prefix node
  // DFS collect all words
  // Return sorted by frequency
}`,
  
  pageRank: `// PageRank Algorithm
PR(p) = (1-d)/N + d × Σ(PR(i)/L(i))

where:
- d = damping factor (0.85)
- N = total pages
- L(i) = outbound links from i

// Power iteration
for each iteration:
  for each page p:
    newRank[p] = (1-d)/N
    for each page i linking to p:
      newRank[p] += d * rank[i] / outlinks[i]
  // Check convergence`,

  lruCache: `class LRUCache {
  capacity: number
  cache: Map<K, Node>  // O(1) lookup
  head: Node  // Most recently used
  tail: Node  // Least recently used
  
  get(key: K): V | undefined {
    if (!cache.has(key)) return undefined
    // Move to front: O(1)
    moveToHead(cache.get(key))
    return cache.get(key).value
  }
  
  put(key: K, value: V) {
    if (cache.size >= capacity) {
      // Evict LRU: O(1)
      removeTail()
    }
    addToHead(new Node(key, value))
  }
}`,

  minHeap: `class MinHeap {
  heap: HeapNode[]
  
  // O(log n) insertion
  insert(node: HeapNode) {
    heap.push(node)
    bubbleUp(heap.length - 1)
  }
  
  // O(log n) extraction
  extractMin(): HeapNode {
    const min = heap[0]
    heap[0] = heap.pop()
    heapifyDown(0)
    return min
  }
  
  // O(n log k) for top-k
  findTopK(items: T[], k: number) {
    const heap = new MinHeap(k)
    for (item of items) heap.insert(item)
    return heap.toArray()
  }
}`,

  invertedIndex: `class InvertedIndex {
  index: Map<string, PostingList>
  
  // Build index: O(n × avg_doc_len)
  addDocument(doc: Document) {
    terms = tokenize(doc.content)
    for (term, position in terms) {
      index[term].postings.add({
        docId: doc.id,
        position: position,
        frequency: term.count
      })
    }
  }
  
  // Boolean queries: O(terms × postings)
  queryAND(terms: string[]) {
    postingLists = terms.map(getPostings)
    return intersect(postingLists)
  }
}`
};

export default function DSAPanel({
  searchQuery,
  searchResults,
  cacheState,
  cacheStats
}: DSAPanelProps) {
  const [activeTab, setActiveTab] = useState('trie');
  const [showCode, setShowCode] = useState(false);

  // Derived values using useMemo instead of useEffect + setState
  const searchPath = useMemo(() => {
    return searchQuery.length > 0 ? searchQuery.toLowerCase().split('') : [];
  }, [searchQuery]);

  const currentChar = useMemo(() => {
    return searchQuery[searchQuery.length - 1] || '';
  }, [searchQuery]);

  const heapData = useMemo(() => {
    return searchResults.slice(0, 7).map((r, i) => ({
      id: r.id,
      title: r.title,
      score: r.pageRank * 10 + (7 - i)
    }));
  }, [searchResults]);

  const pageRankNodes = useMemo(() => {
    return searchResults.map(r => ({
      id: r.id,
      title: r.title,
      rank: r.pageRank,
      outlinks: Math.floor(Math.random() * 5) + 1,
      inlinks: []
    }));
  }, [searchResults]);

  const searchTerms = useMemo(() => {
    return searchQuery.split(/\s+/).filter(t => t.length > 0);
  }, [searchQuery]);

  const matchedDocIds = useMemo(() => {
    return searchResults.map(r => r.id);
  }, [searchResults]);

  return (
    <div className="h-full flex flex-col bg-gray-50 border-l">
      {/* Header */}
      <div className="p-3 border-b bg-white">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <Code className="h-4 w-4 text-blue-500" />
            DSA Visualization
          </h2>
          <Badge variant="outline" className="text-[10px]">
            Live Demo
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid grid-cols-6 px-2 py-1 bg-white border-b">
          <TabsTrigger value="trie" className="text-[10px] px-1">Trie</TabsTrigger>
          <TabsTrigger value="pagerank" className="text-[10px] px-1">PageRank</TabsTrigger>
          <TabsTrigger value="lru" className="text-[10px] px-1">LRU</TabsTrigger>
          <TabsTrigger value="heap" className="text-[10px] px-1">Heap</TabsTrigger>
          <TabsTrigger value="index" className="text-[10px] px-1">Index</TabsTrigger>
          <TabsTrigger value="lsm" className="text-[10px] px-1">LSM</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-auto p-2">
          <TabsContent value="trie" className="mt-0">
            <TrieVisualization
              trieData={null}
              searchPath={searchPath}
              currentChar={currentChar}
            />
            {showCode && (
              <Card className="mt-2">
                <CardContent className="p-2">
                  <pre className="text-[10px] font-mono overflow-auto bg-gray-900 text-green-400 p-2 rounded">
                    {codeSnippets.trie}
                  </pre>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="pagerank" className="mt-0">
            <PageRankVisualization
              nodes={pageRankNodes}
              edges={[]}
            />
          </TabsContent>

          <TabsContent value="lru" className="mt-0">
            <LRUCacheVisualization
              cacheState={cacheState}
              stats={cacheStats}
            />
          </TabsContent>

          <TabsContent value="heap" className="mt-0">
            <MinHeapVisualization
              heap={heapData}
            />
          </TabsContent>

          <TabsContent value="index" className="mt-0">
            <InvertedIndexVisualization
              terms={searchTerms}
              matchedDocs={matchedDocIds}
            />
          </TabsContent>

          <TabsContent value="lsm" className="mt-0 p-2 overflow-auto">
            <LSMCompactionVisualization />
          </TabsContent>
        </div>
      </Tabs>

      {/* Footer with code toggle */}
      <div className="p-2 border-t bg-white">
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs"
          onClick={() => setShowCode(!showCode)}
        >
          {showCode ? 'Hide' : 'Show'} Code Snippet
        </Button>
      </div>
    </div>
  );
}
