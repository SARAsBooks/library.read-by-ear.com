"use client";

import type { ResponseId, FluencyRecord } from "@/lib/types/fluency-record";
import { fluencyRecordDB } from "./db";

/**
 * Adds a single item to the database.
 * @param item - The item to add.
 * @returns A Promise that resolves with the primary key of the added item.
 */
export async function addItemToDB(
  item: FluencyRecord,
): Promise<number | undefined> {
  return fluencyRecordDB.records.add(item).catch((error) => {
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
  // Ensure timestamps are Date objects for all items
  await fluencyRecordDB.records.bulkAdd(items).catch((error) => {
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
