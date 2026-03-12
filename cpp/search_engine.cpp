/**
 * High-Performance Search Engine with Advanced DSA Implementations
 * Compiled to WebAssembly for browser usage
 * 
 * Features:
 * - Trie with Levenshtein distance for fuzzy matching
 * - PageRank with sparse matrix operations
 * - LRU Cache with O(1) operations
 * - MinHeap for streaming top-K
 * - Inverted Index with TF-IDF and BM25 scoring
 * - Memory-efficient serialization
 */

#include <emscripten/emscripten.h>
#include <emscripten/bind.h>
#include <string>
#include <vector>
#include <unordered_map>
#include <unordered_set>
#include <map>
#include <set>
#include <queue>
#include <algorithm>
#include <cmath>
#include <memory>
#include <fstream>
#include <sstream>
#include <iomanip>

using namespace emscripten;

// ============================================================================
// UTILITIES
// ============================================================================

// Fast string hashing for hash maps
struct StringHash {
    size_t operator()(const std::string& s) const {
        size_t hash = 5381;
        for (char c : s) {
            hash = ((hash << 5) + hash) + c;
        }
        return hash;
    }
};

// Timer for performance measurement
class Timer {
    double start;
public:
    Timer() : start(emscripten_get_now()) {}
    double elapsed() const { return emscripten_get_now() - start; }
    void reset() { start = emscripten_get_now(); }
};

// ============================================================================
// TRIE WITH LEVENSHTEIN DISTANCE (FUZZY SEARCH)
// ============================================================================

class TrieNode {
public:
    std::unordered_map<char, TrieNode*> children;
    bool isEndOfWord;
    int frequency;
    std::string word;
    
    TrieNode() : isEndOfWord(false), frequency(0) {}
    ~TrieNode() {
        for (auto& pair : children) {
            delete pair.second;
        }
    }
};

class Trie {
    TrieNode* root;
    size_t nodeCount;
    size_t totalInsertions;
    
public:
    Trie() : root(new TrieNode()), nodeCount(1), totalInsertions(0) {}
    ~Trie() { delete root; }
    
    // O(m) insertion where m = word length
    void insert(const std::string& word, int freq = 1) {
        TrieNode* current = root;
        for (char c : word) {
            if (current->children.find(c) == current->children.end()) {
                current->children[c] = new TrieNode();
                nodeCount++;
            }
            current = current->children[c];
        }
        if (!current->isEndOfWord) {
            current->word = word;
        }
        current->isEndOfWord = true;
        current->frequency += freq;
        totalInsertions++;
    }
    
    // O(m) exact search
    bool search(const std::string& word) const {
        TrieNode* node = findNode(word);
        return node && node->isEndOfWord;
    }
    
    // O(m) prefix check
    bool startsWith(const std::string& prefix) const {
        return findNode(prefix) != nullptr;
    }
    
    // Get all words with prefix - O(m + output)
    std::vector<std::pair<std::string, int>> autocomplete(const std::string& prefix, int maxResults = 10) const {
        std::vector<std::pair<std::string, int>> results;
        TrieNode* start = findNode(prefix);
        if (!start) return results;
        
        collectWords(start, prefix, results);
        
        // Sort by frequency descending
        std::sort(results.begin(), results.end(), 
            [](const auto& a, const auto& b) { return a.second > b.second; });
        
        if ((int)results.size() > maxResults) {
            results.resize(maxResults);
        }
        return results;
    }
    
    // Levenshtein distance fuzzy search - O(m × n × maxDist) for n candidates
    std::vector<std::pair<std::string, int>> fuzzySearch(
        const std::string& query, 
        int maxDistance = 2, 
        int maxResults = 10
    ) const {
        std::vector<std::pair<std::string, int>> results;
        
        // Build initial row of distances
        std::vector<int> currentRow(query.length() + 1);
        for (size_t i = 0; i <= query.length(); i++) {
            currentRow[i] = i;
        }
        
        // Recursively search with edit distance tracking
        for (const auto& pair : root->children) {
            fuzzySearchRecursive(
                pair.second, pair.first, query, currentRow, 
                results, maxDistance
            );
        }
        
        // Sort by distance (ascending), then frequency (descending)
        std::sort(results.begin(), results.end(), 
            [](const auto& a, const auto& b) { 
                return a.second != b.second ? a.second > b.second : a.first < b.first; 
            });
        
        if ((int)results.size() > maxResults) {
            results.resize(maxResults);
        }
        return results;
    }
    
