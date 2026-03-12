'use client';

import { useMemo } from 'react';

interface HeapEntry { id: string; title: string; score: number; }
interface Props { heap: HeapEntry[]; }

// DEMO data when heap is empty
const DEMO_HEAP: HeapEntry[] = [
  { id: '1', title: 'Trie Search', score: 9.4 },
  { id: '2', title: 'BM25 Rank', score: 8.7 },
  { id: '3', title: 'PageRank', score: 8.1 },
  { id: '4', title: 'Binary Search', score: 7.9 },
  { id: '5', title: 'Hash Map', score: 7.3 },
  { id: '6', title: 'LRU Cache', score: 6.8 },
  { id: '7', title: 'Min Heap', score: 6.2 },
];

export default function MinHeapVisualization({ heap }: Props) {
  const data = (heap && heap.length > 0 ? heap : DEMO_HEAP).slice(0, 7);
  const minScore = Math.min(...data.map(d => d.score));
  const maxScore = Math.max(...data.map(d => d.score));

  // Heap layout: positions for up to 7 nodes (3 levels)
  const W = 520, H = 220;
  const positions = [
    { x: W / 2, y: 30 },           // level 0: root (min)
    { x: W / 3, y: 95 }, { x: (2 * W) / 3, y: 95 }, // level 1
    { x: W / 5.5, y: 165 }, { x: W / 2.6, y: 165 }, { x: W / 1.7, y: 165 }, { x: W / 1.25, y: 165 }, // level 2
  ];

  const edges = [
    [0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6]
  ].filter(([p, c]) => c < data.length);

  const neonColors = ['#ff4f4f', '#ffbe00', '#00f5ff', '#39ff14', '#bf5fff', '#ff00ff', '#00f5ff'];

  return (
    <div className="card-holographic p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-tech text-[10px] px-2 py-0.5 rounded" style={{ color: '#ffbe00', border: '1px solid #ffbe0040', background: '#ffbe0010' }}>HEAP</span>
          <span className="font-orbitron text-xs font-semibold text-white">MIN-HEAP TOP-K</span>
        </div>
        <span className="font-tech text-[10px]" style={{ color: '#ffbe00' }}>O(n log k)</span>
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
        {/* Edges */}
        {edges.map(([p, c]) => (
          <line key={`e-${p}-${c}`}
            x1={positions[p].x} y1={positions[p].y}
            x2={positions[c].x} y2={positions[c].y}
            stroke="rgba(0,245,255,0.2)" strokeWidth={1.5}
            strokeDasharray="4 3"
            style={{ animation: 'data-flow 2s linear infinite' }} />
        ))}

        {/* Nodes */}
        {data.slice(0, positions.length).map((n, i) => {
          const { x, y } = positions[i];
          const color = neonColors[i % neonColors.length];
          const normalized = maxScore === minScore ? 0.5 : (n.score - minScore) / (maxScore - minScore);
          const radius = 18 + normalized * 8;
          const isMin = i === 0;
          return (
            <g key={n.id}>
              {/* Glow ring for min node */}
              {isMin && <circle cx={x} cy={y} r={radius + 6} fill="none" stroke={color} strokeWidth={1}
                style={{ opacity: 0.3, animation: 'plasma-pulse 1.5s ease-in-out infinite' }} />}
              <circle cx={x} cy={y} r={radius}
                fill={`${color}15`} stroke={color} strokeWidth={isMin ? 2 : 1.5}
                style={{ filter: isMin ? `drop-shadow(0 0 8px ${color})` : undefined }} />
              <text x={x} y={y - 2} textAnchor="middle" fontSize={10} fill={color} fontFamily="'Share Tech Mono'" fontWeight="bold">
                {n.score.toFixed(1)}
              </text>
              <text x={x} y={y + 10} textAnchor="middle" fontSize={7} fill="rgba(0,245,255,0.5)" fontFamily="'Share Tech Mono'">
                {n.title.slice(0, 8)}
              </text>
              {isMin && (
                <text x={x} y={y - radius - 4} textAnchor="middle" fontSize={8} fill={color} fontFamily="'Orbitron'">MIN</text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="mt-2 font-tech text-[9px] text-[#4a6a7a] text-center">
        ROOT = MINIMUM · PARENT ≤ CHILDREN · {data.length} NODES
      </div>
    </div>
  );
}
