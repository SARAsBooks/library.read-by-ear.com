// lib/performance/monitor.ts
"use client";

/**
 * Performance monitoring utilities for Read-by-Ear
 * Tracks load times, sync performance, and user experience metrics
 */

// Browser API type extensions
declare global {
  interface Performance {
    memory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
  }

  interface Navigator {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  }

  interface NetworkInformation extends EventTarget {
    effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
  }

  interface PerformanceEntry {
    value?: number;
  }
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: "ms" | "bytes" | "count" | "ratio";
  timestamp: number;
  tags?: Record<string, string>;
}

export interface NavigationTiming {
  domContentLoaded: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  timeToInteractive: number;
  totalLoadTime: number;
}

export interface SyncPerformance {
  operation: string;
  duration: number;
  recordCount: number;
  success: boolean;
  errorType?: string;
}

export interface NetworkCondition {
  effectiveType: "slow-2g" | "2g" | "3g" | "4g";
  downlink: number; // Mbps
  rtt: number; // ms
  saveData: boolean;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private observers: PerformanceObserver[] = [];
  private networkObserver: ((condition: NetworkCondition) => void) | null =
    null;

  constructor() {
    if (typeof window !== "undefined") {
      this.initializeObservers();
      this.captureInitialMetrics();
    }
  }

