// lib/performance/network.ts
"use client";

import { performanceMonitor } from "./monitor";

// Use the global types from monitor.ts for consistency
declare global {
  interface Navigator {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  }

  interface NetworkInformation extends EventTarget {
    type?: string;
    effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
  }
}

/**
 * Network condition detection and adaptation utilities
 * Optimizes behavior based on connection quality and device capabilities
 */

export interface ConnectionInfo {
  type: "ethernet" | "wifi" | "cellular" | "unknown";
  effectiveType: "slow-2g" | "2g" | "3g" | "4g";
  downlink: number; // Mbps
  rtt: number; // ms
  saveData: boolean;
  isOnline: boolean;
}

export interface NetworkProfile {
  name: string;
  maxBatchSize: number;
  syncInterval: number; // ms
  enableBackgroundSync: boolean;
  enablePrefetching: boolean;
  enableOptimisticUpdates: boolean;
  cacheStrategy: "aggressive" | "conservative" | "minimal";
}

class NetworkManager {
  private currentConnection: ConnectionInfo | null = null;
  private connectionListeners: ((info: ConnectionInfo) => void)[] = [];
  private onlineListeners: ((online: boolean) => void)[] = [];
  private profiles: Record<string, NetworkProfile> = {};

  constructor() {
    if (typeof window !== "undefined") {
      this.initializeNetworkDetection();
      this.setupProfiles();
    }
  }

  /**
   * Initialize network detection and listeners
   */
  private initializeNetworkDetection(): void {
    // Initial connection check
    this.updateConnectionInfo();

    // Listen for online/offline events
    window.addEventListener("online", () => {
      console.log("[Network] Connection restored");
      this.updateConnectionInfo();
      this.notifyOnlineListeners(true);
    });

    window.addEventListener("offline", () => {
      console.log("[Network] Connection lost");
      this.updateConnectionInfo();
      this.notifyOnlineListeners(false);
    });

    // Listen for connection changes
    const connection =
      navigator.connection ??
      navigator.mozConnection ??
      navigator.webkitConnection;

    if (connection) {
      connection.addEventListener("change", () => {
        console.log("[Network] Connection changed");
        this.updateConnectionInfo();
      });
    }

    // Periodic connection quality checks
    setInterval(() => {
      this.updateConnectionInfo();
    }, 30000); // Every 30 seconds
  }

  /**
   * Setup network profiles for different connection types
   */
  private setupProfiles(): void {
    this.profiles = {
      "slow-2g": {
        name: "Slow 2G",
        maxBatchSize: 5,
        syncInterval: 60000, // 1 minute
        enableBackgroundSync: false,
        enablePrefetching: false,
        enableOptimisticUpdates: false,
        cacheStrategy: "minimal",
      },
      "2g": {
        name: "2G",
        maxBatchSize: 10,
        syncInterval: 45000, // 45 seconds
        enableBackgroundSync: false,
        enablePrefetching: false,
        enableOptimisticUpdates: true,
        cacheStrategy: "conservative",
      },
      "3g": {
        name: "3G",
        maxBatchSize: 25,
        syncInterval: 15000, // 15 seconds
        enableBackgroundSync: true,
        enablePrefetching: true,
        enableOptimisticUpdates: true,
        cacheStrategy: "conservative",
      },
      "4g": {
        name: "4G",
        maxBatchSize: 100,
        syncInterval: 5000, // 5 seconds
        enableBackgroundSync: true,
        enablePrefetching: true,
        enableOptimisticUpdates: true,
        cacheStrategy: "aggressive",
      },
      offline: {
        name: "Offline",
        maxBatchSize: 0,
        syncInterval: 0,
        enableBackgroundSync: false,
        enablePrefetching: false,
        enableOptimisticUpdates: true, // Enable for queue mode
        cacheStrategy: "minimal",
      },
    };
  }

