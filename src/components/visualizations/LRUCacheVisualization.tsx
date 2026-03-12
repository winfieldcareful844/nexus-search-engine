'use client';

interface CacheEntry { key: string; value: string; }
interface Stats { hits: number; misses: number; hitRate: string; }
interface Props { cacheState: CacheEntry[]; stats?: Stats; }

export default function LRUCacheVisualization({ cacheState, stats }: Props) {
  const demo: CacheEntry[] = cacheState?.length > 0 ? cacheState.slice(0, 8) : [
    { key: 'algorithm', value: 'cache hit' }, { key: 'binary search', value: 'cache hit' },
    { key: 'trie', value: 'cache hit' }, { key: 'heap sort', value: 'miss →' },
    { key: 'pagerank', value: 'cache hit' }, { key: 'bfs/dfs', value: 'miss →' },
  ];

  const colors = ['#00f5ff', '#39ff14', '#bf5fff', '#ffbe00', '#ff4f4f', '#ff00ff', '#00f5ff', '#39ff14'];

  return (
    <div className="card-holographic p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="font-tech text-[10px] px-2 py-0.5 rounded" style={{ color: '#ff00ff', border: '1px solid #ff00ff40', background: '#ff00ff10' }}>LRU</span>
          <span className="font-orbitron text-xs font-semibold text-white">CACHE MEMORY</span>
        </div>
        <span className="font-tech text-[10px]" style={{ color: '#ff00ff' }}>O(1)</span>
      </div>

      {/* MRU → LRU direction indicator */}
      <div className="flex items-center gap-2 mb-3 font-tech text-[9px] text-[#4a6a7a]">
        <span className="px-2 py-0.5 rounded" style={{ background: '#39ff1415', color: '#39ff14', border: '1px solid #39ff1430' }}>MRU</span>
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg,#39ff14,#ff4f4f)' }} />
        <span className="px-2 py-0.5 rounded" style={{ background: '#ff4f4f15', color: '#ff4f4f', border: '1px solid #ff4f4f30' }}>LRU</span>
      </div>

      {/* Memory blocks */}
      <div className="space-y-2 mb-4">
        {demo.map((entry, i) => {
          const color = colors[i % colors.length];
          const isMRU = i === 0;
          const isLRU = i === demo.length - 1;
          return (
            <div key={i} className="flex items-center gap-2 group">
              {/* Slot number */}
              <div className="w-6 h-6 rounded flex items-center justify-center font-orbitron text-[9px] shrink-0"
                style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}>{i}</div>

              {/* Block */}
              <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-300"
                style={{ background: `${color}08`, border: `1px solid ${color}${isMRU ? '60' : '20'}`, boxShadow: isMRU ? `0 0 12px ${color}20` : 'none' }}>
                <span className="font-tech text-[10px] truncate flex-1" style={{ color: isMRU ? color : '#7aa3b8' }}>{entry.key}</span>
                {isMRU && <span className="font-tech text-[9px]" style={{ color: '#39ff14' }}>← RECENT</span>}
                {isLRU && <span className="font-tech text-[9px]" style={{ color: '#ff4f4f' }}>EVICT →</span>}
              </div>

              {/* Arrow to next */}
              {i < demo.length - 1 && (
                <svg width="12" height="16" viewBox="0 0 12 16" className="shrink-0">
                  <path d="M6 0 L6 16" stroke="rgba(0,245,255,0.2)" strokeWidth="1" />
                  <path d="M2 12 L6 16 L10 12" fill="none" stroke="rgba(0,245,255,0.2)" strokeWidth="1" />
                </svg>
              )}
            </div>
          );
        })}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-2 pt-3" style={{ borderTop: '1px solid rgba(0,245,255,0.1)' }}>
          {[
            { v: stats.hits, label: 'HITS', color: '#39ff14' },
            { v: stats.misses, label: 'MISSES', color: '#ff4f4f' },
            { v: stats.hitRate, label: 'HIT RATE', color: '#00f5ff' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className="font-orbitron text-base font-bold" style={{ color: s.color, textShadow: `0 0 8px ${s.color}` }}>{s.v}</div>
              <div className="font-tech text-[9px] text-[#4a6a7a]">{s.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
