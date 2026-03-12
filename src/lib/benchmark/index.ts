/**
 * Performance Benchmarking System
 * Compares different algorithm implementations and provides detailed metrics
 */

export interface BenchmarkResult {
  algorithm: string;
  operations: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  stdDev: number;
  opsPerSecond: number;
  memoryUsage?: number;
}

export interface ComparisonResult {
  baseline: BenchmarkResult;
  optimized: BenchmarkResult;
  improvement: {
    speedup: number;
    timeReduced: number;
  };
}

/**
 * Benchmark runner with statistical analysis
 */
export class BenchmarkRunner {
  private warmupRuns: number;
  private measurementRuns: number;
  
  constructor(warmupRuns = 5, measurementRuns = 100) {
    this.warmupRuns = warmupRuns;
    this.measurementRuns = measurementRuns;
  }
  
  /**
   * Benchmark a function with warmup and statistical analysis
   */
  async benchmark<T>(
    name: string,
    fn: () => T | Promise<T>,
    options: { memoryTracking?: boolean } = {}
  ): Promise<BenchmarkResult> {
    // Warmup runs (not measured)
    for (let i = 0; i < this.warmupRuns; i++) {
      await fn();
    }
    
    // Measurement runs
    const times: number[] = [];
    const memorySnapshots: number[] = [];
    
    for (let i = 0; i < this.measurementRuns; i++) {
      // Force garbage collection if available
      if (typeof globalThis !== 'undefined' && 'gc' in globalThis) {
        (globalThis as unknown as { gc: () => void }).gc();
      }
      
      const beforeMemory = options.memoryTracking ? process?.memoryUsage?.()?.heapUsed || 0 : 0;
      const start = performance.now();
      
      await fn();
      
      const end = performance.now();
      const afterMemory = options.memoryTracking ? process?.memoryUsage?.()?.heapUsed || 0 : 0;
      
      times.push(end - start);
      if (options.memoryTracking) {
        memorySnapshots.push(afterMemory - beforeMemory);
      }
    }
    
    // Calculate statistics
    const totalTime = times.reduce((a, b) => a + b, 0);
    const avgTime = totalTime / this.measurementRuns;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const variance = times.reduce((acc, t) => acc + (t - avgTime) ** 2, 0) / this.measurementRuns;
    const stdDev = Math.sqrt(variance);
    const opsPerSecond = 1000 / avgTime;
    
    return {
      algorithm: name,
      operations: this.measurementRuns,
      totalTime,
      avgTime,
      minTime,
      maxTime,
      stdDev,
      opsPerSecond,
      memoryUsage: memorySnapshots.length > 0 
        ? memorySnapshots.reduce((a, b) => a + b, 0) / memorySnapshots.length 
        : undefined
    };
  }
  
  /**
   * Compare two implementations
   */
  compare(baseline: BenchmarkResult, optimized: BenchmarkResult): ComparisonResult {
    const speedup = baseline.avgTime / optimized.avgTime;
    const timeReduced = ((baseline.avgTime - optimized.avgTime) / baseline.avgTime) * 100;
    
    return {
      baseline,
      optimized,
      improvement: {
        speedup,
        timeReduced
      }
    };
  }
}

/**
 * Algorithm complexity analyzer
 */
export class ComplexityAnalyzer {
  /**
   * Measure actual time complexity by running with different input sizes
   */
  async analyzeComplexity(
    fn: (n: number) => void | Promise<void>,
    sizes: number[] = [100, 500, 1000, 5000, 10000]
  ): Promise<{ size: number; time: number }[]> {
    const results: { size: number; time: number }[] = [];
    
    for (const size of sizes) {
      // Warmup
      await fn(size);
      
      // Measure
      const start = performance.now();
      await fn(size);
      const end = performance.now();
      
      results.push({ size, time: end - start });
    }
    
    return results;
  }
  
  /**
   * Determine the Big-O complexity from measurements
   */
  detectComplexity(measurements: { size: number; time: number }[]): string {
    if (measurements.length < 2) return 'Unknown';
    
    const first = measurements[0];
    const last = measurements[measurements.length - 1];
    
    const sizeRatio = last.size / first.size;
    const timeRatio = last.time / first.time;
    
    // Compare ratios to determine complexity
    if (timeRatio < Math.log2(sizeRatio) * 1.5) {
      return 'O(log n)';
    } else if (timeRatio < sizeRatio * 1.5) {
      return 'O(n)';
    } else if (timeRatio < sizeRatio * Math.log2(sizeRatio) * 1.5) {
      return 'O(n log n)';
    } else if (timeRatio < sizeRatio * sizeRatio * 1.5) {
      return 'O(n²)';
    } else {
      return 'O(n^k) or worse';
    }
  }
}

/**
 * Memory usage tracker
 */
export class MemoryTracker {
  private baseline: number = 0;
  
  start(): void {
    this.baseline = this.getCurrentMemory();
  }
  
  stop(): number {
    return this.getCurrentMemory() - this.baseline;
  }
  
  private getCurrentMemory(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    // Browser fallback - approximate
    if ('memory' in performance && (performance as unknown as { memory: { usedJSHeapSize: number } }).memory) {
      return (performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize;
    }
    return 0;
  }
}

/**
 * Algorithm execution tracer for step-by-step visualization
 */
export class AlgorithmTracer {
  private steps: TraceStep[] = [];
  private startTime: number = 0;
  
  start(): void {
    this.steps = [];
    this.startTime = performance.now();
  }
  
  step(type: string, data: Record<string, unknown>): void {
    this.steps.push({
      timestamp: performance.now() - this.startTime,
      type,
      data
    });
  }
  
  getSteps(): TraceStep[] {
    return this.steps;
  }
  
  getSummary(): { totalSteps: number; totalTime: number; stepsByType: Record<string, number> } {
    const stepsByType: Record<string, number> = {};
    for (const step of this.steps) {
      stepsByType[step.type] = (stepsByType[step.type] || 0) + 1;
    }
    
    return {
      totalSteps: this.steps.length,
      totalTime: this.steps.length > 0 
        ? this.steps[this.steps.length - 1].timestamp 
        : 0,
      stepsByType
    };
  }
}

export interface TraceStep {
  timestamp: number;
  type: string;
  data: Record<string, unknown>;
}

// Singleton instances
export const benchmarkRunner = new BenchmarkRunner();
export const complexityAnalyzer = new ComplexityAnalyzer();
export const algorithmTracer = new AlgorithmTracer();
