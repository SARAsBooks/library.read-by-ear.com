"use client";

import React, {
  createContext,
  useReducer,
  useEffect,
  useContext,
  type ReactNode,
  type Dispatch,
} from "react";
import type {
  FluencyRecord,
  TrackedFluencyRecord,
} from "@/lib/types/fluency-record";
import {
  getAllTrackedRecords,
  mergeRecordsFromServer,
  addTrackedRecord,
  markRecordsAsSynced,
} from "@/frontend/dexie/fluency-helpers";
import { getFluencyRecords } from "@/backend/sync";
import { session$ } from "@/frontend/observable/sessions";
import { shouldUseConvex, convexLearningSync } from "@/lib/convex/sync";

// === Types ===

export type FluencyState = {
  records: TrackedFluencyRecord[];
  isLoading: boolean;
  isHydrated: boolean;
  lastSyncTime: Date | null;
  error: string | null;
  useConvex: boolean;
  convexSyncInProgress: boolean;
  fluencyLevels: Record<string, { level: string; responseCount: number }>;
};

export type FluencyAction =
  | { type: "set_loading"; loading: boolean }
  | { type: "set_error"; error: string | null }
  | { type: "hydrate_from_dexie"; records: TrackedFluencyRecord[] }
  | { type: "hydrate_from_server"; records: FluencyRecord[] }
  | { type: "hydrate_from_convex"; records: TrackedFluencyRecord[] }
  | { type: "add_record"; record: TrackedFluencyRecord }
  | { type: "mark_as_synced"; records: TrackedFluencyRecord[] }
  | { type: "set_last_sync_time"; time: Date }
  | { type: "set_use_convex"; useConvex: boolean }
  | { type: "set_convex_sync_progress"; inProgress: boolean }
  | {
      type: "update_fluency_levels";
      levels: Record<string, { level: string; responseCount: number }>;
    }
  | { type: "reset" };

// === Reducer ===

export function fluencyReducer(
  state: FluencyState,
  action: FluencyAction,
): FluencyState {
  switch (action.type) {
    case "set_loading":
      return { ...state, isLoading: action.loading };

    case "set_error":
      return { ...state, error: action.error };

    case "hydrate_from_dexie":
      return {
        ...state,
        records: action.records,
        isLoading: false,
        isHydrated: true,
        error: null,
      };

    case "hydrate_from_server":
      // Merge server records with existing records (deduplication handled in Dexie)
      // This action is dispatched after the merge happens in Dexie
      return {
        ...state,
        records: [...state.records],
        error: null,
      };

    case "hydrate_from_convex":
      return {
        ...state,
        records: action.records,
        isLoading: false,
        isHydrated: true,
        error: null,
      };

    case "add_record":
      return {
        ...state,
        records: [...state.records, action.record],
        error: null,
      };

    case "mark_as_synced":
      return {
        ...state,
        records: state.records.map((record) => {
          const shouldSync = action.records.some(
            (syncedRecord) =>
              record.id && syncedRecord.id && record.id === syncedRecord.id,
          );
          return shouldSync ? { ...record, synced: true } : record;
        }),
        error: null,
      };

    case "set_last_sync_time":
      return {
        ...state,
        lastSyncTime: action.time,
      };

    case "set_use_convex":
      return {
        ...state,
        useConvex: action.useConvex,
      };

    case "set_convex_sync_progress":
      return {
        ...state,
        convexSyncInProgress: action.inProgress,
      };

    case "update_fluency_levels":
      return {
        ...state,
        fluencyLevels: action.levels,
      };

    case "reset":
      return {
        records: [],
        isLoading: false,
        isHydrated: false,
        lastSyncTime: null,
        error: null,
        useConvex: false,
        convexSyncInProgress: false,
        fluencyLevels: {},
      };
  }
  // Exhaustiveness check if a new action is added and not handled above
  const _exhaustive: never = action;
  void _exhaustive;
  return state;
}

// === Initial State ===

export const initialState: FluencyState = {
  records: [],
  isLoading: true,
  isHydrated: false,
  lastSyncTime: null,
  error: null,
  useConvex: false,
  convexSyncInProgress: false,
  fluencyLevels: {},
};

// === Context ===

const FluencyContext = createContext<
  { state: FluencyState; dispatch: Dispatch<FluencyAction> } | undefined
>(undefined);

// === Provider ===

