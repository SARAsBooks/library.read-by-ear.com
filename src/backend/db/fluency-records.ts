"use server";

import { db } from "@/backend/db";
import type { FluencyRecord } from "@/lib/types/fluency-record";
import { readerResponses } from "./schema";
import { eq, lte, sql } from "drizzle-orm";

export async function queryFluencyRecords(
  studentId: string,
): Promise<FluencyRecord[]> {
  const rankedResultsSubquery = db
    .select({
      studentId: readerResponses.studentId,
      word: readerResponses.word,
      response: readerResponses.response,
      timestamp: readerResponses.timestamp,
      // Use the sql template literal for the ROW_NUMBER window function
      rn: sql<number>`row_number() over (partition by ${readerResponses.word} order by ${readerResponses.timestamp} desc)`.as(
        "rn",
      ),
    })
    .from(readerResponses)
    .where(eq(readerResponses.studentId, studentId))
    .as("ranked_results"); // Alias the subquery

  const result = await db
    .select({
      studentId: rankedResultsSubquery.studentId,
      word: rankedResultsSubquery.word,
      response: rankedResultsSubquery.response,
      timestamp: rankedResultsSubquery.timestamp,
    })
    .from(rankedResultsSubquery) // Select *from* the aliased subquery
    .where(lte(rankedResultsSubquery.rn, 10)) // Filter using the 'rn' column from the subquery
    .orderBy(rankedResultsSubquery.word, rankedResultsSubquery.rn); // Order by word and rn

  return result;
}

export async function insertFluencyRecords(
  records: FluencyRecord[],
): Promise<void> {
  await db
    .insert(readerResponses)
    .values(records)
    .onConflictDoNothing()
    .catch((error) => {
      throw new Error(`Error inserting fluency records: ${error}`);
    });
}