  /**
   * Update current connection information
   */
  private updateConnectionInfo(): void {
    const nav = window.navigator;
    const connection =
      nav.connection ?? nav.mozConnection ?? nav.webkitConnection;

    const info: ConnectionInfo = {
      type: (connection?.type as ConnectionInfo["type"]) ?? "unknown",
      effectiveType: connection?.effectiveType ?? "4g",
      downlink: connection?.downlink ?? 10,
      rtt: connection?.rtt ?? 100,
      saveData: connection?.saveData ?? false,
      isOnline: nav.onLine ?? true,
    };

    // Update if changed
    if (
      !this.currentConnection ||
      !this.connectionsEqual(this.currentConnection, info)
    ) {
      const previousConnection = this.currentConnection;
      this.currentConnection = info;

      console.log("[Network] Connection updated:", info);

      // Record performance metric
      performanceMonitor.recordMetric({
        name: "network-change",
        value: this.networkScore(info),
        unit: "count",
        timestamp: Date.now(),
        tags: {
          effectiveType: info.effectiveType,
          wasOnline: String(previousConnection?.isOnline ?? true),
          nowOnline: String(info.isOnline),
        },
      });

      this.notifyConnectionListeners(info);
    }
  }

  /**
   * Get current connection information
   */
  getConnection(): ConnectionInfo {
    if (!this.currentConnection) {
      this.updateConnectionInfo();
    }
    return this.currentConnection!;
  }

  /**
   * Get network profile for current connection
   */
  getCurrentProfile(): NetworkProfile {
    const connection = this.getConnection();

    if (!connection.isOnline) {
      return this.profiles.offline!;
    }

    return this.profiles[connection.effectiveType] ?? this.profiles["4g"]!;
  }

  /**
   * Get adaptive configuration based on network conditions
   */
  getAdaptiveConfig(): {
    batchSize: number;
    syncInterval: number;
    enableRealTime: boolean;
    enableOptimisticUI: boolean;
    cacheStrategy: "aggressive" | "conservative" | "minimal";
  } {
    const profile = this.getCurrentProfile();
    const connection = this.getConnection();

    return {
      batchSize: profile.maxBatchSize,
      syncInterval: profile.syncInterval,
      enableRealTime: profile.enableBackgroundSync && connection.isOnline,
      enableOptimisticUI: profile.enableOptimisticUpdates,
      cacheStrategy: profile.cacheStrategy,
    };
  }

  /**
   * Check if network is good for heavy operations
   */
  isGoodForHeavyOperations(): boolean {
    const connection = this.getConnection();

    return (
      connection.isOnline &&
      connection.effectiveType === "4g" &&
      connection.downlink >= 2 && // At least 2 Mbps
      connection.rtt <= 200 && // Max 200ms RTT
      !connection.saveData
    );
  }

  /**
   * Check if should defer heavy operations
   */
  shouldDeferHeavyOperations(): boolean {
    const connection = this.getConnection();

    return (
      !connection.isOnline ||
      connection.effectiveType === "slow-2g" ||
      connection.effectiveType === "2g" ||
      connection.saveData ||
      (connection.effectiveType === "3g" && connection.rtt > 400)
    );
  }

  /**
   * Estimate operation duration based on data size
   */
  estimateTransferTime(bytes: number): number {
    const connection = this.getConnection();

    if (!connection.isOnline) return Infinity;

    // Add RTT for handshake + transfer time
    const transferTime = (bytes * 8) / (connection.downlink * 1000000); // Convert to seconds
    return connection.rtt + transferTime * 1000; // Return in milliseconds
  }

  /**
   * Add connection change listener
   */
  onConnectionChange(callback: (info: ConnectionInfo) => void): () => void {
    this.connectionListeners.push(callback);

    // Call immediately with current connection
    if (this.currentConnection) {
      callback(this.currentConnection);
    }

    return () => {
      const index = this.connectionListeners.indexOf(callback);
      if (index > -1) {
        this.connectionListeners.splice(index, 1);
      }
    };
  }

  /**
   * Add online/offline listener
   */
  onOnlineChange(callback: (online: boolean) => void): () => void {
    this.onlineListeners.push(callback);

    // Call immediately with current status
    const connection = this.getConnection();
    callback(connection.isOnline);

    return () => {
      const index = this.onlineListeners.indexOf(callback);
      if (index > -1) {
        this.onlineListeners.splice(index, 1);
      }
    };
  }

