// lib/monitoring/error-monitoring.ts
"use client";

import { performanceMonitor } from "@/lib/performance/monitor";
import { config } from "@/lib/config/environment";

/**
 * Centralized error monitoring system
 * Handles global error tracking, performance monitoring integration, and alerting
 */

export interface GlobalError {
  id: string;
  timestamp: number;
  type: "javascript" | "promise" | "network" | "custom";
  error: {
    name: string;
    message: string;
    stack?: string;
  };
  context: {
    url: string;
    userAgent: string;
    userId?: string;
    sessionId?: string;
    environment: string;
    version: string;
  };
  severity: "low" | "medium" | "high" | "critical";
  tags?: Record<string, string>;
}

export interface ErrorThreshold {
  type: "count" | "rate" | "unique";
  metric: string;
  threshold: number;
  window: number; // milliseconds
  severity: "medium" | "high" | "critical";
}

interface ThresholdAlert {
  timestamp: number;
  threshold: ErrorThreshold;
  currentValue: number;
  message: string;
}

class ErrorMonitoringSystem {
  private errors: GlobalError[] = [];
  private listeners: ((error: GlobalError) => void)[] = [];
  private thresholds: ErrorThreshold[] = [];
  private isInitialized = false;

  private readonly MAX_ERRORS = 500;
  private readonly DEFAULT_THRESHOLDS: ErrorThreshold[] = [
    {
      type: "count",
      metric: "javascript",
      threshold: 10,
      window: 60000, // 1 minute
      severity: "high",
    },
    {
      type: "rate",
      metric: "promise",
      threshold: 5,
      window: 30000, // 30 seconds
      severity: "critical",
    },
    {
      type: "unique",
      metric: "network",
      threshold: 3,
      window: 300000, // 5 minutes
      severity: "medium",
    },
  ];

  /**
   * Initialize global error monitoring
   */
  initialize(): void {
    if (this.isInitialized || typeof window === "undefined") {
      return;
    }

    this.setupGlobalErrorHandlers();
    this.setupDefaultThresholds();
    this.startPeriodicCleanup();

    this.isInitialized = true;
    console.log("[ErrorMonitoring] Global error monitoring initialized");
  }

  /**
   * Record a custom error
   */
  recordError(
    error: Error,
    type: "javascript" | "promise" | "network" | "custom" = "custom",
    severity: GlobalError["severity"] = "medium",
    tags?: Record<string, string>,
  ): string {
    const globalError: GlobalError = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      context: {
        url: window.location.href,
        userAgent: window.navigator.userAgent,
        environment: config.getConfig().env,
        version: config.getConfig().version,
      },
      severity,
      tags,
    };

