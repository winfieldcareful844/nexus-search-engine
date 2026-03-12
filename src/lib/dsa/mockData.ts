// Mock data for Google clone with DSA demonstrations

export interface WebPage {
  id: string;
  title: string;
  url: string;
  snippet: string;
  keywords: string[];
  pageRank: number;
  linksTo: string[]; // IDs of pages this page links to
}

export interface SearchTerm {
  term: string;
  frequency: number;
}

// 20+ mock web pages with various topics
export const mockWebPages: WebPage[] = [
  {
    id: "1",
    title: "Introduction to Algorithms - MIT OpenCourseWare",
    url: "https://ocw.mit.edu/algorithms",
    snippet: "This course provides an introduction to mathematical modeling of computational problems. It covers the common algorithms, algorithmic paradigms, and data structures.",
    keywords: ["algorithm", "data structure", "computer science", "MIT", "course"],
    pageRank: 0.15,
    linksTo: ["2", "3", "5"]
  },
  {
    id: "2",
    title: "Data Structures and Algorithms in JavaScript",
    url: "https://javascript.info/data-structures",
    snippet: "Learn how to implement common data structures and algorithms in JavaScript. From arrays and linked lists to trees and graphs.",
    keywords: ["javascript", "data structure", "algorithm", "programming", "tutorial"],
    pageRank: 0.12,
    linksTo: ["1", "4", "6"]
  },
  {
    id: "3",
    title: "Graph Algorithms for Beginners",
    url: "https://graphtheory.io/basics",
    snippet: "Understanding graph algorithms is essential for solving complex problems. Learn BFS, DFS, Dijkstra's algorithm, and more.",
    keywords: ["graph", "algorithm", "BFS", "DFS", "dijkstra", "shortest path"],
    pageRank: 0.10,
    linksTo: ["1", "5", "7"]
  },
  {
    id: "4",
    title: "React - A JavaScript Library for Building User Interfaces",
    url: "https://reactjs.org",
    snippet: "React makes it painless to create interactive UIs. Design simple views for each state, and React will efficiently update and render components.",
    keywords: ["react", "javascript", "UI", "frontend", "components"],
    pageRank: 0.18,
    linksTo: ["2", "8", "9"]
  },
  {
    id: "5",
    title: "Sorting Algorithms Visualized",
    url: "https://sortvisualizer.com",
    snippet: "Interactive visualizations of sorting algorithms including bubble sort, merge sort, quick sort, and heap sort. Understand time complexity.",
    keywords: ["sorting", "algorithm", "visualization", "bubble sort", "merge sort", "quick sort"],
    pageRank: 0.08,
    linksTo: ["1", "3"]
  },
  {
    id: "6",
    title: "Next.js - The React Framework for Production",
    url: "https://nextjs.org",
    snippet: "Next.js gives you the best developer experience with all the features you need for production: hybrid static & server rendering, TypeScript support.",
    keywords: ["nextjs", "react", "framework", "SSR", "typescript", "production"],
    pageRank: 0.16,
    linksTo: ["4", "9", "10"]
  },
  {
    id: "7",
    title: "Understanding PageRank Algorithm",
    url: "https://pagerank.explained/algorithm",
    snippet: "PageRank is an algorithm used by Google to rank web pages in their search engine results. Learn how it works with matrices and eigenvectors.",
    keywords: ["pagerank", "google", "algorithm", "search engine", "ranking"],
    pageRank: 0.11,
    linksTo: ["3", "8"]
  },
  {
    id: "8",
    title: "Trie Data Structure Explained",
    url: "https://trie.dev/explained",
    snippet: "A trie is a tree-like data structure used for efficient retrieval of keys. Perfect for autocomplete, spell checkers, and IP routing.",
    keywords: ["trie", "data structure", "autocomplete", "prefix", "search"],
    pageRank: 0.09,
    linksTo: ["2", "5"]
  },
  {
    id: "9",
    title: "TypeScript Handbook - The Basics",
    url: "https://typescriptlang.org/handbook",
    snippet: "TypeScript adds optional types to JavaScript that support tools for large-scale JavaScript applications for any browser, any host, any OS.",
    keywords: ["typescript", "javascript", "types", "programming", "handbook"],
    pageRank: 0.14,
    linksTo: ["4", "6"]
  },
  {
    id: "10",
    title: "Tailwind CSS - Rapidly Build Modern Websites",
    url: "https://tailwindcss.com",
    snippet: "Tailwind CSS is a utility-first CSS framework for rapidly building custom user interfaces. It's highly customizable and low-level.",
    keywords: ["tailwind", "css", "framework", "styling", "utility-first"],
    pageRank: 0.13,
    linksTo: ["6", "9"]
  },
  {
    id: "11",
    title: "Binary Search Algorithm - Complete Guide",
    url: "https://binarysearch.io/guide",
    snippet: "Binary search is an efficient algorithm for finding an item from a sorted list. It works by repeatedly dividing the search interval in half.",
    keywords: ["binary search", "algorithm", "search", "sorted", "divide and conquer"],
    pageRank: 0.07,
    linksTo: ["1", "5"]
  },
  {
    id: "12",
    title: "Heap Data Structure and Priority Queues",
    url: "https://heap-structures.dev/priority",
    snippet: "Heaps are specialized tree-based data structures. Learn about min-heaps, max-heaps, and how they power priority queues and heap sort.",
    keywords: ["heap", "priority queue", "data structure", "min heap", "max heap"],
    pageRank: 0.08,
    linksTo: ["1", "5", "11"]
  },
  {
    id: "13",
    title: "Inverted Index for Search Engines",
    url: "https://search-index.dev/inverted",
    snippet: "An inverted index is a data structure storing a mapping from content to its location. It's the core data structure used by search engines.",
    keywords: ["inverted index", "search engine", "indexing", "posting list", "information retrieval"],
    pageRank: 0.06,
    linksTo: ["7", "8"]
  },
  {
    id: "14",
    title: "LRU Cache Implementation Guide",
    url: "https://cache-patterns.dev/lru",
    snippet: "Learn how to implement a Least Recently Used (LRU) cache using a hash map and doubly linked list. Understand cache eviction policies.",
    keywords: ["lru cache", "cache", "hash map", "linked list", "eviction policy"],
    pageRank: 0.07,
    linksTo: ["1", "12"]
  },
  {
    id: "15",
    title: "shadcn/ui - Beautiful UI Components",
    url: "https://ui.shadcn.com",
    snippet: "Beautifully designed components built with Radix UI and Tailwind CSS. Accessible, customizable, and open source.",
    keywords: ["shadcn", "ui", "components", "radix", "tailwind", "accessible"],
    pageRank: 0.15,
    linksTo: ["6", "10"]
  },
  {
    id: "16",
    title: "Understanding Time Complexity",
    url: "https://big-o.dev/basics",
    snippet: "Time complexity analysis helps us understand how an algorithm's runtime grows with input size. Learn about O(n), O(log n), O(n^2), and more.",
    keywords: ["time complexity", "big O", "algorithm analysis", "asymptotic", "runtime"],
    pageRank: 0.09,
    linksTo: ["1", "5", "11"]
  },
  {
    id: "17",
    title: "Node.js - JavaScript Runtime",
    url: "https://nodejs.org",
    snippet: "Node.js is an open-source, cross-platform JavaScript runtime environment. Build scalable network applications with event-driven architecture.",
    keywords: ["nodejs", "javascript", "runtime", "server", "backend"],
    pageRank: 0.17,
    linksTo: ["2", "4", "9"]
  },
  {
    id: "18",
    title: "Dynamic Programming Patterns",
    url: "https://dp-patterns.dev",
    snippet: "Master dynamic programming with common patterns: memoization, tabulation, and optimal substructure. Practice with classic DP problems.",
    keywords: ["dynamic programming", "memoization", "tabulation", "optimization", "patterns"],
    pageRank: 0.10,
    linksTo: ["1", "11", "16"]
  },
  {
    id: "19",
    title: "Web Development Bootcamp 2024",
    url: "https://webdev.bootcamp/course",
    snippet: "Complete web development course covering HTML, CSS, JavaScript, React, Node.js, and databases. Build real-world projects.",
    keywords: ["web development", "bootcamp", "html", "css", "javascript", "course"],
    pageRank: 0.11,
    linksTo: ["2", "4", "6", "17"]
  },
  {
    id: "20",
    title: "Prisma - Next-Generation ORM",
    url: "https://prisma.io",
    snippet: "Prisma is a modern database toolkit for Node.js and TypeScript. It includes an ORM, migrations, and a database client.",
    keywords: ["prisma", "orm", "database", "typescript", "nodejs", "sql"],
    pageRank: 0.12,
    linksTo: ["6", "9", "17"]
  },
  {
    id: "21",
    title: "Redis - In-Memory Data Store",
    url: "https://redis.io",
    snippet: "Redis is an open-source, in-memory data structure store used as a database, cache, message broker, and streaming engine.",
    keywords: ["redis", "cache", "in-memory", "database", "data store"],
    pageRank: 0.13,
    linksTo: ["14", "17", "20"]
  },
  {
    id: "22",
    title: "Machine Learning Fundamentals",
    url: "https://ml-fundamentals.dev/intro",
    snippet: "Introduction to machine learning algorithms: supervised learning, unsupervised learning, neural networks, and deep learning basics.",
    keywords: ["machine learning", "AI", "neural network", "deep learning", "supervised learning"],
    pageRank: 0.14,
    linksTo: ["1", "18"]
  }
];

