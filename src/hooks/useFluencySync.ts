"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import {
  useFluency,
  useUnsyncedRecords,
  useMarkRecordsAsSynced,
} from "./fluency-context";
import { postFluencyRecords } from "@/backend/sync";
import { useDebouncedCallback } from "./useDebouncedCallback";

/**
 * Custom hook for syncing fluency records with the server.
 * Provides manual sync, debounced auto-sync, and sync status.
 *
 * @param debounceDelay - Optional delay in ms for debounced sync (0 = no debounce)
 * @returns Sync interface with sync function, status, and timestamps
 */
export const useFluencySync = (debounceDelay = 0) => {
  const { state } = useFluency();
  const unsyncedRecords = useUnsyncedRecords();
  const markAsSynced = useMarkRecordsAsSynced();

  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);

  // Prevent overlapping sync operations
  const syncInProgress = useRef(false);

  // Core sync function that does the actual work
  const _syncNow = useCallback(async () => {
    // Guard against overlapping syncs
    if (syncInProgress.current || isSyncing) {
      console.log("Sync already in progress, skipping");
      return { success: false, reason: "already_syncing" };
    }

    // Check if there are records to sync
    if (unsyncedRecords.length === 0) {
      console.log("No unsynced records to sync");
      return { success: true, reason: "no_records" };
    }

    console.log(`Starting sync of ${unsyncedRecords.length} records`);
    setIsSyncing(true);
    setLastSyncError(null);
    syncInProgress.current = true;

    try {
      // Convert tracked records to plain FluencyRecords for server
      const recordsToSync = unsyncedRecords.map(
        ({ origin: _origin, synced: _synced, ...record }) => record,
      );

      // Send to server
      const success = await postFluencyRecords(recordsToSync);

      if (success) {
        // Mark records as synced in both Dexie and context
        await markAsSynced(unsyncedRecords);

        setLastSyncTime(new Date());
        console.log(`Successfully synced ${recordsToSync.length} records`);
        return { success: true, syncedCount: recordsToSync.length };
      } else {
        throw new Error("Server rejected the sync request");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown sync error";
      console.error("Sync failed:", errorMessage);
      setLastSyncError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsSyncing(false);
      syncInProgress.current = false;
    }
  }, [unsyncedRecords, markAsSynced, isSyncing]);

  // Always create debounced version, but with 0 delay if no debounce needed
  const debouncedSync = useDebouncedCallback(_syncNow, debounceDelay);
  const sync = debounceDelay > 0 ? debouncedSync : _syncNow;

  // Auto-sync on page load for existing unsynced records (run once after hydration)
  useEffect(() => {
    if (!state.isHydrated) return;

    const autoSyncOnLoad = () => {
      if (unsyncedRecords.length > 0) {
        console.log(
          `Auto-syncing ${unsyncedRecords.length} unsynced records on page load`,
        );
        void _syncNow();
      }
    };

    // Small delay to ensure components are mounted
    const timer = setTimeout(autoSyncOnLoad, 100);
    return () => clearTimeout(timer);
  }, [state.isHydrated, _syncNow, unsyncedRecords.length]);

  // Force sync function that bypasses debounce
  const forceSync = useCallback(async () => {
    if (
      debounceDelay > 0 &&
      (debouncedSync as typeof debouncedSync & { cancel: () => void }).cancel
    ) {
      (debouncedSync as typeof debouncedSync & { cancel: () => void }).cancel();
    }
    return await _syncNow();
  }, [_syncNow, debouncedSync, debounceDelay]);

  return {
    sync, // Main sync function (may be debounced)
    forceSync, // Immediate sync (bypasses debounce)
    isSyncing, // Current sync status
    lastSyncTime, // When last successful sync occurred
    lastSyncError, // Last sync error (null if no error)
    unsyncedCount: unsyncedRecords.length, // Number of unsynced records
    isHydrated: state.isHydrated, // Whether initial load is complete
  };
};

/**
 * Hook for debounced auto-sync based on unsynced record count changes.
 * Triggers sync automatically when unsynced records are added after a quiet period.
 *
 * @param delay - Debounce delay in milliseconds (default: 5000ms = 5 seconds)
 */
export const useAutoSync = (delay = 5000) => {
  const { sync, unsyncedCount, isHydrated } = useFluencySync(delay);

  // Trigger debounced sync when unsynced count changes (but not on initial hydration)
  const prevCountRef = useRef<number>(0);
  const hasInitializedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isHydrated) return;

    // Skip triggering on first hydration
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      prevCountRef.current = unsyncedCount;
      return;
    }

    // Only trigger if count increased (new records added)
    if (unsyncedCount > prevCountRef.current && unsyncedCount > 0) {
      console.log(`Auto-sync triggered: ${unsyncedCount} unsynced records`);
      void sync();
    }

    prevCountRef.current = unsyncedCount;
  }, [unsyncedCount, isHydrated, sync]);

  return {
    unsyncedCount,
    isHydrated,
    // Don't expose sync functions from auto-sync - use useFluencySync for manual control
  };
};
