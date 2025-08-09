// lib/offline/queue.ts
"use client";

import { v7 as uuidv7 } from "uuid";
import { networkManager } from "@/lib/performance/network";
import { performanceMonitor, measureSync } from "@/lib/performance/monitor";
import type { Session } from "@/lib/types/session";

/**
 * Offline action queueing system for handling mutations when offline
 * Provides retry logic, conflict resolution, and state synchronization
 */

export interface QueuedAction {
  id: string;
  type:
    | "fluency-record"
    | "session-update"
    | "library-action"
    | "convex-mutation";
  action: string; // Function/mutation name
  payload: unknown;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  priority: "low" | "normal" | "high" | "critical";
  studentId: string;
  dependencies?: string[]; // Other action IDs that must complete first
  conflictResolution: "merge" | "overwrite" | "skip" | "manual";
}

interface StoredQueueData {
  queue: QueuedAction[];
  completedActions: string[];
}

export interface QueueStats {
  pending: number;
  processing: number;
  failed: number;
  completed: number;
  totalSize: number; // bytes
}

export interface ConflictResolution {
  actionId: string;
  conflictType: "duplicate" | "outdated" | "dependency";
  resolution: "merged" | "skipped" | "failed" | "retried";
  details?: string;
}

class OfflineActionQueue {
  private queue: QueuedAction[] = [];
  private processing = new Set<string>();
  private completedActions = new Set<string>();
  private failedActions = new Map<string, Error>();
  private listeners: ((stats: QueueStats) => void)[] = [];
  private processingTimer: NodeJS.Timeout | null = null;
  private storageKey = "rbe.offline.queue";

  constructor() {
    if (typeof window !== "undefined") {
      this.loadFromStorage();
      this.startProcessing();
      this.setupNetworkListeners();
    }
  }

  /**
   * Add action to offline queue
   */
  enqueue(
    action: Omit<QueuedAction, "id" | "timestamp" | "retryCount">,
  ): string {
    const queuedAction: QueuedAction = {
      ...action,
      id: uuidv7(),
      timestamp: Date.now(),
      retryCount: 0,
    };

    // Check for duplicates based on action type and payload
    const existingAction = this.findDuplicateAction(queuedAction);
    if (existingAction) {
      return this.handleDuplicate(existingAction, queuedAction);
    }

    this.queue.push(queuedAction);
    this.sortQueueByPriority();
    this.saveToStorage();
    this.notifyListeners();

    console.log(
      `[OfflineQueue] Enqueued action: ${action.action}`,
      queuedAction.id,
    );

    performanceMonitor.recordMetric({
      name: "offline-queue-enqueue",
      value: this.queue.length,
      unit: "count",
      timestamp: Date.now(),
      tags: {
        action: action.action,
        priority: action.priority,
        type: action.type,
      },
    });

    return queuedAction.id;
  }

  /**
   * Remove action from queue
   */
  dequeue(actionId: string): boolean {
    const index = this.queue.findIndex((a) => a.id === actionId);
    if (index === -1) return false;

    this.queue.splice(index, 1);
    this.processing.delete(actionId);
    this.saveToStorage();
    this.notifyListeners();

    return true;
  }

  /**
   * Get current queue statistics
   */
  getStats(): QueueStats {
    const totalSize = this.estimateQueueSize();

    return {
      pending: this.queue.filter((a) => !this.processing.has(a.id)).length,
      processing: this.processing.size,
      failed: this.failedActions.size,
      completed: this.completedActions.size,
      totalSize,
    };
  }

  /**
   * Get actions by status
   */
  getActions(
    status?: "pending" | "processing" | "failed" | "completed",
  ): QueuedAction[] {
    switch (status) {
      case "pending":
        return this.queue.filter((a) => !this.processing.has(a.id));
      case "processing":
        return this.queue.filter((a) => this.processing.has(a.id));
      case "failed":
        return this.queue.filter((a) => this.failedActions.has(a.id));
      case "completed":
        return []; // Completed actions are removed from queue
      default:
        return [...this.queue];
    }
  }

  /**
   * Clear all actions (with optional filter)
   */
  clear(filter?: (action: QueuedAction) => boolean): number {
    const initialLength = this.queue.length;

    if (filter) {
      this.queue = this.queue.filter((action) => !filter(action));
    } else {
      this.queue = [];
      this.processing.clear();
      this.failedActions.clear();
      this.completedActions.clear();
    }

    this.saveToStorage();
    this.notifyListeners();

    return initialLength - this.queue.length;
  }

  /**
   * Retry failed actions
   */
  retryFailed(): void {
    const failedActionIds = Array.from(this.failedActions.keys());

    failedActionIds.forEach((actionId) => {
      const action = this.queue.find((a) => a.id === actionId);
      if (action) {
        action.retryCount = 0; // Reset retry count
        this.failedActions.delete(actionId);
      }
    });

    this.notifyListeners();
    console.log(
      `[OfflineQueue] Retrying ${failedActionIds.length} failed actions`,
    );
  }

