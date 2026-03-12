// Trie Data Structure for Autocomplete
// Time Complexity: O(m) for insert, search, and prefix matching where m = length of key

export interface TrieNode {
  children: Map<string, TrieNode>;
  isEndOfWord: boolean;
  frequency: number; // For ranking suggestions
  char: string;
}

export interface TrieVisualizationStep {
  type: 'insert' | 'search' | 'autocomplete';
  currentNode: string;
  char: string;
  path: string[];
  found: boolean;
  suggestions: string[];
  description: string;
}

export class Trie {
  private root: TrieNode;
  private visualizationSteps: TrieVisualizationStep[];

  constructor() {
    this.root = this.createNode('');
    this.visualizationSteps = [];
  }

  private createNode(char: string): TrieNode {
    return {
      children: new Map<string, TrieNode>(),
      isEndOfWord: false,
      frequency: 0,
      char: char
    };
  }

  // Insert a word into the trie
  insert(word: string, frequency: number = 1): void {
    let current = this.root;
    const path: string[] = [];

    for (const char of word.toLowerCase()) {
      path.push(char);
      
      if (!current.children.has(char)) {
        current.children.set(char, this.createNode(char));
      }
      
      current = current.children.get(char)!;
      
      this.visualizationSteps.push({
        type: 'insert',
        currentNode: current.char,
        char: char,
        path: [...path],
        found: false,
        suggestions: [],
        description: `Inserting '${char}' at path: ${path.join(' -> ')}`
      });
    }

    current.isEndOfWord = true;
    current.frequency = frequency;
    
    this.visualizationSteps.push({
      type: 'insert',
      currentNode: current.char,
      char: '',
      path: [...path],
      found: true,
      suggestions: [],
      description: `Completed insertion of '${word}' with frequency ${frequency}`
    });
  }

  // Search for exact word in trie
  search(word: string): boolean {
    let current = this.root;
    const path: string[] = [];

    for (const char of word.toLowerCase()) {
      path.push(char);
      
      if (!current.children.has(char)) {
        this.visualizationSteps.push({
          type: 'search',
          currentNode: current.char,
          char: char,
          path: [...path],
          found: false,
          suggestions: [],
          description: `Character '${char}' not found at path: ${path.slice(0, -1).join(' -> ')}`
        });
        return false;
      }
      
      current = current.children.get(char)!;
      
      this.visualizationSteps.push({
        type: 'search',
        currentNode: current.char,
        char: char,
        path: [...path],
        found: true,
        suggestions: [],
        description: `Found '${char}' at path: ${path.join(' -> ')}`
      });
    }

    const found = current.isEndOfWord;
    this.visualizationSteps.push({
      type: 'search',
      currentNode: current.char,
      char: '',
      path: [...path],
      found: found,
      suggestions: [],
      description: found ? `Word '${word}' found!` : `Prefix '${word}' exists but not a complete word`
    });

    return found;
  }

  // Check if there is any word starting with the given prefix
  startsWith(prefix: string): boolean {
    let current = this.root;

    for (const char of prefix.toLowerCase()) {
      if (!current.children.has(char)) {
        return false;
      }
      current = current.children.get(char)!;
    }

    return true;
  }

  // Get all words with given prefix (autocomplete)
  autocomplete(prefix: string, maxResults: number = 10): string[] {
    const suggestions: { word: string; frequency: number }[] = [];
    const path: string[] = [];
    let current = this.root;

    // Navigate to the prefix node
    for (const char of prefix.toLowerCase()) {
      path.push(char);
      if (!current.children.has(char)) {
        this.visualizationSteps.push({
          type: 'autocomplete',
          currentNode: current.char,
          char: char,
          path: [...path],
          found: false,
          suggestions: [],
          description: `Prefix '${prefix}' not found in Trie`
        });
        return [];
      }
      current = current.children.get(char)!;
    }

    this.visualizationSteps.push({
      type: 'autocomplete',
      currentNode: current.char,
      char: '',
      path: [...path],
      found: true,
      suggestions: [],
      description: `Found prefix '${prefix}', collecting all words...`
    });

    // DFS to collect all words with this prefix
    this.collectWords(current, prefix.toLowerCase(), suggestions);

    // Sort by frequency and return top results
    suggestions.sort((a, b) => b.frequency - a.frequency);
    const results = suggestions.slice(0, maxResults).map(s => s.word);

    this.visualizationSteps.push({
      type: 'autocomplete',
      currentNode: '',
      char: '',
      path: [],
      found: true,
      suggestions: results,
      description: `Found ${results.length} suggestions for prefix '${prefix}'`
    });

    return results;
  }

  private collectWords(node: TrieNode, prefix: string, results: { word: string; frequency: number }[]): void {
    if (node.isEndOfWord) {
      results.push({ word: prefix, frequency: node.frequency });
    }

    for (const [char, child] of node.children) {
      this.collectWords(child, prefix + char, results);
    }
  }

  // Get the root node for visualization
  getRoot(): TrieNode {
    return this.root;
  }

  // Get visualization steps
  getVisualizationSteps(): TrieVisualizationStep[] {
    return this.visualizationSteps;
  }

  // Clear visualization steps
  clearVisualizationSteps(): void {
    this.visualizationSteps = [];
  }

  // Convert trie to a serializable format for visualization
  toJSON(node: TrieNode = this.root, depth: number = 0): { 
    char: string; 
    isEndOfWord: boolean; 
    frequency: number;
    children: ReturnType<Trie['toJSON']>[] 
  } {
    const children: ReturnType<Trie['toJSON']>[] = [];
    
    for (const [char, child] of node.children) {
      children.push(this.toJSON(child, depth + 1));
    }

    return {
      char: node.char || 'ROOT',
      isEndOfWord: node.isEndOfWord,
      frequency: node.frequency,
      children: children.sort((a, b) => a.char.localeCompare(b.char))
    };
  }

  // Get all nodes as a flat array with positions for visualization
  getNodePositions(): { 
    id: string; 
    char: string; 
    isEndOfWord: boolean; 
    parentId: string | null;
    depth: number;
    frequency: number;
  }[] {
    const nodes: { id: string; char: string; isEndOfWord: boolean; parentId: string | null; depth: number; frequency: number }[] = [];
    
    const traverse = (node: TrieNode, id: string, parentId: string | null, depth: number) => {
      nodes.push({
        id,
        char: node.char || 'ROOT',
        isEndOfWord: node.isEndOfWord,
        parentId,
        depth,
        frequency: node.frequency
      });

      let i = 0;
      for (const [char, child] of node.children) {
        traverse(child, `${id}-${i}`, id, depth + 1);
        i++;
      }
    };

    traverse(this.root, 'root', null, 0);
    return nodes;
  }
}

// Create a singleton trie with common search terms pre-loaded
import { commonSearchTerms } from './mockData';

let globalTrie: Trie | null = null;

export function getGlobalTrie(): Trie {
  if (!globalTrie) {
    globalTrie = new Trie();
    commonSearchTerms.forEach(({ term, frequency }) => {
      globalTrie!.insert(term, frequency);
    });
  }
  return globalTrie;
}

export function resetGlobalTrie(): void {
  globalTrie = null;
}
