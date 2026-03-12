'use client';

import { useMemo } from 'react';

interface PageRankNode { id: string; title: string; rank: number; outlinks: number; inlinks: string[]; }
interface Props { nodes: PageRankNode[]; edges: [string, string][]; }

const DEMO_NODES: PageRankNode[] = [
  { id: 'a', title: 'Algorithms', rank: 0.38, outlinks: 3, inlinks: [] },
  { id: 'b', title: 'Data Structs', rank: 0.27, outlinks: 2, inlinks: ['a'] },
  { id: 'c', title: 'Search Eng', rank: 0.21, outlinks: 4, inlinks: ['a', 'b'] },
  { id: 'd', title: 'Trie/BFS', rank: 0.17, outlinks: 1, inlinks: ['c'] },
  { id: 'e', title: 'PageRank', rank: 0.29, outlinks: 2, inlinks: ['a', 'c'] },
  { id: 'f', title: 'LRU Cache', rank: 0.15, outlinks: 1, inlinks: ['b', 'd'] },
];

const DEMO_EDGES: [string, string][] = [['a', 'b'], ['a', 'c'], ['a', 'e'], ['b', 'c'], ['b', 'f'], ['c', 'd'], ['c', 'e'], ['d', 'f'], ['e', 'a']];

export default function PageRankVisualization({ nodes, edges }: Props) {
  const displayNodes = (nodes && nodes.length > 1 ? nodes.slice(0, 6) : DEMO_NODES) as PageRankNode[];
  const displayEdges = (edges && edges.length > 0 ? edges : DEMO_EDGES) as [string, string][];

  const W = 520, H = 220, CX = W / 2, CY = H / 2, R = 85;
  const maxRank = Math.max(...displayNodes.map(n => n.rank));

  // Position nodes in a circle
  const positions = useMemo(() => {
    const pos: Record<string, { x: number; y: number }> = {};
    displayNodes.forEach((n, i) => {
      const angle = (i / displayNodes.length) * 2 * Math.PI - Math.PI / 2;
      pos[n.id] = { x: CX + R * Math.cos(angle), y: CY + R * Math.sin(angle) };
    });
    return pos;
  }, [displayNodes]);

  const colors = ['#00f5ff', '#39ff14', '#bf5fff', '#ffbe00', '#ff4f4f', '#ff00ff'];

  return (
    <div className="card-holographic p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-tech text-[10px] px-2 py-0.5 rounded" style={{ color: '#00f5ff', border: '1px solid #00f5ff40', background: '#00f5ff10' }}>PR</span>
          <span className="font-orbitron text-xs font-semibold text-white">PAGERANK GRAPH</span>
        </div>
        <span className="font-tech text-[10px]" style={{ color: '#00f5ff' }}>O(n×iter)</span>
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
        {/* Orbit ring */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(0,245,255,0.06)" strokeWidth={1} strokeDasharray="4 6" />

        {/* Edges */}
        {displayEdges.map(([from, to], i) => {
          const fp = positions[from], tp = positions[to];
          if (!fp || !tp) return null;
          const dx = tp.x - fp.x, dy = tp.y - fp.y, len = Math.sqrt(dx * dx + dy * dy);
          const ux = dx / len, uy = dy / len;
          const r1 = 14, r2 = 14;
          return (
            <line key={`e-${i}`} x1={fp.x + ux * r1} y1={fp.y + uy * r1} x2={tp.x - ux * r2} y2={tp.y - uy * r2}
              stroke="rgba(0,245,255,0.15)" strokeWidth={1}
              markerEnd="url(#arrow)" />
          );
        })}

        {/* Arrow marker */}
        <defs>
          <marker id="arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="rgba(0,245,255,0.3)" />
          </marker>
        </defs>

        {/* Center label */}
        <text x={CX} y={CY + 4} textAnchor="middle" fill="rgba(0,245,255,0.2)" fontSize={9} fontFamily="'Share Tech Mono'">d=0.85</text>

        {/* Nodes */}
        {displayNodes.map((n, i) => {
          const pos = positions[n.id];
          if (!pos) return null;
          const color = colors[i % colors.length];
          const normalized = maxRank === 0 ? 0.5 : n.rank / maxRank;
          const radius = 10 + normalized * 10;
          return (
            <g key={n.id}>
              {/* Rank glow */}
              <circle cx={pos.x} cy={pos.y} r={radius + 4} fill="none" stroke={color} strokeWidth={0.5}
                style={{ opacity: 0.3 * normalized }} />
              <circle cx={pos.x} cy={pos.y} r={radius} fill={`${color}18`} stroke={color} strokeWidth={1.5}
                style={{ filter: `drop-shadow(0 0 ${4 + normalized * 8}px ${color})` }} />
              <text x={pos.x} y={pos.y + 3} textAnchor="middle" fontSize={8} fill={color} fontFamily="'Share Tech Mono'" fontWeight="bold">
                {n.rank.toFixed(2)}
              </text>
              <text x={pos.x} y={pos.y + radius + 12} textAnchor="middle" fontSize={7} fill="rgba(0,245,255,0.5)" fontFamily="'Share Tech Mono'">
                {n.title.slice(0, 8)}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="font-tech text-[9px] text-[#4a6a7a] text-center mt-1">
        NODE SIZE ∝ RANK · d=0.85 DAMPING · {displayNodes.length} PAGES · {displayEdges.length} LINKS
      </div>
    </div>
  );
}
