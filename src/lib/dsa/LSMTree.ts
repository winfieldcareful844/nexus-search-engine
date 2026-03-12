import * as fs from 'fs/promises';
import * as path from 'path';
import { SkipList } from './SkipList';
import { BloomFilter } from './BloomFilter';

/**
 * Log-Structured Merge-Tree (LSM Tree)
 * 
 * WHAT IT SOLVES:
 *   B-Trees (like those used in MySQL/Postgres) require random disk I/O for in-place
 *   updates. This is slow on traditional disks and causes write amplification on SSDs.
 *   An LSM Tree turns ALL continuous random writes into sequential disk O/P (appends).
 * 
 * HOW IT WORKS:
 *   1. Writes go to an in-memory balanced tree (MemTable) AND a Write-Ahead Log (WAL)
 *      for crash durability.
 *   2. When MemTable hits a size limit, it's flushed to disk as an immutable
 *      Sorted String Table (SSTable).
 *   3. Reads search the MemTable first, then recent SSTables, falling back to older ones.
 *      Bloom Filters on each SSTable prevent slow disk lookups for missing keys.
 *   4. Background Compaction merges smaller SSTables into larger ones, removing
 *      overwritten or deleted keys (tombstones).
 * 
 * WHY IT MATTERS:
 *   This is the standard storage architecture behind massive-scale distributed databases
 *   like Cassandra, RocksDB, LevelDB, HBase, and Google Bigtable.
 */

// A special marker to indicate a deleted key without removing it from the sequence
const TOMBSTONE = '__TOMBSTONE__';

/** SSTable Metadata kept in-memory for fast routing */
export interface SSTableMeta {
    id: string;
    level: number;
    minKey: string;
    maxKey: string;
    bloomFilter: BloomFilter;
    index: { key: string; offset: number }[]; // Sparse index (every N keys)
}

export class LSMTree {
    private memTable: SkipList<string, string>;
    private memSizeBytes: number = 0;
    
    // Configurations
    private readonly memTableFlushThresholdBytes = 1024 * 1024; // 1MB for demo (usually 64MB)
    private readonly dirPath: string;
    private readonly walPath: string;
    
    private sstables: SSTableMeta[] = []; // Sorted by level, then by recency (newest first)
    private nextSSTableId = 0;

    constructor(directory: string = './.data/lsm') {
        this.dirPath = directory;
        this.walPath = path.join(directory, 'wal.log');
        this.memTable = new SkipList<string, string>();
    }

    /**
     * Bootstraps the LSM Tree. Replays WAL if the database crashed before flush.
     */
    async init(): Promise<void> {
        try {
            await fs.mkdir(this.dirPath, { recursive: true });
            
            // 1. Replay WAL for disaster recovery
            try {
                const walData = await fs.readFile(this.walPath, 'utf8');
                if (walData) {
                    const lines = walData.split('\n').filter(Boolean);
                    for (const line of lines) {
                        const [key, value] = line.split('\t');
                        if (key && value) {
                            this.memTable.insert(key, value);
                            this.memSizeBytes += key.length + value.length;
                        }
                    }
                }
            } catch (err: any) {
                if (err.code !== 'ENOENT') throw err; // Ignore if WAL doesn't exist
            }
            
            // 2. Load existing SSTable metadata
            const files = await fs.readdir(this.dirPath);
            const metaFiles = files.filter(f => f.endsWith('.meta.json'));
            for (const mFile of metaFiles) {
                const contents = await fs.readFile(path.join(this.dirPath, mFile), 'utf8');
                const metaRaw = JSON.parse(contents);
                
                // Hydrate bloom filter
                const bf = new BloomFilter(1000, 0.01); 
                // In a real system you'd serialize/deserialize the actual BloomFilter bit array.
                // For this demo, we recreate an empty one (and would need to rebuild it if we wanted it perfectly accurate).
                // A production approach stores BF bits inside the SSTable footer.
                
                this.sstables.push({ ...metaRaw, bloomFilter: bf });
                const idNum = parseInt(metaRaw.id.replace('sst_', ''));
                if (idNum >= this.nextSSTableId) this.nextSSTableId = idNum + 1;
            }

            // Sort SSTables: Level 0 first (then by descending ID), then Level 1... 
            // Ensures reads hit the most recent updates first.
            this.sstables.sort((a, b) => {
                if (a.level !== b.level) return a.level - b.level;
                const aId = parseInt(a.id.split('_')[1]);
                const bId = parseInt(b.id.split('_')[1]);
                return bId - aId;
            });
            
        } catch (error) {
            console.error('Failed to initialize LSM Tree', error);
        }
    }

    /**
     * O(1) expected Memory Update. Appends to WAL for durability.
     */
    async put(key: string, value: string): Promise<void> {
        // 1. Append to Write-Ahead Log FIRST (crash tolerance)
        const logEntry = `${key}\t${value}\n`;
        await fs.appendFile(this.walPath, logEntry);

        // 2. Update MemTable
        this.memTable.insert(key, value);
        this.memSizeBytes += key.length + value.length;

        // 3. Check for Flush Threshold
        if (this.memSizeBytes >= this.memTableFlushThresholdBytes) {
            await this.flushMemTable();
        }
    }

    /**
     * Inserts a deletion marker (Tombstone). 
     * In an LSM tree, data is immutable, so deletes are just special writes.
     */
    async delete(key: string): Promise<void> {
        await this.put(key, TOMBSTONE);
    }

