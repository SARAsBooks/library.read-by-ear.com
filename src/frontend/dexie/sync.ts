"use client";

import { postFluencyRecords, getFluencyRecords } from "@/backend/sync";
import { fluencyRecordDB } from "./db";
import { session$ } from "../observable/sessions";
import {
  bulkAddItemsToDB,
  clearFluencyRecordsTableByStudentId,
} from "./fluency-helpers";

/**
 * Sends an array of items to the server.
 * @param since - the time of the last sync.
 * @returns A Promise that resolves when the server confirms receipt (or rejects on error).
 */
export async function sendToServer(since: Date): Promise<boolean> {
  const records = await fluencyRecordDB.records
    .where("timestamp")
    .above(since)
    .toArray();

  if (records.length === 0) {
    return true;
  }

  return await postFluencyRecords(records);
}

/**
 * Fetches all items from the server.
 * @returns A Promise that resolves with a boolean indicating success.
 */
export async function syncFromServer(): Promise<boolean> {
  const studentId = session$.studentId.peek();
  if (!studentId) {
    console.error("No studentId found in session.");
    return false;
  }

  const records = await getFluencyRecords(studentId);

  if (records.length === 0) {
    console.log("No records found on server.");
    return false;
  }

  await clearFluencyRecordsTableByStudentId(studentId);
  await bulkAddItemsToDB(records);
  console.log(`Fetched ${records.length} records from server`);
  return true;
}
