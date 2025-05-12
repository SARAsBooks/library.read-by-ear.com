"use client";

import Dexie, { type EntityTable } from "dexie";
import type { FluencyRecord } from "@/lib/types/fluency-record";

const db = new Dexie("FluencyRecordsDexie") as Dexie & {
  records: EntityTable<FluencyRecord, "id">;
};

// Schema declaration:
db.version(1).stores({
  records: "++id, studentId, word, timestamp",
});

export default db;
