'use client';

import { useMemo } from 'react';

interface TrieNode {
  char: string; isEndOfWord: boolean; frequency: number; children: TrieNode[];
}
interface Props { trieData: TrieNode | null; searchPath: string[]; currentChar: string; }

// Build a set of common prefix chars to demo a rich tree when no data
const DEMO_WORDS = ['algorithm', 'array', 'binary', 'bfs', 'breadth', 'cache', 'cycle', 'dfs', 'depth', 'dynamic', 'error', 'edge', 'fibonacci', 'graph', 'hash', 'heap', 'index', 'inorder', 'java', 'kotlin', 'linked', 'list', 'merge', 'node', 'null', 'order', 'priority', 'queue', 'red', 'recursion', 'sort', 'stack', 'spanning', 'tree', 'trie', 'union', 'vertex'];

function buildDemoTrie() {
  const root: Record<string, any> = {};
  for (const w of DEMO_WORDS) {
    let cur = root;
    for (const c of w) { if (!cur[c]) cur[c] = {}; cur = cur[c]; }
    cur['$'] = true;
  }
  return root;
}

type FlatNode = { id: string; char: string; depth: number; idx: number; total: number; parentId: string | null; isEnd: boolean; inPath: boolean; isCurrent: boolean; };

function flattenDemo(obj: Record<string, any>, path: string[], currentPath: string[], depth = 0, parentId: string | null = null, idPrefix = 'r'): FlatNode[] {
  const keys = Object.keys(obj).filter(k => k !== '$').sort().slice(0, depth === 0 ? 8 : 4);
  const result: FlatNode[] = [];
  keys.forEach((c, idx) => {
    const id = `${idPrefix}-${idx}`;
    const pathSoFar = path;
    const inPath = currentPath.length >= depth + 1 && currentPath[depth] === c && path.every((p, i) => currentPath[i] === p);
    const isCurrent = inPath && currentPath.length === depth + 1;
    result.push({ id, char: c, depth, idx, total: keys.length, parentId, isEnd: !!obj[c]['$'], inPath, isCurrent });
    if (depth < 3) result.push(...flattenDemo(obj[c], [...path, c], currentPath, depth + 1, id, id));
  });
  return result;
}

export default function TrieVisualization({ trieData, searchPath, currentChar }: Props) {
  const demo = useMemo(() => buildDemoTrie(), []);
  const nodes = useMemo(() => flattenDemo(demo, [], searchPath, 0, null, 'r'), [demo, searchPath]);

  // Layout: group by depth
  const byDepth = useMemo(() => {
    const d: Record<number, FlatNode[]> = {};
    for (const n of nodes) { (d[n.depth] = d[n.depth] || []).push(n); }
    return d;
  }, [nodes]);

  const W = 560, H = 260;
  const depthKeys = Object.keys(byDepth).map(Number).sort();

  // Assign x,y positions
  const posMap: Record<string, { x: number; y: number }> = {};
  depthKeys.forEach(d => {
    const row = byDepth[d];
    const spacing = W / (row.length + 1);
    row.forEach((n, i) => { posMap[n.id] = { x: spacing * (i + 1), y: 30 + d * 65 }; });
  });

  return (
    <div className="card-holographic p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-tech text-[10px] px-2 py-0.5 rounded" style={{ color: '#39ff14', border: '1px solid #39ff1440', background: '#39ff1410' }}>TRIE</span>
          <span className="font-orbitron text-xs font-semibold text-white">PREFIX TREE</span>
        </div>
        <span className="font-tech text-[10px]" style={{ color: '#39ff14' }}>O(m)</span>
      </div>

      {searchPath.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1 items-center font-tech text-[10px]">
          <span className="text-[#4a6a7a]">PATH:</span>
          {searchPath.map((c, i) => (
            <span key={i} className="px-1.5 py-0.5 rounded transition-all" style={{
              background: i === searchPath.length - 1 ? '#39ff14' : '#39ff1420',
              color: i === searchPath.length - 1 ? '#030014' : '#39ff14',
              border: '1px solid #39ff1440'
            }}>{c}</span>
          ))}
        </div>
      )}

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
        {/* Edges */}
        {nodes.filter(n => n.parentId && posMap[n.id] && posMap[n.parentId]).map(n => {
          const p = posMap[n.parentId!], c = posMap[n.id];
          return (
            <line key={`e-${n.id}`} x1={p.x} y1={p.y} x2={c.x} y2={c.y}
              stroke={n.inPath ? '#39ff14' : 'rgba(0,245,255,0.08)'} strokeWidth={n.inPath ? 2 : 1}
              style={n.inPath ? { filter: 'drop-shadow(0 0 4px #39ff14)' } : {}} />
          );
        })}

        {/* Root */}
        <circle cx={W / 2} cy={10} r={10} fill="rgba(0,245,255,0.15)" stroke="#00f5ff" strokeWidth={1.5} />
        <text x={W / 2} y={14} textAnchor="middle" fill="#00f5ff" fontSize={9} fontFamily="'Share Tech Mono'">ROOT</text>

        {/* Nodes */}
        {nodes.filter(n => posMap[n.id]).map(n => {
          const { x, y } = posMap[n.id];
          const color = n.isCurrent ? '#39ff14' : n.inPath ? '#39ff1480' : n.isEnd ? '#ffbe00' : 'rgba(0,245,255,0.12)';
          const textColor = n.isCurrent ? '#030014' : n.inPath ? '#39ff14' : n.isEnd ? '#ffbe00' : '#7aa3b8';
          return (
            <g key={n.id}>
              <circle cx={x} cy={y} r={n.isCurrent ? 12 : 10}
                fill={color} stroke={n.inPath || n.isCurrent ? '#39ff14' : 'rgba(0,245,255,0.2)'} strokeWidth={1.5}
                style={n.isCurrent ? { filter: 'drop-shadow(0 0 8px #39ff14)' } : {}} />
              <text x={x} y={y + 4} textAnchor="middle" fill={textColor} fontSize={10} fontFamily="'Share Tech Mono'" fontWeight="bold">
                {n.char.toUpperCase()}
              </text>
              {n.isEnd && <circle cx={x + 8} cy={y - 8} r={3} fill="#ffbe00" style={{ filter: 'drop-shadow(0 0 4px #ffbe00)' }} />}
            </g>
          );
        })}
      </svg>

      <div className="flex flex-wrap gap-3 mt-2 font-tech text-[9px]">
        {[{ color: '#39ff14', label: 'Active Path' }, { color: '#ffbe00', label: 'Word End' }, { color: 'rgba(0,245,255,0.3)', label: 'Node' }].map(l => (
          <div key={l.label} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ background: l.color }} />
            <span style={{ color: '#4a6a7a' }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
