// lib/performance/tools.ts
"use client";

import { performanceMonitor } from "./monitor";
import { networkManager } from "./network";

/**
 * Performance measurement and analysis tools
 * Provides utilities for measuring, analyzing, and reporting performance
 */

export interface PerformanceReport {
  summary: {
    totalMetrics: number;
    timeRange: { start: number; end: number };
    environment: string;
  };
  navigation: {
    loadTime: number;
    domContentLoaded: number;
    firstContentfulPaint: number;
    timeToInteractive: number;
  };
  network: {
    effectiveType: string;
    downlink: number;
    rtt: number;
    quality: "poor" | "fair" | "good" | "excellent";
  };
  sync: {
    averageDuration: number;
    successRate: number;
    totalOperations: number;
    averageThroughput: number;
  };
  resources: {
    slowestResource: { name: string; duration: number } | null;
    totalResourceTime: number;
    resourceCount: number;
  };
  issues: {
    slowOperations: Array<{
      name: string;
      duration: number;
      timestamp: number;
    }>;
    networkIssues: Array<{ timestamp: number; issue: string }>;
    recommendations: string[];
  };
}

export interface LoadTestResult {
  scenario: string;
  iterations: number;
  duration: number; // ms
  operations: {
    name: string;
    count: number;
    averageTime: number;
    minTime: number;
    maxTime: number;
    successRate: number;
  }[];
  throughput: {
    operationsPerSecond: number;
    recordsPerSecond: number;
  };
  memory: {
    initial: number;
    peak: number;
    final: number;
  };
  recommendations: string[];
}

class PerformanceTools {
  /**
   * Generate comprehensive performance report
   */
  async generateReport(timeRangeMs = 300000): Promise<PerformanceReport> {
    const now = Date.now();
    const since = now - timeRangeMs;
    const metrics = performanceMonitor.getMetrics(undefined, since);
    const networkCondition = performanceMonitor.captureNetworkCondition();
    const connectionTest = await networkManager.testConnectionQuality();

    // Group metrics by type
    const navigationMetrics = metrics.filter((m) =>
      m.name.startsWith("navigation-"),
    );
    const syncMetrics = metrics.filter((m) => m.name === "sync-operation");
    const resourceMetrics = metrics.filter(
      (m) => m.name === "resource-load-time",
    );

    // Calculate navigation timing
    const navigation = this.calculateNavigationTiming(navigationMetrics);

    // Calculate sync performance
    const sync = this.calculateSyncPerformance(syncMetrics);

    // Calculate resource performance
    const resources = this.calculateResourcePerformance(resourceMetrics);

    // Identify issues and generate recommendations
    const issues = this.identifyPerformanceIssues(metrics, networkCondition);

    return {
      summary: {
        totalMetrics: metrics.length,
        timeRange: { start: since, end: now },
        environment: this.detectEnvironment(),
      },
      navigation,
      network: {
        effectiveType: networkCondition.effectiveType,
        downlink: networkCondition.downlink,
        rtt: networkCondition.rtt,
        quality: connectionTest.quality,
      },
      sync,
      resources,
      issues,
    };
  }

  /**
   * Run load testing scenarios
   */
  async runLoadTest(
    scenario: "light" | "moderate" | "heavy",
  ): Promise<LoadTestResult> {
    const startTime = performance.now();
    const initialMemory = this.getMemoryUsage();

    const scenarios = {
      light: { iterations: 10, concurrency: 1, recordsPerIteration: 5 },
      moderate: { iterations: 50, concurrency: 3, recordsPerIteration: 20 },
      heavy: { iterations: 100, concurrency: 5, recordsPerIteration: 50 },
    };

    const config = scenarios[scenario];
    const operations: LoadTestResult["operations"] = [];

    console.log(`[PerformanceTools] Starting ${scenario} load test...`);

    // Test different operations
    const testOperations = [
      {
        name: "database-read",
        operation: () => this.simulateRead(config.recordsPerIteration),
      },
      {
        name: "database-write",
        operation: () => this.simulateWrite(config.recordsPerIteration),
      },
      {
        name: "network-sync",
        operation: () => this.simulateSync(config.recordsPerIteration),
      },
      {
        name: "cache-lookup",
        operation: () => this.simulateCache(config.recordsPerIteration),
      },
    ];

    for (const testOp of testOperations) {
      const opResults = await this.measureOperation(
        testOp.name,
        testOp.operation,
        config.iterations,
        config.concurrency,
      );
      operations.push(opResults);
    }

    const endTime = performance.now();
    const finalMemory = this.getMemoryUsage();
    const peakMemory = Math.max(initialMemory.used, finalMemory.used);

    const totalOperations = operations.reduce((sum, op) => sum + op.count, 0);
    const totalRecords = totalOperations * config.recordsPerIteration;
    const totalDuration = endTime - startTime;

    const result: LoadTestResult = {
      scenario,
      iterations: config.iterations,
      duration: totalDuration,
      operations,
      throughput: {
        operationsPerSecond: (totalOperations / totalDuration) * 1000,
        recordsPerSecond: (totalRecords / totalDuration) * 1000,
      },
      memory: {
        initial: initialMemory.used,
        peak: peakMemory,
        final: finalMemory.used,
      },
      recommendations: this.generateLoadTestRecommendations(
        operations,
        scenario,
      ),
    };

    console.log(`[PerformanceTools] ${scenario} load test completed:`, result);
    return result;
  }

