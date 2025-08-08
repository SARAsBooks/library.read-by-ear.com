import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { mergeRecords, getRecordKey } from "./mergeRecords";
import type { FluencyRecord } from "@/lib/types/fluency-record";

const recArb: fc.Arbitrary<FluencyRecord> = fc.record({
  studentId: fc.string({ minLength: 1, maxLength: 8 }),
  word: fc.string({ minLength: 1, maxLength: 8 }),
  response: fc.integer({ min: 0, max: 1 }),
  timestamp: fc.date(),
});

describe("mergeRecords (property-based)", () => {
  it("is idempotent: merging the same incoming twice yields same result", () => {
    fc.assert(
      fc.property(
        fc.array(recArb, { maxLength: 50 }),
        fc.array(recArb, { maxLength: 50 }),
        (existing: FluencyRecord[], incoming: FluencyRecord[]) => {
          const first = mergeRecords(existing, incoming);
          const second = mergeRecords(first.merged, incoming);
          expect(first.merged.map(getRecordKey)).toEqual(
            second.merged.map(getRecordKey),
          );
        },
      ),
    );
  });

  it("does not add duplicates: keys in merged are unique", () => {
    fc.assert(
      fc.property(
        fc.array(recArb, { maxLength: 50 }),
        fc.array(recArb, { maxLength: 50 }),
        (existing: FluencyRecord[], incoming: FluencyRecord[]) => {
          const { merged } = mergeRecords(existing, incoming);
          const keys = merged.map(getRecordKey);
          const unique = new Set(keys);
          expect(unique.size).toBe(keys.length);
        },
      ),
    );
  });
});