  /**
   * Initialize performance observers
   */
  private initializeObservers(): void {
    try {
      // Web Vitals observer
      const vitalsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordMetric({
            name: entry.name,
            value: entry.value ?? entry.duration,
            unit: "ms",
            timestamp: Date.now(),
            tags: {
              entryType: entry.entryType,
              source: "web-vitals",
            },
          });
        }
      });

      vitalsObserver.observe({
        entryTypes: ["paint", "largest-contentful-paint", "layout-shift"],
      });
      this.observers.push(vitalsObserver);

      // Navigation observer
      const navigationObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const navEntry = entry as PerformanceNavigationTiming;
          this.recordNavigationMetrics(navEntry);
        }
      });

      navigationObserver.observe({ entryTypes: ["navigation"] });
      this.observers.push(navigationObserver);

      // Resource observer for asset loading
      const resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const resource = entry as PerformanceResourceTiming;

          if (this.isImportantResource(resource.name)) {
            this.recordMetric({
              name: "resource-load-time",
              value: resource.responseEnd - resource.requestStart,
              unit: "ms",
              timestamp: Date.now(),
              tags: {
                resource: this.getResourceType(resource.name),
                url: resource.name,
                size: String(resource.transferSize ?? 0),
              },
            });
          }
        }
      });

      resourceObserver.observe({ entryTypes: ["resource"] });
      this.observers.push(resourceObserver);
    } catch (error) {
      console.warn(
        "[PerformanceMonitor] Failed to initialize observers:",
        error,
      );
    }
  }

  /**
   * Capture initial page load metrics
   */
  private captureInitialMetrics(): void {
    // Capture memory usage if available
    if ("memory" in performance && performance.memory) {
      const memory = performance.memory;
      this.recordMetric({
        name: "js-heap-used",
        value: memory.usedJSHeapSize,
        unit: "bytes",
        timestamp: Date.now(),
        tags: { source: "memory" },
      });

      this.recordMetric({
        name: "js-heap-total",
        value: memory.totalJSHeapSize,
        unit: "bytes",
        timestamp: Date.now(),
        tags: { source: "memory" },
      });
    }

    // Network condition
    this.captureNetworkCondition();
  }

  /**
   * Record navigation timing metrics
   */
  private recordNavigationMetrics(entry: PerformanceNavigationTiming): void {
    const metrics: Partial<NavigationTiming> = {
      domContentLoaded:
        entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart,
      totalLoadTime: entry.loadEventEnd - entry.fetchStart,
    };

    // First Contentful Paint
    const fcpEntry = performance.getEntriesByName("first-contentful-paint")[0];
    if (fcpEntry) {
      metrics.firstContentfulPaint = fcpEntry.startTime;
    }

    // Record each metric
    Object.entries(metrics).forEach(([name, value]) => {
      if (value !== undefined && value > 0) {
        this.recordMetric({
          name: `navigation-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`,
          value,
          unit: "ms",
          timestamp: Date.now(),
          tags: { source: "navigation" },
        });
      }
    });
  }

  /**
   * Get current network condition
   */
  captureNetworkCondition(): NetworkCondition {
    const navigator = window.navigator;
    const connection =
      navigator.connection ??
      navigator.mozConnection ??
      navigator.webkitConnection;

    const condition: NetworkCondition = {
      effectiveType: connection?.effectiveType ?? "4g",
      downlink: connection?.downlink ?? 10, // Default to 10 Mbps
      rtt: connection?.rtt ?? 100, // Default to 100ms
      saveData: connection?.saveData ?? false,
    };

    this.recordMetric({
      name: "network-effective-type",
      value: this.networkTypeToNumber(condition.effectiveType),
      unit: "count",
      timestamp: Date.now(),
      tags: {
        effectiveType: condition.effectiveType,
        downlink: String(condition.downlink),
        rtt: String(condition.rtt),
        saveData: String(condition.saveData),
      },
    });

    return condition;
  }

  /**
   * Record a custom performance metric
   */
  recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);

    // Keep only recent metrics (last 100)
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }

    // Log significant performance issues
    if (this.isSignificantMetric(metric)) {
      console.warn("[Performance]", metric);
    }
  }

  /**
   * Record sync operation performance
   */
  recordSyncPerformance(performance: SyncPerformance): void {
    this.recordMetric({
      name: "sync-operation",
      value: performance.duration,
      unit: "ms",
      timestamp: Date.now(),
      tags: {
        operation: performance.operation,
        recordCount: String(performance.recordCount),
        success: String(performance.success),
        errorType: performance.errorType ?? "none",
      },
    });

    // Record throughput
    if (performance.success && performance.recordCount > 0) {
      const throughput =
        performance.recordCount / (performance.duration / 1000); // records/second
      this.recordMetric({
        name: "sync-throughput",
        value: throughput,
        unit: "count",
        timestamp: Date.now(),
        tags: {
          operation: performance.operation,
        },
      });
    }
  }

  /**
   * Record database operation timing
   */
  recordDatabaseOperation(
    operation: string,
    duration: number,
    recordCount = 0,
  ): void {
    this.recordMetric({
      name: "database-operation",
      value: duration,
      unit: "ms",
      timestamp: Date.now(),
      tags: {
        operation,
        recordCount: String(recordCount),
      },
    });
  }

  /**
   * Record Convex query performance
   */
  recordConvexQuery(
    queryName: string,
    duration: number,
    resultCount = 0,
  ): void {
    this.recordMetric({
      name: "convex-query",
      value: duration,
      unit: "ms",
      timestamp: Date.now(),
      tags: {
        query: queryName,
        resultCount: String(resultCount),
      },
    });
  }

  /**
   * Get recent metrics by name
   */
  getMetrics(name?: string, since?: number): PerformanceMetric[] {
    let filtered = this.metrics;

    if (name) {
      filtered = filtered.filter((m) => m.name === name);
    }

    if (since) {
      filtered = filtered.filter((m) => m.timestamp >= since);
    }

    return [...filtered]; // Return copy
  }

  /**
   * Get performance summary
   */
  getSummary(): {
    totalMetrics: number;
    recentIssues: PerformanceMetric[];
    networkCondition: NetworkCondition;
    averages: Record<string, number>;
  } {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentMetrics = this.getMetrics(undefined, oneMinuteAgo);

    // Calculate averages for key metrics
    const averages: Record<string, number> = {};
    const metricGroups = this.groupMetricsByName(recentMetrics);

    Object.entries(metricGroups).forEach(([name, metrics]) => {
      if (metrics.length > 0) {
        const sum = metrics.reduce((acc, m) => acc + m.value, 0);
        averages[name] = sum / metrics.length;
      }
    });

    return {
      totalMetrics: this.metrics.length,
      recentIssues: recentMetrics.filter((m) => this.isSignificantMetric(m)),
      networkCondition: this.captureNetworkCondition(),
      averages,
    };
  }

  /**
   * Clear stored metrics
   */
  clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Cleanup observers
   */
  destroy(): void {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers = [];
    this.metrics = [];
  }

  /**
   * Helper: Check if resource is important to monitor
   */
  private isImportantResource(url: string): boolean {
    // Monitor critical assets
    return (
      url.includes(".js") ||
      url.includes(".css") ||
      url.includes(".woff") ||
      url.includes("api/") ||
      url.includes("convex") ||
      url.includes("auth.sara.ai")
    );
  }

  /**
   * Helper: Get resource type from URL
   */
  private getResourceType(url: string): string {
    if (url.includes(".js")) return "javascript";
    if (url.includes(".css")) return "stylesheet";
    if (url.includes(".woff")) return "font";
    if (url.includes("api/")) return "api";
    if (url.includes("convex")) return "convex";
    if (url.includes("auth.sara.ai")) return "auth";
    return "other";
  }

  /**
   * Helper: Convert network type to number for metrics
   */
  private networkTypeToNumber(type: string): number {
    switch (type) {
      case "slow-2g":
        return 1;
      case "2g":
        return 2;
      case "3g":
        return 3;
      case "4g":
        return 4;
      default:
        return 4;
    }
  }

  /**
   * Helper: Check if metric indicates performance issue
   */
  private isSignificantMetric(metric: PerformanceMetric): boolean {
    const thresholds: Record<string, number> = {
      "sync-operation": 5000, // 5 seconds
      "convex-query": 2000, // 2 seconds
      "database-operation": 1000, // 1 second
      "resource-load-time": 3000, // 3 seconds
      "navigation-total-load-time": 10000, // 10 seconds
    };

    const threshold = thresholds[metric.name];
    return threshold !== undefined && metric.value > threshold;
  }

  /**
   * Helper: Group metrics by name
   */
  private groupMetricsByName(
    metrics: PerformanceMetric[],
  ): Record<string, PerformanceMetric[]> {
    return metrics.reduce(
      (groups, metric) => {
        groups[metric.name] ??= [];
        groups[metric.name]!.push(metric);
        return groups;
      },
      {} as Record<string, PerformanceMetric[]>,
    );
  }
}