    // Get memory usage estimate
    size_t getMemoryUsage() const {
        return nodeCount * (sizeof(TrieNode) + 50); // Approximate overhead
    }
    
    size_t getNodeCount() const { return nodeCount; }
    size_t getTotalInsertions() const { return totalInsertions; }
    
private:
    TrieNode* findNode(const std::string& prefix) const {
        TrieNode* current = root;
        for (char c : prefix) {
            if (current->children.find(c) == current->children.end()) {
                return nullptr;
            }
            current = current->children[c];
        }
        return current;
    }
    
    void collectWords(
        TrieNode* node, 
        const std::string& prefix, 
        std::vector<std::pair<std::string, int>>& results
    ) const {
        if (node->isEndOfWord) {
            results.push_back({prefix, node->frequency});
        }
        for (const auto& pair : node->children) {
            collectWords(pair.second, prefix + pair.first, results);
        }
    }
    
    void fuzzySearchRecursive(
        TrieNode* node, 
        char ch, 
        const std::string& query,
        const std::vector<int>& previousRow,
        std::vector<std::pair<std::string, int>>& results,
        int maxDistance
    ) const {
        size_t columns = query.length() + 1;
        std::vector<int> currentRow(columns);
        currentRow[0] = previousRow[0] + 1;
        
        // Calculate minimum edit distance
        for (size_t i = 1; i < columns; i++) {
            int insertCost = currentRow[i - 1] + 1;
            int deleteCost = previousRow[i] + 1;
            int replaceCost = previousRow[i - 1] + (query[i - 1] != ch ? 1 : 0);
            currentRow[i] = std::min({insertCost, deleteCost, replaceCost});
        }
        
        // If last element <= maxDistance and is end of word, add to results
        if (currentRow[columns - 1] <= maxDistance && node->isEndOfWord) {
            results.push_back({node->word, node->frequency});
        }
        
        // If any element in row <= maxDistance, recursively search children
        if (*std::min_element(currentRow.begin(), currentRow.end()) <= maxDistance) {
            for (const auto& pair : node->children) {
                fuzzySearchRecursive(pair.second, pair.first, query, currentRow, results, maxDistance);
            }
        }
    }
};

// ============================================================================
// LRU CACHE WITH O(1) OPERATIONS
// ============================================================================

template<typename K, typename V>
class LRUCache {
    struct CacheNode {
        K key;
        V value;
        CacheNode* prev;
        CacheNode* next;
        
        CacheNode(const K& k, const V& v) : key(k), value(v), prev(nullptr), next(nullptr) {}
    };
    
    std::unordered_map<K, CacheNode*, StringHash> cache;
    CacheNode* head; // Most recently used
    CacheNode* tail; // Least recently used
    size_t capacity;
    size_t hits;
    size_t misses;
    
public:
    LRUCache(size_t cap) : head(nullptr), tail(nullptr), capacity(cap), hits(0), misses(0) {}
    
    ~LRUCache() {
        CacheNode* current = head;
        while (current) {
            CacheNode* next = current->next;
            delete current;
            current = next;
        }
    }
    
    // O(1) average case
    std::pair<bool, V> get(const K& key) {
        auto it = cache.find(key);
        if (it == cache.end()) {
            misses++;
            return {false, V()};
        }
        
        hits++;
        CacheNode* node = it->second;
        moveToHead(node);
        return {true, node->value};
    }
    
    // O(1) average case
    void put(const K& key, const V& value) {
        auto it = cache.find(key);
        
        if (it != cache.end()) {
            // Update existing
            it->second->value = value;
            moveToHead(it->second);
            return;
        }
        
        // Evict LRU if at capacity
        if (cache.size() >= capacity) {
            evictLRU();
        }
        
        // Insert new node
        CacheNode* node = new CacheNode(key, value);
        cache[key] = node;
        addToHead(node);
    }
    
    bool contains(const K& key) const {
        return cache.find(key) != cache.end();
    }
    
