import { describe, it, expect } from "vitest";
import {
  fluencyReducer,
  initialState,
  type FluencyState,
} from "./fluency-context";
import type { TrackedFluencyRecord } from "@/lib/types/fluency-record";

const mkRecord = (id: number, synced: boolean): TrackedFluencyRecord => ({
  id,
  studentId: "s1",
  word: "cat",
  response: 1,
  timestamp: new Date(1_000 + id),
  origin: "local",
  synced,
});

describe("fluencyReducer", () => {
  it("hydrates from Dexie and marks as synced correctly", () => {
    const records = [mkRecord(1, false), mkRecord(2, false)];
    const hydrated = fluencyReducer(initialState, {
      type: "hydrate_from_dexie",
      records,
    });
    expect(hydrated.isHydrated).toBe(true);
    expect(hydrated.records.length).toBe(2);

    const toSync: TrackedFluencyRecord[] = [records[0]!];
    const afterSync = fluencyReducer(hydrated, {
      type: "mark_as_synced",
      records: toSync,
    });
    expect(afterSync.records[0]!.synced).toBe(true);
    expect(afterSync.records[1]!.synced).toBe(false);
  });

  it("adds a new record and sets lastSyncTime", () => {
    const base: FluencyState = {
      ...initialState,
      isLoading: false,
      isHydrated: true,
    };
    const added = fluencyReducer(base, {
      type: "add_record",
      record: mkRecord(3, false),
    });
    expect(added.records.length).toBe(1);

    const now = new Date();
    const afterTime = fluencyReducer(added, {
      type: "set_last_sync_time",
      time: now,
    });
    expect(afterTime.lastSyncTime).toEqual(now);
  });
});
