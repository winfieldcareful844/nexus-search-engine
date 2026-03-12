// PageRank Algorithm Implementation
// Simplified version of Google's PageRank using the power iteration method

import { mockWebPages, WebPage, buildLinkGraph } from './mockData';

export interface PageRankNode {
  id: string;
  title: string;
  rank: number;
  outlinks: number;
  inlinks: string[];
}

export interface PageRankIteration {
  iteration: number;
  ranks: Map<string, number>;
  maxDiff: number;
  description: string;
}

export interface PageRankVisualizationStep {
  type: 'init' | 'iterate' | 'converge';
  nodes: PageRankNode[];
  edges: { from: string; to: string }[];
  currentIteration: number;
  description: string;
}

export class PageRank {
  private pages: WebPage[];
  private dampingFactor: number;
  private graph: Map<string, string[]>; // Maps page ID to array of pages that link TO it
  private outlinkCount: Map<string, number>; // Maps page ID to number of outlinks
  private ranks: Map<string, number>;
  private iterations: PageRankIteration[];
  private visualizationSteps: PageRankVisualizationStep[];

  constructor(dampingFactor: number = 0.85) {
    this.pages = mockWebPages;
    this.dampingFactor = dampingFactor;
    this.graph = new Map();
    this.outlinkCount = new Map();
    this.ranks = new Map();
    this.iterations = [];
    this.visualizationSteps = [];
    
    this.initializeGraph();
  }

  private initializeGraph(): void {
    // Initialize outlink count for each page
    this.pages.forEach(page => {
      this.outlinkCount.set(page.id, page.linksTo.length);
      this.graph.set(page.id, []);
    });

    // Build reverse graph (who links to each page)
    this.pages.forEach(page => {
      page.linksTo.forEach(targetId => {
        const inboundLinks = this.graph.get(targetId) || [];
        inboundLinks.push(page.id);
        this.graph.set(targetId, inboundLinks);
      });
    });
  }

  // Initialize ranks uniformly
  initialize(): void {
    const initialRank = 1 / this.pages.length;
    
    this.pages.forEach(page => {
      this.ranks.set(page.id, initialRank);
    });

    this.visualizationSteps.push({
      type: 'init',
      nodes: this.getNodes(),
      edges: this.getEdges(),
      currentIteration: 0,
      description: `Initialized all ${this.pages.length} pages with rank ${(initialRank).toFixed(4)} each (1/N)`
    });
  }

  // Perform one iteration of PageRank
  iterate(): number {
    const newRanks = new Map<string, number>();
    const N = this.pages.length;

    // Calculate rank for each page
    this.pages.forEach(page => {
      const inlinks = this.graph.get(page.id) || [];
      
      // Sum of contributions from pages linking to this page
      let rankSum = 0;
      inlinks.forEach(sourceId => {
        const sourceRank = this.ranks.get(sourceId) || 0;
        const sourceOutlinks = this.outlinkCount.get(sourceId) || 1;
        rankSum += sourceRank / sourceOutlinks;
      });

      // PageRank formula: PR(p) = (1-d)/N + d * sum(PR(i)/L(i))
      const newRank = (1 - this.dampingFactor) / N + this.dampingFactor * rankSum;
      newRanks.set(page.id, newRank);
    });

    // Calculate maximum difference for convergence check
    let maxDiff = 0;
    this.ranks.forEach((oldRank, id) => {
      const newRank = newRanks.get(id) || 0;
      maxDiff = Math.max(maxDiff, Math.abs(newRank - oldRank));
    });

    // Update ranks
    this.ranks = newRanks;

    return maxDiff;
  }

  // Run PageRank until convergence
  compute(maxIterations: number = 100, tolerance: number = 0.0001): Map<string, number> {
    this.initialize();

    for (let i = 1; i <= maxIterations; i++) {
      const maxDiff = this.iterate();
      
      const iterationInfo: PageRankIteration = {
        iteration: i,
        ranks: new Map(this.ranks),
        maxDiff,
        description: `Iteration ${i}: Max difference = ${maxDiff.toFixed(6)}`
      };
      this.iterations.push(iterationInfo);

      this.visualizationSteps.push({
        type: 'iterate',
        nodes: this.getNodes(),
        edges: this.getEdges(),
        currentIteration: i,
        description: `Iteration ${i}: Max rank change = ${maxDiff.toFixed(6)}`
      });

      if (maxDiff < tolerance) {
        this.visualizationSteps.push({
          type: 'converge',
          nodes: this.getNodes(),
          edges: this.getEdges(),
          currentIteration: i,
          description: `Converged after ${i} iterations!`
        });
        break;
      }
    }

    return this.ranks;
  }

  // Get current nodes with their ranks
  getNodes(): PageRankNode[] {
    return this.pages.map(page => ({
      id: page.id,
      title: page.title,
      rank: this.ranks.get(page.id) || 0,
      outlinks: this.outlinkCount.get(page.id) || 0,
      inlinks: this.graph.get(page.id) || []
    }));
  }

  // Get all edges in the graph
  getEdges(): { from: string; to: string }[] {
    const edges: { from: string; to: string }[] = [];
    
    this.pages.forEach(page => {
      page.linksTo.forEach(targetId => {
        edges.push({ from: page.id, to: targetId });
      });
    });

    return edges;
  }

  // Get visualization steps
  getVisualizationSteps(): PageRankVisualizationStep[] {
    return this.visualizationSteps;
  }

  // Get iterations history
  getIterations(): PageRankIteration[] {
    return this.iterations;
  }

  // Get top K pages by rank
  getTopPages(k: number): PageRankNode[] {
    const nodes = this.getNodes();
    return nodes.sort((a, b) => b.rank - a.rank).slice(0, k);
  }

  // Get rank for a specific page
  getRank(pageId: string): number {
    return this.ranks.get(pageId) || 0;
  }

  // Reset and clear visualization steps
  reset(): void {
    this.ranks = new Map();
    this.iterations = [];
    this.visualizationSteps = [];
  }

  // Get page info by ID
  getPageById(id: string): WebPage | undefined {
    return this.pages.find(page => page.id === id);
  }

  // Get subgraph for visualization (limited nodes)
  getSubgraph(maxNodes: number = 10): { 
    nodes: PageRankNode[]; 
    edges: { from: string; to: string }[] 
  } {
    const topNodes = this.getTopPages(maxNodes);
    const topIds = new Set(topNodes.map(n => n.id));
    
    const edges = this.getEdges().filter(
      e => topIds.has(e.from) && topIds.has(e.to)
    );

    return { nodes: topNodes, edges };
  }
}

// Singleton instance
let globalPageRank: PageRank | null = null;

export function getGlobalPageRank(): PageRank {
  if (!globalPageRank) {
    globalPageRank = new PageRank();
    globalPageRank.compute();
  }
  return globalPageRank;
}

export function resetGlobalPageRank(): void {
  globalPageRank = null;
}