  /**
   * Add listener for queue changes
   */
  addListener(callback: (stats: QueueStats) => void): () => void {
    this.listeners.push(callback);

    // Call immediately with current stats
    callback(this.getStats());

    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Start processing queue
   */
  private startProcessing(): void {
    if (this.processingTimer) return;

    this.processingTimer = setInterval(() => {
      this.processQueue().catch((error) => {
        console.error("[OfflineQueue] Processing error:", error);
      });
    }, 2000); // Process every 2 seconds
  }

  /**
   * Stop processing queue
   */
  stopProcessing(): void {
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = null;
    }
  }

  /**
   * Process queued actions
   */
  private async processQueue(): Promise<void> {
    if (!networkManager.getConnection().isOnline) {
      return; // Wait for network
    }

    const config = networkManager.getAdaptiveConfig();
    const maxConcurrent = Math.min(config.batchSize / 10, 5); // Limit concurrent processing

    const availableActions = this.queue.filter(
      (action) =>
        !this.processing.has(action.id) &&
        !this.failedActions.has(action.id) &&
        this.areDependenciesMet(action),
    );

    const actionsToProcess = availableActions
      .slice(0, maxConcurrent - this.processing.size)
      .filter(() => this.processing.size < maxConcurrent);

    if (actionsToProcess.length === 0) return;

    // Process actions concurrently
    const promises = actionsToProcess.map((action) =>
      this.processAction(action),
    );
    await Promise.allSettled(promises);
  }

  /**
   * Process individual action
   */
  private async processAction(action: QueuedAction): Promise<void> {
    this.processing.add(action.id);
    this.notifyListeners();

    console.log(
      `[OfflineQueue] Processing action: ${action.action}`,
      action.id,
    );

    try {
      await measureSync(async () => {
        switch (action.type) {
          case "fluency-record":
            await this.processFluencyRecord(action);
            break;
          case "session-update":
            await this.processSessionUpdate(action);
            break;
          case "convex-mutation":
            await this.processConvexMutation(action);
            break;
          default:
            throw new Error(`Unknown action type: ${action.type}`);
        }
      });

      // Success - remove from queue
      this.completeAction(action.id);
      console.log(
        `[OfflineQueue] Completed action: ${action.action}`,
        action.id,
      );
    } catch (error) {
      this.handleActionError(action, error as Error);
    }
  }

  /**
   * Process fluency record action
   */
  private async processFluencyRecord(action: QueuedAction): Promise<void> {
    // Import here to avoid circular dependencies
    const { convexLearningSync } = await import("@/lib/convex/sync");

    const payload = action.payload as {
      studentId: string;
      word: string;
      response: number;
      timestamp: number;
    };

    await convexLearningSync.addResponse(
      payload.studentId,
      payload.word,
      payload.response,
    );
  }

  /**
   * Process session update action
   */
  private async processSessionUpdate(action: QueuedAction): Promise<void> {
    // Import here to avoid circular dependencies
    const { updateSession } = await import("@/backend/actions/session");

    const payload = action.payload as Session;
    await updateSession(payload);
  }

  /**
   * Process Convex mutation action
   */
  private async processConvexMutation(action: QueuedAction): Promise<void> {
    // This would integrate with the Convex client to execute mutations
    // For now, we'll just log it
    console.log(
      `[OfflineQueue] Processing Convex mutation: ${action.action}`,
      action.payload,
    );
  }

  /**
   * Handle action completion
   */
  private completeAction(actionId: string): void {
    this.dequeue(actionId);
    this.completedActions.add(actionId);
    this.processing.delete(actionId);

    performanceMonitor.recordMetric({
      name: "offline-queue-complete",
      value: this.queue.length,
      unit: "count",
      timestamp: Date.now(),
      tags: { success: "true" },
    });
  }

  /**
   * Handle action error
   */
  private handleActionError(action: QueuedAction, error: Error): void {
    this.processing.delete(action.id);
    action.retryCount++;

    console.error(
      `[OfflineQueue] Action failed (${action.retryCount}/${action.maxRetries}):`,
      error,
    );

    if (action.retryCount >= action.maxRetries) {
      this.failedActions.set(action.id, error);

      performanceMonitor.recordMetric({
        name: "offline-queue-failed",
        value: action.retryCount,
        unit: "count",
        timestamp: Date.now(),
        tags: {
          action: action.action,
          error: error.constructor.name,
        },
      });
    } else {
      // Schedule retry with exponential backoff
      const backoffMs = Math.min(1000 * Math.pow(2, action.retryCount), 30000);

      setTimeout(() => {
        if (this.queue.find((a) => a.id === action.id)) {
          console.log(
            `[OfflineQueue] Retrying action: ${action.action}`,
            action.id,
          );
        }
      }, backoffMs);
    }

    this.notifyListeners();
  }

  /**
   * Check if action dependencies are met
   */
  private areDependenciesMet(action: QueuedAction): boolean {
    if (!action.dependencies) return true;

    return action.dependencies.every(
      (depId) =>
        this.completedActions.has(depId) ||
        !this.queue.find((a) => a.id === depId),
    );
  }

