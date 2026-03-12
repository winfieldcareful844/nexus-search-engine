import { HyperLogLog } from './HyperLogLog';
import { ConsistentHashing } from './ConsistentHashing';

/**
 * Distributed Crawler Simulation Pipeline
 * 
 * WHAT IT SOLVES:
 *   Single-threaded crawling of 1 billion URLs is too slow.
 *   We need to distribute the fetch/parse/index workload across N servers.
 *   
 * CORE COMPONENTS demonstrated here:
 *   1. Message Broker (like Redis / Kafka / SQS) — decoupled pub/sub queue.
 *   2. Worker Pool — asynchronous consumers reading from the queue.
 *   3. Consistent Hashing — routing parsed data to specific DB shards based on URL hash
 *      so that a single URL's entire history goes to the same physical node.
 *   4. HyperLogLog — O(1) space tracking of "Have I seen this URL before?".
 *   5. Coordinator / Leader Election — simulating a Raft/Paxos leader node.
 */

// Simulated message payload in the queue
export interface CrawlJob {
    url: string;
    depth: number;
    sourceNode: string; // The worker who found it
}

export class CrawlerPipeline {
    // 1. Message Queue (Simulating Redis List/Stream)
    private pendingQueue: CrawlJob[] = [];
    
    // 2. HyperLogLog (Cardinality Estimation for unique seen URLs)
    public uniqueUrlTracker = new HyperLogLog(12); // ~4KB space

    // 3. Consistent Hashing Ring for Sharding
    public hashRing = new ConsistentHashing(100);

    // 4. Cluster Architecture State
    public workers: string[] = ['worker-us-east', 'worker-us-west', 'worker-eu-central', 'worker-ap-south'];
    public indexNodes: string[] = ['db-shard-1', 'db-shard-2', 'db-shard-3'];
    public leader: string = this.workers[0]; // Simplistic leader election state

    // Simulation metrics
    public metrics = {
        jobsProcessed: 0,
        bytesFetched: 0,
        urlsDiscovered: 0,
    };

    private isRunning = false;

    constructor() {
        // Initialize consistent hashing for the Database shards
        for (const shard of this.indexNodes) {
            this.hashRing.addNode(shard);
        }
    }

    // Producer API (e.g. injected via a REST endpoint or initial seed)
    enqueueSeed(seedUrl: string): void {
        this.pendingQueue.push({ url: seedUrl, depth: 0, sourceNode: 'user-input' });
        this.uniqueUrlTracker.add(seedUrl);
    }

    /**
     * Start the distributed worker pool simulator
     */
    async startSimulation(tickMs: number = 100): Promise<void> {
        if (this.isRunning) return;
        this.isRunning = true;

        console.log(`[CrawlerPipeline] Starting with leader: ${this.leader}`);

        // Run an infinite background loop
        while (this.isRunning) {
            // Process a batch (simulating multi-threaded pop from Redis)
            const batchSize = Math.min(this.pendingQueue.length, this.workers.length);
            
            if (batchSize > 0) {
                const batch = this.pendingQueue.splice(0, batchSize);
                
                // Distribute jobs artificially to workers
                const promises = batch.map((job, idx) => {
                    const assignedWorker = this.workers[idx % this.workers.length];
                    return this.simulateWorkerExecution(assignedWorker, job);
                });

                await Promise.all(promises);
            }

            await new Promise(r => setTimeout(r, tickMs));
        }
    }

    pauseSimulation(): void {
        this.isRunning = false;
    }

    /**
     * Simulates what a single Crawler Worker microservice would do
     */
    private async simulateWorkerExecution(workerName: string, job: CrawlJob): Promise<void> {
        // 1. Fetch
        // (Simulate network delay)
        await new Promise(r => setTimeout(r, Math.random() * 50));
        
        // Simulating the size of the fetched HTML document
        const fictitiousBytes = Math.floor(Math.random() * 50000) + 10000;
        this.metrics.bytesFetched += fictitiousBytes;

        // 2. Route parsed document to the correct DB shard
        // Instead of writing locally, the worker finds the correct DB shard via Consistent Hashing
        const assignedShard = this.hashRing.getNode(job.url)!;
        
        // Log the action (in reality, this makes a gRPC/HTTP call to the shard)
        // console.log(`[${workerName}] Parsed ${job.url} -> Sending to ${assignedShard}`);

        this.metrics.jobsProcessed++;

        // 3. Extract Links
        // We simulate finding 2 or 3 random new links on the page
        const newLinksCount = Math.floor(Math.random() * 3) + 1;
        for (let i = 0; i < newLinksCount; i++) {
            const domainRand = Math.floor(Math.random() * 1000000); // 1M possible docs
            const nextUrl = `https://example.com/page/${domainRand}`;
            
            this.metrics.urlsDiscovered++;
            
            // HyperLogLog checks uniqueness probabilistically, though we just add it to track cardinality.
            this.uniqueUrlTracker.add(nextUrl);

            // Add to the message broker ONLY if depth is acceptable to avoid infinite loop
            if (job.depth < 10 && this.pendingQueue.length < 5000) {
                this.pendingQueue.push({
                    url: nextUrl,
                    depth: job.depth + 1,
                    sourceNode: workerName
                });
            }
        }
    }

    /**
     * Simulate a node failure event (Raft interaction or Ring update)
     */
    simulateNodeFailure(nodeType: 'worker' | 'shard', nodeName: string): void {
        if (nodeType === 'worker') {
            this.workers = this.workers.filter(w => w !== nodeName);
            if (this.leader === nodeName) {
                console.log(`[Raft Election] Leader down! Initiating election...`);
                this.leader = this.workers[0] || 'none';
                console.log(`[Raft Election] New leader elected: ${this.leader}`);
            }
        } else if (nodeType === 'shard') {
            // Remove the node from the Consistent Hashing ring
            // Keys will automatically shift cleanly to the next node in the ring!
            this.hashRing.removeNode(nodeName);
            this.indexNodes = this.indexNodes.filter(n => n !== nodeName);
            console.log(`[Consistent Hashing] Shard ${nodeName} removed. Keys rebalancing automatically.`);
        }
    }

    getPipelineStatus() {
        return {
            isRunning: this.isRunning,
            leader: this.leader,
            activeWorkers: this.workers.length,
            activeShards: this.indexNodes.length,
            queueDepth: this.pendingQueue.length,
            metrics: { ...this.metrics },
            uniqueUrlsEstimated: this.uniqueUrlTracker.estimate()
        };
    }
}
