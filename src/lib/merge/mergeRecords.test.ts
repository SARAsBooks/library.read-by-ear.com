import { describe, it, expect } from "vitest";
import { mergeRecords, getRecordKey } from "./mergeRecords";
import type { FluencyRecord } from "@/lib/types/fluency-record";

const r = (
  studentId: string,
  word: string,
  ts: number,
  response = 1,
): FluencyRecord => ({
  studentId,
  word,
  response,
  timestamp: new Date(ts),
});

describe("mergeRecords", () => {
  it("adds new records and skips duplicates deterministically", () => {
    const existing = [r("s1", "cat", 1), r("s1", "dog", 2)];
    const incoming = [r("s1", "cat", 1), r("s1", "bird", 3)];

    const { merged, added, skipped } = mergeRecords(existing, incoming);

    expect(added.map(getRecordKey)).toEqual([getRecordKey(r("s1", "bird", 3))]);
    expect(skipped.map(getRecordKey)).toEqual([
      getRecordKey(r("s1", "cat", 1)),
    ]);
    expect(merged.length).toBe(3);
  });

  it("is idempotent when applying the same incoming set repeatedly", () => {
    const existing = [r("s1", "cat", 1)];
    const incoming = [r("s1", "cat", 1), r("s1", "dog", 2)];

    const first = mergeRecords(existing, incoming);
    const second = mergeRecords(first.merged, incoming);

    expect(first.merged.map(getRecordKey)).toEqual(
      second.merged.map(getRecordKey),
    );
  });
});
