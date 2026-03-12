import { LSMTree } from './LSMTree';
import { mockWebPages } from './mockData';

export interface Posting {
    docId: string;
    positions: number[];
    frequency: number;
}

export interface IndexEntry {
    term: string;
    postings: Posting[];
    skipList: { docId: string; index: number }[];
    documentFrequency: number;
    compressedBytes: number;
}

export interface SearchResult {
    docId: string;
    score: number;
    matchedTerms: string[];
    phraseMatch?: boolean;
    proximityBonus?: number;
}

const BM25_K1 = 1.5;
const BM25_B = 0.75;

export class EnhancedInvertedIndex {
    private lsm: LSMTree;
    // Keeping Document metadata in memory for quick snippets is common in search engines
    // (Actual inverted index data goes to LSM disk storage)
    private documents: Map<string, { title: string; content: string; keywords: string[]; length: number }>;
    private totalDocuments: number = 0;
    private totalTerms: number = 0;
    private initialized: boolean = false;
    
    // Track compression metrics for diagnostics
    private statsTotalRawBytes: number = 0;
    private statsTotalCompressedBytes: number = 0;

    constructor() {
        this.lsm = new LSMTree('./.data/inverted_index');
        this.documents = new Map();
    }

    async init() {
        if (this.initialized) return;
        await this.lsm.init();
        this.initialized = true;
    }

    private vbyteEncode(n: number): Uint8Array {
        const bytes: number[] = [];
        while (n > 127) {
            bytes.push((n & 0x7F) | 0x80);
            n >>>= 7;
        }
        bytes.push(n & 0x7F);
        return new Uint8Array(bytes);
    }

    private docIdToInt(docId: string): number {
        let h = 0x811c9dc5;
        for (let i = 0; i < docId.length; i++) {
            h ^= docId.charCodeAt(i);
            h = (h * 16777619) >>> 0;
        }
        return h >>> 0;
    }

    private compressedSize(postings: Posting[]): number {
        if (postings.length === 0) return 0;
        let totalBytes = 0;
        let prev = 0;
        for (const p of postings) {
            const id = this.docIdToInt(p.docId);
            const gap = Math.max(0, id - prev);
            totalBytes += this.vbyteEncode(gap).length;
            prev = id;
        }
        return totalBytes;
    }

    private buildSkips(postings: Posting[]): { docId: string; index: number }[] {
        const step = Math.max(1, Math.floor(Math.sqrt(postings.length)));
        const skips: { docId: string; index: number }[] = [];
        for (let i = step; i < postings.length; i += step) {
            skips.push({ docId: postings[i].docId, index: i });
        }
        return skips;
    }

    private tokenize(text: string): string[] {
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(t => t.length > 1 && !STOP_WORDS.has(t));
    }

    // ── Indexing (Async to use LSMTree) ──────────────────────────────────
    async addDocument(docId: string, title: string, content: string, keywords: string[]): Promise<void> {
        const terms = this.tokenize(content + ' ' + title + ' ' + keywords.join(' '));
        this.documents.set(docId, { title, content, keywords, length: terms.length });
        this.totalDocuments++;
        this.totalTerms += terms.length;

        const termPositions = new Map<string, number[]>();
        terms.forEach((term, pos) => {
            if (!termPositions.has(term)) termPositions.set(term, []);
            termPositions.get(term)!.push(pos);
        });

        // Write batch updates to LSM
        for (const [term, positions] of termPositions.entries()) {
            const existingRaw = await this.lsm.get(`term:${term}`);
            let entry: IndexEntry;
            if (existingRaw) {
                entry = JSON.parse(existingRaw);
            } else {
                entry = { term, postings: [], skipList: [], documentFrequency: 0, compressedBytes: 0 };
            }

            // Remove any existing posting for this docId (update case)
            if (entry.postings.length > 0) {
                this.statsTotalRawBytes -= entry.postings.length * 8;
                this.statsTotalCompressedBytes -= entry.compressedBytes;
            }
            entry.postings = entry.postings.filter(p => p.docId !== docId);
            
            entry.postings.push({ docId, positions, frequency: positions.length });
            entry.documentFrequency = entry.postings.length;
            entry.postings.sort((a, b) => a.docId.localeCompare(b.docId));
            entry.skipList = this.buildSkips(entry.postings);
            entry.compressedBytes = this.compressedSize(entry.postings);
            
            this.statsTotalRawBytes += entry.postings.length * 8;
            this.statsTotalCompressedBytes += entry.compressedBytes;

            await this.lsm.put(`term:${term}`, JSON.stringify(entry));
        }
    }

