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

// === Types ===

export type FluencyState = {
  records: TrackedFluencyRecord[];
  isLoading: boolean;
  isHydrated: boolean;
  lastSyncTime: Date | null;
  error: string | null;
};

export type FluencyAction =
  | { type: "set_loading"; loading: boolean }
  | { type: "set_error"; error: string | null }
  | { type: "hydrate_from_dexie"; records: TrackedFluencyRecord[] }
  | { type: "hydrate_from_server"; records: FluencyRecord[] }
  | { type: "add_record"; record: TrackedFluencyRecord }
  | { type: "mark_as_synced"; records: TrackedFluencyRecord[] }
  | { type: "set_last_sync_time"; time: Date }
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

    case "reset":
      return {
        records: [],
        isLoading: false,
        isHydrated: false,
        lastSyncTime: null,
        error: null,
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
};

// === Context ===

const FluencyContext = createContext<
  { state: FluencyState; dispatch: Dispatch<FluencyAction> } | undefined
>(undefined);

// === Provider ===

export const FluencyProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(fluencyReducer, initialState);

  // Phase 1: Hydrate from Dexie on mount
  useEffect(() => {
    const loadFromDexie = async () => {
      try {
        dispatch({ type: "set_loading", loading: true });
        const records = await getAllTrackedRecords();
        dispatch({ type: "hydrate_from_dexie", records });
      } catch (error) {
        console.error("Failed to hydrate from Dexie:", error);
        dispatch({ type: "set_error", error: "Failed to load local data" });
      }
    };

    void loadFromDexie();
  }, []);

  // Phase 2: Hydrate from server after Dexie load completes
  useEffect(() => {
    if (!state.isHydrated) return;

    const loadFromServer = async () => {
      try {
        const studentId = session$.studentId.peek();
        if (!studentId) {
          console.log("No studentId found, skipping server hydration");
          return;
        }

        const serverRecords = await getFluencyRecords(studentId);
        if (serverRecords.length > 0) {
          // Merge records in Dexie (handles deduplication)
          await mergeRecordsFromServer(serverRecords);

          // Reload records from Dexie to get the updated state
          const updatedRecords = await getAllTrackedRecords();
          dispatch({ type: "hydrate_from_dexie", records: updatedRecords });

          console.log(`Hydrated ${serverRecords.length} records from server`);
        }
      } catch (error) {
        console.error("Failed to hydrate from server:", error);
        dispatch({ type: "set_error", error: "Failed to sync with server" });
      }
    };

    void loadFromServer();
  }, [state.isHydrated]);

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
 * Adds to both Dexie and context state.
 */
export const useAddFluencyRecord = () => {
  const { dispatch } = useFluency();

  const addRecord = async (record: FluencyRecord) => {
    try {
      // Add to Dexie first
      const id = await addTrackedRecord(record);

      if (id) {
        // Create the tracked record with the returned ID
        const trackedRecord: TrackedFluencyRecord = {
          ...record,
          id,
          origin: "local",
          synced: false,
        };

        // Update context state
        dispatch({ type: "add_record", record: trackedRecord });
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
