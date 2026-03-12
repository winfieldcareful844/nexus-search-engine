// Binary Search Algorithm Implementation
// Time Complexity: O(log n) where n is the array length

export interface SearchResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  relevance: number;
}

export interface BinarySearchStep {
  step: number;
  left: number;
  right: number;
  mid: number;
  midValue: string;
  target: string;
  comparison: 'less' | 'greater' | 'equal' | 'not_found';
  description: string;
  array: { value: string; highlighted: boolean; inRange: boolean }[];
}

export class BinarySearch {
  private steps: BinarySearchStep[];

  constructor() {
    this.steps = [];
  }

  // Binary search on sorted array of strings
  search(
    sortedArray: string[],
    target: string
  ): { found: boolean; index: number; steps: BinarySearchStep[] } {
    this.steps = [];
    let left = 0;
    let right = sortedArray.length - 1;
    let stepCount = 0;

    while (left <= right) {
      stepCount++;
      const mid = Math.floor((left + right) / 2);
      const midValue = sortedArray[mid];

      // Create visualization for current step
      const arrayVisualization = sortedArray.map((value, idx) => ({
        value,
        highlighted: idx === mid,
        inRange: idx >= left && idx <= right
      }));

      let comparison: 'less' | 'greater' | 'equal' | 'not_found';
      let description: string;

      if (midValue === target) {
        comparison = 'equal';
        description = `Found '${target}' at index ${mid}! Search complete.`;
        
        this.steps.push({
          step: stepCount,
          left,
          right,
          mid,
          midValue,
          target,
          comparison,
          description,
          array: arrayVisualization
        });

        return { found: true, index: mid, steps: this.steps };
      } else if (midValue < target) {
        comparison = 'less';
        description = `Comparing '${midValue}' (mid) with '${target}': ${midValue} < ${target}, search right half`;
        left = mid + 1;
      } else {
        comparison = 'greater';
        description = `Comparing '${midValue}' (mid) with '${target}': ${midValue} > ${target}, search left half`;
        right = mid - 1;
      }

      this.steps.push({
        step: stepCount,
        left,
        right,
        mid,
        midValue,
        target,
        comparison,
        description,
        array: arrayVisualization
      });
    }

    // Target not found
    this.steps.push({
      step: stepCount + 1,
      left,
      right,
      mid: -1,
      midValue: '',
      target,
      comparison: 'not_found',
      description: `'${target}' not found in the array`,
      array: sortedArray.map(value => ({ value, highlighted: false, inRange: false }))
    });

    return { found: false, index: -1, steps: this.steps };
  }

  // Binary search on sorted array of objects by a key
  searchByProperty<T>(
    sortedArray: T[],
    target: string,
    keyFn: (item: T) => string
  ): { found: boolean; index: number; steps: BinarySearchStep[] } {
    this.steps = [];
    let left = 0;
    let right = sortedArray.length - 1;
    let stepCount = 0;

    while (left <= right) {
      stepCount++;
      const mid = Math.floor((left + right) / 2);
      const midValue = keyFn(sortedArray[mid]);

      const arrayVisualization = sortedArray.map((item, idx) => ({
        value: keyFn(item),
        highlighted: idx === mid,
        inRange: idx >= left && idx <= right
      }));

      let comparison: 'less' | 'greater' | 'equal' | 'not_found';
      let description: string;

      if (midValue === target) {
        comparison = 'equal';
        description = `Found '${target}' at index ${mid}!`;
        
        this.steps.push({
          step: stepCount,
          left,
          right,
          mid,
          midValue,
          target,
          comparison,
          description,
          array: arrayVisualization
        });

        return { found: true, index: mid, steps: this.steps };
      } else if (midValue < target) {
        comparison = 'less';
        description = `'${midValue}' < '${target}': searching right half [${mid + 1}...${right}]`;
        left = mid + 1;
      } else {
        comparison = 'greater';
        description = `'${midValue}' > '${target}': searching left half [${left}...${mid - 1}]`;
        right = mid - 1;
      }

      this.steps.push({
        step: stepCount,
        left,
        right,
        mid,
        midValue,
        target,
        comparison,
        description,
        array: arrayVisualization
      });
    }

    return { found: false, index: -1, steps: this.steps };
  }

  // Binary search for filtering results within a range
  searchRange<T>(
    sortedArray: T[],
    minVal: string,
    maxVal: string,
    keyFn: (item: T) => string
  ): { results: T[]; steps: BinarySearchStep[] } {
    this.steps = [];
    const results: T[] = [];

    // Simple linear scan for range (could be optimized with two binary searches)
    sortedArray.forEach((item, idx) => {
      const value = keyFn(item);
      
      const arrayVisualization = sortedArray.map((i, iIdx) => ({
        value: keyFn(i),
        highlighted: iIdx === idx,
        inRange: true
      }));

      if (value >= minVal && value <= maxVal) {
        results.push(item);
        this.steps.push({
          step: idx + 1,
          left: 0,
          right: sortedArray.length - 1,
          mid: idx,
          midValue: value,
          target: `${minVal} - ${maxVal}`,
          comparison: 'equal',
          description: `'${value}' is in range [${minVal}, ${maxVal}], added to results`,
          array: arrayVisualization
        });
      }
    });

    return { results, steps: this.steps };
  }

  // Get all steps
  getSteps(): BinarySearchStep[] {
    return this.steps;
  }

  // Clear steps
  clearSteps(): void {
    this.steps = [];
  }
}

// Binary search on relevance scores (for filtering search results)
export class ResultFilter {
  private binarySearch: BinarySearch;

  constructor() {
    this.binarySearch = new BinarySearch();
  }

  // Filter results by minimum relevance score
  filterByMinRelevance(
    results: SearchResult[],
    minRelevance: number
  ): { filtered: SearchResult[]; steps: BinarySearchStep[] } {
    // Sort by relevance score descending
    const sorted = [...results].sort((a, b) => b.relevance - a.relevance);
    
    // Binary search for the cutoff point
    const scores = sorted.map(r => r.relevance.toString().padStart(5, '0'));
    
    const searchResult = this.binarySearch.search(scores, minRelevance.toString().padStart(5, '0'));
    
    // Return all results above the threshold
    const filtered = sorted.filter(r => r.relevance >= minRelevance);
    
    return {
      filtered,
      steps: searchResult.steps
    };
  }

  // Get top K results by relevance using binary search approach
  getTopK(
    results: SearchResult[],
    k: number
  ): { topK: SearchResult[]; steps: BinarySearchStep[] } {
    const sorted = [...results].sort((a, b) => b.relevance - a.relevance);
    const topK = sorted.slice(0, k);
    
    return {
      topK,
      steps: [{
        step: 1,
        left: 0,
        right: sorted.length - 1,
        mid: k - 1,
        midValue: topK[topK.length - 1]?.relevance.toString() || '0',
        target: `top ${k}`,
        comparison: 'equal',
        description: `Selected top ${k} results by relevance`,
        array: sorted.map((r, idx) => ({
          value: r.relevance.toFixed(2),
          highlighted: idx < k,
          inRange: true
        }))
      }]
    };
  }
}

// Singleton instance
let globalBinarySearch: BinarySearch | null = null;

export function getGlobalBinarySearch(): BinarySearch {
  if (!globalBinarySearch) {
    globalBinarySearch = new BinarySearch();
  }
  return globalBinarySearch;
}
