import type {
  FluencyRecord,
  TrackedFluencyRecord,
} from "@/lib/types/fluency-record";

// Create a stable key for deduplication
export const getRecordKey = (
  record: Pick<FluencyRecord, "studentId" | "word" | "timestamp">,
): string => `${record.studentId}|${record.word}|${record.timestamp.getTime()}`;

export type MergeResult<T extends FluencyRecord> = {
  merged: T[];
  added: T[];
  skipped: T[];
};

/**
 * Pure merge of existing and incoming records using getRecordKey equality.
 * Idempotent: re-applying the same incoming set yields the same merged output.
 */
export function mergeRecords<T extends FluencyRecord>(
  existing: T[],
  incoming: ReadonlyArray<FluencyRecord>,
): MergeResult<T | FluencyRecord> {
  const existingKeys = new Set(existing.map(getRecordKey));
  const added: FluencyRecord[] = [];
  const skipped: FluencyRecord[] = [];

  for (const rec of incoming) {
    if (existingKeys.has(getRecordKey(rec))) {
      skipped.push(rec);
    } else {
      existingKeys.add(getRecordKey(rec));
      added.push(rec);
    }
  }

  return {
    merged: (existing as (T | FluencyRecord)[]).concat(added),
    added,
    skipped,
  };
}

/**
 * Helper to initialize tracked flags for remote imports.
 */
export function asRemoteTracked(
  records: FluencyRecord[],
): TrackedFluencyRecord[] {
  return records.map((r) => ({
    ...r,
    origin: "remote" as const,
    synced: true,
  }));
}