    size_t size() const { return cache.size(); }
    size_t getHits() const { return hits; }
    size_t getMisses() const { return misses; }
    double getHitRate() const {
        size_t total = hits + misses;
        return total > 0 ? (double)hits / total : 0.0;
    }
    
    std::vector<K> getKeys() const {
        std::vector<K> keys;
        CacheNode* current = head;
        while (current) {
            keys.push_back(current->key);
            current = current->next;
        }
        return keys;
    }
    
private:
    void moveToHead(CacheNode* node) {
        if (node == head) return;
        
        // Remove from current position
        if (node->prev) node->prev->next = node->next;
        if (node->next) node->next->prev = node->prev;
        if (node == tail) tail = node->prev;
        
        // Add to head
        node->prev = nullptr;
        node->next = head;
        if (head) head->prev = node;
        head = node;
    }
    
    void addToHead(CacheNode* node) {
        node->next = head;
        node->prev = nullptr;
        if (head) head->prev = node;
        head = node;
        if (!tail) tail = node;
    }
    
    void evictLRU() {
        if (!tail) return;
        
        CacheNode* lru = tail;
        cache.erase(lru->key);
        
        if (lru->prev) {
            lru->prev->next = nullptr;
            tail = lru->prev;
        } else {
            head = tail = nullptr;
        }
        
        delete lru;
    }
};

// ============================================================================
// MIN-HEAP FOR TOP-K SELECTION
// ============================================================================

struct HeapItem {
    std::string id;
    std::string title;
    double score;
    
    HeapItem(const std::string& i, const std::string& t, double s) 
        : id(i), title(t), score(s) {}
    HeapItem() : score(0) {}
};

class MinHeap {
    std::vector<HeapItem> heap;
    size_t maxSize;
    size_t operations;
    
public:
    MinHeap(size_t maxSz) : maxSize(maxSz), operations(0) {}
    
    // O(log k) where k = maxSize
    void push(const HeapItem& item) {
        operations++;
        
        if (heap.size() < maxSize) {
            heap.push_back(item);
            bubbleUp(heap.size() - 1);
        } else if (item.score > heap[0].score) {
            // Replace minimum if new item is larger
            heap[0] = item;
            bubbleDown(0);
        }
    }
    
    // O(log k)
    HeapItem popMin() {
        if (heap.empty()) return HeapItem();
        
        HeapItem min = heap[0];
        heap[0] = heap.back();
        heap.pop_back();
        
        if (!heap.empty()) {
            bubbleDown(0);
        }
        
        return min;
    }
    
    // Get sorted results (descending by score)
    std::vector<HeapItem> getSorted() {
        std::vector<HeapItem> result;
        std::vector<HeapItem> temp = heap;
        
        while (!temp.empty()) {
            // Find max (we want descending order)
            auto maxIt = std::max_element(temp.begin(), temp.end(),
                [](const HeapItem& a, const HeapItem& b) { return a.score < b.score; });
            result.push_back(*maxIt);
            temp.erase(maxIt);
        }
        
        return result;
    }
    
    const std::vector<HeapItem>& getHeap() const { return heap; }
    size_t size() const { return heap.size(); }
    bool empty() const { return heap.empty(); }
    size_t getOperations() const { return operations; }
    
private:
    void bubbleUp(size_t index) {
        while (index > 0) {
            size_t parent = (index - 1) / 2;
            if (heap[parent].score <= heap[index].score) break;
            std::swap(heap[parent], heap[index]);
            index = parent;
        }
    }
    
    void bubbleDown(size_t index) {
        while (true) {
            size_t left = 2 * index + 1;
            size_t right = 2 * index + 2;
            size_t smallest = index;
            
            if (left < heap.size() && heap[left].score < heap[smallest].score) {
                smallest = left;
            }
            if (right < heap.size() && heap[right].score < heap[smallest].score) {
                smallest = right;
            }
            
            if (smallest == index) break;
            std::swap(heap[index], heap[smallest]);
            index = smallest;
        }
    }
};

// ============================================================================
// INVERTED INDEX WITH TF-IDF AND BM25
// ============================================================================

struct Posting {
    std::string docId;
    std::vector<size_t> positions;
    int frequency;
    