    /**
     * Read path:
     * 1. Check MemTable
     * 2. Check Level 0 SSTables (newest to oldest)
     * 3. Check Level 1->N SSTables
     */
    async get(key: string): Promise<string | null> {
        // 1. MemTable Lookup (O(log M))
        const memValue = this.memTable.search(key);
        if (memValue !== undefined) {
            return memValue === TOMBSTONE ? null : memValue;
        }

        // 2. SSTable Lookup (O(L * log S) with Bloom Filters avoiding disk access)
        for (const sst of this.sstables) {
            // Check ranges first
            if (key < sst.minKey || key > sst.maxKey) continue;
            
            // Check Bloom Filter (O(k))
            // if (!sst.bloomFilter.has(key)) continue; // Simulated skip
            
            // Disk read required if Bloom Filter returns true
            const val = await this.readFromSSTable(sst, key);
            if (val !== null) {
                return val === TOMBSTONE ? null : val;
            }
        }
        return null;
    }

    /**
     * Transforms the current in-memory SkipList into an immutable disk file.
     * Block size is typically 4KB, we create a sparse index pointing to block boundaries.
     */
    private async flushMemTable(): Promise<void> {
        if (this.memSizeBytes === 0) return;

        const sstId = `sst_${this.nextSSTableId++}`;
        const outputDataPath = path.join(this.dirPath, `${sstId}.data`);
        const outputMetaPath = path.join(this.dirPath, `${sstId}.meta.json`);

        // Get sorted entries from MemTable
        const entries = this.memTable.toSortedArray();

        // We'll write to a temp file, then atomically rename it, but for demo we just write.
        let fileContent = '';
        const sparseIndex: { key: string; offset: number }[] = [];
        const bloom = new BloomFilter(Math.max(1000, entries.length * 2), 0.01);
        
        let minKey = '';
        let maxKey = '';
        let currentOffset = 0;

        for (const {key, value} of entries) {
            if (!minKey) minKey = key;
            maxKey = key;
            bloom.add(key);
            
            // Add to sparse index every 64 items (acting as a block boundary)
            if (sparseIndex.length === 0 || sparseIndex.length % 64 === 0) {
                sparseIndex.push({ key, offset: currentOffset });
            }

            const row = `${key}\x00${value}\n`;
            fileContent += row;
            currentOffset += Buffer.byteLength(row, 'utf8');
        }

        await fs.writeFile(outputDataPath, fileContent);

        const meta: SSTableMeta = {
            id: sstId,
            level: 0,
            minKey,
            maxKey,
            bloomFilter: bloom,
            index: sparseIndex
        };

        // Write meta
        await fs.writeFile(outputMetaPath, JSON.stringify({ ...meta, bloomFilter: 'BLOB_REF' }));

        // Clear WAL and MemTable
        await fs.truncate(this.walPath, 0);
        this.memTable = new SkipList<string, string>();
        this.memSizeBytes = 0;

        // Add to active SSTables (newest at the front of Level 0)
        this.sstables.unshift(meta);

        // Check for compaction
        this.triggerCompactionCheck();
    }

    /**
     * Binary search the sparse index to find the byte offset, then read from disk.
     */
    private async readFromSSTable(meta: SSTableMeta, key: string): Promise<string | null> {
        // 1. Binary search the sparse index to find the containing block
        let blockOffsetStart = 0;
        let blockOffsetEnd = Number.MAX_SAFE_INTEGER;
        
        for (let i = 0; i < meta.index.length; i++) {
            if (meta.index[i].key <= key) {
                blockOffsetStart = meta.index[i].offset;
                if (i + 1 < meta.index.length) {
                    blockOffsetEnd = meta.index[i+1].offset;
                }
            } else {
                break;
            }
        }

        // 2. Read the specific block from disk
        try {
            const dataPath = path.join(this.dirPath, `${meta.id}.data`);
            const fileHandle = await fs.open(dataPath, 'r');
            
            // Read a chunk (in real system, read exact blockSize bytes)
            const buffer = Buffer.alloc(64 * 1024); // 64KB block guess
            const { bytesRead } = await fileHandle.read(buffer, 0, buffer.length, blockOffsetStart);
            await fileHandle.close();

            const block = buffer.toString('utf8', 0, bytesRead);
            const lines = block.split('\n');
            for (const line of lines) {
                const [k, v] = line.split('\x00');
                if (k === key) return v;
                if (k > key) break; // Because it's sorted, we can safely stop
            }
        } catch (err) {
            console.error('SSTable read error', err);
        }

        return null; // Not found in this SSTable
    }

    /**
     * Background Compaction (Size-Tiered)
     * If multiple SSTables end up in Level 0, we merge them into Level 1, 
     * resolving tombstones and recovering disk space.
     */
    private async triggerCompactionCheck(): Promise<void> {
        const level0 = this.sstables.filter(s => s.level === 0);
        if (level0.length >= 4) { // Compact when 4 files in L0
            console.log(`[LSM Compaction] Merging ${level0.length} Level 0 SSTables into Level 1...`);
            // In a real implementation:
            // 1. Open k-way merge iterator across all files
            // 2. Stream sorted combined keys to a new Level 1 file
            // 3. Drop tombstones logically if we are purely at the bottom level, 
            //    otherwise keep them to shadow deeper levels.
            // 4. Atomically swap metadata arrays and delete old files.
        }
    }

    // Diagnostics
    stats() {
        return {
            memTableSize: this.memSizeBytes,
            sstables: this.sstables.length,
            levels: [...new Set(this.sstables.map(s => s.level))],
            files: this.sstables.map(s => ({
                id: s.id, level: s.level, minKey: s.minKey, maxKey: s.maxKey 
            }))
        };
    }
}