export const FluencyProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(fluencyReducer, initialState);

  // Phase 0: Check session settings for Convex usage
  useEffect(() => {
    const checkConvexUsage = () => {
      const session = session$.peek();
      const shouldUseConvexSync = shouldUseConvex(session);
      dispatch({ type: "set_use_convex", useConvex: shouldUseConvexSync });

      if (shouldUseConvexSync) {
        console.log("Fluency context will use Convex sync");
      } else {
        console.log("Fluency context will use legacy Dexie + server sync");
      }
    };

    checkConvexUsage();

    // Listen for session changes that might affect Convex usage
    const unsubscribe = session$.onChange(checkConvexUsage);
    return unsubscribe;
  }, []);

  // Phase 1: Hydrate from appropriate source based on feature flag
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        dispatch({ type: "set_loading", loading: true });

        if (state.useConvex) {
          // Load from Convex for real-time sync
          const studentId = session$.studentId.peek();
          if (studentId) {
            console.log("Loading fluency records from Convex");
            const convexRecords =
              await convexLearningSync.getRecords(studentId);
            dispatch({ type: "hydrate_from_convex", records: convexRecords });

            // Also load fluency levels for immediate UI updates
            const fluencyLevels =
              await convexLearningSync.getFluencyLevels(studentId);
            if (fluencyLevels) {
              dispatch({
                type: "update_fluency_levels",
                levels: fluencyLevels,
              });
            }
          } else {
            console.log("No studentId for Convex sync, falling back to Dexie");
            const records = await getAllTrackedRecords();
            dispatch({ type: "hydrate_from_dexie", records });
          }
        } else {
          // Load from Dexie (existing behavior)
          console.log("Loading fluency records from Dexie");
          const records = await getAllTrackedRecords();
          dispatch({ type: "hydrate_from_dexie", records });
        }
      } catch (error) {
        console.error("Failed to hydrate fluency data:", error);
        dispatch({ type: "set_error", error: "Failed to load learning data" });
      }
    };

    void loadInitialData();
  }, [state.useConvex]); // Re-run when Convex usage changes

  // Phase 2: Additional sync after initial hydration (legacy server sync for non-Convex mode)
  useEffect(() => {
    if (!state.isHydrated || state.useConvex) return; // Skip if using Convex

    const loadFromServer = async () => {
      try {
        const studentId = session$.studentId.peek();
        if (!studentId) {
          console.log("No studentId found, skipping server hydration");
          return;
        }

        console.log("Performing legacy server sync for fluency records");
        const serverRecords = await getFluencyRecords(studentId);
        if (serverRecords.length > 0) {
          // Merge records in Dexie (handles deduplication)
          await mergeRecordsFromServer(serverRecords);

          // Reload records from Dexie to get the updated state
          const updatedRecords = await getAllTrackedRecords();
          dispatch({ type: "hydrate_from_dexie", records: updatedRecords });

          console.log(
            `Hydrated ${serverRecords.length} records from legacy server`,
          );
        }
      } catch (error) {
        console.error("Failed to hydrate from server:", error);
        dispatch({ type: "set_error", error: "Failed to sync with server" });
      }
    };

    void loadFromServer();
  }, [state.isHydrated, state.useConvex]);

  return (
    <FluencyContext.Provider value={{ state, dispatch }}>
      {children}
    </FluencyContext.Provider>
  );
};

// === Hook ===

export const useFluency = () => {
  const context = useContext(FluencyContext);
  if (!context) {
    throw new Error("useFluency must be used within a FluencyProvider");
  }
  return context;
};

// === Utility Hooks ===

/**
 * Hook to add a new fluency record.
 * Uses Convex or Dexie depending on feature flag.
 */
export const useAddFluencyRecord = () => {
  const { state, dispatch } = useFluency();

  const addRecord = async (record: FluencyRecord) => {
    try {
      if (state.useConvex) {
        // Add to Convex with optimistic update
        const studentId = session$.studentId.peek();
        if (!studentId) {
          console.error("No studentId for Convex learning record");
          return;
        }

        console.log("Adding fluency record via Convex:", record);

        // Optimistic update to context state
        const optimisticRecord: TrackedFluencyRecord = {
          ...record,
          origin: "local",
          synced: false, // Will be set to true after successful Convex sync
        };
        dispatch({ type: "add_record", record: optimisticRecord });

        // Add to Convex
        const success = await convexLearningSync.addResponse(
          studentId,
          record.word,
          record.response,
        );

        if (success) {
          console.log("Successfully added fluency record to Convex");
          // Update fluency levels after successful add
          const fluencyLevels =
            await convexLearningSync.getFluencyLevels(studentId);
          if (fluencyLevels) {
            dispatch({ type: "update_fluency_levels", levels: fluencyLevels });
          }
        } else {
          console.error("Failed to add fluency record to Convex");
          dispatch({
            type: "set_error",
            error: "Failed to sync learning response",
          });
        }
      } else {
        // Legacy Dexie approach
        console.log("Adding fluency record via Dexie:", record);

        const id = await addTrackedRecord(record);
        if (id) {
          const trackedRecord: TrackedFluencyRecord = {
            ...record,
            id,
            origin: "local",
            synced: false,
          };
          dispatch({ type: "add_record", record: trackedRecord });
        }
      }
    } catch (error) {
      console.error("Failed to add fluency record:", error);
      dispatch({ type: "set_error", error: "Failed to add record" });
    }
  };

  return addRecord;
};

