import { describe, it, expect } from "vitest";
import { fluencyReducer, initialState } from "./fluency-context";
import type { TrackedFluencyRecord } from "@/lib/types/fluency-record";

const mk = (id: number): TrackedFluencyRecord => ({
  id,
  studentId: "s1",
  word: "cat",
  response: 1,
  timestamp: new Date(1_000 + id),
  origin: "remote",
  synced: true,
});

describe("fluencyReducer hydrate_from_server", () => {
  it("is a no-op when dedupe added nothing (handled in Dexie)", () => {
    const hydrated = fluencyReducer(initialState, {
      type: "hydrate_from_dexie",
      records: [mk(1), mk(2)],
    });
    const afterServer = fluencyReducer(hydrated, {
      type: "hydrate_from_server",
      records: [],
    });
    expect(afterServer.records).toEqual(hydrated.records);
    expect(afterServer.isHydrated).toBe(true);
  });
});