    async getEntry(term: string): Promise<IndexEntry | null> {
        const raw = await this.lsm.get(`term:${term.toLowerCase()}`);
        return raw ? JSON.parse(raw) : null;
    }

    // ── BM25 Scoring (Async) ─────────────────────────────────────────────
    private async bm25Score(docId: string, terms: string[]): Promise<number> {
        const avgdl = this.totalDocuments > 0 ? this.totalTerms / this.totalDocuments : 1;
        const doc = this.documents.get(docId);
        const dl = doc?.length ?? avgdl;
        const N = this.totalDocuments;

        let score = 0;
        for (const term of terms) {
            const entry = await this.getEntry(term);
            if (!entry) continue;
            
            const posting = entry.postings.find(p => p.docId === docId);
            if (!posting) continue;

            const tf = posting.frequency;
            const df = entry.documentFrequency;
            const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);
            const tfn = (tf * (BM25_K1 + 1)) / (tf + BM25_K1 * (1 - BM25_B + BM25_B * dl / avgdl));

            score += idf * tfn;
        }
        return score;
    }

    private async proximityBonus(docId: string, terms: string[], lambda: number = 10): Promise<number> {
        if (terms.length < 2) return 0;
        let totalBonus = 0;

        for (let i = 0; i < terms.length - 1; i++) {
            const entryA = await this.getEntry(terms[i]);
            const entryB = await this.getEntry(terms[i + 1]);
            
            const posA = entryA?.postings.find(p => p.docId === docId)?.positions ?? [];
            const posB = entryB?.postings.find(p => p.docId === docId)?.positions ?? [];
            
            if (posA.length === 0 || posB.length === 0) continue;

            let pA = 0, pB = 0, minSpan = Infinity;
            while (pA < posA.length && pB < posB.length) {
                const span = Math.abs(posA[pA] - posB[pB]);
                minSpan = Math.min(minSpan, span);
                if (posA[pA] < posB[pB]) pA++;
                else pB++;
            }
            if (minSpan < Infinity) totalBonus += lambda / Math.max(minSpan, 1);
        }
        return totalBonus;
    }

    // ── Query Algorithms (Async) ─────────────────────────────────────────

    async queryAND(terms: string[]): Promise<SearchResult[]> {
        const normalized = terms.map(t => t.toLowerCase());
        
        // Fetch all needed entries to avoid re-fetching
        const entriesMap = new Map<string, IndexEntry>();
        for (const term of normalized) {
            const entry = await this.getEntry(term);
            if (!entry) return []; // AND requires all terms
            entriesMap.set(term, entry);
        }

        normalized.sort((a, b) => entriesMap.get(a)!.documentFrequency - entriesMap.get(b)!.documentFrequency);

        let candidates = entriesMap.get(normalized[0])!.postings.map(p => p.docId);

        for (let i = 1; i < normalized.length && candidates.length > 0; i++) {
            const entry = entriesMap.get(normalized[i])!;
            const skips = entry.skipList;
            const newCandidates: string[] = [];

            for (const docId of candidates) {
                let searchIdx = 0;
                for (const skip of skips) {
                    if (skip.docId.localeCompare(docId) <= 0) searchIdx = skip.index;
                    else break;
                }
                let found = false;
                for (let j = searchIdx; j < entry.postings.length; j++) {
                    const cmp = entry.postings[j].docId.localeCompare(docId);
                    if (cmp === 0) { found = true; break; }
                    if (cmp > 0) break;
                }
                if (found) newCandidates.push(docId);
            }
            candidates = newCandidates;
        }

        const results: SearchResult[] = [];
        for (const docId of candidates) {
            const bm25 = await this.bm25Score(docId, normalized);
            const prox = await this.proximityBonus(docId, normalized);
            results.push({ docId, score: bm25 + prox, matchedTerms: normalized, proximityBonus: prox });
        }
        return results.sort((a, b) => b.score - a.score);
    }

    async queryPhrase(phraseTerms: string[]): Promise<SearchResult[]> {
        if (phraseTerms.length === 0) return [];
        const normalized = phraseTerms.map(t => t.toLowerCase());

        const andResults = await this.queryAND(normalized);
        if (andResults.length === 0) return [];

        const phraseMatches: SearchResult[] = [];

        // Preload entries
        const entriesMap = new Map<string, IndexEntry>();
        for (const term of normalized) {
            const entry = await this.getEntry(term);
            if (entry) entriesMap.set(term, entry);
        }

        for (const result of andResults) {
            const docId = result.docId;

            const positionLists: number[][] = normalized.map(term =>
                entriesMap.get(term)?.postings.find(p => p.docId === docId)?.positions.slice().sort((a, b) => a - b) ?? []
            );

            if (positionLists.some(pl => pl.length === 0)) continue;

            let validStarts = positionLists[0];
            for (let i = 1; i < positionLists.length; i++) {
                const nextSet = new Set(positionLists[i]);
                validStarts = validStarts.filter(pos => nextSet.has(pos + i));
            }

            if (validStarts.length > 0) {
                phraseMatches.push({ ...result, phraseMatch: true, score: result.score * 2.0 });
            }
        }

        return phraseMatches.sort((a, b) => b.score - a.score);
    }

    async queryOR(terms: string[]): Promise<SearchResult[]> {
        const normalized = terms.map(t => t.toLowerCase());
        const docScores = new Map<string, { bm25: number; matchedTerms: string[] }>();

        for (const term of normalized) {
            const entry = await this.getEntry(term);
            const postings = entry?.postings ?? [];
            for (const posting of postings) {
                if (!docScores.has(posting.docId)) {
                    docScores.set(posting.docId, { bm25: 0, matchedTerms: [] });
                }
                const data = docScores.get(posting.docId)!;
                if (!data.matchedTerms.includes(term)) data.matchedTerms.push(term);
            }
        }

        const results: SearchResult[] = [];
        for (const [docId, data] of docScores.entries()) {
            const bm25 = await this.bm25Score(docId, data.matchedTerms);
            const prox = await this.proximityBonus(docId, data.matchedTerms);
            results.push({ docId, score: bm25 + prox, matchedTerms: data.matchedTerms });
        }

        return results.sort((a, b) => b.score - a.score);
    }

    getDocument(docId: string) { return this.documents.get(docId); }
    getTotalDocuments(): number { return this.totalDocuments; }
    
    compressionStats() {
        return {
            totalRawBytes: this.statsTotalRawBytes,
            totalCompressedBytes: this.statsTotalCompressedBytes,
            compressionRatio: this.statsTotalRawBytes > 0 ? this.statsTotalRawBytes / this.statsTotalCompressedBytes : 1,
            terms: this.totalTerms
        };
    }
}