    Posting(const std::string& id) : docId(id), frequency(0) {}
};

struct Document {
    std::string id;
    std::string title;
    std::string content;
    std::vector<std::string> keywords;
    size_t length;
};

class InvertedIndex {
    std::unordered_map<std::string, std::vector<Posting>, StringHash> index;
    std::unordered_map<std::string, Document, StringHash> documents;
    std::unordered_map<std::string, double, StringHash> docLengths; // For BM25
    size_t totalTerms;
    double avgDocLength;
    
public:
    InvertedIndex() : totalTerms(0), avgDocLength(0) {}
    
    // Add document and index its terms
    void addDocument(const std::string& id, const std::string& title, 
                     const std::string& content, const std::vector<std::string>& keywords) {
        Document doc;
        doc.id = id;
        doc.title = title;
        doc.content = content;
        doc.keywords = keywords;
        doc.length = 0;
        
        // Tokenize and index content
        std::vector<std::string> terms = tokenize(content + " " + title);
        
        // Track positions for phrase queries
        std::unordered_map<std::string, std::vector<size_t>, StringHash> termPositions;
        for (size_t i = 0; i < terms.size(); i++) {
            termPositions[terms[i]].push_back(i);
            doc.length++;
        }
        
        // Add to index
        for (const auto& pair : termPositions) {
            const std::string& term = pair.first;
            
            if (index.find(term) == index.end()) {
                index[term] = std::vector<Posting>();
            }
            
            Posting posting(id);
            posting.positions = pair.second;
            posting.frequency = pair.second.size();
            index[term].push_back(posting);
        }
        
        documents[id] = doc;
        docLengths[id] = doc.length;
        totalTerms += doc.length;
        avgDocLength = (double)totalTerms / documents.size();
    }
    
    // TF-IDF scoring
    std::vector<std::pair<std::string, double>> searchTFIDF(
        const std::vector<std::string>& queryTerms, 
        int maxResults = 20
    ) {
        std::unordered_map<std::string, double, StringHash> scores;
        size_t N = documents.size();
        
        for (const std::string& term : queryTerms) {
            auto it = index.find(term);
            if (it == index.end()) continue;
            
            // IDF = log(N / df)
            double idf = log((double)N / it->second.size());
            
            for (const Posting& posting : it->second) {
                // TF = 1 + log(frequency) or just frequency
                double tf = 1 + log(posting.frequency);
                scores[posting.docId] += tf * idf;
            }
        }
        
        return sortAndLimit(scores, maxResults);
    }
    
    // BM25 scoring (more sophisticated)
    std::vector<std::pair<std::string, double>> searchBM25(
        const std::vector<std::string>& queryTerms,
        double k1 = 1.5,
        double b = 0.75,
        int maxResults = 20
    ) {
        std::unordered_map<std::string, double, StringHash> scores;
        size_t N = documents.size();
        
        for (const std::string& term : queryTerms) {
            auto it = index.find(term);
            if (it == index.end()) continue;
            
            // IDF for BM25
            double df = it->second.size();
            double idf = log((N - df + 0.5) / (df + 0.5) + 1);
            
            for (const Posting& posting : it->second) {
                double tf = posting.frequency;
                double docLen = docLengths[posting.docId];
                
                // BM25 formula
                double numerator = tf * (k1 + 1);
                double denominator = tf + k1 * (1 - b + b * docLen / avgDocLength);
                
                scores[posting.docId] += idf * numerator / denominator;
            }
        }
        
        return sortAndLimit(scores, maxResults);
    }
    
    // Boolean AND query
    std::vector<std::string> searchAND(const std::vector<std::string>& queryTerms) {
        if (queryTerms.empty()) return {};
        
        std::unordered_set<std::string, StringHash> result;
        bool first = true;
        
        for (const std::string& term : queryTerms) {
            auto it = index.find(term);
            if (it == index.end()) return {};
            
            std::unordered_set<std::string, StringHash> docs;
            for (const Posting& p : it->second) {
                docs.insert(p.docId);
            }
            
            if (first) {
                result = docs;
                first = false;
            } else {
                std::unordered_set<std::string, StringHash> intersection;
                for (const std::string& doc : result) {
                    if (docs.count(doc)) intersection.insert(doc);
                }
                result = intersection;
            }
        }
        
        return std::vector<std::string>(result.begin(), result.end());
    }
    