  /**
   * Test connection quality with a ping
   */
  async testConnectionQuality(): Promise<{
    latency: number;
    throughput: number; // bytes/ms
    quality: "poor" | "fair" | "good" | "excellent";
  }> {
    const startTime = performance.now();

    try {
      // Test with small request to our API
      const response = await fetch("/api/ping", {
        method: "HEAD",
        cache: "no-cache",
      });

      const latency = performance.now() - startTime;

      // Estimate throughput (very rough)
      const connection = this.getConnection();
      const throughput = (connection.downlink * 1000) / 8; // Convert Mbps to bytes/ms

      let quality: "poor" | "fair" | "good" | "excellent";
      if (latency > 1000 || !response.ok) {
        quality = "poor";
      } else if (latency > 500) {
        quality = "fair";
      } else if (latency > 200) {
        quality = "good";
      } else {
        quality = "excellent";
      }

      performanceMonitor.recordMetric({
        name: "connection-test",
        value: latency,
        unit: "ms",
        timestamp: Date.now(),
        tags: {
          quality,
          throughput: String(throughput),
        },
      });

      return { latency, throughput, quality };
    } catch (error) {
      console.warn("[Network] Connection test failed:", error);

      return {
        latency: Infinity,
        throughput: 0,
        quality: "poor",
      };
    }
  }

  /**
   * Notify connection change listeners
   */
  private notifyConnectionListeners(info: ConnectionInfo): void {
    this.connectionListeners.forEach((callback) => {
      try {
        callback(info);
      } catch (error) {
        console.error("[Network] Connection listener error:", error);
      }
    });
  }

  /**
   * Notify online/offline listeners
   */
  private notifyOnlineListeners(online: boolean): void {
    this.onlineListeners.forEach((callback) => {
      try {
        callback(online);
      } catch (error) {
        console.error("[Network] Online listener error:", error);
      }
    });
  }

  /**
   * Calculate numeric score for network quality
   */
  private networkScore(info: ConnectionInfo): number {
    if (!info.isOnline) return 0;

    const typeScore =
      {
        "slow-2g": 1,
        "2g": 2,
        "3g": 3,
        "4g": 4,
      }[info.effectiveType] ?? 4;

    // Factor in downlink and RTT
    const downlinkScore = Math.min(info.downlink, 10) / 10; // Normalize to 0-1
    const rttScore = Math.max(0, 1 - info.rtt / 1000); // Lower RTT is better

    return typeScore * downlinkScore * rttScore;
  }

  /**
   * Compare two connections for equality
   */
  private connectionsEqual(a: ConnectionInfo, b: ConnectionInfo): boolean {
    return (
      a.type === b.type &&
      a.effectiveType === b.effectiveType &&
      Math.abs(a.downlink - b.downlink) < 0.1 &&
      Math.abs(a.rtt - b.rtt) < 50 &&
      a.saveData === b.saveData &&
      a.isOnline === b.isOnline
    );
  }
}

// Global instance
export const networkManager = new NetworkManager();

/**
 * React hook for network information
 */
export function useNetworkInfo(): {
  connection: ConnectionInfo;
  profile: NetworkProfile;
  isOnline: boolean;
  isGoodConnection: boolean;
} {
  const connection = networkManager.getConnection();
  const profile = networkManager.getCurrentProfile();

  return {
    connection,
    profile,
    isOnline: connection.isOnline,
    isGoodConnection: networkManager.isGoodForHeavyOperations(),
  };
}

/**
 * Utility: Wait for good network conditions
 */
export function waitForGoodConnection(timeoutMs = 30000): Promise<boolean> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), timeoutMs);

    if (networkManager.isGoodForHeavyOperations()) {
      clearTimeout(timeout);
      resolve(true);
      return;
    }

    const unsubscribe = networkManager.onConnectionChange((_info) => {
      if (networkManager.isGoodForHeavyOperations()) {
        clearTimeout(timeout);
        unsubscribe();
        resolve(true);
      }
    });
  });
}

/**
 * Utility: Retry operation with backoff based on network conditions
 */
export async function retryWithNetworkBackoff<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries) break;

      const connection = networkManager.getConnection();
      const baseDelay =
        connection.effectiveType === "4g"
          ? 1000
          : connection.effectiveType === "3g"
            ? 2000
            : connection.effectiveType === "2g"
              ? 5000
              : 10000;

      const backoffDelay = baseDelay * Math.pow(2, attempt - 1);

      console.log(
        `[Network] Retrying operation in ${backoffDelay}ms (attempt ${attempt}/${maxRetries})`,
      );

      await new Promise((resolve) => setTimeout(resolve, backoffDelay));
    }
  }

  throw lastError!;
}