  /**
   * Find duplicate actions
   */
  private findDuplicateAction(action: QueuedAction): QueuedAction | null {
    return (
      this.queue.find(
        (existing) =>
          existing.type === action.type &&
          existing.action === action.action &&
          existing.studentId === action.studentId &&
          JSON.stringify(existing.payload) === JSON.stringify(action.payload),
      ) ?? null
    );
  }

  /**
   * Handle duplicate actions based on conflict resolution strategy
   */
  private handleDuplicate(
    existing: QueuedAction,
    newAction: QueuedAction,
  ): string {
    switch (newAction.conflictResolution) {
      case "skip":
        console.log(
          `[OfflineQueue] Skipping duplicate action: ${newAction.action}`,
        );
        return existing.id;

      case "overwrite":
        existing.payload = newAction.payload;
        existing.timestamp = newAction.timestamp;
        this.saveToStorage();
        return existing.id;

      case "merge":
        // Merge payloads if both are objects
        if (
          typeof existing.payload === "object" &&
          typeof newAction.payload === "object"
        ) {
          existing.payload = { ...existing.payload, ...newAction.payload };
          existing.timestamp = Math.max(
            existing.timestamp,
            newAction.timestamp,
          );
          this.saveToStorage();
          return existing.id;
        }
      // Fall through to overwrite if can't merge

      case "manual":
      default:
        // Add as new action for manual resolution
        this.queue.push({
          ...newAction,
          id: uuidv7(),
          timestamp: Date.now(),
          retryCount: 0,
        });
        this.saveToStorage();
        return newAction.id;
    }
  }

  /**
   * Sort queue by priority and timestamp
   */
  private sortQueueByPriority(): void {
    const priorityOrder = { critical: 4, high: 3, normal: 2, low: 1 };

    this.queue.sort((a, b) => {
      const priorityDiff =
        priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;

      return a.timestamp - b.timestamp; // Earlier timestamps first
    });
  }

  /**
   * Estimate queue size in bytes
   */
  private estimateQueueSize(): number {
    return this.queue.reduce((size, action) => {
      const actionJson = JSON.stringify(action);
      return size + actionJson.length * 2; // Rough UTF-16 byte estimate
    }, 0);
  }

  /**
   * Load queue from local storage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored) as StoredQueueData;
        this.queue = data.queue ?? [];
        this.completedActions = new Set(data.completedActions ?? []);
        console.log(
          `[OfflineQueue] Loaded ${this.queue.length} actions from storage`,
        );
      }
    } catch (error) {
      console.error("[OfflineQueue] Failed to load from storage:", error);
      this.queue = [];
    }
  }

  /**
   * Save queue to local storage
   */
  private saveToStorage(): void {
    try {
      const data = {
        queue: this.queue,
        completedActions: Array.from(this.completedActions),
        timestamp: Date.now(),
      };

      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error("[OfflineQueue] Failed to save to storage:", error);

      // If storage is full, try to clear old completed actions
      if (error instanceof Error && error.name === "QuotaExceededError") {
        this.completedActions.clear();
        try {
          const data = {
            queue: this.queue,
            completedActions: [],
            timestamp: Date.now(),
          };
          localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch {
          console.error("[OfflineQueue] Unable to save even after cleanup");
        }
      }
    }
  }

  /**
   * Setup network change listeners
   */
  private setupNetworkListeners(): void {
    networkManager.onOnlineChange((online) => {
      if (online) {
        console.log("[OfflineQueue] Network restored - resuming processing");
        this.retryFailed();
      } else {
        console.log("[OfflineQueue] Network lost - queueing actions for later");
      }
    });
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    const stats = this.getStats();
    this.listeners.forEach((callback) => {
      try {
        callback(stats);
      } catch (error) {
        console.error("[OfflineQueue] Listener error:", error);
      }
    });
  }
}

// Global instance
export const offlineQueue = new OfflineActionQueue();

/**
 * Queue fluency record for offline processing
 */
export function queueFluencyRecord(
  studentId: string,
  word: string,
  response: number,
  timestamp: Date = new Date(),
): string {
  return offlineQueue.enqueue({
    type: "fluency-record",
    action: "addFluencyRecord",
    payload: {
      studentId,
      word,
      response,
      timestamp: timestamp.getTime(),
    },
    priority: "high",
    studentId,
    maxRetries: 3,
    conflictResolution: "merge",
  });
}

/**
 * Queue session update for offline processing
 */
export function queueSessionUpdate(session: unknown): string {
  const studentId = (session as { studentId?: string })?.studentId ?? "unknown";

  return offlineQueue.enqueue({
    type: "session-update",
    action: "updateSession",
    payload: session,
    priority: "normal",
    studentId,
    maxRetries: 2,
    conflictResolution: "overwrite",
  });
}

/**
 * React hook for offline queue status
 */
export function useOfflineQueue(): {
  stats: QueueStats;
  isProcessing: boolean;
  hasFailedActions: boolean;
  retryFailed: () => void;
  clearQueue: () => void;
} {
  const stats = offlineQueue.getStats();

  return {
    stats,
    isProcessing: stats.processing > 0,
    hasFailedActions: stats.failed > 0,
    retryFailed: () => offlineQueue.retryFailed(),
    clearQueue: () => offlineQueue.clear(),
  };
}