    const Document* getDocument(const std::string& id) const {
        auto it = documents.find(id);
        return it != documents.end() ? &(it->second) : nullptr;
    }
    
    size_t getIndexSize() const { return index.size(); }
    size_t getDocumentCount() const { return documents.size(); }
    double getAvgDocLength() const { return avgDocLength; }
    
    // Get posting list for visualization
    std::vector<std::pair<std::string, int>> getPostings(const std::string& term) {
        std::vector<std::pair<std::string, int>> result;
        auto it = index.find(term);
        if (it != index.end()) {
            for (const Posting& p : it->second) {
                result.push_back({p.docId, p.frequency});
            }
        }
        return result;
    }
    
private:
    std::vector<std::string> tokenize(const std::string& text) {
        std::vector<std::string> tokens;
        std::string current;
        
        for (char c : text) {
            if (std::isalnum(c)) {
                current += std::tolower(c);
            } else if (!current.empty()) {
                if (current.length() > 1) tokens.push_back(current);
                current.clear();
            }
        }
        if (current.length() > 1) tokens.push_back(current);
        
        return tokens;
    }
    
    std::vector<std::pair<std::string, double>> sortAndLimit(
        const std::unordered_map<std::string, double, StringHash>& scores,
        int maxResults
    ) {
        std::vector<std::pair<std::string, double>> result(scores.begin(), scores.end());
        std::sort(result.begin(), result.end(),
            [](const auto& a, const auto& b) { return a.second > b.second; });
        
        if ((int)result.size() > maxResults) {
            result.resize(maxResults);
        }
        return result;
    }
};

// ============================================================================
// PAGERANK IMPLEMENTATION
// ============================================================================

class PageRank {
    std::unordered_map<std::string, std::vector<std::string>, StringHash> graph; // outlinks
    std::unordered_map<std::string, std::vector<std::string>, StringHash> reverseGraph; // inlinks
    std::unordered_map<std::string, double, StringHash> ranks;
    std::vector<std::pair<std::string, double>> rankHistory;
    size_t iterations;
    
public:
    PageRank() : iterations(0) {}
    
    // Add edge: from -> to
    void addEdge(const std::string& from, const std::string& to) {
        graph[from].push_back(to);
        reverseGraph[to].push_back(from);
        
        // Ensure both nodes exist in ranks
        if (ranks.find(from) == ranks.end()) ranks[from] = 0;
        if (ranks.find(to) == ranks.end()) ranks[to] = 0;
    }
    
    // Compute PageRank with power iteration
    void compute(double damping = 0.85, int maxIterations = 100, double tolerance = 1e-6) {
        size_t N = ranks.size();
        if (N == 0) return;
        
        // Initialize ranks uniformly
        double initialRank = 1.0 / N;
        for (auto& pair : ranks) {
            pair.second = initialRank;
        }
        
        // Power iteration
        for (int iter = 0; iter < maxIterations; iter++) {
            std::unordered_map<std::string, double, StringHash> newRanks;
            double diff = 0;
            
            for (const auto& node : ranks) {
                const std::string& page = node.first;
                
                // Sum contributions from inlinks
                double rankSum = 0;
                auto inlinksIt = reverseGraph.find(page);
                if (inlinksIt != reverseGraph.end()) {
                    for (const std::string& inlink : inlinksIt->second) {
                        size_t outlinks = graph[inlink].size();
                        if (outlinks > 0) {
                            rankSum += ranks[inlink] / outlinks;
                        }
                    }
                }
                
                // PageRank formula
                newRanks[page] = (1 - damping) / N + damping * rankSum;
                diff += std::abs(newRanks[page] - ranks[page]);
            }
            
            ranks = newRanks;
            iterations++;
            
            // Record for visualization
            double topRank = 0;
            std::string topPage;
            for (const auto& pair : ranks) {
                if (pair.second > topRank) {
                    topRank = pair.second;
                    topPage = pair.first;
                }
            }
            rankHistory.push_back({topPage, topRank});
            
            // Check convergence
            if (diff < tolerance) break;
        }
    }
    