// Common search terms for autocomplete (with frequency for weighting)
export const commonSearchTerms: SearchTerm[] = [
  { term: "algorithm", frequency: 1500 },
  { term: "algorithms", frequency: 1200 },
  { term: "algorithm visualization", frequency: 300 },
  { term: "algorithm complexity", frequency: 250 },
  { term: "algorithm design", frequency: 200 },
  { term: "android", frequency: 800 },
  { term: "api", frequency: 900 },
  { term: "api design", frequency: 150 },
  { term: "autocomplete", frequency: 180 },
  { term: "binary search", frequency: 450 },
  { term: "binary search tree", frequency: 320 },
  { term: "big O notation", frequency: 280 },
  { term: "cache", frequency: 350 },
  { term: "css", frequency: 1100 },
  { term: "css framework", frequency: 200 },
  { term: "data structure", frequency: 1800 },
  { term: "data structures", frequency: 1600 },
  { term: "data structures and algorithms", frequency: 600 },
  { term: "database", frequency: 700 },
  { term: "dynamic programming", frequency: 400 },
  { term: "frontend", frequency: 550 },
  { term: "frontend development", frequency: 300 },
  { term: "graph", frequency: 450 },
  { term: "graph algorithm", frequency: 200 },
  { term: "graph traversal", frequency: 150 },
  { term: "hash map", frequency: 380 },
  { term: "heap", frequency: 300 },
  { term: "heap sort", frequency: 180 },
  { term: "html", frequency: 1200 },
  { term: "html css javascript", frequency: 250 },
  { term: "inverted index", frequency: 120 },
  { term: "javascript", frequency: 2500 },
  { term: "javascript tutorial", frequency: 400 },
  { term: "javascript array methods", frequency: 300 },
  { term: "linked list", frequency: 420 },
  { term: "lru cache", frequency: 200 },
  { term: "machine learning", frequency: 800 },
  { term: "machine learning algorithms", frequency: 250 },
  { term: "min heap", frequency: 150 },
  { term: "nextjs", frequency: 650 },
  { term: "nextjs tutorial", frequency: 280 },
  { term: "nodejs", frequency: 750 },
  { term: "nodejs express", frequency: 200 },
  { term: "pagerank", frequency: 180 },
  { term: "pagerank algorithm", frequency: 120 },
  { term: "priority queue", frequency: 280 },
  { term: "programming", frequency: 900 },
  { term: "programming languages", frequency: 350 },
  { term: "quick sort", frequency: 350 },
  { term: "react", frequency: 2000 },
  { term: "react hooks", frequency: 500 },
  { term: "react tutorial", frequency: 450 },
  { term: "search engine", frequency: 320 },
  { term: "sorting", frequency: 480 },
  { term: "sorting algorithm", frequency: 350 },
  { term: "stack", frequency: 290 },
  { term: "tailwind", frequency: 580 },
  { term: "tailwind css", frequency: 420 },
  { term: "time complexity", frequency: 320 },
  { term: "trie", frequency: 220 },
  { term: "trie data structure", frequency: 150 },
  { term: "typescript", frequency: 1100 },
  { term: "typescript tutorial", frequency: 280 },
  { term: "web development", frequency: 700 },
  { term: "web development course", frequency: 200 }
];

// Get page by ID
export function getPageById(id: string): WebPage | undefined {
  return mockWebPages.find(page => page.id === id);
}

// Get all page IDs
export function getAllPageIds(): string[] {
  return mockWebPages.map(page => page.id);
}

// Build link graph for PageRank
export function buildLinkGraph(): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  
  // Initialize all pages
  mockWebPages.forEach(page => {
    graph.set(page.id, []);
  });
  
  // Build reverse links (who links to each page)
  mockWebPages.forEach(page => {
    page.linksTo.forEach(targetId => {
      const inboundLinks = graph.get(targetId) || [];
      inboundLinks.push(page.id);
      graph.set(targetId, inboundLinks);
    });
  });
  
  return graph;
}

// Get all documents for inverted index
export function getAllDocuments(): Map<string, { title: string; content: string; keywords: string[] }> {
  const docs = new Map<string, { title: string; content: string; keywords: string[] }>();
  
  mockWebPages.forEach(page => {
    docs.set(page.id, {
      title: page.title,
      content: page.snippet,
      keywords: page.keywords
    });
  });
  
  return docs;
}
