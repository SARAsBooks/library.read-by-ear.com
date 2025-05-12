"use server";

import type { FluencyRecord } from "@/lib/types/fluency-record";
import type { Library } from "@/lib/types/library";
import {
  queryFluencyRecords,
  insertFluencyRecords,
} from "./db/fluency-records";
import { isSuccess, tryCatch } from "@/lib/util/try-catch";

export const postFluencyRecords = async (
  records: FluencyRecord[],
): Promise<boolean> => {
  console.log(`Sending ${records.length} fluency records to database`);
  const result = await tryCatch(insertFluencyRecords(records));
  if (isSuccess(result)) return true;
  return false;
};

export const getFluencyRecords = async (
  studentId: string,
): Promise<FluencyRecord[]> => {
  console.log(
    "Fetching fluency records from database for studentId:",
    studentId,
  );
  const records = await queryFluencyRecords(studentId);
  return records;
};

export const postLibrary = async (library: Library): Promise<boolean> => {
  console.log(
    "Sending library data to database for studentId:",
    library.studentId,
  );
  return true;
};

export const getLibrary = async (studentId: string): Promise<Library> => {
  console.log("Fetching library data from server for studentId:", studentId);
  return {
    studentId,
    bookmarks: [],
    library: [],
  };
};
