// Inverted Index Implementation for Search Engine
// Maps terms to documents containing those terms

export interface Posting {
  docId: string;
  positions: number[]; // Positions of term in document
  frequency: number;
}

export interface IndexEntry {
  term: string;
  postings: Posting[];
  documentFrequency: number; // Number of documents containing this term
}

export interface InvertedIndexVisualizationStep {
  type: 'index' | 'query' | 'boolean';
  operation: string;
  term: string;
  postings: Posting[];
  description: string;
  highlightedDocs: string[];
  queryType: 'AND' | 'OR' | 'NOT' | 'SINGLE' | null;
}

export interface SearchResult {
  docId: string;
  score: number;
  matchedTerms: string[];
}

export class InvertedIndex {
  private index: Map<string, IndexEntry>;
  private documents: Map<string, { title: string; content: string; keywords: string[] }>;
  private visualizationSteps: InvertedIndexVisualizationStep[];
  private totalDocuments: number;

  constructor() {
    this.index = new Map();
    this.documents = new Map();
    this.visualizationSteps = [];
    this.totalDocuments = 0;
  }

  // Add a document to the index
  addDocument(docId: string, title: string, content: string, keywords: string[]): void {
    this.documents.set(docId, { title, content, keywords });
    this.totalDocuments++;

    // Tokenize and index the content
    const terms = this.tokenize(content + ' ' + title + ' ' + keywords.join(' '));
    
    // Track term positions within the document
    const termPositions: Map<string, number[]> = new Map();
    terms.forEach((term, position) => {
      if (!termPositions.has(term)) {
        termPositions.set(term, []);
      }
      termPositions.get(term)!.push(position);
    });

    // Update inverted index
    termPositions.forEach((positions, term) => {
      if (!this.index.has(term)) {
        this.index.set(term, {
          term,
          postings: [],
          documentFrequency: 0
        });
      }

      const entry = this.index.get(term)!;
      entry.postings.push({
        docId,
        positions,
        frequency: positions.length
      });
      entry.documentFrequency++;

      this.visualizationSteps.push({
        type: 'index',
        operation: 'ADD DOCUMENT',
        term,
        postings: entry.postings,
        description: `Indexed term '${term}' in document '${title}' (positions: ${positions.join(', ')})`,
        highlightedDocs: [docId],
        queryType: null
      });
    });
  }

