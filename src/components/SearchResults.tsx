'use client';

import { useMemo } from 'react';
import { ExternalLink, Star, Clock, BookOpen } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SearchResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  pageRank: number;
  keywords: string[];
  matchedTerms?: string[];
  relevance?: number;
}

interface SearchResultsProps {
  results: SearchResult[];
  query: string;
  totalResults: number;
  searchTime: number;
  onResultClick?: (result: SearchResult) => void;
}

export default function SearchResults({
  results,
  query,
  totalResults,
  searchTime,
  onResultClick
}: SearchResultsProps) {
  
  // Highlight matching terms in snippet
  const highlightSnippet = (snippet: string, matchedTerms: string[] = []) => {
    if (!matchedTerms.length) return snippet;

    const regex = new RegExp(`(${matchedTerms.join('|')})`, 'gi');
    const parts = snippet.split(regex);

    return parts.map((part, index) => {
      if (matchedTerms.some(term => part.toLowerCase() === term.toLowerCase())) {
        return (
          <mark key={index} className="bg-yellow-100 text-gray-900 px-0.5 rounded">
            {part}
          </mark>
        );
      }
      return part;
    });
  };

  // Format URL for display
  const formatUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      return {
        domain: urlObj.hostname,
        path: urlObj.pathname + urlObj.search
      };
    } catch {
      return { domain: url, path: '' };
    }
  };

  const resultStats = useMemo(() => (
    <div className="text-sm text-gray-500 mb-4">
      About {(totalResults).toLocaleString()} results 
      <span className="text-gray-400 mx-2">·</span>
      <span className="text-green-600">{searchTime.toFixed(2)} seconds</span>
    </div>
  ), [totalResults, searchTime]);

  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🔍</div>
        <h3 className="text-xl font-medium text-gray-700 mb-2">
          No results found for &quot;{query}&quot;
        </h3>
        <p className="text-gray-500">
          Try different keywords or check your spelling
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {resultStats}
      
      <div className="space-y-4">
        {results.map((result, index) => {
          const urlInfo = formatUrl(result.url);
          
          return (
            <Card 
              key={result.id}
              className="border-0 shadow-none hover:shadow-md transition-shadow cursor-pointer bg-transparent"
              onClick={() => onResultClick?.(result)}
            >
              <CardContent className="p-0">
                <div className="flex flex-col gap-1">
                  {/* URL and breadcrumb */}
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600">
                      {urlInfo.domain.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex items-center gap-1 text-sm">
                      <span className="text-gray-600">{urlInfo.domain}</span>
                      {urlInfo.path && (
                        <>
                          <span className="text-gray-400">›</span>
                          <span className="text-gray-500">{urlInfo.path.slice(0, 30)}{urlInfo.path.length > 30 ? '...' : ''}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-lg text-blue-700 hover:underline underline-offset-2 font-medium">
                    <a href={result.url} target="_blank" rel="noopener noreferrer">
                      {result.title}
                    </a>
                  </h3>

                  {/* Snippet with highlights */}
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {highlightSnippet(result.snippet, result.matchedTerms)}
                  </p>

                  {/* Metadata */}
                  <div className="flex items-center gap-3 mt-2">
                    {/* PageRank badge */}
                    <Badge variant="outline" className="text-xs font-normal">
                      <Star className="h-3 w-3 mr-1 text-yellow-500" />
                      PageRank: {result.pageRank.toFixed(3)}
                    </Badge>
                    
                    {/* Position indicator */}
                    <Badge variant="secondary" className="text-xs font-normal">
                      #{index + 1}
                    </Badge>

                    {/* Keywords */}
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <BookOpen className="h-3 w-3" />
                      <span>{result.keywords.length} keywords</span>
                    </div>
                  </div>

                  {/* Matched terms if any */}
                  {result.matchedTerms && result.matchedTerms.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {result.matchedTerms.slice(0, 5).map(term => (
                        <span 
                          key={term}
                          className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded"
                        >
                          {term}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* DSA Info Panel */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h4 className="font-medium text-gray-700 mb-2">How Results Are Ranked</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
          <div>
            <span className="font-medium text-green-600">PageRank</span>
            <p className="mt-1">Pages are ranked based on link structure using the PageRank algorithm.</p>
          </div>
          <div>
            <span className="font-medium text-blue-600">Inverted Index</span>
            <p className="mt-1">Documents are matched using an inverted index with posting lists.</p>
          </div>
          <div>
            <span className="font-medium text-purple-600">Min-Heap</span>
            <p className="mt-1">Top K results are selected efficiently using a min-heap.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
