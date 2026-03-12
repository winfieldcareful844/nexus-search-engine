'use client';

const DEMO_TERMS = ['algorithm', 'binary', 'cache', 'graph', 'heap'];
const DEMO_DOCS = ['doc1', 'doc2', 'doc3', 'doc4', 'doc5', 'doc6'];
const DEMO_INDEX: Record<string, string[]> = {
  algorithm: ['doc1', 'doc3', 'doc5'],
  binary: ['doc2', 'doc4'],
  cache: ['doc1', 'doc2', 'doc6'],
  graph: ['doc3', 'doc4', 'doc5'],
  heap: ['doc1', 'doc6'],
};

const TERM_COLORS: Record<string, string> = {
  algorithm: '#00f5ff', binary: '#39ff14', cache: '#bf5fff', graph: '#ffbe00', heap: '#ff4f4f',
};

interface Props { terms: string[]; matchedDocs: string[]; }

export default function InvertedIndexVisualization({ terms, matchedDocs }: Props) {
  const displayTerms = terms && terms.length > 0 ? terms.slice(0, 5) : DEMO_TERMS;
  const displayDocs = matchedDocs && matchedDocs.length > 0 ? matchedDocs.slice(0, 6) : DEMO_DOCS;
  const indexMap = DEMO_INDEX;

  return (
    <div className="card-holographic p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="font-tech text-[10px] px-2 py-0.5 rounded" style={{ color: '#bf5fff', border: '1px solid #bf5fff40', background: '#bf5fff10' }}>IDX</span>
          <span className="font-orbitron text-xs font-semibold text-white">INVERTED INDEX</span>
        </div>
        <span className="font-tech text-[10px]" style={{ color: '#bf5fff' }}>O(terms)</span>
      </div>

      {/* Matrix */}
      <div className="overflow-auto">
        {/* Header row */}
        <div className="flex gap-1 mb-1 ml-24">
          {DEMO_DOCS.map(d => (
            <div key={d} className="w-10 text-center font-tech text-[8px] text-[#4a6a7a]">{d}</div>
          ))}
        </div>

        {DEMO_TERMS.map(term => {
          const color = TERM_COLORS[term] || '#00f5ff';
          const termDocs = indexMap[term] || [];
          return (
            <div key={term} className="flex items-center gap-1 mb-1">
              {/* Term label */}
              <div className="w-24 shrink-0">
                <span className="font-tech text-[9px] px-2 py-0.5 rounded truncate block"
                  style={{ color, background: `${color}10`, border: `1px solid ${color}30` }}>
                  {term}
                </span>
              </div>

              {/* Posting cells */}
              {DEMO_DOCS.map(doc => {
                const isMatch = termDocs.includes(doc);
                const isQueried = displayDocs.includes(doc) && displayTerms.includes(term);
                return (
                  <div key={doc} className="w-10 h-8 rounded flex items-center justify-center transition-all duration-300"
                    style={{
                      background: isQueried ? `${color}25` : isMatch ? `${color}10` : 'rgba(0,0,0,0.3)',
                      border: `1px solid ${isQueried ? color : isMatch ? `${color}30` : 'rgba(0,245,255,0.05)'}`,
                      boxShadow: isQueried ? `0 0 8px ${color}40` : 'none',
                    }}>
                    {isMatch ? (
                      <span className="font-tech text-[10px] font-bold" style={{ color: isQueried ? color : `${color}60` }}>1</span>
                    ) : (
                      <span className="font-tech text-[10px] text-[#1a2a3a]">·</span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* BM25 legend */}
      <div className="mt-3 pt-3 space-y-1" style={{ borderTop: '1px solid rgba(0,245,255,0.1)' }}>
        <div className="font-tech text-[9px] text-[#4a6a7a]">BM25 SCORING:</div>
        <div className="font-tech text-[9px] text-[#bf5fff]">score(D,Q) = Σ IDF(qᵢ) × TF(qᵢ,D) / (TF + k₁(1-b+b·|D|/avgdl))</div>
        <div className="flex gap-4 mt-1">
          {[{ label: '1 = PRESENT', color: '#00f5ff' }, { label: 'GLOW = MATCHED', color: '#bf5fff' }].map(l => (
            <div key={l.label} className="flex items-center gap-1 font-tech text-[8px]" style={{ color: '#4a6a7a' }}>
              <div className="w-2 h-2 rounded" style={{ background: l.color }} />
              {l.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