  // Tokenize text into terms
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(term => term.length > 1);
  }

  // Get posting list for a term
  getPostings(term: string): Posting[] {
    const normalizedTerm = term.toLowerCase();
    const entry = this.index.get(normalizedTerm);

    if (!entry) {
      this.visualizationSteps.push({
        type: 'query',
        operation: `GET POSTINGS: ${term}`,
        term: normalizedTerm,
        postings: [],
        description: `Term '${term}' not found in index`,
        highlightedDocs: [],
        queryType: 'SINGLE'
      });
      return [];
    }

    this.visualizationSteps.push({
      type: 'query',
      operation: `GET POSTINGS: ${term}`,
      term: normalizedTerm,
      postings: entry.postings,
      description: `Found '${term}' in ${entry.postings.length} document(s)`,
      highlightedDocs: entry.postings.map(p => p.docId),
      queryType: 'SINGLE'
    });

    return entry.postings;
  }

  // Boolean AND query - find documents containing ALL terms
  queryAND(terms: string[]): SearchResult[] {
    const normalizedTerms = terms.map(t => t.toLowerCase());
    
    // Get posting lists for all terms
    const postingLists = normalizedTerms.map(term => ({
      term,
      postings: this.getPostings(term)
    }));

    // Filter out terms with no results
    const validLists = postingLists.filter(pl => pl.postings.length > 0);
    
    if (validLists.length === 0) {
      this.visualizationSteps.push({
        type: 'boolean',
        operation: `AND: ${terms.join(' AND ')}`,
        term: normalizedTerms.join(', '),
        postings: [],
        description: 'No documents found for any term',
        highlightedDocs: [],
        queryType: 'AND'
      });
      return [];
    }

    // Start with smallest posting list (optimization)
    validLists.sort((a, b) => a.postings.length - b.postings.length);
    
    // Intersect posting lists
    let result = new Set(validLists[0].postings.map(p => p.docId));
    
    for (let i = 1; i < validLists.length; i++) {
      const currentDocs = new Set(validLists[i].postings.map(p => p.docId));
      result = new Set([...result].filter(docId => currentDocs.has(docId)));
    }

    const results: SearchResult[] = [...result].map(docId => ({
      docId,
      score: this.calculateScore(docId, normalizedTerms),
      matchedTerms: normalizedTerms.filter(term => 
        this.index.get(term)?.postings.some(p => p.docId === docId)
      )
    }));

    this.visualizationSteps.push({
      type: 'boolean',
      operation: `AND: ${terms.join(' AND ')}`,
      term: normalizedTerms.join(', '),
      postings: [],
      description: `AND query found ${results.length} document(s) matching all terms`,
      highlightedDocs: results.map(r => r.docId),
      queryType: 'AND'
    });

    return results;
  }

  // Boolean OR query - find documents containing ANY term
  queryOR(terms: string[]): SearchResult[] {
    const normalizedTerms = terms.map(t => t.toLowerCase());
    const docScores = new Map<string, { score: number; matchedTerms: string[] }>();

    normalizedTerms.forEach(term => {
      const postings = this.getPostings(term);
      
      postings.forEach(posting => {
        if (!docScores.has(posting.docId)) {
          docScores.set(posting.docId, { score: 0, matchedTerms: [] });
        }
        const current = docScores.get(posting.docId)!;
        current.score += posting.frequency;
        if (!current.matchedTerms.includes(term)) {
          current.matchedTerms.push(term);
        }
      });
    });

    const results: SearchResult[] = [...docScores].map(([docId, data]) => ({
      docId,
      score: data.score,
      matchedTerms: data.matchedTerms
    }));

    this.visualizationSteps.push({
      type: 'boolean',
      operation: `OR: ${terms.join(' OR ')}`,
      term: normalizedTerms.join(', '),
      postings: [],
      description: `OR query found ${results.length} document(s) matching any term`,
      highlightedDocs: results.map(r => r.docId),
      queryType: 'OR'
    });

    return results;
  }

  // Boolean NOT query - find documents NOT containing the term
  queryNOT(term: string, allDocIds: string[]): SearchResult[] {
    const normalizedTerm = term.toLowerCase();
    const postings = this.getPostings(normalizedTerm);
    const excludedDocs = new Set(postings.map(p => p.docId));

    const results: SearchResult[] = allDocIds
      .filter(docId => !excludedDocs.has(docId))
      .map(docId => ({
        docId,
        score: 1,
        matchedTerms: []
      }));

    this.visualizationSteps.push({
      type: 'boolean',
      operation: `NOT: ${term}`,
      term: normalizedTerm,
      postings: [],
      description: `NOT query found ${results.length} document(s) NOT containing '${term}'`,
      highlightedDocs: results.map(r => r.docId),
      queryType: 'NOT'
    });

    return results;
  }

  // Calculate TF-IDF score
  private calculateScore(docId: string, terms: string[]): number {
    let score = 0;

    terms.forEach(term => {
      const entry = this.index.get(term);
      if (!entry) return;

      const posting = entry.postings.find(p => p.docId === docId);
      if (!posting) return;

      // TF (Term Frequency)
      const tf = posting.frequency;
      
      // IDF (Inverse Document Frequency)
      const idf = Math.log(this.totalDocuments / entry.documentFrequency);
      
      score += tf * idf;
    });

    return score;
  }

  // Get all indexed terms
  getTerms(): string[] {
    return [...this.index.keys()].sort();
  }

  // Get index entry for a term
  getIndexEntry(term: string): IndexEntry | undefined {
    return this.index.get(term.toLowerCase());
  }

  // Get visualization steps
  getVisualizationSteps(): InvertedIndexVisualizationStep[] {
    return this.visualizationSteps;
  }

  // Clear visualization steps
  clearVisualizationSteps(): void {
    this.visualizationSteps = [];
  }

  // Get document by ID
  getDocument(docId: string): { title: string; content: string; keywords: string[] } | undefined {
    return this.documents.get(docId);
  }

  // Get total number of documents
  getTotalDocuments(): number {
    return this.totalDocuments;
  }

  // Get index size
  getIndexSize(): number {
    return this.index.size;
  }

  // Clear the index
  clear(): void {
    this.index.clear();
    this.documents.clear();
    this.visualizationSteps = [];
    this.totalDocuments = 0;
  }

  // Get posting list visualization data
  getPostingListVisualization(term: string): {
    term: string;
    documentFrequency: number;
    postings: { docId: string; docTitle: string; frequency: number; positions: number[] }[];
  } | null {
    const entry = this.index.get(term.toLowerCase());
    if (!entry) return null;

    return {
      term: entry.term,
      documentFrequency: entry.documentFrequency,
      postings: entry.postings.map(p => {
        const doc = this.documents.get(p.docId);
        return {
          docId: p.docId,
          docTitle: doc?.title || 'Unknown',
          frequency: p.frequency,
          positions: p.positions
        };
      })
    };
  }
}

// Build index from mock data
import { mockWebPages } from './mockData';

let globalInvertedIndex: InvertedIndex | null = null;

export function getGlobalInvertedIndex(): InvertedIndex {
  if (!globalInvertedIndex) {
    globalInvertedIndex = new InvertedIndex();
    
    mockWebPages.forEach(page => {
      globalInvertedIndex!.addDocument(
        page.id,
        page.title,
        page.snippet,
        page.keywords
      );
    });
  }
  return globalInvertedIndex;
}

export function resetGlobalInvertedIndex(): void {
  globalInvertedIndex = null;
}