const STOP_WORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'by', 'from', 'up', 'about', 'into', 'through', 'during', 'is', 'are', 'was',
    'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'need', 'dare',
    'ought', 'used', 'it', 'its', 'this', 'that', 'these', 'those', 'i', 'we', 'you',
    'he', 'she', 'they', 'me', 'us', 'him', 'her', 'them', 'my', 'our', 'your', 'his',
    'their', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each',
    'both', 'few', 'more', 'most', 'other', 'some', 'such', 'than', 'too', 'very',
]);

let globalEnhancedIndex: EnhancedInvertedIndex | null = null;
let isInitializing = false;

export async function getGlobalEnhancedIndexAsync(): Promise<EnhancedInvertedIndex> {
    if (globalEnhancedIndex) return globalEnhancedIndex;
    if (!globalEnhancedIndex && !isInitializing) {
        isInitializing = true;
        const index = new EnhancedInvertedIndex();
        await index.init();
        
        // Populate if empty (first run)
        if (index.getTotalDocuments() === 0) {
            for (const page of mockWebPages) {
                await index.addDocument(page.id, page.title, page.snippet, page.keywords);
            }
        }
        globalEnhancedIndex = index;
        isInitializing = false;
    } else {
        // Simple spin-wait if concurrent init requested
        while (isInitializing) {
            await new Promise(r => setTimeout(r, 10));
        }
    }
    return globalEnhancedIndex!;
}
