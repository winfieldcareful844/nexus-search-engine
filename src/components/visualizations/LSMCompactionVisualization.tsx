'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, HardDrive, Cpu, ArrowDown } from 'lucide-react';

export default function LSMCompactionVisualization() {
  const [memTable, setMemTable] = useState<{key: string, val: string}[]>([]);
  const [l0, setL0] = useState<{id: string, keys: number}[]>([]);
  const [l1, setL1] = useState<{id: string, keys: number}[]>([]);
  const [isCompacting, setIsCompacting] = useState(false);

  // Auto-generate MemTable writes
  useEffect(() => {
    const interval = setInterval(() => {
      setMemTable(prev => {
        if (prev.length >= 8) {
          // Flush to L0
          setL0(currentL0 => [...currentL0, { id: `sst-0-${Date.now().toString().slice(-4)}`, keys: 8 }]);
          return [];
        }
        return [...prev, { key: `k${Math.floor(Math.random() * 100)}`, val: 'val' }];
      });
    }, 600);
    return () => clearInterval(interval);
  }, []);

  // Auto-trigger Compaction from L0 to L1
  useEffect(() => {
    if (l0.length >= 4 && !isCompacting) {
      setIsCompacting(true);
      setTimeout(() => {
        setL0([]);
        setL1(prev => [...prev, { id: `sst-1-${Date.now().toString().slice(-4)}`, keys: 32 }]);
        setIsCompacting(false);
      }, 2000);
    }
  }, [l0, isCompacting]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4 border-b border-void-800 pb-2">
        <h3 className="text-xl font-orbitron text-primary-400 flex items-center gap-2">
          <Database className="w-5 h-5" />
          Log-Structured Merge-Tree
        </h3>
        <p className="text-sm text-void-300 font-mono">Storage Engine</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* MemTable (In-Memory) */}
        <div className="border border-void-700 bg-void-900 rounded-lg p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-accent-500/50"></div>
          <h4 className="font-orbitron text-accent-400 flex items-center gap-2 mb-4">
            <Cpu className="w-4 h-4" /> MemTable (RAM)
          </h4>
          <div className="space-y-2 min-h-[160px]">
            <AnimatePresence>
              {memTable.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="bg-void-800 border border-void-600 px-3 py-1 rounded text-xs font-mono flex justify-between"
                >
                  <span className="text-primary-300">{item.key}</span>
                  <span className="text-void-400">{item.val}</span>
                </motion.div>
              ))}
            </AnimatePresence>
            {memTable.length === 0 && (
              <p className="text-xs text-void-500 italic mt-4">Waiting for writes...</p>
            )}
          </div>
          
          <div className="mt-4 flex flex-col items-center justify-center text-void-500">
            <p className="text-[10px] mb-1">Flush Threshold: 8 items</p>
            <div className="w-full bg-void-800 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-accent-500 h-full transition-all duration-300"
                style={{ width: `${(memTable.length / 8) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Level 0 SSTables */}
        <div className="border border-void-700 bg-void-900 rounded-lg p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-primary-500/50"></div>
          <h4 className="font-orbitron text-primary-400 flex items-center gap-2 mb-4">
            <HardDrive className="w-4 h-4" /> Level 0 (Disk)
          </h4>
          <div className="space-y-3 min-h-[160px] relative">
            <AnimatePresence>
              {l0.map((sst) => (
                <motion.div
                  key={sst.id}
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 50, scale: 0.9 }}
                  className="bg-void-800 border border-primary-500/30 px-3 py-2 rounded text-xs font-mono flex justify-between items-center"
                >
                  <span className="text-primary-300">{sst.id}.sst</span>
                  <span className="bg-primary-500/20 text-primary-400 px-2 rounded-full">{sst.keys} keys</span>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {isCompacting && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="absolute inset-0 bg-void-900/80 backdrop-blur-sm flex flex-col items-center justify-center border border-accent-500/50 rounded z-10"
              >
                <ArrowDown className="w-6 h-6 text-accent-400 animate-bounce mb-2" />
                <p className="text-xs font-orbitron text-accent-400">Compacting to L1...</p>
              </motion.div>
            )}
          </div>
          
          <div className="mt-4 text-center">
            <p className="text-[10px] text-void-500">Compaction Threshold: 4 files</p>
          </div>
        </div>

        {/* Level 1 SSTables */}
        <div className="border border-void-700 bg-void-900 rounded-lg p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500/50"></div>
          <h4 className="font-orbitron text-emerald-400 flex items-center gap-2 mb-4">
            <HardDrive className="w-4 h-4" /> Level 1 (Disk)
          </h4>
          <div className="space-y-3 min-h-[160px]">
            <AnimatePresence>
              {l1.map((sst) => (
                <motion.div
                  key={sst.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-void-800 border border-emerald-500/30 px-3 py-2 rounded text-xs font-mono flex justify-between items-center"
                >
                  <span className="text-emerald-300">{sst.id}.sst</span>
                  <span className="bg-emerald-500/20 text-emerald-400 px-2 rounded-full text-[10px]">Merged (x4)</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          
          <div className="mt-4 text-center">
            <p className="text-[10px] text-void-500">Read Optimized Layer</p>
          </div>
        </div>

      </div>

      <div className="bg-void-800/50 rounded-lg p-4 text-xs text-void-300 border border-void-700/50">
        <p className="mb-2"><strong className="text-accent-400">Alien Tech Insight:</strong> Real databases (like Cassandra or RocksDB) use LSM Trees to turn random writes into sequential disk IO. Operations flow from memory (MemTable) downwards to disk (SSTables).</p>
        <p><strong className="text-primary-400">Compaction:</strong> Background workers merge overlapping SSTables, dropping deleted keys (Tombstones) and optimizing read performance.</p>
      </div>

    </div>
  );
}