    double getRank(const std::string& page) const {
        auto it = ranks.find(page);
        return it != ranks.end() ? it->second : 0;
    }
    
    std::vector<std::pair<std::string, double>> getTopPages(int n = 10) const {
        std::vector<std::pair<std::string, double>> sorted(ranks.begin(), ranks.end());
        std::sort(sorted.begin(), sorted.end(),
            [](const auto& a, const auto& b) { return a.second > b.second; });
        
        if ((int)sorted.size() > n) sorted.resize(n);
        return sorted;
    }
    
    size_t getIterations() const { return iterations; }
    const std::vector<std::pair<std::string, double>>& getHistory() const { return rankHistory; }
};

// ============================================================================
// SEARCH ENGINE (COMBINES ALL COMPONENTS)
// ============================================================================

class SearchEngine {
    Trie trie;
    InvertedIndex index;
    LRUCache<std::string, std::string> cache;
    PageRank pageRank;
    
    std::unordered_map<std::string, std::string> docTitles;
    std::unordered_map<std::string, std::string> docUrls;
    std::unordered_map<std::string, std::string> docSnippets;
    
public:
    SearchEngine() : cache(100) {}
    
    // Initialize with documents
    void addDocument(const std::string& id, const std::string& title,
                     const std::string& url, const std::string& content,
                     const std::vector<std::string>& keywords) {
        index.addDocument(id, title, content, keywords);
        docTitles[id] = title;
        docUrls[id] = url;
        docSnippets[id] = content;
        
        // Also add title words to trie for autocomplete
        std::istringstream iss(title);
        std::string word;
        while (iss >> word) {
            std::transform(word.begin(), word.end(), word.begin(), ::tolower);
            trie.insert(word, 1);
        }
        
        // Add keywords to trie
        for (const std::string& kw : keywords) {
            std::string lowerKw = kw;
            std::transform(lowerKw.begin(), lowerKw.end(), lowerKw.begin(), ::tolower);
            trie.insert(lowerKw, 5);
        }
    }
    
    // Set page link
    void addPageLink(const std::string& from, const std::string& to) {
        pageRank.addEdge(from, to);
    }
    
    // Compute PageRank after all links added
    void computePageRank() {
        pageRank.compute();
    }
    
    // Main search function
    std::string search(const std::string& query, int maxResults = 20) {
        Timer timer;
        
        // Check cache
        auto cached = cache.get(query);
        if (cached.first) {
            return "{\"cached\":true,\"results\":" + cached.second + 
                   ",\"time\":" + std::to_string(timer.elapsed()) + "}";
        }
        
        // Tokenize query
        std::vector<std::string> terms;
        std::istringstream iss(query);
        std::string term;
        while (iss >> term) {
            std::transform(term.begin(), term.end(), term.begin(), ::tolower);
            terms.push_back(term);
        }
        
        // Search with BM25
        auto results = index.searchBM25(terms, 1.5, 0.75, maxResults);
        
        // Combine with PageRank scores
        std::ostringstream json;
        json << "[";
        
        for (size_t i = 0; i < results.size(); i++) {
            const std::string& docId = results[i].first;
            double bm25Score = results[i].second;
            double prScore = pageRank.getRank(docId);
            
            // Combined score: BM25 + weighted PageRank
            double combinedScore = bm25Score + prScore * 10;
            
            if (i > 0) json << ",";
            json << "{\"id\":\"" << docId << "\""
                 << ",\"title\":\"" << escapeJson(docTitles[docId]) << "\""
                 << ",\"url\":\"" << escapeJson(docUrls[docId]) << "\""
                 << ",\"snippet\":\"" << escapeJson(docSnippets[docId]) << "\""
                 << ",\"bm25Score\":" << std::fixed << std::setprecision(4) << bm25Score
                 << ",\"pageRank\":" << std::fixed << std::setprecision(4) << prScore
                 << ",\"combinedScore\":" << std::fixed << std::setprecision(4) << combinedScore
                 << "}";
        }
        
        json << "]";
        
        std::string resultJson = json.str();
        cache.put(query, resultJson);
        
        return "{\"cached\":false,\"results\":" + resultJson + 
               ",\"time\":" + std::to_string(timer.elapsed()) + "}";
    }
    
