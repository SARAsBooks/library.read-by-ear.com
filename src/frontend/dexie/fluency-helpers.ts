"use client";

import type {
  ResponseId,
  FluencyRecord,
  TrackedFluencyRecord,
} from "@/lib/types/fluency-record";
import { fluencyRecordDB } from "./db";
import { mergeRecords, asRemoteTracked } from "@/lib/merge/mergeRecords";

/**
 * Adds a single item to the database.
 * @param item - The item to add.
 * @returns A Promise that resolves with the primary key of the added item.
 * @deprecated Use addTrackedRecord instead for new code.
 */
export async function addItemToDB(
  item: FluencyRecord,
): Promise<number | undefined> {
  // Convert to tracked record for backward compatibility
  const trackedItem: TrackedFluencyRecord = {
    ...item,
    origin: "local",
    synced: false,
  };
  return fluencyRecordDB.records.add(trackedItem).catch((error) => {
    console.error("Error adding item to DB:", error);
    return undefined; // Return undefined on error
  });
}

/**
 * Adds multiple items to the database in a single transaction (bulk add).
 * Useful for inserting data fetched from the server.
 * @param items - An array of items to add.
 * @returns A Promise that resolves when the operation is complete.
 */
export async function bulkAddItemsToDB(items: FluencyRecord[]): Promise<void> {
  // Convert to tracked records and mark as remote/synced (coming from server)
  const trackedItems: TrackedFluencyRecord[] = items.map((item) => ({
    ...item,
    origin: "remote" as const,
    synced: true,
  }));

  await fluencyRecordDB.records.bulkAdd(trackedItems).catch((error) => {
    console.error("Error adding items to DB:", error);
  });
  console.log(`Added ${items.length} items to the database.`);
}

/**
 * Clears all records from  the FluencyRecord table that match the given studentId
 * Useful before inserting fresh data from the server.
 * @param studentId - The user ID to filter by.
 * @returns A Promise that resolves when the table is cleared.
 */
export async function clearFluencyRecordsTableByStudentId(
  studentId: string,
): Promise<void> {
  await fluencyRecordDB.records
    .where("studentId")
    .equals(studentId)
    .delete()
    .then(() => {
      console.log(`Cleared records for studentId: ${studentId}`);
    })
    .catch((error) => {
      console.error(
        `Error clearing records for studentId ${studentId}:`,
        error,
      );
    });
}

/**
 * Clears all data from the FluencyRecord table.
 * Useful before inserting fresh data from the server.
 * @returns A Promise that resolves when the table is cleared.
 */
export async function clearFluencyRecordsTable(): Promise<void> {
  await fluencyRecordDB.records.clear().catch((error) => {
    console.error("Error clearing FluencyRecord table:", error);
  });
  console.log("Cleared FluencyRecord table.");
}

/**
 * Queries the n most recent entries for a given studentId and word,
 * and returns their 'response' property sorted oldest to newest.
 * @param studentId - The user ID to filter by.
 * @param word - The slug to filter by.
 * @param n - The number of most recent entries to retrieve.
 * @returns A Promise that resolves with an array of boolean responses, sorted oldest to newest.
 */
export async function getFluencyRecords(
  studentId: string,
  word: string,
  n: number,
): Promise<ResponseId[]> {
  if (n <= 0) {
    return [];
  }

  try {
    const recentItems = await fluencyRecordDB.records
      .where("[studentId+word]")
      .equals([studentId, word])
      .sortBy("timestamp") // Sorts by timestamp
      .then((items) => items.slice(-n)); // Get the last N items

    // Map to responses and reverse to get oldest to newest among the N
    const responsesOldestFirst = recentItems
      .map((item) => item.response)
      .flat()
      .reverse(); // Reverse again to get oldest to newest of the N

    return responsesOldestFirst;
  } catch (error) {
    console.error("Error querying recent responses:", error);
    return []; // Return empty array on error
  }
}

// === New Tracking Functions for React Hooks Integration ===

/**
 * Gets all tracked fluency records from the database.
 * @returns A Promise that resolves with an array of TrackedFluencyRecord.
 */
