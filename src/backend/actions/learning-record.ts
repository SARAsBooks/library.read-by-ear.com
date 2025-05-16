"use server";

import type { LearningRecord } from "@/lib/types/learning-record";

export async function postLearningRecords(records: LearningRecord[]) {
  console.log("postLearningRecords:", records);
}
