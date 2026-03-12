/**
 * Dummy Vector Embedding Service
 * 
 * In a real-world scenario (like Pinecone + OpenAI embeddings), we would 
 * pass the document text to an LLM or cross-encoder (e.g. text-embedding-ada-002) 
 * to get a 1536-dimensional dense vector representing the semantic meaning.
 * 
 * To avoid adding huge AI model dependencies (e.g. transformers.js) to this 
 * algorithm showcase, we use a deterministic "N-gram Hash" embedding.
 * This ensures that similar words actually produce mathematically similar vectors 
 * (to a small degree), allowing the HNSW vector database to function authentically.
 */

export class EmbeddingService {
    private static DIMENSIONS = 64;

    /**
     * Converts a string of text into a deterministic 64-dimensional normalized vector.
     * Uses character bi-grams to capture some "semantic" similarity
     * (e.g. "search" and "searching" will share many bi-grams).
     */
    static embed(text: string): number[] {
        const normalized = text.toLowerCase().replace(/[^a-z0-9]/g, ' ');
        const vector = new Array(this.DIMENSIONS).fill(0);
        
        // Count bi-grams
        for (let i = 0; i < normalized.length - 1; i++) {
            if (normalized[i] === ' ' && normalized[i+1] === ' ') continue;
            
            const bigram = normalized.substring(i, i + 2);
            // Simple string hash
            let hash = 0;
            for (let j = 0; j < bigram.length; j++) {
                hash = ((hash << 5) - hash) + bigram.charCodeAt(j);
                hash |= 0; 
            }
            
            // Map hash to a dimension bucket
            const bucket = Math.abs(hash) % this.DIMENSIONS;
            vector[bucket] += 1;
        }

        // Normalize vector (L2 norm = 1.0) so Cosine Similarity is simply the dot product
        let magnitude = 0;
        for (let i = 0; i < this.DIMENSIONS; i++) {
            magnitude += vector[i] * vector[i];
        }
        
        magnitude = Math.sqrt(magnitude);
        if (magnitude === 0) return vector; // empty string case
        
        for (let i = 0; i < this.DIMENSIONS; i++) {
            vector[i] /= magnitude;
        }

        return vector;
    }
}