export async function getAllTrackedRecords(): Promise<TrackedFluencyRecord[]> {
  try {
    return await fluencyRecordDB.records.toArray();
  } catch (error) {
    console.error("Error getting all tracked records:", error);
    return [];
  }
}

/**
 * Gets all unsynced local records from the database.
 * @returns A Promise that resolves with an array of unsynced TrackedFluencyRecord.
 */
export async function getUnsyncedRecords(): Promise<TrackedFluencyRecord[]> {
  try {
    return await fluencyRecordDB.records
      .where({ origin: "local", synced: false })
      .toArray();
  } catch (error) {
    console.error("Error getting unsynced records:", error);
    return [];
  }
}

/**
 * Adds a single tracked record to the database with local origin and unsynced status.
 * @param record - The FluencyRecord to add (without tracking fields).
 * @returns A Promise that resolves with the primary key of the added item.
 */
export async function addTrackedRecord(
  record: FluencyRecord,
): Promise<number | undefined> {
  const trackedRecord: TrackedFluencyRecord = {
    ...record,
    origin: "local",
    synced: false,
  };

  return fluencyRecordDB.records.add(trackedRecord).catch((error) => {
    console.error("Error adding tracked record to DB:", error);
    return undefined;
  });
}

/**
 * Adds multiple tracked records to the database in a single transaction.
 * @param records - An array of FluencyRecord to add.
 * @param origin - The origin to assign to all records ("local" or "remote").
 * @param synced - The synced status to assign to all records.
 * @returns A Promise that resolves when the operation is complete.
 */
export async function bulkAddTrackedRecords(
  records: FluencyRecord[],
  origin: "local" | "remote" = "remote",
  synced = true,
): Promise<void> {
  const trackedRecords: TrackedFluencyRecord[] = records.map((record) => ({
    ...record,
    origin,
    synced,
  }));

  await fluencyRecordDB.records.bulkAdd(trackedRecords).catch((error) => {
    console.error("Error bulk adding tracked records to DB:", error);
  });
  console.log(`Added ${records.length} tracked records to the database.`);
}

/**
 * Marks the specified records as synced in the database.
 * @param records - The records to mark as synced.
 * @returns A Promise that resolves when the operation is complete.
 */
export async function markRecordsAsSynced(
  records: TrackedFluencyRecord[],
): Promise<void> {
  if (records.length === 0) return;

  try {
    await fluencyRecordDB.transaction(
      "rw",
      fluencyRecordDB.records,
      async () => {
        for (const record of records) {
          if (record.id) {
            await fluencyRecordDB.records.update(record.id, { synced: true });
          }
        }
      },
    );
    console.log(`Marked ${records.length} records as synced.`);
  } catch (error) {
    console.error("Error marking records as synced:", error);
  }
}

/**
 * Gets the count of unsynced local records.
 * @returns A Promise that resolves with the count of unsynced records.
 */
export async function getUnsyncedRecordCount(): Promise<number> {
  try {
    return await fluencyRecordDB.records
      .where({ origin: "local", synced: false })
      .count();
  } catch (error) {
    console.error("Error getting unsynced record count:", error);
    return 0;
  }
}

/**
 * Helper function to create a unique key for a fluency record.
 * Used for deduplication during server sync.
 * @param record - The fluency record.
 * @returns A unique string key.
 */
export function getRecordKey(record: FluencyRecord): string {
  return `${record.studentId}|${record.word}|${record.timestamp.getTime()}`;
}

/**
 * Merges server records with local records, avoiding duplicates.
 * @param serverRecords - Records fetched from the server.
 * @returns A Promise that resolves when the merge is complete.
 */
export async function mergeRecordsFromServer(
  serverRecords: FluencyRecord[],
): Promise<void> {
  if (serverRecords.length === 0) return;

  try {
    const existingRecords = await getAllTrackedRecords();
    const { added } = mergeRecords(existingRecords, serverRecords);
    if (added.length > 0) {
      await fluencyRecordDB.records.bulkAdd(asRemoteTracked(added));
      console.log(`Merged ${added.length} new records from server.`);
    } else {
      console.log("No new records to merge from server.");
    }
  } catch (error) {
    console.error("Error merging records from server:", error);
  }
}
