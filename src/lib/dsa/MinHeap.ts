// Min-Heap Implementation for Top K Results
// Time Complexity: O(log n) for insert and extract-min, O(n log k) for top-k selection

export interface HeapNode {
  id: string;
  title: string;
  score: number;
  [key: string]: unknown;
}

export interface HeapVisualizationStep {
  type: 'insert' | 'extract' | 'heapify' | 'build';
  operation: string;
  heap: HeapNode[];
  currentIndex: number;
  description: string;
  comparisons: { parent: number; child: number }[];
}

export class MinHeap {
  private heap: HeapNode[];
  private maxSize: number;
  private visualizationSteps: HeapVisualizationStep[];

  constructor(maxSize: number = 10) {
    this.heap = [];
    this.maxSize = maxSize;
    this.visualizationSteps = [];
  }

  // Get parent index
  private parent(index: number): number {
    return Math.floor((index - 1) / 2);
  }

  // Get left child index
  private leftChild(index: number): number {
    return 2 * index + 1;
  }

  // Get right child index
  private rightChild(index: number): number {
    return 2 * index + 2;
  }

  // Swap two elements
  private swap(i: number, j: number): void {
    [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
  }

  // Insert a node into the heap - O(log n)
  insert(node: HeapNode): void {
    const comparisons: { parent: number; child: number }[] = [];
    
    if (this.heap.length >= this.maxSize) {
      // If new node is larger than minimum, replace it
      if (node.score > this.heap[0].score) {
        const removed = this.heap[0];
        this.heap[0] = node;
        
        this.visualizationSteps.push({
          type: 'insert',
          operation: `INSERT(${node.title}, score: ${node.score})`,
          heap: [...this.heap],
          currentIndex: 0,
          description: `Heap full. Replaced min (${removed.title}, score: ${removed.score}) with larger node`,
          comparisons: []
        });
        
        this.heapifyDown(0);
      } else {
        this.visualizationSteps.push({
          type: 'insert',
          operation: `INSERT(${node.title}, score: ${node.score})`,
          heap: [...this.heap],
          currentIndex: -1,
          description: `Node score (${node.score}) <= current min (${this.heap[0].score}), ignored`,
          comparisons: []
        });
      }
      return;
    }

    // Add to end
    this.heap.push(node);
    let currentIndex = this.heap.length - 1;

    this.visualizationSteps.push({
      type: 'insert',
      operation: `INSERT(${node.title}, score: ${node.score})`,
      heap: [...this.heap],
      currentIndex,
      description: `Added node at index ${currentIndex}`,
      comparisons: []
    });

    // Bubble up
    while (currentIndex > 0) {
      const parentIndex = this.parent(currentIndex);
      comparisons.push({ parent: parentIndex, child: currentIndex });

      if (this.heap[parentIndex].score <= this.heap[currentIndex].score) {
        break;
      }

      this.swap(parentIndex, currentIndex);
      currentIndex = parentIndex;

      this.visualizationSteps.push({
        type: 'heapify',
        operation: 'BUBBLE UP',
        heap: [...this.heap],
        currentIndex,
        description: `Swapped with parent. New position: index ${currentIndex}`,
        comparisons: [...comparisons]
      });
    }
  }

  // Heapify down - O(log n)
  private heapifyDown(index: number): void {
    let currentIndex = index;
    const comparisons: { parent: number; child: number }[] = [];

    while (true) {
      const left = this.leftChild(currentIndex);
      const right = this.rightChild(currentIndex);
      let smallest = currentIndex;

      if (left < this.heap.length && this.heap[left].score < this.heap[smallest].score) {
        smallest = left;
        comparisons.push({ parent: currentIndex, child: left });
      }

      if (right < this.heap.length && this.heap[right].score < this.heap[smallest].score) {
        smallest = right;
        comparisons.push({ parent: currentIndex, child: right });
      }

      if (smallest === currentIndex) break;

      this.swap(currentIndex, smallest);
      currentIndex = smallest;

      this.visualizationSteps.push({
        type: 'heapify',
        operation: 'HEAPIFY DOWN',
        heap: [...this.heap],
        currentIndex,
        description: `Swapped with smaller child. New position: index ${currentIndex}`,
        comparisons: [...comparisons]
      });
    }
  }

  // Extract minimum - O(log n)
  extractMin(): HeapNode | undefined {
    if (this.heap.length === 0) return undefined;

    const min = this.heap[0];
    const last = this.heap.pop()!;

    if (this.heap.length > 0) {
      this.heap[0] = last;
      
      this.visualizationSteps.push({
        type: 'extract',
        operation: `EXTRACT MIN: ${min.title}`,
        heap: [...this.heap],
        currentIndex: 0,
        description: `Extracted ${min.title} (score: ${min.score}), moved last element to root`,
        comparisons: []
      });
      
      this.heapifyDown(0);
    } else {
      this.visualizationSteps.push({
        type: 'extract',
        operation: `EXTRACT MIN: ${min.title}`,
        heap: [],
        currentIndex: -1,
        description: `Extracted ${min.title} (score: ${min.score}), heap is now empty`,
        comparisons: []
      });
    }

    return min;
  }

  // Peek at minimum without removing
  peek(): HeapNode | undefined {
    return this.heap[0];
  }

  // Get current heap size
  size(): number {
    return this.heap.length;
  }

  // Check if heap is empty
  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  // Get heap as array
  getHeap(): HeapNode[] {
    return [...this.heap];
  }

  // Get visualization steps
  getVisualizationSteps(): HeapVisualizationStep[] {
    return this.visualizationSteps;
  }

  // Clear visualization steps
  clearVisualizationSteps(): void {
    this.visualizationSteps = [];
  }

  // Clear heap
  clear(): void {
    this.heap = [];
    this.visualizationSteps = [];
  }

  // Build heap from array - O(n)
  buildHeap(nodes: HeapNode[]): void {
    this.heap = [...nodes];
    
    this.visualizationSteps.push({
      type: 'build',
      operation: 'BUILD HEAP',
      heap: [...this.heap],
      currentIndex: -1,
      description: `Building heap from ${nodes.length} elements`,
      comparisons: []
    });

    // Start from last non-leaf node
    for (let i = Math.floor(this.heap.length / 2) - 1; i >= 0; i--) {
      this.heapifyDown(i);
    }
  }

  // Get heap as tree structure for visualization
  getTreeStructure(): { 
    nodes: { id: string; title: string; score: number; index: number; level: number }[];
    edges: { from: number; to: number }[];
  } {
    const nodes: { id: string; title: string; score: number; index: number; level: number }[] = [];
    const edges: { from: number; to: number }[] = [];

    this.heap.forEach((node, index) => {
      const level = Math.floor(Math.log2(index + 1));
      nodes.push({
        id: node.id,
        title: node.title,
        score: node.score,
        index,
        level
      });

      const left = this.leftChild(index);
      const right = this.rightChild(index);

      if (left < this.heap.length) {
        edges.push({ from: index, to: left });
      }
      if (right < this.heap.length) {
        edges.push({ from: index, to: right });
      }
    });

    return { nodes, edges };
  }
}

// Find top K elements using min-heap
export function findTopK<T extends { id: string; title: string; score: number }>(
  items: T[],
  k: number
): { topK: T[]; steps: HeapVisualizationStep[] } {
  const heap = new MinHeap(k);

  items.forEach(item => {
    heap.insert({
      ...item,
      id: item.id,
      title: item.title,
      score: item.score
    });
  });

  // Extract all elements (will be in reverse order)
  const result: HeapNode[] = [];
  while (!heap.isEmpty()) {
    result.unshift(heap.extractMin()!);
  }

  return {
    topK: result.reverse() as T[], // Reverse to get descending order
    steps: heap.getVisualizationSteps()
  };
}

// Singleton instance
let globalMinHeap: MinHeap | null = null;

export function getGlobalMinHeap(): MinHeap {
  if (!globalMinHeap) {
    globalMinHeap = new MinHeap(10);
  }
  return globalMinHeap;
}

export function resetGlobalMinHeap(): void {
  globalMinHeap = null;
}