    this.processError(globalError);
    return globalError.id;
  }

  /**
   * Add error listener
   */
  onError(callback: (error: GlobalError) => void): () => void {
    this.listeners.push(callback);

    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Get recent errors
   */
  getErrors(since?: number, type?: GlobalError["type"]): GlobalError[] {
    let filtered = this.errors;

    if (since) {
      filtered = filtered.filter((error) => error.timestamp >= since);
    }

    if (type) {
      filtered = filtered.filter((error) => error.type === type);
    }

    return [...filtered].sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get error statistics
   */
  getStatistics(windowMs = 300000): {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    rate: number; // errors per minute
    uniqueErrors: number;
    criticalErrors: GlobalError[];
  } {
    const since = Date.now() - windowMs;
    const recentErrors = this.getErrors(since);

    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const uniqueKeys = new Set<string>();

    recentErrors.forEach((error) => {
      byType[error.type] = (byType[error.type] ?? 0) + 1;
      bySeverity[error.severity] = (bySeverity[error.severity] ?? 0) + 1;

      const key = `${error.error.name}:${error.error.message}`;
      uniqueKeys.add(key);
    });

    const criticalErrors = recentErrors.filter(
      (error) => error.severity === "critical" || error.severity === "high",
    );

    return {
      total: recentErrors.length,
      byType,
      bySeverity,
      rate: (recentErrors.length / windowMs) * 60000, // errors per minute
      uniqueErrors: uniqueKeys.size,
      criticalErrors,
    };
  }

  /**
   * Clear errors (for testing/cleanup)
   */
  clearErrors(): void {
    this.errors = [];
  }

  /**
   * Configure error thresholds for alerting
   */
  setThresholds(thresholds: ErrorThreshold[]): void {
    this.thresholds = [...thresholds];
  }

  /**
   * Check if errors exceed thresholds
   */
  checkThresholds(): {
    threshold: ErrorThreshold;
    currentValue: number;
    exceeded: boolean;
  }[] {
    const results = [];

    for (const threshold of this.thresholds) {
      const currentValue = this.calculateThresholdValue(threshold);
      const exceeded = currentValue > threshold.threshold;

      results.push({
        threshold,
        currentValue,
        exceeded,
      });

      if (exceeded) {
        this.triggerThresholdAlert(threshold, currentValue);
      }
    }

    return results;
  }

  // Private methods

  private setupGlobalErrorHandlers(): void {
    // Global JavaScript errors
    window.addEventListener("error", (event) => {
      const error = new Error(event.message);
      error.name = "JavaScriptError";
      error.stack = `at ${event.filename}:${event.lineno}:${event.colno}`;

      this.recordError(error, "javascript", "high", {
        filename: event.filename,
        lineno: String(event.lineno),
        colno: String(event.colno),
      });
    });

    // Unhandled promise rejections
    window.addEventListener("unhandledrejection", (event) => {
      const error =
        event.reason instanceof Error
          ? event.reason
          : new Error(String(event.reason));

      error.name = "UnhandledPromiseRejection";

      this.recordError(error, "promise", "critical", {
        reason: String(event.reason),
      });
    });

    // Network errors (fetch failures)
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);

        // Track failed HTTP requests
        if (!response.ok) {
          const error = new Error(
            `HTTP ${response.status}: ${response.statusText}`,
          );
          error.name = "NetworkError";

          this.recordError(error, "network", "medium", {
            url:
              typeof args[0] === "string"
                ? args[0]
                : (args[0] as Request)?.url || "unknown",
            status: String(response.status),
            statusText: response.statusText,
          });
        }

        return response;
      } catch (networkError) {
        const error =
          networkError instanceof Error
            ? networkError
            : new Error(String(networkError));

        error.name = "NetworkError";

        this.recordError(error, "network", "high", {
          url:
            typeof args[0] === "string"
              ? args[0]
              : (args[0] as Request)?.url || "unknown",
        });

        throw networkError;
      }
    };
  }

  private setupDefaultThresholds(): void {
    this.thresholds = [...this.DEFAULT_THRESHOLDS];
  }

  private processError(error: GlobalError): void {
    // Add to storage
    this.errors.push(error);

    // Cleanup old errors if needed
    if (this.errors.length > this.MAX_ERRORS) {
      this.errors = this.errors.slice(-this.MAX_ERRORS);
    }

    // Record performance metric
    performanceMonitor.recordMetric({
      name: "global-error",
      value: 1,
      unit: "count",
      timestamp: error.timestamp,
      tags: {
        type: error.type,
        severity: error.severity,
        errorName: error.error.name,
        ...error.tags,
      },
    });

    // Notify listeners
    this.notifyListeners(error);

    // Log based on severity
    const logMethod = this.getLogMethod(error.severity);
    logMethod(`[ErrorMonitoring] ${error.type} error:`, {
      id: error.id,
      error: error.error,
      severity: error.severity,
      tags: error.tags,
    });

    // Check thresholds
    this.checkThresholds();
  }

  private notifyListeners(error: GlobalError): void {
    this.listeners.forEach((listener) => {
      try {
        listener(error);
      } catch (listenerError) {
        console.error("[ErrorMonitoring] Listener error:", listenerError);
      }
    });
  }

  private getLogMethod(severity: GlobalError["severity"]) {
    switch (severity) {
      case "critical":
      case "high":
        return console.error;
      case "medium":
        return console.warn;
      case "low":
      default:
        return console.log;
    }
  }

  private calculateThresholdValue(threshold: ErrorThreshold): number {
    const since = Date.now() - threshold.window;
    const recentErrors = this.getErrors(
      since,
      threshold.metric as GlobalError["type"],
    );

    switch (threshold.type) {
      case "count":
        return recentErrors.length;

      case "rate":
        return (recentErrors.length / threshold.window) * 60000; // per minute

      case "unique":
        const uniqueKeys = new Set(
          recentErrors.map(
            (error) => `${error.error.name}:${error.error.message}`,
          ),
        );
        return uniqueKeys.size;

      default:
        return 0;
    }
  }

  private triggerThresholdAlert(
    threshold: ErrorThreshold,
    currentValue: number,
  ): void {
    const alert = {
      timestamp: Date.now(),
      threshold,
      currentValue,
      message: `Error threshold exceeded: ${threshold.metric} ${threshold.type} is ${currentValue}, threshold is ${threshold.threshold}`,
    };

    // Record alert metric
    performanceMonitor.recordMetric({
      name: "error-threshold-exceeded",
      value: currentValue,
      unit: "count",
      timestamp: Date.now(),
      tags: {
        metric: threshold.metric,
        type: threshold.type,
        severity: threshold.severity,
      },
    });

    console.error("[ErrorMonitoring] Threshold alert:", alert);

    // In production, you might want to send alerts to external service
    if (config.getConfig().isProduction) {
      this.sendExternalAlert(alert).catch((err) => {
        console.error("[ErrorMonitoring] Failed to send external alert:", err);
      });
    }
  }

  private async sendExternalAlert(alert: ThresholdAlert): Promise<void> {
    // Implementation depends on your alerting service (Slack, PagerDuty, etc.)
    try {
      await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(alert),
      });
    } catch (error) {
      console.warn("[ErrorMonitoring] Alert sending failed:", error);
    }
  }

  private startPeriodicCleanup(): void {
    // Clean up old errors every 5 minutes
    setInterval(
      () => {
        const cutoff = Date.now() - 24 * 60 * 60 * 1000; // Keep last 24 hours
        this.errors = this.errors.filter((error) => error.timestamp >= cutoff);
      },
      5 * 60 * 1000,
    );
  }
}

// Global instance
export const errorMonitoring = new ErrorMonitoringSystem();

/**
 * Initialize error monitoring
 */
export function initializeErrorMonitoring(): void {
  errorMonitoring.initialize();
}

/**
 * React hook for error monitoring
 */
export function useErrorMonitoring() {
  // Note: This would need React import in a real implementation
  // For now, we'll provide the interface without React dependencies
  return {
    errors: errorMonitoring.getErrors(Date.now() - 300000),
    statistics: errorMonitoring.getStatistics(),
    recordError: errorMonitoring.recordError.bind(errorMonitoring),
    clearErrors: errorMonitoring.clearErrors.bind(errorMonitoring),
  };
}