/**
 * Hook to get unsynced records from current state.
 */
export const useUnsyncedRecords = () => {
  const { state } = useFluency();
  return state.records.filter(
    (record) => record.origin === "local" && !record.synced,
  );
};

/**
 * Hook to mark records as synced.
 * Updates both Dexie and context state.
 */
export const useMarkRecordsAsSynced = () => {
  const { dispatch } = useFluency();

  const markAsSynced = async (records: TrackedFluencyRecord[]) => {
    try {
      // Update Dexie first
      await markRecordsAsSynced(records);

      // Update context state
      dispatch({ type: "mark_as_synced", records });
      dispatch({ type: "set_last_sync_time", time: new Date() });
    } catch (error) {
      console.error("Failed to mark records as synced:", error);
      dispatch({ type: "set_error", error: "Failed to update sync status" });
    }
  };

  return markAsSynced;
};

/**
 * Hook to sync Dexie records to Convex (for migration).
 */
export const useSyncToConvex = () => {
  const { state, dispatch } = useFluency();

  const syncToConvex = async (): Promise<{
    success: boolean;
    recordsProcessed: number;
    wordsUpdated: number;
  }> => {
    if (!state.useConvex) {
      console.log("Convex sync not enabled");
      return { success: false, recordsProcessed: 0, wordsUpdated: 0 };
    }

    try {
      dispatch({ type: "set_convex_sync_progress", inProgress: true });

      const studentId = session$.studentId.peek();
      if (!studentId) {
        console.error("No studentId for Convex sync");
        return { success: false, recordsProcessed: 0, wordsUpdated: 0 };
      }

      // Get all Dexie records for migration
      const dexieRecords = await getAllTrackedRecords();
      console.log(
        `Starting migration of ${dexieRecords.length} Dexie records to Convex`,
      );

      const result = await convexLearningSync.syncFromDexie(
        studentId,
        dexieRecords,
      );

      if (result.success) {
        console.log(
          `Migration complete: ${result.recordsProcessed} records processed, ${result.wordsUpdated} words updated`,
        );

        // Reload from Convex to get the updated state
        const convexRecords = await convexLearningSync.getRecords(studentId);
        dispatch({ type: "hydrate_from_convex", records: convexRecords });

        // Update fluency levels
        const fluencyLevels =
          await convexLearningSync.getFluencyLevels(studentId);
        if (fluencyLevels) {
          dispatch({ type: "update_fluency_levels", levels: fluencyLevels });
        }

        dispatch({ type: "set_last_sync_time", time: new Date() });
      }

      return result;
    } catch (error) {
      console.error("Failed to sync to Convex:", error);
      dispatch({
        type: "set_error",
        error: "Failed to migrate to real-time sync",
      });
      return { success: false, recordsProcessed: 0, wordsUpdated: 0 };
    } finally {
      dispatch({ type: "set_convex_sync_progress", inProgress: false });
    }
  };

  return syncToConvex;
};

/**
 * Hook to get fluency level for a specific word.
 */
export const useWordFluency = (word: string) => {
  const { state } = useFluency();

  // Return fluency level from state if available
  const fluencyInfo = state.fluencyLevels[word];
  return fluencyInfo ?? { level: "Unknown", responseCount: 0 };
};

/**
 * Hook to refresh fluency levels from Convex.
 */
export const useRefreshFluencyLevels = () => {
  const { state, dispatch } = useFluency();

  const refreshLevels = async () => {
    if (!state.useConvex) return;

    try {
      const studentId = session$.studentId.peek();
      if (!studentId) return;

      const fluencyLevels =
        await convexLearningSync.getFluencyLevels(studentId);
      if (fluencyLevels) {
        dispatch({ type: "update_fluency_levels", levels: fluencyLevels });
      }
    } catch (error) {
      console.error("Failed to refresh fluency levels:", error);
    }
  };

  return refreshLevels;
};