  /**
   * Benchmark sync operations
   */
  async benchmarkSync(recordCounts: number[] = [10, 50, 100, 500]): Promise<
    {
      recordCount: number;
      duration: number;
      throughput: number;
      memoryUsed: number;
    }[]
  > {
    const results = [];

    for (const recordCount of recordCounts) {
      const startMemory = this.getMemoryUsage();
      const startTime = performance.now();

      // Simulate sync operation
      await this.simulateSync(recordCount);

      const endTime = performance.now();
      const endMemory = this.getMemoryUsage();

      const duration = endTime - startTime;
      const throughput = recordCount / (duration / 1000); // records per second
      const memoryUsed = endMemory.used - startMemory.used;

      results.push({
        recordCount,
        duration,
        throughput,
        memoryUsed,
      });

      // Allow garbage collection between tests
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return results;
  }

  /**
   * Monitor real-time performance
   */
  startRealTimeMonitoring(intervalMs = 5000): () => void {
    let isMonitoring = true;

    const monitor = async () => {
      while (isMonitoring) {
        const metrics = performanceMonitor.getSummary();
        const networkTest = await networkManager.testConnectionQuality();
        const memory = this.getMemoryUsage();

        const snapshot = {
          timestamp: Date.now(),
          metrics: metrics.totalMetrics,
          recentIssues: metrics.recentIssues.length,
          networkLatency: networkTest.latency,
          networkQuality: networkTest.quality,
          memoryUsed: memory.used,
          memoryLimit: memory.limit,
        };

        // Log significant changes
        if (
          networkTest.quality === "poor" ||
          memory.used > memory.limit * 0.8
        ) {
          console.warn(
            "[PerformanceTools] Performance issue detected:",
            snapshot,
          );
        }

        performanceMonitor.recordMetric({
          name: "realtime-monitor",
          value: snapshot.memoryUsed,
          unit: "bytes",
          timestamp: Date.now(),
          tags: {
            networkQuality: networkTest.quality,
            metricsCount: String(metrics.totalMetrics),
            issuesCount: String(metrics.recentIssues.length),
          },
        });

        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    };

    monitor().catch((error) => {
      console.error("[PerformanceTools] Real-time monitoring error:", error);
    });

    return () => {
      isMonitoring = false;
    };
  }

  /**
   * Export performance data
   */
  async exportData(
    format: "json" | "csv" = "json",
    timeRangeMs = 300000,
  ): Promise<string> {
    const report = await this.generateReport(timeRangeMs);
    const metrics = performanceMonitor.getMetrics(
      undefined,
      Date.now() - timeRangeMs,
    );

    if (format === "json") {
      return JSON.stringify(
        {
          report,
          rawMetrics: metrics,
          exportedAt: new Date().toISOString(),
        },
        null,
        2,
      );
    }

    if (format === "csv") {
      const csvHeaders = "name,value,unit,timestamp,tags\n";
      const csvRows = metrics
        .map((metric) => {
          const tags = metric.tags
            ? JSON.stringify(metric.tags).replace(/"/g, '""')
            : "";
          return `"${metric.name}",${metric.value},"${metric.unit}",${metric.timestamp},"${tags}"`;
        })
        .join("\n");

      return csvHeaders + csvRows;
    }

    throw new Error(`Unsupported export format: ${String(format)}`);
  }

  /**
   * Compare performance between sessions
   */
  comparePerformance(
    baseline: PerformanceReport,
    current: PerformanceReport,
  ): {
    navigation: {
      field: string;
      baseline: number;
      current: number;
      change: number;
      improvement: boolean;
    }[];
    sync: {
      field: string;
      baseline: number;
      current: number;
      change: number;
      improvement: boolean;
    }[];
    network: {
      field: string;
      baseline: string | number;
      current: string | number;
      change?: number;
      improvement?: boolean;
    }[];
    overall: "improved" | "degraded" | "stable";
    recommendations: string[];
  } {
    const navigationComparison = [
      {
        field: "loadTime",
        baseline: baseline.navigation.loadTime,
        current: current.navigation.loadTime,
      },
      {
        field: "domContentLoaded",
        baseline: baseline.navigation.domContentLoaded,
        current: current.navigation.domContentLoaded,
      },
      {
        field: "firstContentfulPaint",
        baseline: baseline.navigation.firstContentfulPaint,
        current: current.navigation.firstContentfulPaint,
      },
    ].map((item) => ({
      ...item,
      change: ((item.current - item.baseline) / item.baseline) * 100,
      improvement: item.current < item.baseline, // Lower is better for timing
    }));

    const syncComparison = [
      {
        field: "averageDuration",
        baseline: baseline.sync.averageDuration,
        current: current.sync.averageDuration,
      },
      {
        field: "successRate",
        baseline: baseline.sync.successRate,
        current: current.sync.successRate,
      },
      {
        field: "averageThroughput",
        baseline: baseline.sync.averageThroughput,
        current: current.sync.averageThroughput,
      },
    ].map((item) => ({
      ...item,
      change: ((item.current - item.baseline) / item.baseline) * 100,
      improvement:
        item.field === "averageDuration"
          ? item.current < item.baseline
          : item.current > item.baseline,
    }));

    const networkComparison = [
      {
        field: "effectiveType",
        baseline: baseline.network.effectiveType,
        current: current.network.effectiveType,
      },
      {
        field: "downlink",
        baseline: baseline.network.downlink,
        current: current.network.downlink,
      },
      {
        field: "rtt",
        baseline: baseline.network.rtt,
        current: current.network.rtt,
      },
    ].map((item) => {
      if (
        typeof item.baseline === "number" &&
        typeof item.current === "number"
      ) {
        const change = ((item.current - item.baseline) / item.baseline) * 100;
        return {
          ...item,
          change,
          improvement:
            item.field === "rtt"
              ? item.current < item.baseline
              : item.current > item.baseline,
        };
      }
      return item;
    });

    // Determine overall performance
    const improvements = [...navigationComparison, ...syncComparison].filter(
      (item) => item.improvement,
    ).length;
    const degradations = [...navigationComparison, ...syncComparison].filter(
      (item) => !item.improvement,
    ).length;

    let overall: "improved" | "degraded" | "stable";
    if (improvements > degradations * 1.2) {
      overall = "improved";
    } else if (degradations > improvements * 1.2) {
      overall = "degraded";
    } else {
      overall = "stable";
    }

    const recommendations = this.generateComparisonRecommendations(
      navigationComparison,
      syncComparison,
      overall,
    );

    return {
      navigation: navigationComparison,
      sync: syncComparison,
      network: networkComparison,
      overall,
      recommendations,
    };
  }

  // Private helper methods

  private calculateNavigationTiming(
    metrics: Array<{ name: string; value: number }>,
  ): PerformanceReport["navigation"] {
    const getMetricValue = (name: string) => {
      const metric = metrics.find((m) => m.name.includes(name));
      return metric ? metric.value : 0;
    };

    return {
      loadTime: getMetricValue("total-load-time"),
      domContentLoaded: getMetricValue("dom-content-loaded"),
      firstContentfulPaint: getMetricValue("first-contentful-paint"),
      timeToInteractive: getMetricValue("time-to-interactive") || 0,
    };
  }

  private calculateSyncPerformance(
    metrics: Array<{ value: number; tags?: Record<string, string> }>,
  ): PerformanceReport["sync"] {
    if (metrics.length === 0) {
      return {
        averageDuration: 0,
        successRate: 0,
        totalOperations: 0,
        averageThroughput: 0,
      };
    }

    const durations = metrics.map((m) => m.value);
    const successes = metrics.filter((m) => m.tags?.success === "true").length;

    return {
      averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      successRate: successes / metrics.length,
      totalOperations: metrics.length,
      averageThroughput:
        successes / (durations.reduce((a, b) => a + b, 0) / 1000), // ops per second
    };
  }

  private calculateResourcePerformance(
    metrics: Array<{ value: number; tags?: Record<string, string> }>,
  ): PerformanceReport["resources"] {
    if (metrics.length === 0) {
      return { slowestResource: null, totalResourceTime: 0, resourceCount: 0 };
    }

    const slowest = metrics.reduce((prev, current) =>
      prev.value > current.value ? prev : current,
    );

    return {
      slowestResource: {
        name: slowest.tags?.resource ?? "unknown",
        duration: slowest.value,
      },
      totalResourceTime: metrics.reduce((sum, m) => sum + m.value, 0),
      resourceCount: metrics.length,
    };
  }

  private identifyPerformanceIssues(
    metrics: Array<{ name: string; value: number; timestamp: number }>,
    networkCondition: { effectiveType: string; rtt: number },
  ): PerformanceReport["issues"] {
    const slowOperations = metrics
      .filter((m) => m.value > 2000) // Slower than 2 seconds
      .map((m) => ({
        name: m.name,
        duration: m.value,
        timestamp: m.timestamp,
      }))
      .slice(0, 10); // Top 10 slowest

    const networkIssues = [];
    if (
      networkCondition.effectiveType === "slow-2g" ||
      networkCondition.effectiveType === "2g"
    ) {
      networkIssues.push({
        timestamp: Date.now(),
        issue: `Slow network detected: ${networkCondition.effectiveType}`,
      });
    }
    if (networkCondition.rtt > 500) {
      networkIssues.push({
        timestamp: Date.now(),
        issue: `High latency: ${networkCondition.rtt}ms`,
      });
    }

    const recommendations = [];
    if (slowOperations.length > 0) {
      recommendations.push(
        "Consider optimizing slow operations or implementing caching",
      );
    }
    if (networkIssues.length > 0) {
      recommendations.push(
        "Network conditions are suboptimal - consider offline-first approach",
      );
    }
    if (metrics.length > 80) {
      recommendations.push(
        "High number of performance events - consider reducing monitoring frequency",
      );
    }

    return {
      slowOperations,
      networkIssues,
      recommendations,
    };
  }

  private async measureOperation(
    name: string,
    operation: () => Promise<void>,
    iterations: number,
    concurrency: number,
  ): Promise<LoadTestResult["operations"][0]> {
    const times: number[] = [];
    let successes = 0;

    const runBatch = async (batchSize: number) => {
      const promises = Array.from({ length: batchSize }, async () => {
        const start = performance.now();
        try {
          await operation();
          successes++;
        } catch (error) {
          console.warn(`[PerformanceTools] Operation ${name} failed:`, error);
        }
        const end = performance.now();
        times.push(end - start);
      });

      await Promise.all(promises);
    };

    // Run iterations in batches based on concurrency
    for (let i = 0; i < iterations; i += concurrency) {
      const batchSize = Math.min(concurrency, iterations - i);
      await runBatch(batchSize);
    }

    const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const successRate = successes / iterations;

    return {
      name,
      count: iterations,
      averageTime,
      minTime,
      maxTime,
      successRate,
    };
  }

  private async simulateRead(recordCount: number): Promise<void> {
    // Simulate database read operations
    await new Promise((resolve) => setTimeout(resolve, recordCount * 0.5));
  }

  private async simulateWrite(recordCount: number): Promise<void> {
    // Simulate database write operations
    await new Promise((resolve) => setTimeout(resolve, recordCount * 1.0));
  }

  private async simulateSync(recordCount: number): Promise<void> {
    // Simulate network sync operations
    const networkCondition = performanceMonitor.captureNetworkCondition();
    const baseTime = recordCount * 2;
    const networkMultiplier =
      networkCondition.effectiveType === "4g"
        ? 1
        : networkCondition.effectiveType === "3g"
          ? 2
          : 4;

    await new Promise((resolve) =>
      setTimeout(resolve, baseTime * networkMultiplier),
    );
  }

  private async simulateCache(recordCount: number): Promise<void> {
    // Simulate cache lookup operations
    await new Promise((resolve) => setTimeout(resolve, recordCount * 0.1));
  }

  private getMemoryUsage(): { used: number; limit: number } {
    if (typeof window !== "undefined" && "memory" in performance) {
      const perfWithMemory = performance as unknown as {
        memory: { usedJSHeapSize: number; jsHeapSizeLimit: number };
      };
      return {
        used: perfWithMemory.memory.usedJSHeapSize,
        limit: perfWithMemory.memory.jsHeapSizeLimit,
      };
    }
    return { used: 0, limit: 0 };
  }

  private detectEnvironment(): string {
    if (typeof window === "undefined") return "server";

    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1")
      return "development";
    if (hostname.includes("vercel.app")) return "preview";
    return "production";
  }

  private generateLoadTestRecommendations(
    operations: LoadTestResult["operations"],
    scenario: string,
  ): string[] {
    const recommendations: string[] = [];

    const slowOperations = operations.filter((op) => op.averageTime > 1000);
    if (slowOperations.length > 0) {
      recommendations.push(
        `Optimize slow operations: ${slowOperations.map((op) => op.name).join(", ")}`,
      );
    }

    const lowSuccessRate = operations.filter((op) => op.successRate < 0.9);
    if (lowSuccessRate.length > 0) {
      recommendations.push(
        `Improve reliability for: ${lowSuccessRate.map((op) => op.name).join(", ")}`,
      );
    }

    if (scenario === "heavy" && operations.some((op) => op.averageTime > 500)) {
      recommendations.push(
        "Consider implementing request batching for heavy load scenarios",
      );
    }

    return recommendations;
  }

  private generateComparisonRecommendations(
    navigation: Array<{ improvement: boolean; change: number }>,
    sync: Array<{ improvement: boolean; change: number }>,
    overall: string,
  ): string[] {
    const recommendations: string[] = [];

    if (overall === "degraded") {
      recommendations.push(
        "Performance has degraded - investigate recent changes",
      );
    }

    const slowNavigation = navigation.filter(
      (item) => !item.improvement && Math.abs(item.change) > 20,
    );
    if (slowNavigation.length > 0) {
      recommendations.push(
        "Navigation performance has decreased - check for new resources or blocking operations",
      );
    }

    const slowSync = sync.filter(
      (item) => !item.improvement && Math.abs(item.change) > 15,
    );
    if (slowSync.length > 0) {
      recommendations.push(
        "Sync operations are slower - verify network conditions and server performance",
      );
    }

    if (overall === "improved") {
      recommendations.push(
        "Performance improvements detected - consider this configuration as baseline",
      );
    }

    return recommendations;
  }
}

// Global instance
export const performanceTools = new PerformanceTools();

// Utility functions
export function startPerformanceMonitoring(options?: {
  intervalMs?: number;
  enableLoadTesting?: boolean;
  exportInterval?: number;
}): () => void {
  const {
    intervalMs = 30000,
    enableLoadTesting = false,
    exportInterval = 300000,
  } = options ?? {};

  console.log("[PerformanceTools] Starting performance monitoring");

  const stopRealTimeMonitoring =
    performanceTools.startRealTimeMonitoring(intervalMs);

  let loadTestTimer: NodeJS.Timeout | null = null;
  if (enableLoadTesting) {
    loadTestTimer = setInterval(() => {
      void performanceTools.runLoadTest("light").catch((error) => {
        console.error("[PerformanceTools] Load test failed:", error);
      });
    }, exportInterval);
  }

  let exportTimer: NodeJS.Timeout | null = null;
  if (exportInterval > 0) {
    exportTimer = setInterval(() => {
      void performanceTools
        .generateReport()
        .then((report) => {
          console.log("[PerformanceTools] Performance report:", report);
        })
        .catch((error) => {
          console.error("[PerformanceTools] Report generation failed:", error);
        });
    }, exportInterval);
  }

  return () => {
    console.log("[PerformanceTools] Stopping performance monitoring");
    stopRealTimeMonitoring();
    if (loadTestTimer) clearInterval(loadTestTimer);
    if (exportTimer) clearInterval(exportTimer);
  };
}
