import { NextRequest, NextResponse } from 'next/server';
import { getGlobalTrie } from '@/lib/dsa/Trie';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '';
  
  if (!query.trim()) {
    return NextResponse.json({ suggestions: [] });
  }
  
  const trie = getGlobalTrie();
  const suggestions = trie.autocomplete(query, 8);
  
  // Get frequency for each suggestion
  const suggestionsWithFrequency = suggestions.map(term => {
    // This would normally come from the trie or a separate store
    const frequency = Math.floor(Math.random() * 2000) + 100;
    return { term, frequency };
  });
  
  return NextResponse.json({ 
    suggestions: suggestionsWithFrequency,
    query,
    algorithm: 'Trie-based prefix matching',
    timeComplexity: 'O(m) where m = query length'
  });
}