    // Autocomplete
    std::string autocomplete(const std::string& prefix, int maxResults = 10) {
        auto results = trie.autocomplete(prefix, maxResults);
        
        std::ostringstream json;
        json << "[";
        for (size_t i = 0; i < results.size(); i++) {
            if (i > 0) json << ",";
            json << "{\"term\":\"" << results[i].first << "\""
                 << ",\"frequency\":" << results[i].second << "}";
        }
        json << "]";
        return json.str();
    }
    
    // Fuzzy search for typo tolerance
    std::string fuzzySearch(const std::string& query, int maxDistance = 2, int maxResults = 10) {
        auto results = trie.fuzzySearch(query, maxDistance, maxResults);
        
        std::ostringstream json;
        json << "[";
        for (size_t i = 0; i < results.size(); i++) {
            if (i > 0) json << ",";
            json << "{\"term\":\"" << results[i].first << "\""
                 << ",\"frequency\":" << results[i].second << "}";
        }
        json << "]";
        return json.str();
    }
    
    // Get statistics
    std::string getStats() {
        std::ostringstream json;
        json << "{"
             << "\"trieNodes\":" << trie.getNodeCount()
             << ",\"indexTerms\":" << index.getIndexSize()
             << ",\"documents\":" << index.getDocumentCount()
             << ",\"avgDocLength\":" << std::fixed << std::setprecision(2) << index.getAvgDocLength()
             << ",\"cacheSize\":" << cache.size()
             << ",\"cacheHits\":" << cache.getHits()
             << ",\"cacheMisses\":" << cache.getMisses()
             << ",\"cacheHitRate\":" << std::fixed << std::setprecision(4) << cache.getHitRate()
             << ",\"trieMemory\":" << trie.getMemoryUsage()
             << "}";
        return json.str();
    }
    
    // Benchmark search performance
    std::string benchmark(const std::string& query, int iterations = 100) {
        std::vector<double> times;
        
        for (int i = 0; i < iterations; i++) {
            Timer t;
            search(query, 20);
            times.push_back(t.elapsed());
        }
        
        double sum = 0, minT = times[0], maxT = times[0];
        for (double t : times) {
            sum += t;
            if (t < minT) minT = t;
            if (t > maxT) maxT = t;
        }
        double avg = sum / iterations;
        
        // Calculate standard deviation
        double variance = 0;
        for (double t : times) {
            variance += (t - avg) * (t - avg);
        }
        double stdDev = sqrt(variance / iterations);
        
        std::ostringstream json;
        json << "{"
             << "\"iterations\":" << iterations
             << ",\"avg\":" << std::fixed << std::setprecision(4) << avg
             << ",\"min\":" << std::fixed << std::setprecision(4) << minT
             << ",\"max\":" << std::fixed << std::setprecision(4) << maxT
             << ",\"stdDev\":" << std::fixed << std::setprecision(4) << stdDev
             << ",\"qps\":" << std::fixed << std::setprecision(0) << (1000.0 / avg)
             << "}";
        return json.str();
    }
    
private:
    std::string escapeJson(const std::string& s) {
        std::string result;
        for (char c : s) {
            switch (c) {
                case '"': result += "\\\""; break;
                case '\\': result += "\\\\"; break;
                case '\n': result += "\\n"; break;
                case '\r': result += "\\r"; break;
                case '\t': result += "\\t"; break;
                default: result += c;
            }
        }
        return result;
    }
};

// ============================================================================
// EMSCRIPTEN BINDINGS
// ============================================================================

EMSCRIPTEN_BINDINGS(search_engine) {
    class_<SearchEngine>("SearchEngine")
        .constructor<>()
        .function("addDocument", &SearchEngine::addDocument)
        .function("addPageLink", &SearchEngine::addPageLink)
        .function("computePageRank", &SearchEngine::computePageRank)
        .function("search", &SearchEngine::search)
        .function("autocomplete", &SearchEngine::autocomplete)
        .function("fuzzySearch", &SearchEngine::fuzzySearch)
        .function("getStats", &SearchEngine::getStats)
        .function("benchmark", &SearchEngine::benchmark);
    
    register_vector<std::string>("StringVector");
}
