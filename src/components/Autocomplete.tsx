'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, ArrowUpRight, Clock, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AutocompleteProps {
  query: string;
  onSelect: (suggestion: string) => void;
  onClose: () => void;
}

interface Suggestion {
  text: string;
  type: 'prefix' | 'history' | 'trending';
  frequency?: number;
}

export default function Autocomplete({ query, onSelect, onClose }: AutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Fetch autocomplete suggestions
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!query.trim()) {
        setSuggestions([]);
        return;
      }

      try {
        const response = await fetch(`/api/autocomplete?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        const formattedSuggestions: Suggestion[] = data.suggestions.map((s: { term: string; frequency: number }) => ({
          text: s.term,
          type: 'prefix' as const,
          frequency: s.frequency
        }));

        setSuggestions(formattedSuggestions);
        setSelectedIndex(-1);
      } catch {
        // Fallback to basic suggestions
        setSuggestions([
          { text: query, type: 'prefix' },
          { text: `${query} tutorial`, type: 'prefix' },
          { text: `${query} examples`, type: 'prefix' }
        ]);
      }
    };

    const debounceTimer = setTimeout(fetchSuggestions, 50);
    return () => clearTimeout(debounceTimer);
  }, [query]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < suggestions.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
          break;
        case 'Enter':
          if (selectedIndex >= 0 && suggestions[selectedIndex]) {
            e.preventDefault();
            onSelect(suggestions[selectedIndex].text);
          }
          break;
        case 'Escape':
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [suggestions, selectedIndex, onSelect, onClose]);

  const handleSelect = useCallback((suggestion: string) => {
    onSelect(suggestion);
  }, [onSelect]);

  const getIcon = useCallback((type: Suggestion['type']) => {
    switch (type) {
      case 'history':
        return <Clock className="h-4 w-4 text-gray-400" />;
      case 'trending':
        return <TrendingUp className="h-4 w-4 text-blue-500" />;
      default:
        return <Search className="h-4 w-4 text-gray-400" />;
    }
  }, []);

  // Highlight the matched prefix
  const renderSuggestion = useCallback((text: string) => {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const matchIndex = lowerText.indexOf(lowerQuery);

    if (matchIndex === -1) {
      return <span>{text}</span>;
    }

    return (
      <span>
        {text.slice(0, matchIndex)}
        <span className="font-medium">{text.slice(matchIndex, matchIndex + query.length)}</span>
        {text.slice(matchIndex + query.length)}
      </span>
    );
  }, [query]);

  if (suggestions.length === 0) return null;

  return (
    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-50">
      <ul className="py-2">
        {suggestions.map((suggestion, index) => (
          <li
            key={`${suggestion.type}-${suggestion.text}`}
            className={cn(
              'flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors',
              selectedIndex === index 
                ? 'bg-gray-100' 
                : 'hover:bg-gray-50'
            )}
            onClick={() => handleSelect(suggestion.text)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            {getIcon(suggestion.type)}
            <span className="flex-1 text-sm text-gray-700">
              {renderSuggestion(suggestion.text)}
            </span>
            {suggestion.frequency && (
              <span className="text-xs text-gray-400">
                {suggestion.frequency > 1000 
                  ? `${(suggestion.frequency / 1000).toFixed(1)}k`
                  : suggestion.frequency
                }
              </span>
            )}
            <ArrowUpRight className="h-4 w-4 text-gray-300 opacity-0 group-hover:opacity-100" />
          </li>
        ))}
      </ul>
      
      {/* DSA Info Footer */}
      <div className="border-t border-gray-100 px-4 py-2 bg-gray-50">
        <p className="text-xs text-gray-500">
          <span className="font-medium">Trie Data Structure</span> — 
          Autocomplete suggestions in <span className="text-green-600 font-medium">O(m)</span> time where m = query length
        </p>
      </div>
    </div>
  );
}