// Global instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Higher-order function to measure performance of async operations
 */
export function measurePerformance<T>(
  name: string,
  tags?: Record<string, string>,
): (fn: () => Promise<T>) => Promise<T> {
  return async (fn: () => Promise<T>): Promise<T> => {
    const startTime = performance.now();

    try {
      const result = await fn();

      const duration = performance.now() - startTime;
      performanceMonitor.recordMetric({
        name,
        value: duration,
        unit: "ms",
        timestamp: Date.now(),
        tags: { ...tags, success: "true" },
      });

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      performanceMonitor.recordMetric({
        name,
        value: duration,
        unit: "ms",
        timestamp: Date.now(),
        tags: {
          ...tags,
          success: "false",
          errorType:
            error instanceof Error ? error.constructor.name : "unknown",
        },
      });

      throw error;
    }
  };
}

/**
 * Decorator for measuring sync operations
 */
export const measureSync = measurePerformance("sync-operation");

/**
 * Decorator for measuring database operations
 */
export const measureDatabase = measurePerformance("database-operation");

/**
 * Decorator for measuring Convex queries
 */
export const measureConvex = measurePerformance("convex-query");

/**
 * Check if current network is suitable for heavy operations
 */
export function isGoodNetwork(): boolean {
  const condition = performanceMonitor.captureNetworkCondition();
  return (
    condition.effectiveType === "4g" &&
    condition.downlink >= 1.5 && // At least 1.5 Mbps
    condition.rtt <= 300 && // Max 300ms RTT
    !condition.saveData
  );
}

/**
 * Get adaptive batch size based on network conditions
 */
export function getAdaptiveBatchSize(baseSize = 50): number {
  const condition = performanceMonitor.captureNetworkCondition();

  switch (condition.effectiveType) {
    case "slow-2g":
    case "2g":
      return Math.max(5, Math.floor(baseSize * 0.1)); // Very small batches
    case "3g":
      return Math.max(10, Math.floor(baseSize * 0.3)); // Small batches
    case "4g":
    default:
      return baseSize; // Full batches
  }
}
