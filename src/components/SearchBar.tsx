'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import Autocomplete from './Autocomplete';

interface SearchBarProps {
  onSearch: (query: string) => void;
  onInputChange?: (query: string) => void;
  onSuggestionSelect?: (suggestion: string) => void;
  autoFocus?: boolean;
  showButtons?: boolean;
  size?: 'default' | 'large';
  className?: string;
}

export default function SearchBar({
  onSearch, onInputChange, onSuggestionSelect,
  autoFocus = false, showButtons = true, size = 'large', className
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
        setShowAutocomplete(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) { onSearch(query.trim()); setShowAutocomplete(false); }
  }, [query, onSearch]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v); onInputChange?.(v);
    setShowAutocomplete(v.length > 0);
  }, [onInputChange]);

  const handleSelect = useCallback((s: string) => {
    setQuery(s); setShowAutocomplete(false);
    onSuggestionSelect?.(s); onSearch(s);
  }, [onSearch, onSuggestionSelect]);

  const isLarge = size === 'large';

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <form onSubmit={handleSubmit}>
        {/* Scanning beam overlay */}
        {isFocused && (
          <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none z-10">
            <div className="absolute top-0 bottom-0 w-16 opacity-20"
              style={{ background: 'linear-gradient(90deg,transparent,#00f5ff,transparent)', animation: 'beam-scan 1.8s ease-in-out' }} />
          </div>
        )}

        <div className={cn(
          'flex items-center rounded-xl transition-all duration-300 relative',
          isLarge ? 'px-5 py-4' : 'px-4 py-2.5',
          isFocused
            ? 'shadow-[0_0_0_1px_rgba(0,245,255,0.6),0_0_24px_rgba(0,245,255,0.2)]'
            : 'shadow-[0_0_0_1px_rgba(0,245,255,0.15)]'
        )}
          style={{ background: 'rgba(6,0,37,0.95)', backdropFilter: 'blur(20px)' }}
        >
          {/* Search icon */}
          <Search className={cn('shrink-0 transition-colors duration-300', isLarge ? 'w-5 h-5 mr-3' : 'w-4 h-4 mr-2')}
            style={{ color: isFocused ? '#00f5ff' : '#4a6a7a' }} />

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleChange}
            onFocus={() => { setIsFocused(true); if (query.length > 0) setShowAutocomplete(true); }}
            onBlur={() => setIsFocused(false)}
            placeholder={isLarge ? 'Search the knowledge matrix…' : 'Search…'}
            autoFocus={autoFocus}
            className={cn(
              'flex-1 bg-transparent outline-none border-none font-space placeholder:text-[#2a4a5a]',
              isLarge ? 'text-base text-white' : 'text-sm text-white'
            )}
            style={{ caretColor: '#00f5ff' }}
          />

          {query && (
            <button type="button" onClick={() => { setQuery(''); setShowAutocomplete(false); inputRef.current?.focus(); }}
              className="p-1 rounded-full ml-2 hover:bg-[rgba(0,245,255,0.1)] transition-colors">
              <X className="w-4 h-4" style={{ color: '#4a6a7a' }} />
            </button>
          )}

          {/* Right icons */}
          <div className="flex items-center ml-2 pl-2 gap-1"
            style={{ borderLeft: '1px solid rgba(0,245,255,0.15)' }}>
            <button type="submit" className="px-3 py-1 rounded-lg font-orbitron text-[10px] font-semibold transition-all duration-200"
              style={{ background: 'rgba(0,245,255,0.1)', color: '#00f5ff', border: '1px solid rgba(0,245,255,0.25)' }}>
              SCAN
            </button>
          </div>
        </div>

        {showAutocomplete && (
          <Autocomplete query={query} onSelect={handleSelect} onClose={() => setShowAutocomplete(false)} />
        )}
      </form>

      {showButtons && isLarge && (
        <div className="flex justify-center gap-3 mt-6">
          {[{ label: 'NEXUS SEARCH', action: handleSubmit }, { label: 'RANDOM NODE', action: () => { } }].map(btn => (
            <button key={btn.label} onClick={btn.action as any}
              className="px-5 py-2 rounded-lg font-orbitron text-xs font-semibold transition-all duration-200 hover:scale-105"
              style={{ background: 'rgba(0,245,255,0.08)', color: '#00f5ff', border: '1px solid rgba(0,245,255,0.25)' }}>
              {btn.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
